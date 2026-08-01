/**
 * src/routes/payments.js — PaymentRecord route handlers
 *
 * Handles all /payments/* requests using WinterTC Web standard APIs.
 *
 * Routes:
 *   GET    /payments                  — list (filters: status, invoiceId, paymentDateFrom, paymentDateTo)
 *   POST   /payments                  — create
 *   GET    /payments/:id              — get by @id
 *   PATCH  /payments/:id              — merge-patch
 *   DELETE /payments/:id              — delete → 204
 *   POST   /payments/validate         — validate without storing
 *   POST   /payments/:id/match        — trigger clearing / Ausziffern for a single payment
 */

import { getPlugin } from '../plugins/registry.js';
import { matchPaymentToInvoice } from '../matching.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function json(data, { status = 200 } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function parseBody(request) {
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try { return await request.json(); } catch { return null; }
  }
  return null;
}

// ─── Clearing helper ──────────────────────────────────────────────────────────

/**
 * Run the multi-stage matching algorithm for a single PaymentRecord.
 * Applies all side-effects (status updates on payment, invoice, premium)
 * and returns a summary of the clearing result.
 *
 * @param {object} storage   — IStoragePlugin
 * @param {object} payment   — PaymentRecord JSON-LD
 * @returns {Promise<object>} clearing result summary
 */
