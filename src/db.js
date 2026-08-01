'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'parties.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
  }
  return db;
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

    CREATE INDEX IF NOT EXISTS idx_parties_type            ON parties(type);
    CREATE INDEX IF NOT EXISTS idx_parties_name            ON parties(name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_parties_address_locality ON parties(address_locality COLLATE NOCASE);
  `);
}

/**
 * Insert a new party document.
 * @param {object} party - validated JSON-LD party object
 * @returns {object} the stored party
 */
function createParty(party) {
  const db = getDb();
  const locality = extractLocality(party);
  const stmt = db.prepare(`
    INSERT INTO parties (id, type, name, address_locality, data)
    VALUES (@id, @type, @name, @locality, @data)
  `);
  stmt.run({
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
 * @returns {object|null}
 */
function getPartyById(id) {
  const db = getDb();
  const row = db.prepare('SELECT data FROM parties WHERE id = ?').get(id);
  return row ? JSON.parse(row.data) : null;
}

/**
 * Replace a party's data (full update).
 * @param {string} id
 * @param {object} party - new JSON-LD data
 * @returns {object|null} updated party, or null if not found
 */
function updateParty(id, party) {
  const db = getDb();
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
 * @returns {boolean}
 */
function deleteParty(id) {
  const db = getDb();
  const result = db.prepare('DELETE FROM parties WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Query parties using optional filter criteria.
 * All filters are case-insensitive partial matches.
 *
 * @param {object} filters - { type, name, addressLocality }
 * @returns {object[]} array of JSON-LD party objects
 */
function queryParties(filters = {}) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (filters.type) {
    conditions.push("type = ?");
    params.push(filters.type);
  }
  if (filters.name) {
    conditions.push("name LIKE ? COLLATE NOCASE");
    params.push(`%${filters.name}%`);
  }
  if (filters.addressLocality) {
    conditions.push("address_locality LIKE ? COLLATE NOCASE");
    params.push(`%${filters.addressLocality}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT data FROM parties ${where} LIMIT 100`).all(...params);
  return rows.map(r => JSON.parse(r.data));
}

/**
 * List all parties (up to 100).
 * @returns {object[]}
 */
function listParties() {
  return queryParties();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractLocality(party) {
  const addr = party.address;
  if (!addr) return null;
  return addr.addressLocality || null;
}

module.exports = { createParty, getPartyById, updateParty, deleteParty, queryParties, listParties };
