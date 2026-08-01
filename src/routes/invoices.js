/**
 * src/routes/invoices.js — InsuranceInvoice route handlers
 *
 * Handles all /invoices/* requests using WinterTC Web standard APIs.
 *
 * Routes:
 *   GET    /invoices                  — list (filters: premiumId, contractId, status, invoiceNumber)
 *   POST   /invoices                  — create (invoiceNumber auto-assigned if absent)
 *   GET    /invoices/:id              — get by @id
 *   PATCH  /invoices/:id              — merge-patch
 *   DELETE /invoices/:id              — delete → 204
 *   POST   /invoices/validate         — validate without storing
 */

import { getPlugin } from '../plugins/registry.js';

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

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * Route all /invoices/* requests to the appropriate handler.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function invoicesHandler(request) {
  const storage   = getPlugin('storage');
  const validator = getPlugin('validator');

  const url    = new URL(request.url);
  const method = request.method.toUpperCase();
  const full   = url.pathname.replace(/\/$/, '');
  const sub    = full.replace(/^\/invoices/, '') || '/';

  // ── POST /invoices/validate ───────────────────────────────────────────────
  if (method === 'POST' && sub === '/validate') {
    const body = await parseBody(request);
    const { data } = body ?? {};
    if (!data) return json({ error: '"data" field is required.' }, { status: 400 });
    return json(validator.validateInvoice(data));
  }

  // ── GET /invoices ─────────────────────────────────────────────────────────
  if (method === 'GET' && sub === '/') {
    const q = url.searchParams;
    const filters = {};
    if (q.get('premiumId'))     filters.premiumId     = q.get('premiumId');
    if (q.get('contractId'))    filters.contractId    = q.get('contractId');
    if (q.get('status'))        filters.status        = q.get('status');
    if (q.get('invoiceNumber')) filters.invoiceNumber = q.get('invoiceNumber');
    return json(await storage.queryInvoices(filters));
  }

  // ── POST /invoices ────────────────────────────────────────────────────────
  if (method === 'POST' && sub === '/') {
    const invoice = await parseBody(request);
    if (!invoice || typeof invoice !== 'object' || Array.isArray(invoice)) {
      return json({ error: 'Request body must be a JSON-LD InsuranceInvoice object.' }, { status: 400 });
    }
    if (!invoice['@id'])      invoice['@id']      = `urn:uuid:${crypto.randomUUID()}`;
    if (!invoice['@context']) invoice['@context'] = 'https://schema.org';
    if (!invoice['@type'])    invoice['@type']    = 'InsuranceInvoice';
    if (!invoice.status)      invoice.status      = 'draft';

    const { valid, errors, suggestions } = validator.validateInvoice(invoice);
    if (!valid) return json({ valid: false, errors, suggestions }, { status: 422 });

    // invoiceNumber is auto-assigned by storage.createInvoice when absent
    return json(await storage.createInvoice(invoice), { status: 201 });
  }

  // ── /invoices/:id routes ──────────────────────────────────────────────────
  const idMatch = sub.match(/^\/(.+)$/);
  if (idMatch) {
    const id = decodeURIComponent(idMatch[1]);

    if (method === 'GET') {
      const invoice = await storage.getInvoiceById(id);
      if (!invoice) return json({ error: 'InsuranceInvoice not found.' }, { status: 404 });
      return json(invoice);
    }

    if (method === 'PATCH') {
      const existing = await storage.getInvoiceById(id);
      if (!existing) return json({ error: 'InsuranceInvoice not found.' }, { status: 404 });

      const patch = await parseBody(request);
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        return json({ error: 'Request body must be a JSON patch object.' }, { status: 400 });
      }

      const merged = { ...existing, ...patch, '@id': id };
      const { valid, errors, suggestions } = validator.validateInvoice(merged);
      if (!valid) return json({ valid: false, errors, suggestions }, { status: 422 });

      const updated = await storage.updateInvoice(id, merged);
      if (!updated) return json({ error: 'InsuranceInvoice not found.' }, { status: 404 });
      return json(updated);
    }

    if (method === 'DELETE') {
      const deleted = await storage.deleteInvoice(id);
      if (!deleted) return json({ error: 'InsuranceInvoice not found.' }, { status: 404 });
      return new Response(null, { status: 204 });
    }
  }

  return json({ error: 'Not found.' }, { status: 404 });
}
