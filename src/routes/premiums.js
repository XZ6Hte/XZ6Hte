/**
 * src/routes/premiums.js — PremiumNotice route handlers
 *
 * Handles all /premiums/* requests using WinterTC Web standard APIs.
 *
 * Routes:
 *   GET    /premiums                  — list (filters: contractId, status, dueDateFrom, dueDateTo)
 *   POST   /premiums                  — create
 *   GET    /premiums/:id              — get by @id
 *   PATCH  /premiums/:id              — merge-patch
 *   DELETE /premiums/:id              — delete → 204
 *   POST   /premiums/validate         — validate without storing
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
 * Route all /premiums/* requests to the appropriate handler.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function premiumsHandler(request) {
  const storage   = getPlugin('storage');
  const validator = getPlugin('validator');

  const url    = new URL(request.url);
  const method = request.method.toUpperCase();
  const full   = url.pathname.replace(/\/$/, '');
  const sub    = full.replace(/^\/premiums/, '') || '/';

  // ── POST /premiums/validate ───────────────────────────────────────────────
  if (method === 'POST' && sub === '/validate') {
    const body = await parseBody(request);
    const { data } = body ?? {};
    if (!data) return json({ error: '"data" field is required.' }, { status: 400 });
    return json(validator.validatePremium(data));
  }

  // ── GET /premiums ─────────────────────────────────────────────────────────
  if (method === 'GET' && sub === '/') {
    const q = url.searchParams;
    const filters = {};
    if (q.get('contractId'))    filters.contractId    = q.get('contractId');
    if (q.get('status'))        filters.status        = q.get('status');
    if (q.get('dueDateFrom'))   filters.dueDateFrom   = q.get('dueDateFrom');
    if (q.get('dueDateTo'))     filters.dueDateTo     = q.get('dueDateTo');
    return json(await storage.queryPremiums(filters));
  }

  // ── POST /premiums ────────────────────────────────────────────────────────
  if (method === 'POST' && sub === '/') {
    const premium = await parseBody(request);
    if (!premium || typeof premium !== 'object' || Array.isArray(premium)) {
      return json({ error: 'Request body must be a JSON-LD PremiumNotice object.' }, { status: 400 });
    }
    if (!premium['@id'])     premium['@id']    = `urn:uuid:${crypto.randomUUID()}`;
    if (!premium['@context']) premium['@context'] = 'https://schema.org';
    if (!premium['@type'])    premium['@type']  = 'PremiumNotice';
    if (!premium.status)      premium.status    = 'due';

    const { valid, errors, suggestions } = validator.validatePremium(premium);
    if (!valid) return json({ valid: false, errors, suggestions }, { status: 422 });

    return json(await storage.createPremium(premium), { status: 201 });
  }

  // ── /premiums/:id routes ──────────────────────────────────────────────────
  const idMatch = sub.match(/^\/(.+)$/);
  if (idMatch) {
    const id = decodeURIComponent(idMatch[1]);

    if (method === 'GET') {
      const premium = await storage.getPremiumById(id);
      if (!premium) return json({ error: 'PremiumNotice not found.' }, { status: 404 });
      return json(premium);
    }

    if (method === 'PATCH') {
      const existing = await storage.getPremiumById(id);
      if (!existing) return json({ error: 'PremiumNotice not found.' }, { status: 404 });

      const patch = await parseBody(request);
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        return json({ error: 'Request body must be a JSON patch object.' }, { status: 400 });
      }

      const merged = { ...existing, ...patch, '@id': id };
      const { valid, errors, suggestions } = validator.validatePremium(merged);
      if (!valid) return json({ valid: false, errors, suggestions }, { status: 422 });

      const updated = await storage.updatePremium(id, merged);
      if (!updated) return json({ error: 'PremiumNotice not found.' }, { status: 404 });
      return json(updated);
    }

    if (method === 'DELETE') {
      const deleted = await storage.deletePremium(id);
      if (!deleted) return json({ error: 'PremiumNotice not found.' }, { status: 404 });
      return new Response(null, { status: 204 });
    }
  }

  return json({ error: 'Not found.' }, { status: 404 });
}
