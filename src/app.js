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

const LLM_PATHS = new Set(['/parties/generate', '/parties/query']);

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

    // Health check
    if (path === '/health') {
      return json({ status: 'ok' });
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

    return json({ error: 'Not found.' }, { status: 404 });
  } catch (err) {
    console.error(err);
    return json(
      { error: err.message ?? 'Internal server error.' },
      { status: err.status ?? 500 },
    );
  }
}
