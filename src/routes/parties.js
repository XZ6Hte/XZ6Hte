/**
 * src/routes/parties.js — Party route handlers
 *
 * Handles all /parties/* requests using WinterTC Web standard APIs:
 * Request, Response, URL — no Express, no runtime-specific code.
 *
 * Exported function:
 *   partiesHandler(request) → Promise<Response>
 */

import { validateParty } from '../validator.js';
import { generateParty, extractQueryFilters } from '../llm.js';
import { createParty, getPartyById, updateParty, deleteParty, queryParties } from '../db.js';

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

// ─── Main dispatcher ──────────────────────────────────────────────────────────

/**
 * Route all /parties/* requests to the appropriate handler.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function partiesHandler(request) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  // Strip trailing slash and isolate the path after /parties
  const fullPath = url.pathname.replace(/\/$/, '');
  const sub = fullPath.replace(/^\/parties/, '') || '/';

  // ── POST /parties/generate ────────────────────────────────────────────────
  if (method === 'POST' && sub === '/generate') {
    const body = await parseBody(request);
    const { prompt } = body ?? {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return json({ error: '"prompt" (string) is required.' }, { status: 400 });
    }

    const generated = await generateParty(prompt.trim());
    const parties = Array.isArray(generated) ? generated : [generated];
    const stored = [];

    for (const party of parties) {
      const { valid, errors } = validateParty(party);
      if (!valid) {
        return json({ error: 'Generated party failed validation.', errors, party }, { status: 422 });
      }
      stored.push(await createParty(party));
    }

    return json(stored.length === 1 ? stored[0] : stored, { status: 201 });
  }

  // ── POST /parties/validate ────────────────────────────────────────────────
  if (method === 'POST' && sub === '/validate') {
    const body = await parseBody(request);
    const { data } = body ?? {};
    if (!data) {
      return json({ error: '"data" field is required.' }, { status: 400 });
    }
    return json(validateParty(data));
  }

  // ── POST /parties/query ───────────────────────────────────────────────────
  if (method === 'POST' && sub === '/query') {
    const body = await parseBody(request);
    const { nl_query } = body ?? {};
    if (!nl_query || typeof nl_query !== 'string' || !nl_query.trim()) {
      return json({ error: '"nl_query" (string) is required.' }, { status: 400 });
    }

    const filters = await extractQueryFilters(nl_query.trim());
    const results = await queryParties(filters);
    return json({ filters, results });
  }

  // ── GET /parties  (with optional query-string filters) ────────────────────
  if (method === 'GET' && sub === '/') {
    const filters = {};
    const q = url.searchParams;
    if (q.get('type'))            filters.type = q.get('type');
    if (q.get('name'))            filters.name = q.get('name');
    if (q.get('addressLocality')) filters.addressLocality = q.get('addressLocality');

    return json(await queryParties(filters));
  }

  // ── POST /parties  (create from user-supplied JSON-LD) ────────────────────
  if (method === 'POST' && sub === '/') {
    const party = await parseBody(request);
    if (!party || typeof party !== 'object' || Array.isArray(party)) {
      return json({ error: 'Request body must be a JSON-LD Party object.' }, { status: 400 });
    }

    if (!party['@id']) {
      party['@id'] = `urn:uuid:${crypto.randomUUID()}`;
    }

    const { valid, errors, suggestions } = validateParty(party);
    if (!valid) {
      return json({ valid: false, errors, suggestions }, { status: 422 });
    }

    return json(await createParty(party), { status: 201 });
  }

  // ── /parties/:id  routes ──────────────────────────────────────────────────
  const idMatch = sub.match(/^\/(.+)$/);
  if (idMatch) {
    const id = decodeURIComponent(idMatch[1]);

    // GET /parties/:id
    if (method === 'GET') {
      const party = await getPartyById(id);
      if (!party) return json({ error: 'Party not found.' }, { status: 404 });
      return json(party);
    }

    // PATCH /parties/:id
    if (method === 'PATCH') {
      const existing = await getPartyById(id);
      if (!existing) return json({ error: 'Party not found.' }, { status: 404 });

      const patch = await parseBody(request);
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        return json({ error: 'Request body must be a JSON patch object.' }, { status: 400 });
      }

      const merged = { ...existing, ...patch, '@id': id };
      const { valid, errors, suggestions } = validateParty(merged);
      if (!valid) {
        return json({ valid: false, errors, suggestions }, { status: 422 });
      }

      const updated = await updateParty(id, merged);
      if (!updated) return json({ error: 'Party not found.' }, { status: 404 });
      return json(updated);
    }

    // DELETE /parties/:id
    if (method === 'DELETE') {
      const deleted = await deleteParty(id);
      if (!deleted) return json({ error: 'Party not found.' }, { status: 404 });
      return new Response(null, { status: 204 });
    }
  }

  return json({ error: 'Not found.' }, { status: 404 });
}
