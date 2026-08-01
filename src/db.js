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
