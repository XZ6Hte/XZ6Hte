/**
 * src/app.js — WinterTC application fetch handler
 *
 * This module wires all routes together and returns a single fetch handler:
 *   (request: Request) => Promise<Response>
 *
 * Everything here uses only WinterTC Web standard APIs.
 * Rate-limiting is implemented with a plain in-memory Map (no npm packages).
 */

import { env } from './runtime.js';
import { partiesHandler } from './routes/parties.js';
import { contractsHandler } from './routes/contracts.js';
import { premiumsHandler } from './routes/premiums.js';
import { invoicesHandler } from './routes/invoices.js';
import { paymentsHandler } from './routes/payments.js';
import { registerPlugin, getPlugin } from './plugins/registry.js';
import { dbPlugin }        from './plugins/db-plugin.js';
import { llmPlugin }       from './plugins/llm-plugin.js';
import { validatorPlugin } from './plugins/validator-plugin.js';
import { guiPage }         from './gui/page.js';

// ─── Bootstrap default plugins ────────────────────────────────────────────────
// Register built-in implementations. Replace any slot with a custom plugin
// that satisfies the same interface before the first request arrives.
registerPlugin('storage',   dbPlugin);
registerPlugin('llm',       llmPlugin);
registerPlugin('validator', validatorPlugin);

// ─── In-memory rate limiter ───────────────────────────────────────────────────

const LLM_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LLM_RATE_MAX = parseInt(env('LLM_RATE_LIMIT', '20'), 10);
/** @type {Map<string, { count: number, resetAt: number }>} */
const rateCounts = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  let rec = rateCounts.get(ip);
  if (!rec || now > rec.resetAt) {
    rec = { count: 0, resetAt: now + LLM_RATE_WINDOW_MS };
    rateCounts.set(ip, rec);
  }
  rec.count += 1;
  return rec.count > LLM_RATE_MAX;
}

function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('cf-connecting-ip') ??
    'unknown'
  );
}

// ─── Response helpers ─────────────────────────────────────────────────────────

function json(data, { status = 200 } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Main fetch handler ───────────────────────────────────────────────────────

const LLM_PATHS = new Set([
  '/parties/generate', '/parties/query',
  '/contracts/generate', '/contracts/query',
]);

/**
 * Handle a single HTTP request.
 * Registered as the fetch handler for Deno.serve() or the Node bridge.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function handleRequest(request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    // GUI — served at / and /gui
    if (request.method === 'GET' && (path === '/' || path === '/gui')) {
      return new Response(guiPage, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Health check
    if (path === '/health') {
      return json({ status: 'ok' });
    }

    // GET /contracts/:id/premiums — list premiums for a contract
    if (request.method === 'GET' && /^\/contracts\/[^/]+\/premiums$/.test(path)) {
      const contractId = decodeURIComponent(path.split('/')[2]);
      const storage = getPlugin('storage');
      return json(await storage.queryPremiums({ contractId }));
    }

    // GET /premiums/:id/invoices — list invoices for a premium
    if (request.method === 'GET' && /^\/premiums\/[^/]+\/invoices$/.test(path)) {
      const premiumId = decodeURIComponent(path.split('/')[2]);
      const storage = getPlugin('storage');
      return json(await storage.queryInvoices({ premiumId }));
    }

    // GET /invoices/:id/payments — list payments for an invoice
    if (request.method === 'GET' && /^\/invoices\/[^/]+\/payments$/.test(path)) {
      const invoiceId = decodeURIComponent(path.split('/')[2]);
      const storage = getPlugin('storage');
      return json(await storage.queryPayments({ invoiceId }));
    }

    // GET /parties/:id/contracts — convenience: list contracts for a specific party
    // Must be checked before the general /parties/* handler
    if (request.method === 'GET' && /^\/parties\/[^/]+\/contracts$/.test(path)) {
      const partyId = decodeURIComponent(path.split('/')[2]);
      const storage = getPlugin('storage');
      return json(await storage.queryContracts({ partyId }));
    }

    // All /parties routes
    if (path === '/parties' || path.startsWith('/parties/')) {
      // Rate-limit LLM-backed endpoints
      if (LLM_PATHS.has(path)) {
        if (isRateLimited(getClientIp(request))) {
          return json(
            { error: 'Too many LLM requests. Please wait before trying again.' },
            { status: 429 },
          );
        }
      }
      return await partiesHandler(request);
    }

    // All /contracts routes
    if (path === '/contracts' || path.startsWith('/contracts/')) {
      // Rate-limit LLM-backed endpoints
      if (LLM_PATHS.has(path)) {
        if (isRateLimited(getClientIp(request))) {
          return json(
            { error: 'Too many LLM requests. Please wait before trying again.' },
            { status: 429 },
          );
        }
      }
      return await contractsHandler(request);
    }

    // All /premiums routes
    if (path === '/premiums' || path.startsWith('/premiums/')) {
      return await premiumsHandler(request);
    }

    // All /invoices routes
    if (path === '/invoices' || path.startsWith('/invoices/')) {
      return await invoicesHandler(request);
    }

    // All /payments routes
    if (path === '/payments' || path.startsWith('/payments/')) {
      return await paymentsHandler(request);
    }

    return json({ error: 'Not found.' }, { status: 404 });
  } catch (err) {
    console.error(err);
    return json(
      { error: err.message ?? 'Internal server error.' },
      { status: err.status ?? 500 },
    );
  }
}