async function runMatching(storage, payment) {
  const openInvoices = await storage.getOpenInvoices();
  const result = matchPaymentToInvoice(payment, openInvoices);

  if (!result) {
    // Stage 4: escalate
    const escalated = { ...payment, status: 'escalated' };
    await storage.updatePayment(payment['@id'], escalated);
    return { outcome: 'escalated', paymentId: payment['@id'] };
  }

  const { matchType, confidence, invoiceId, matchedAmount, remainingAmount, overpaidAmount } = result;

  // Update the matched invoice
  const invoice = await storage.getInvoiceById(invoiceId);
  let newInvoiceStatus;
  let updatedInvoice;

  if (matchType === 'exact') {
    newInvoiceStatus = 'paid';
    updatedInvoice = { ...invoice, status: newInvoiceStatus, minimumPaymentDue: '0.00' };
  } else if (matchType === 'partial') {
    newInvoiceStatus = 'partially_paid';
    updatedInvoice = { ...invoice, status: newInvoiceStatus, minimumPaymentDue: remainingAmount };
  } else {
    // overpayment
    newInvoiceStatus = 'overpaid';
    updatedInvoice = { ...invoice, status: newInvoiceStatus, minimumPaymentDue: '0.00' };
  }
  await storage.updateInvoice(invoiceId, updatedInvoice);

  // If invoice is fully paid, mark linked premium as paid too
  if (newInvoiceStatus === 'paid' && invoice.premiumId) {
    const premium = await storage.getPremiumById(invoice.premiumId);
    if (premium && premium.status !== 'paid') {
      await storage.updatePremium(invoice.premiumId, { ...premium, status: 'paid' });
    }
  }

  // Update payment
  const newPaymentStatus = matchType === 'partial' ? 'partially_matched' : 'matched';
  const updatedPayment = {
    ...payment,
    status: newPaymentStatus,
    invoiceId,
    matchedAmount,
    matchConfidence: confidence,
    ...(remainingAmount !== undefined && { unmatchedAmount: remainingAmount }),
  };
  await storage.updatePayment(payment['@id'], updatedPayment);

  return {
    outcome: matchType,
    confidence,
    paymentId: payment['@id'],
    invoiceId,
    matchedAmount,
    ...(remainingAmount !== undefined && { remainingAmount }),
    ...(overpaidAmount !== undefined && { overpaidAmount }),
    invoiceStatus: newInvoiceStatus,
    paymentStatus: newPaymentStatus,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * Route all /payments/* requests to the appropriate handler.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function paymentsHandler(request) {
  const storage   = getPlugin('storage');
  const validator = getPlugin('validator');

  const url    = new URL(request.url);
  const method = request.method.toUpperCase();
  const full   = url.pathname.replace(/\/$/, '');
  const sub    = full.replace(/^\/payments/, '') || '/';

  // ── POST /payments/validate ───────────────────────────────────────────────
  if (method === 'POST' && sub === '/validate') {
    const body = await parseBody(request);
    const { data } = body ?? {};
    if (!data) return json({ error: '"data" field is required.' }, { status: 400 });
    return json(validator.validatePayment(data));
  }

  // ── GET /payments ─────────────────────────────────────────────────────────
  if (method === 'GET' && sub === '/') {
    const q = url.searchParams;
    const filters = {};
    if (q.get('status'))          filters.status          = q.get('status');
    if (q.get('invoiceId'))       filters.invoiceId       = q.get('invoiceId');
    if (q.get('paymentDateFrom')) filters.paymentDateFrom = q.get('paymentDateFrom');
    if (q.get('paymentDateTo'))   filters.paymentDateTo   = q.get('paymentDateTo');
    return json(await storage.queryPayments(filters));
  }

  // ── POST /payments ────────────────────────────────────────────────────────
  if (method === 'POST' && sub === '/') {
    const payment = await parseBody(request);
    if (!payment || typeof payment !== 'object' || Array.isArray(payment)) {
      return json({ error: 'Request body must be a JSON-LD PaymentRecord object.' }, { status: 400 });
    }
    if (!payment['@id'])      payment['@id']      = `urn:uuid:${crypto.randomUUID()}`;
    if (!payment['@context']) payment['@context'] = 'https://schema.org';
    if (!payment['@type'])    payment['@type']    = 'PaymentRecord';
    if (!payment.status)      payment.status      = 'received';

    const { valid, errors, suggestions } = validator.validatePayment(payment);
    if (!valid) return json({ valid: false, errors, suggestions }, { status: 422 });

    return json(await storage.createPayment(payment), { status: 201 });
  }

  // ── /payments/:id/match ───────────────────────────────────────────────────
  const matchRoute = sub.match(/^\/([^/]+)\/match$/);
  if (matchRoute && method === 'POST') {
    const id = decodeURIComponent(matchRoute[1]);
    const payment = await storage.getPaymentById(id);
    if (!payment) return json({ error: 'PaymentRecord not found.' }, { status: 404 });

    if (['matched', 'partially_matched'].includes(payment.status)) {
      return json({ error: 'Payment is already matched.', status: payment.status }, { status: 409 });
    }

    const clearingResult = await runMatching(storage, payment);
    return json(clearingResult);
  }

  // ── /payments/:id routes ──────────────────────────────────────────────────
  const idMatch = sub.match(/^\/(.+)$/);
  if (idMatch) {
    const id = decodeURIComponent(idMatch[1]);

    if (method === 'GET') {
      const payment = await storage.getPaymentById(id);
      if (!payment) return json({ error: 'PaymentRecord not found.' }, { status: 404 });
      return json(payment);
    }

    if (method === 'PATCH') {
      const existing = await storage.getPaymentById(id);
      if (!existing) return json({ error: 'PaymentRecord not found.' }, { status: 404 });

      const patch = await parseBody(request);
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        return json({ error: 'Request body must be a JSON patch object.' }, { status: 400 });
      }

      const merged = { ...existing, ...patch, '@id': id };
      const { valid, errors, suggestions } = validator.validatePayment(merged);
      if (!valid) return json({ valid: false, errors, suggestions }, { status: 422 });

      const updated = await storage.updatePayment(id, merged);
      if (!updated) return json({ error: 'PaymentRecord not found.' }, { status: 404 });
      return json(updated);
    }

    if (method === 'DELETE') {
      const deleted = await storage.deletePayment(id);
      if (!deleted) return json({ error: 'PaymentRecord not found.' }, { status: 404 });
      return new Response(null, { status: 204 });
    }
  }

  return json({ error: 'Not found.' }, { status: 404 });
}
