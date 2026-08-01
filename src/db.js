/**
 * src/db.js — SQLite storage layer
 *
 * Uses runtime.createDb() from the switch so the same SQL logic runs on
 * both Deno and Node.js. All functions are async because the DB is opened
 * lazily on first access (the dynamic import in runtime.js is async).
 */

import { env, createDb } from './runtime.js';

const DB_PATH = env('DB_PATH', './parties.db');

let _db = null;

async function getDb() {
  if (!_db) {
    _db = await createDb(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    migrate(_db);
  }
  return _db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS parties (
      id               TEXT PRIMARY KEY,
      type             TEXT NOT NULL,
      name             TEXT NOT NULL,
      address_locality TEXT,
      data             TEXT NOT NULL,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_parties_type             ON parties(type);
    CREATE INDEX IF NOT EXISTS idx_parties_name             ON parties(name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_parties_address_locality ON parties(address_locality COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS contracts (
      id               TEXT PRIMARY KEY,
      type             TEXT NOT NULL,
      name             TEXT NOT NULL,
      provider_id      TEXT,
      insured_party_id TEXT,
      data             TEXT NOT NULL,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_contracts_type             ON contracts(type);
    CREATE INDEX IF NOT EXISTS idx_contracts_name             ON contracts(name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_contracts_provider_id      ON contracts(provider_id);
    CREATE INDEX IF NOT EXISTS idx_contracts_insured_party_id ON contracts(insured_party_id);

    CREATE TABLE IF NOT EXISTS premiums (
      id           TEXT PRIMARY KEY,
      contract_id  TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'due',
      period_start TEXT,
      period_end   TEXT,
      due_date     TEXT,
      gross_amount TEXT,
      data         TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_premiums_contract_id ON premiums(contract_id);
    CREATE INDEX IF NOT EXISTS idx_premiums_status      ON premiums(status);
    CREATE INDEX IF NOT EXISTS idx_premiums_due_date    ON premiums(due_date);

    CREATE TABLE IF NOT EXISTS invoices (
      id               TEXT PRIMARY KEY,
      premium_id       TEXT NOT NULL,
      contract_id      TEXT,
      invoice_number   TEXT UNIQUE,
      status           TEXT NOT NULL DEFAULT 'draft',
      payment_due_date TEXT,
      total_amount     TEXT,
      sender_name      TEXT,
      data             TEXT NOT NULL,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_premium_id       ON invoices(premium_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_contract_id      ON invoices(contract_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number   ON invoices(invoice_number);
    CREATE INDEX IF NOT EXISTS idx_invoices_status           ON invoices(status);

    CREATE TABLE IF NOT EXISTS payments (
      id                    TEXT PRIMARY KEY,
      status                TEXT NOT NULL DEFAULT 'received',
      payment_date          TEXT,
      amount_raw            TEXT,
      sender_name           TEXT,
      transaction_reference TEXT,
      invoice_id            TEXT,
      data                  TEXT NOT NULL,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_payments_status           ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_payments_invoice_id       ON payments(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_payments_payment_date     ON payments(payment_date);
    CREATE INDEX IF NOT EXISTS idx_payments_sender_name      ON payments(sender_name COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS sequences (
      name    TEXT PRIMARY KEY,
      current INTEGER NOT NULL DEFAULT 0
    );
  `);
}

/**
 * Insert a new party document.
 * @param {object} party - validated JSON-LD party object
 * @returns {Promise<object>} the stored party
 */
export async function createParty(party) {
  const db = await getDb();
  const locality = extractLocality(party);
  db.prepare(`
    INSERT INTO parties (id, type, name, address_locality, data)
    VALUES (@id, @type, @name, @locality, @data)
  `).run({
    id: party['@id'],
    type: party['@type'],
    name: party.name,
    locality,
    data: JSON.stringify(party),
  });
  return party;
}

/**
 * Retrieve a party by its @id.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getPartyById(id) {
  const db = await getDb();
  const row = db.prepare('SELECT data FROM parties WHERE id = ?').get(id);
  return row ? JSON.parse(row.data) : null;
}

/**
 * Replace a party's data (full update).
 * @param {string} id
 * @param {object} party - new JSON-LD data
 * @returns {Promise<object|null>} updated party, or null if not found
 */
export async function updateParty(id, party) {
  const db = await getDb();
  const locality = extractLocality(party);
  const result = db.prepare(`
    UPDATE parties
    SET type = @type, name = @name, address_locality = @locality,
        data = @data, updated_at = datetime('now')
    WHERE id = @id
  `).run({
    id,
    type: party['@type'],
    name: party.name,
    locality,
    data: JSON.stringify(party),
  });
  return result.changes > 0 ? party : null;
}

/**
 * Delete a party by its @id.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteParty(id) {
  const db = await getDb();
  const result = db.prepare('DELETE FROM parties WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Query parties using optional filter criteria.
 * All filters are case-insensitive partial matches.
 *
 * @param {{ type?: string, name?: string, addressLocality?: string }} [filters]
 * @returns {Promise<object[]>} array of JSON-LD party objects
 */
export async function queryParties(filters = {}) {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (filters.type) {
    conditions.push('type = ?');
    params.push(filters.type);
  }
  if (filters.name) {
    conditions.push('name LIKE ? COLLATE NOCASE');
    params.push(`%${filters.name}%`);
  }
  if (filters.addressLocality) {
    conditions.push('address_locality LIKE ? COLLATE NOCASE');
    params.push(`%${filters.addressLocality}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT data FROM parties ${where} LIMIT 100`).all(...params);
  return rows.map((r) => JSON.parse(r.data));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractLocality(party) {
  const addr = party.address;
  if (!addr) return null;
  return addr.addressLocality ?? null;
}

// ─── Contract storage ─────────────────────────────────────────────────────────

/**
 * Insert a new contract document.
 * @param {object} contract - validated JSON-LD contract object
 * @returns {Promise<object>} the stored contract
 */
export async function createContract(contract) {
  const db = await getDb();
  db.prepare(`
    INSERT INTO contracts (id, type, name, provider_id, insured_party_id, data)
    VALUES (@id, @type, @name, @providerId, @insuredPartyId, @data)
  `).run({
    id: contract['@id'],
    type: contract['@type'],
    name: contract.name,
    providerId: extractPartyId(contract.provider ?? contract.offeredBy),
    insuredPartyId: extractPartyId(contract.insuredParty),
    data: JSON.stringify(contract),
  });
  return contract;
}

/**
 * Retrieve a contract by its @id.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getContractById(id) {
  const db = await getDb();
  const row = db.prepare('SELECT data FROM contracts WHERE id = ?').get(id);
  return row ? JSON.parse(row.data) : null;
}

/**
 * Replace a contract's data (full update).
 * @param {string} id
 * @param {object} contract - new JSON-LD data
 * @returns {Promise<object|null>} updated contract, or null if not found
 */
export async function updateContract(id, contract) {
  const db = await getDb();
  const result = db.prepare(`
    UPDATE contracts
    SET type = @type, name = @name,
        provider_id = @providerId, insured_party_id = @insuredPartyId,
        data = @data, updated_at = datetime('now')
    WHERE id = @id
  `).run({
    id,
    type: contract['@type'],
    name: contract.name,
    providerId: extractPartyId(contract.provider ?? contract.offeredBy),
    insuredPartyId: extractPartyId(contract.insuredParty),
    data: JSON.stringify(contract),
  });
  return result.changes > 0 ? contract : null;
}

/**
 * Delete a contract by its @id.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteContract(id) {
  const db = await getDb();
  const result = db.prepare('DELETE FROM contracts WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Query contracts using optional filter criteria.
 *
 * @param {{ type?: string, name?: string, partyId?: string }} [filters]
 * @returns {Promise<object[]>} array of JSON-LD contract objects
 */
export async function queryContracts(filters = {}) {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (filters.type) {
    conditions.push('type = ?');
    params.push(filters.type);
  }
  if (filters.name) {
    conditions.push('name LIKE ? COLLATE NOCASE');
    params.push(`%${filters.name}%`);
  }
  if (filters.partyId) {
    conditions.push('(provider_id = ? OR insured_party_id = ?)');
    params.push(filters.partyId, filters.partyId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT data FROM contracts ${where} LIMIT 100`).all(...params);
  return rows.map((r) => JSON.parse(r.data));
}

/**
 * Extract the @id from a party reference (object or URI string).
 * @param {object|string|undefined} ref
 * @returns {string|null}
 */
function extractPartyId(ref) {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  return ref['@id'] ?? null;
}

// ─── Premium storage ──────────────────────────────────────────────────────────

/**
 * Insert a new PremiumNotice document.
 * @param {object} premium - validated JSON-LD PremiumNotice
 * @returns {Promise<object>}
 */
export async function createPremium(premium) {
  const db = await getDb();
  db.prepare(`
    INSERT INTO premiums (id, contract_id, status, period_start, period_end, due_date, gross_amount, data)
    VALUES (@id, @contractId, @status, @periodStart, @periodEnd, @dueDate, @grossAmount, @data)
  `).run({
    id: premium['@id'],
    contractId: premium.contractId,
    status: premium.status,
    periodStart: premium.periodStart ?? null,
    periodEnd: premium.periodEnd ?? null,
    dueDate: premium.dueDate ?? null,
    grossAmount: premium.grossAmount ?? premium.premiumAmount ?? null,
    data: JSON.stringify(premium),
  });
  return premium;
}

/**
 * Retrieve a PremiumNotice by its @id.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getPremiumById(id) {
  const db = await getDb();
  const row = db.prepare('SELECT data FROM premiums WHERE id = ?').get(id);
  return row ? JSON.parse(row.data) : null;
}

/**
 * Replace a PremiumNotice's data (full update).
 * @param {string} id
 * @param {object} premium
 * @returns {Promise<object|null>}
 */
export async function updatePremium(id, premium) {
  const db = await getDb();
  const result = db.prepare(`
    UPDATE premiums
    SET contract_id = @contractId, status = @status,
        period_start = @periodStart, period_end = @periodEnd,
        due_date = @dueDate, gross_amount = @grossAmount,
        data = @data, updated_at = datetime('now')
    WHERE id = @id
  `).run({
    id,
    contractId: premium.contractId,
    status: premium.status,
    periodStart: premium.periodStart ?? null,
    periodEnd: premium.periodEnd ?? null,
    dueDate: premium.dueDate ?? null,
    grossAmount: premium.grossAmount ?? premium.premiumAmount ?? null,
    data: JSON.stringify(premium),
  });
  return result.changes > 0 ? premium : null;
}

/**
 * Delete a PremiumNotice by its @id.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deletePremium(id) {
  const db = await getDb();
  const result = db.prepare('DELETE FROM premiums WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Query PremiumNotice objects using optional filter criteria.
 *
 * @param {{ contractId?: string, status?: string, dueDateFrom?: string, dueDateTo?: string }} [filters]
 * @returns {Promise<object[]>}
 */
export async function queryPremiums(filters = {}) {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (filters.contractId) {
    conditions.push('contract_id = ?');
    params.push(filters.contractId);
  }
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.dueDateFrom) {
    conditions.push('due_date >= ?');
    params.push(filters.dueDateFrom);
  }
  if (filters.dueDateTo) {
    conditions.push('due_date <= ?');
    params.push(filters.dueDateTo);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT data FROM premiums ${where} ORDER BY due_date ASC LIMIT 100`).all(...params);
  return rows.map((r) => JSON.parse(r.data));
}

// ─── Invoice storage ──────────────────────────────────────────────────────────

/**
 * Generate the next sequential invoice number for the current year.
 * Format: INV-YYYY-NNNNNN (gap-free per GoBD requirements).
 *
 * @param {object} db - synchronous better-sqlite3 / Deno DB instance
 * @returns {string}
 */
function nextInvoiceNumber(db) {
  const year = new Date().getFullYear();
  const seqName = `invoice_${year}`;
  db.prepare('INSERT OR IGNORE INTO sequences (name, current) VALUES (?, 0)').run(seqName);
  db.prepare('UPDATE sequences SET current = current + 1 WHERE name = ?').run(seqName);
  const row = db.prepare('SELECT current FROM sequences WHERE name = ?').get(seqName);
  return `INV-${year}-${String(row.current).padStart(6, '0')}`;
}

/**
 * Insert a new InsuranceInvoice document.
 * Assigns a gap-free invoiceNumber when not already set.
 *
 * @param {object} invoice - validated JSON-LD InsuranceInvoice
 * @returns {Promise<object>}
 */
export async function createInvoice(invoice) {
  const db = await getDb();
  if (!invoice.invoiceNumber) {
    invoice = { ...invoice, invoiceNumber: nextInvoiceNumber(db) };
  }
  db.prepare(`
    INSERT INTO invoices (id, premium_id, contract_id, invoice_number, status, payment_due_date, total_amount, sender_name, data)
    VALUES (@id, @premiumId, @contractId, @invoiceNumber, @status, @paymentDueDate, @totalAmount, @senderName, @data)
  `).run({
    id: invoice['@id'],
    premiumId: invoice.premiumId,
    contractId: invoice.contractId ?? null,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    paymentDueDate: invoice.paymentDueDate ?? null,
    totalAmount: invoice.totalPaymentDue ?? invoice.netAmount ?? null,
    senderName: invoice.customer?.name ?? null,
    data: JSON.stringify(invoice),
  });
  return invoice;
}

/**
 * Retrieve an InsuranceInvoice by its @id.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getInvoiceById(id) {
  const db = await getDb();
  const row = db.prepare('SELECT data FROM invoices WHERE id = ?').get(id);
  return row ? JSON.parse(row.data) : null;
}

/**
 * Replace an InsuranceInvoice's data (full update).
 * @param {string} id
 * @param {object} invoice
 * @returns {Promise<object|null>}
 */
export async function updateInvoice(id, invoice) {
  const db = await getDb();
  const result = db.prepare(`
    UPDATE invoices
    SET premium_id = @premiumId, contract_id = @contractId,
        invoice_number = @invoiceNumber, status = @status,
        payment_due_date = @paymentDueDate, total_amount = @totalAmount,
        sender_name = @senderName,
        data = @data, updated_at = datetime('now')
    WHERE id = @id
  `).run({
    id,
    premiumId: invoice.premiumId,
    contractId: invoice.contractId ?? null,
    invoiceNumber: invoice.invoiceNumber ?? null,
    status: invoice.status,
    paymentDueDate: invoice.paymentDueDate ?? null,
    totalAmount: invoice.totalPaymentDue ?? invoice.netAmount ?? null,
    senderName: invoice.customer?.name ?? null,
    data: JSON.stringify(invoice),
  });
  return result.changes > 0 ? invoice : null;
}

/**
 * Delete an InsuranceInvoice by its @id.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteInvoice(id) {
  const db = await getDb();
  const result = db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Query InsuranceInvoice objects using optional filter criteria.
 *
 * @param {{ premiumId?: string, contractId?: string, status?: string, invoiceNumber?: string }} [filters]
 * @returns {Promise<object[]>}
 */
export async function queryInvoices(filters = {}) {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (filters.premiumId) {
    conditions.push('premium_id = ?');
    params.push(filters.premiumId);
  }
  if (filters.contractId) {
    conditions.push('contract_id = ?');
    params.push(filters.contractId);
  }
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.invoiceNumber) {
    conditions.push('invoice_number LIKE ? COLLATE NOCASE');
    params.push(`%${filters.invoiceNumber}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT data FROM invoices ${where} ORDER BY created_at ASC LIMIT 100`).all(...params);
  return rows.map((r) => JSON.parse(r.data));
}

/**
 * Return all open (matchable) invoices: status in (issued, partially_paid).
 * Used by the matching engine.
 *
 * @returns {Promise<object[]>}
 */
export async function getOpenInvoices() {
  const db = await getDb();
  const rows = db.prepare(`
    SELECT data FROM invoices
    WHERE status IN ('issued', 'partially_paid')
    ORDER BY payment_due_date ASC
    LIMIT 500
  `).all();
  return rows.map((r) => JSON.parse(r.data));
}

// ─── Payment storage ──────────────────────────────────────────────────────────

/**
 * Insert a new PaymentRecord document.
 * @param {object} payment - validated JSON-LD PaymentRecord
 * @returns {Promise<object>}
 */
export async function createPayment(payment) {
  const db = await getDb();
  db.prepare(`
    INSERT INTO payments (id, status, payment_date, amount_raw, sender_name, transaction_reference, invoice_id, data)
    VALUES (@id, @status, @paymentDate, @amountRaw, @senderName, @transactionReference, @invoiceId, @data)
  `).run({
    id: payment['@id'],
    status: payment.status,
    paymentDate: payment.paymentDate ?? null,
    amountRaw: payment.amount ?? null,
    senderName: payment.senderName ?? null,
    transactionReference: payment.transactionReference ?? null,
    invoiceId: payment.invoiceId ?? null,
    data: JSON.stringify(payment),
  });
  return payment;
}

/**
 * Retrieve a PaymentRecord by its @id.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getPaymentById(id) {
  const db = await getDb();
  const row = db.prepare('SELECT data FROM payments WHERE id = ?').get(id);
  return row ? JSON.parse(row.data) : null;
}

/**
 * Replace a PaymentRecord's data (full update).
 * @param {string} id
 * @param {object} payment
 * @returns {Promise<object|null>}
 */
export async function updatePayment(id, payment) {
  const db = await getDb();
  const result = db.prepare(`
    UPDATE payments
    SET status = @status, payment_date = @paymentDate,
        amount_raw = @amountRaw, sender_name = @senderName,
        transaction_reference = @transactionReference,
        invoice_id = @invoiceId,
        data = @data, updated_at = datetime('now')
    WHERE id = @id
  `).run({
    id,
    status: payment.status,
    paymentDate: payment.paymentDate ?? null,
    amountRaw: payment.amount ?? null,
    senderName: payment.senderName ?? null,
    transactionReference: payment.transactionReference ?? null,
    invoiceId: payment.invoiceId ?? null,
    data: JSON.stringify(payment),
  });
  return result.changes > 0 ? payment : null;
}

/**
 * Delete a PaymentRecord by its @id.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deletePayment(id) {
  const db = await getDb();
  const result = db.prepare('DELETE FROM payments WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Query PaymentRecord objects using optional filter criteria.
 *
 * @param {{ status?: string, invoiceId?: string, paymentDateFrom?: string, paymentDateTo?: string }} [filters]
 * @returns {Promise<object[]>}
 */
export async function queryPayments(filters = {}) {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.invoiceId) {
    conditions.push('invoice_id = ?');
    params.push(filters.invoiceId);
  }
  if (filters.paymentDateFrom) {
    conditions.push('payment_date >= ?');
    params.push(filters.paymentDateFrom);
  }
  if (filters.paymentDateTo) {
    conditions.push('payment_date <= ?');
    params.push(filters.paymentDateTo);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT data FROM payments ${where} ORDER BY payment_date DESC LIMIT 100`).all(...params);
  return rows.map((r) => JSON.parse(r.data));
}
