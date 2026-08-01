/**
 * src/matching.js — Payment-to-Invoice clearing / Ausziffern
 *
 * Implements the multi-stage matching logic described in the process spec:
 *
 *  Stage 1 — Exact reference match:
 *    Look for the invoiceNumber (or premiumId) inside the payment's
 *    transactionReference. If found AND amounts agree, auto-match 100%.
 *
 *  Stage 2 — Fuzzy match (fallback when no reference is found):
 *    Compare the sender name with the insuredParty name on the invoice AND
 *    the payment amount with the open invoice balance within a ±14-day
 *    window around paymentDueDate.
 *
 *  Stage 3 — Difference handling (partial / over-payment):
 *    Underpayment  → invoice: partially_paid, remaining balance stays open.
 *    Full payment  → invoice: paid.
 *    Overpayment   → invoice: overpaid, credit-note workflow is flagged.
 *
 *  Stage 4 — Escalation:
 *    All stages failed → payment: escalated (manual clearing queue).
 *
 * Pure logic — no runtime-specific APIs, no I/O.
 */

// ─── Amount helpers ───────────────────────────────────────────────────────────

/**
 * Parse an amount string such as "EUR 1200.00" or "1200.00 EUR".
 *
 * @param {string|undefined} amountStr
 * @returns {{ currency: string, value: number }|null}
 */
export function parseAmount(amountStr) {
  if (!amountStr || typeof amountStr !== 'string') return null;
  const m = amountStr.match(/([A-Z]{3})\s*([\d.,]+)|([\d.,]+)\s*([A-Z]{3})/);
  if (!m) return null;
  const currency = m[1] ?? m[4];
  const raw = (m[2] ?? m[3]).replace(/,(?=\d{3})/g, '').replace(',', '.');
  const value = parseFloat(raw);
  return isNaN(value) ? null : { currency, value };
}

/**
 * Format a numeric value back to an amount string.
 *
 * @param {string} currency
 * @param {number} value
 * @returns {string}
 */
function formatAmount(currency, value) {
  return `${currency} ${value.toFixed(2)}`;
}

// ─── Name similarity ──────────────────────────────────────────────────────────

/**
 * Returns true when the sender name and the insured-party name share
 * at least one significant word token (≥ 3 chars, case-insensitive).
 *
 * @param {string} senderName
 * @param {string} insuredName
 * @returns {boolean}
 */
function namesSimilar(senderName, insuredName) {
  if (!senderName || !insuredName) return false;
  const tokenise = (s) =>
    s.toLowerCase().split(/[\s,.()\-/]+/).filter((t) => t.length >= 3);
  const senderTokens = new Set(tokenise(senderName));
  return tokenise(insuredName).some((t) => senderTokens.has(t));
}

// ─── Date window check ────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns true when |paymentDate - dueDate| ≤ windowDays.
 *
 * @param {string|undefined} paymentDateStr  ISO 8601
 * @param {string|undefined} dueDateStr      ISO 8601
 * @param {number}           windowDays
 */
function withinDateWindow(paymentDateStr, dueDateStr, windowDays = 14) {
  if (!paymentDateStr || !dueDateStr) return true; // no date → don't exclude
  const diff = Math.abs(new Date(paymentDateStr) - new Date(dueDateStr));
  return diff / MS_PER_DAY <= windowDays;
}

// ─── Matching result types ─────────────────────────────────────────────────────

/**
 * @typedef {object} MatchResult
 * @property {'exact'|'partial'|'over'} matchType
 * @property {'exact'|'fuzzy'}          confidence
 * @property {string}                   invoiceId
 * @property {string}                   matchedAmount   — amount string
 * @property {string|undefined}         remainingAmount — for partial
 * @property {string|undefined}         overpaidAmount  — for over
 */

// ─── Core matching function ───────────────────────────────────────────────────

/**
 * Attempt to match a PaymentRecord against a list of open InsuranceInvoices.
 *
 * @param {object}   payment       — PaymentRecord JSON-LD object
 * @param {object[]} openInvoices  — InsuranceInvoice objects with status ≠ paid/cancelled
 * @returns {MatchResult|null}     — null means escalate to manual queue
 */
export function matchPaymentToInvoice(payment, openInvoices) {
  const payAmount = parseAmount(payment.amount);
  if (!payAmount) return null;

  // ── Stage 1: exact reference match ────────────────────────────────────────
  const ref = (payment.transactionReference ?? '').toLowerCase();

  for (const inv of openInvoices) {
    const invNum = inv.invoiceNumber ?? '';
    const premId = inv.premiumId ?? '';

    const refMatches =
      (invNum && ref.includes(invNum.toLowerCase())) ||
      (premId && ref.includes(premId.toLowerCase()));

    if (!refMatches) continue;

    const openBalance = parseAmount(inv.minimumPaymentDue ?? inv.totalPaymentDue);
    if (!openBalance) continue;
    if (openBalance.currency !== payAmount.currency) continue;

    return buildResult(payAmount, openBalance, inv['@id'], 'exact');
  }

  // ── Stage 2: fuzzy match — name + amount + date window ────────────────────
  const senderName = payment.senderName ?? '';

  for (const inv of openInvoices) {
    const customerName = inv.customer?.name ?? '';

    if (!namesSimilar(senderName, customerName)) continue;
    if (!withinDateWindow(payment.paymentDate, inv.paymentDueDate)) continue;

    const openBalance = parseAmount(inv.minimumPaymentDue ?? inv.totalPaymentDue);
    if (!openBalance) continue;
    if (openBalance.currency !== payAmount.currency) continue;

    // Accept when amounts are close (within 1% or €1.00, whichever is larger)
    const tolerance = Math.max(openBalance.value * 0.01, 1.0);
    if (Math.abs(payAmount.value - openBalance.value) > tolerance) continue;

    return buildResult(payAmount, openBalance, inv['@id'], 'fuzzy');
  }

  // ── Stage 4: escalate ─────────────────────────────────────────────────────
  return null;
}

// ─── Helper: build result based on amount comparison ─────────────────────────

function buildResult(payAmount, openBalance, invoiceId, confidence) {
  const diff = payAmount.value - openBalance.value;
  const cur = payAmount.currency;

  if (Math.abs(diff) < 0.005) {
    // Exact (within rounding)
    return {
      matchType: 'exact',
      confidence,
      invoiceId,
      matchedAmount: formatAmount(cur, payAmount.value),
    };
  }

  if (diff < 0) {
    // Underpayment — partial
    return {
      matchType: 'partial',
      confidence,
      invoiceId,
      matchedAmount: formatAmount(cur, payAmount.value),
      remainingAmount: formatAmount(cur, openBalance.value - payAmount.value),
    };
  }

  // Overpayment
  return {
    matchType: 'over',
    confidence,
    invoiceId,
    matchedAmount: formatAmount(cur, openBalance.value),
    overpaidAmount: formatAmount(cur, diff),
  };
}
