/**
 * src/validator-premium.js
 *
 * Validators for the financial-accounting lifecycle entities:
 *
 *  • PremiumNotice    — Beitrags-Sollstellung: the scheduled premium demand
 *                       linked to a Contract.
 *  • InsuranceInvoice — Rechnung: the tax-inclusive invoice document generated
 *                       from a PremiumNotice.
 *  • PaymentRecord    — Zahlungseingang: a bank payment imported for clearing.
 *
 * Status lifecycles
 *   PremiumNotice    : due → invoiced → paid  (| cancelled)
 *   InsuranceInvoice : draft → issued → partially_paid / paid / overpaid (| cancelled)
 *   PaymentRecord    : received → processing → matched / partially_matched / escalated
 *                      (| unassigned)
 *
 * Pure logic — no runtime-specific APIs.
 */

import { SCHEMA_CONTEXTS } from './validator.js';

// ─── Types & constants ────────────────────────────────────────────────────────

export const PREMIUM_TYPES = new Set(['PremiumNotice']);
export const INVOICE_TYPES = new Set(['InsuranceInvoice']);
export const PAYMENT_TYPES = new Set(['PaymentRecord']);

export const PREMIUM_STATUSES = new Set(['due', 'invoiced', 'paid', 'cancelled']);
export const INVOICE_STATUSES = new Set(['draft', 'issued', 'partially_paid', 'paid', 'overpaid', 'cancelled']);
export const PAYMENT_STATUSES = new Set(['received', 'processing', 'matched', 'partially_matched', 'unassigned', 'escalated']);

export const PREMIUM_FREQUENCIES = new Set(['annual', 'semi-annual', 'quarterly', 'monthly']);

const PREMIUM_PROPERTIES = new Set([
  '@context', '@type', '@id',
  'name', 'description',
  'contractId',
  'status',
  'periodStart',
  'periodEnd',
  'dueDate',
  'frequency',
  'premiumAmount',
  'taxRate',
  'taxAmount',
  'grossAmount',
  'provider',
  'insuredParty',
]);

const INVOICE_PROPERTIES = new Set([
  '@context', '@type', '@id',
  'name', 'description',
  'premiumId',
  'contractId',
  'invoiceNumber',
  'status',
  'issueDate',
  'paymentDueDate',
  'billingPeriod',
  'netAmount',
  'taxAmount',
  'totalPaymentDue',
  'minimumPaymentDue',
  'provider',
  'customer',
  'invoiceUrl',
  'snapshotData',
]);

const PAYMENT_PROPERTIES = new Set([
  '@context', '@type', '@id',
  'name', 'description',
  'status',
  'paymentDate',
  'amount',
  'currency',
  'transactionReference',
  'senderName',
  'senderAccountNumber',
  'senderBankCode',
  'invoiceId',
  'premiumId',
  'matchedAmount',
  'unmatchedAmount',
  'matchConfidence',
]);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

// ─── PremiumNotice ─────────────────────────────────────────────────────────────

/**
 * Validate a PremiumNotice JSON-LD object.
 *
 * @param {unknown} data
 * @returns {{ valid: boolean, errors: string[], suggestions: string[] }}
 */
