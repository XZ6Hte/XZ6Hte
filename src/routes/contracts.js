/**
 * src/routes/contracts.js — Contract route handlers
 *
 * Handles all /contracts/* requests using WinterTC Web standard APIs:
 * Request, Response, URL — no Express, no runtime-specific code.
 *
 * Exported function:
 *   contractsHandler(request) → Promise<Response>
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

// ─── Main dispatcher ──────────────────────────────────────────────────────────

/**
 * Route all /contracts/* requests to the appropriate handler.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function contractsHandler(request) {
  const storage   = getPlugin('storage');
  const llm       = getPlugin('llm');
  const validator = getPlugin('validator');

  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  // Strip trailing slash and isolate the path after /contracts
  const fullPath = url.pathname.replace(/\/$/, '');
  const sub = fullPath.replace(/^\/contracts/, '') || '/';

  // ── POST /contracts/generate ──────────────────────────────────────────────
  if (method === 'POST' && sub === '/generate') {
    const body = await parseBody(request);
    const { prompt } = body ?? {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return json({ error: '"prompt" (string) is required.' }, { status: 400 });
    }

    const generated = await llm.generateContract(prompt.trim());
    const contracts = Array.isArray(generated) ? generated : [generated];
    const stored = [];

    for (const contract of contracts) {
      const { valid, errors } = validator.validateContract(contract);
      if (!valid) {
        return json({ error: 'Generated contract failed validation.', errors, contract }, { status: 422 });
      }
      stored.push(await storage.createContract(contract));
    }

    return json(stored.length === 1 ? stored[0] : stored, { status: 201 });
  }

  // ── POST /contracts/validate ──────────────────────────────────────────────
  if (method === 'POST' && sub === '/validate') {
    const body = await parseBody(request);
    const { data } = body ?? {};
    if (!data) {
      return json({ error: '"data" field is required.' }, { status: 400 });
    }
    return json(validator.validateContract(data));
  }

  // ── POST /contracts/query ─────────────────────────────────────────────────
  if (method === 'POST' && sub === '/query') {
    const body = await parseBody(request);
    const { nl_query } = body ?? {};
    if (!nl_query || typeof nl_query !== 'string' || !nl_query.trim()) {
      return json({ error: '"nl_query" (string) is required.' }, { status: 400 });
    }

    const filters = await llm.extractContractQueryFilters(nl_query.trim());
    const results = await storage.queryContracts(filters);
    return json({ filters, results });
  }

  // ── GET /contracts  (with optional query-string filters) ──────────────────
  if (method === 'GET' && sub === '/') {
    const filters = {};
    const q = url.searchParams;
    if (q.get('type'))    filters.type    = q.get('type');
    if (q.get('name'))    filters.name    = q.get('name');
    if (q.get('partyId')) filters.partyId = q.get('partyId');

    return json(await storage.queryContracts(filters));
  }

  // ── POST /contracts  (create from user-supplied JSON-LD) ─────────────────
  if (method === 'POST' && sub === '/') {
    const contract = await parseBody(request);
    if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
      return json({ error: 'Request body must be a JSON-LD Contract object.' }, { status: 400 });
    }

    if (!contract['@id']) {
      contract['@id'] = `urn:uuid:${crypto.randomUUID()}`;
    }

    const { valid, errors, suggestions } = validator.validateContract(contract);
    if (!valid) {
      return json({ valid: false, errors, suggestions }, { status: 422 });
    }

    return json(await storage.createContract(contract), { status: 201 });
  }

  // ── /contracts/:id  routes ────────────────────────────────────────────────
  const idMatch = sub.match(/^\/(.+)$/);
  if (idMatch) {
    const id = decodeURIComponent(idMatch[1]);

    // GET /contracts/:id
    if (method === 'GET') {
      const contract = await storage.getContractById(id);
      if (!contract) return json({ error: 'Contract not found.' }, { status: 404 });
      return json(contract);
    }

    // PATCH /contracts/:id
    if (method === 'PATCH') {
      const existing = await storage.getContractById(id);
      if (!existing) return json({ error: 'Contract not found.' }, { status: 404 });

      const patch = await parseBody(request);
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        return json({ error: 'Request body must be a JSON patch object.' }, { status: 400 });
      }

      const merged = { ...existing, ...patch, '@id': id };
      const { valid, errors, suggestions } = validator.validateContract(merged);
      if (!valid) {
        return json({ valid: false, errors, suggestions }, { status: 422 });
      }

      const updated = await storage.updateContract(id, merged);
      if (!updated) return json({ error: 'Contract not found.' }, { status: 404 });
      return json(updated);
    }

    // DELETE /contracts/:id
    if (method === 'DELETE') {
      const deleted = await storage.deleteContract(id);
      if (!deleted) return json({ error: 'Contract not found.' }, { status: 404 });
      return new Response(null, { status: 204 });
    }
  }

  return json({ error: 'Not found.' }, { status: 404 });
}
