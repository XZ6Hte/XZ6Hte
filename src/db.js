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