export function validatePremium(data) {
  const errors = [];
  const suggestions = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Input must be a JSON object.'], suggestions: [] };
  }

  // @context
  const ctx = data['@context'];
  if (!ctx) {
    errors.push('Missing "@context". It must be "https://schema.org".');
    suggestions.push('Add "@context": "https://schema.org".');
  } else if (!SCHEMA_CONTEXTS.has(ctx)) {
    errors.push(`"@context" must be "https://schema.org", got "${ctx}".`);
  }

  // @type
  if (!data['@type']) {
    errors.push('Missing "@type". Must be "PremiumNotice".');
  } else if (!PREMIUM_TYPES.has(data['@type'])) {
    errors.push(`"@type" "${data['@type']}" is not valid. Use "PremiumNotice".`);
  }

  // @id
  if (!data['@id']) {
    errors.push('Missing "@id". Provide a URI or URN identifier (e.g. "urn:uuid:<uuid>").');
    suggestions.push('Generate a UUID with crypto.randomUUID() and prefix it with "urn:uuid:".');
  }

  // name
  if (!data.name) {
    errors.push('Missing required field "name".');
  } else if (typeof data.name !== 'string') {
    errors.push('"name" must be a string.');
  }

  // contractId
  if (!data.contractId) {
    errors.push('Missing required field "contractId". A PremiumNotice must reference a Contract.');
  }

  // status
  if (!data.status) {
    errors.push(`Missing required field "status". Must be one of: ${[...PREMIUM_STATUSES].join(', ')}.`);
  } else if (!PREMIUM_STATUSES.has(data.status)) {
    errors.push(`"status" "${data.status}" is not valid. Must be one of: ${[...PREMIUM_STATUSES].join(', ')}.`);
  }

  // periodStart / periodEnd
  for (const dateField of ['periodStart', 'periodEnd', 'dueDate']) {
    if (data[dateField] !== undefined) {
      if (typeof data[dateField] !== 'string' || !ISO_DATE_RE.test(data[dateField])) {
        errors.push(`"${dateField}" must be an ISO 8601 date string (YYYY-MM-DD).`);
      }
    }
  }

  // frequency
  if (data.frequency !== undefined && !PREMIUM_FREQUENCIES.has(data.frequency)) {
    errors.push(`"frequency" must be one of: ${[...PREMIUM_FREQUENCIES].join(', ')}.`);
  }

  // Unknown properties
  for (const key of Object.keys(data)) {
    if (!PREMIUM_PROPERTIES.has(key)) {
      errors.push(`Unknown property "${key}".`);
      suggestions.push(`Remove "${key}". Allowed: ${[...PREMIUM_PROPERTIES].join(', ')}.`);
    }
  }

  return { valid: errors.length === 0, errors, suggestions };
}

// ─── InsuranceInvoice ──────────────────────────────────────────────────────────

/**
 * Validate an InsuranceInvoice JSON-LD object.
 *
 * @param {unknown} data
 * @returns {{ valid: boolean, errors: string[], suggestions: string[] }}
 */
export function validateInvoice(data) {
  const errors = [];
  const suggestions = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Input must be a JSON object.'], suggestions: [] };
  }

  // @context
  const ctx = data['@context'];
  if (!ctx) {
    errors.push('Missing "@context". It must be "https://schema.org".');
    suggestions.push('Add "@context": "https://schema.org".');
  } else if (!SCHEMA_CONTEXTS.has(ctx)) {
    errors.push(`"@context" must be "https://schema.org", got "${ctx}".`);
  }

  // @type
  if (!data['@type']) {
    errors.push('Missing "@type". Must be "InsuranceInvoice".');
  } else if (!INVOICE_TYPES.has(data['@type'])) {
    errors.push(`"@type" "${data['@type']}" is not valid. Use "InsuranceInvoice".`);
  }

  // @id
  if (!data['@id']) {
    errors.push('Missing "@id". Provide a URI or URN identifier (e.g. "urn:uuid:<uuid>").');
    suggestions.push('Generate a UUID with crypto.randomUUID() and prefix it with "urn:uuid:".');
  }

  // name
  if (!data.name) {
    errors.push('Missing required field "name".');
  } else if (typeof data.name !== 'string') {
    errors.push('"name" must be a string.');
  }

  // premiumId
  if (!data.premiumId) {
    errors.push('Missing required field "premiumId". An InsuranceInvoice must reference a PremiumNotice.');
  }

  // status
  if (!data.status) {
    errors.push(`Missing required field "status". Must be one of: ${[...INVOICE_STATUSES].join(', ')}.`);
  } else if (!INVOICE_STATUSES.has(data.status)) {
    errors.push(`"status" "${data.status}" is not valid. Must be one of: ${[...INVOICE_STATUSES].join(', ')}.`);
  }

  // Date fields
  for (const dateField of ['issueDate', 'paymentDueDate']) {
    if (data[dateField] !== undefined) {
      if (typeof data[dateField] !== 'string' || !ISO_DATE_RE.test(data[dateField])) {
        errors.push(`"${dateField}" must be an ISO 8601 date string (YYYY-MM-DD).`);
      }
    }
  }

  // Unknown properties
  for (const key of Object.keys(data)) {
    if (!INVOICE_PROPERTIES.has(key)) {
      errors.push(`Unknown property "${key}".`);
      suggestions.push(`Remove "${key}". Allowed: ${[...INVOICE_PROPERTIES].join(', ')}.`);
    }
  }

  return { valid: errors.length === 0, errors, suggestions };
}

// ─── PaymentRecord ─────────────────────────────────────────────────────────────

/**
 * Validate a PaymentRecord JSON-LD object.
 *
 * @param {unknown} data
 * @returns {{ valid: boolean, errors: string[], suggestions: string[] }}
 */
export function validatePayment(data) {
  const errors = [];
  const suggestions = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Input must be a JSON object.'], suggestions: [] };
  }

  // @context
  const ctx = data['@context'];
  if (!ctx) {
    errors.push('Missing "@context". It must be "https://schema.org".');
    suggestions.push('Add "@context": "https://schema.org".');
  } else if (!SCHEMA_CONTEXTS.has(ctx)) {
    errors.push(`"@context" must be "https://schema.org", got "${ctx}".`);
  }

  // @type
  if (!data['@type']) {
    errors.push('Missing "@type". Must be "PaymentRecord".');
  } else if (!PAYMENT_TYPES.has(data['@type'])) {
    errors.push(`"@type" "${data['@type']}" is not valid. Use "PaymentRecord".`);
  }

  // @id
  if (!data['@id']) {
    errors.push('Missing "@id". Provide a URI or URN identifier (e.g. "urn:uuid:<uuid>").');
    suggestions.push('Generate a UUID with crypto.randomUUID() and prefix it with "urn:uuid:".');
  }

  // name
  if (!data.name) {
    errors.push('Missing required field "name".');
  } else if (typeof data.name !== 'string') {
    errors.push('"name" must be a string.');
  }

  // status
  if (!data.status) {
    errors.push(`Missing required field "status". Must be one of: ${[...PAYMENT_STATUSES].join(', ')}.`);
  } else if (!PAYMENT_STATUSES.has(data.status)) {
    errors.push(`"status" "${data.status}" is not valid. Must be one of: ${[...PAYMENT_STATUSES].join(', ')}.`);
  }

  // amount
  if (!data.amount) {
    errors.push('Missing required field "amount" (e.g. "EUR 1200.00").');
  }

  // paymentDate
  if (!data.paymentDate) {
    errors.push('Missing required field "paymentDate" (ISO 8601 date YYYY-MM-DD).');
  } else if (typeof data.paymentDate !== 'string' || !ISO_DATE_RE.test(data.paymentDate)) {
    errors.push('"paymentDate" must be an ISO 8601 date string (YYYY-MM-DD).');
  }

  // matchConfidence
  if (data.matchConfidence !== undefined &&
      !['exact', 'fuzzy', 'manual'].includes(data.matchConfidence)) {
    errors.push('"matchConfidence" must be one of: exact, fuzzy, manual.');
  }

  // Unknown properties
  for (const key of Object.keys(data)) {
    if (!PAYMENT_PROPERTIES.has(key)) {
      errors.push(`Unknown property "${key}".`);
      suggestions.push(`Remove "${key}". Allowed: ${[...PAYMENT_PROPERTIES].join(', ')}.`);
    }
  }

  return { valid: errors.length === 0, errors, suggestions };
}
