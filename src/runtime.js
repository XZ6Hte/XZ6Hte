/**
 * src/runtime.js — THE SWITCH
 *
 * Detects whether we are running inside Deno or Node.js and exports a
 * unified adapter surface. ALL runtime-specific branching lives here.
 * Every other source file is runtime-agnostic: it imports from this
 * module and works identically on both runtimes.
 *
 * Exports:
 *   env(key, fallback?)  – read an environment variable
 *   serve(handler, opts) – start an HTTP server with a WinterTC fetch handler
 *   createDb(path)       – open a better-sqlite3 Database instance
 */

// ─── Runtime detection ────────────────────────────────────────────────────────

const IS_DENO = typeof Deno !== 'undefined';

// ─── env ─────────────────────────────────────────────────────────────────────

/**
 * Read an environment variable.
 *   Deno  → Deno.env.get(key)
 *   Node  → process.env[key]
 *
 * @param {string} key
 * @param {string} [fallback]
 * @returns {string | undefined}
 */
export function env(key, fallback = undefined) {
  if (IS_DENO) {
    return Deno.env.get(key) ?? fallback;
  }
  return process.env[key] ?? fallback;
}

// ─── serve ────────────────────────────────────────────────────────────────────

/**
 * Start an HTTP server.
 *
 * `handler` must be a WinterTC-compatible fetch handler:
 *   (request: Request) => Response | Promise<Response>
 *
 *   Deno  → Deno.serve()
 *   Node  → node:http bridged to Web Request / Response
 *
 * @param {(req: Request) => Response | Promise<Response>} handler
 * @param {{ port?: number }} [opts]
 */
export async function serve(handler, { port = 3000 } = {}) {
  if (IS_DENO) {
    Deno.serve(
      {
        port,
        onListen({ port }) {
          console.log(`Parties Manager API listening on http://localhost:${port}`);
        },
      },
      handler,
    );
  } else {
    // Node.js: bridge node:http ↔ WinterTC Request / Response
    const { createServer } = await import('node:http');

    const server = createServer(async (nodeReq, nodeRes) => {
      // Build the full URL the request was made to
      const host = nodeReq.headers.host ?? `localhost:${port}`;
      const url = `http://${host}${nodeReq.url}`;

      // Collect the request body
      let bodyBuffer = null;
      if (nodeReq.method !== 'GET' && nodeReq.method !== 'HEAD') {
        bodyBuffer = await new Promise((resolve, reject) => {
          const chunks = [];
          nodeReq.on('data', (chunk) => chunks.push(chunk));
          nodeReq.on('end', () => resolve(Buffer.concat(chunks)));
          nodeReq.on('error', reject);
        });
      }

      // Convert Node headers → Web Headers
      const reqHeaders = new Headers();
      for (const [key, val] of Object.entries(nodeReq.headers)) {
        if (Array.isArray(val)) val.forEach((v) => reqHeaders.append(key, v));
        else if (val) reqHeaders.set(key, val);
      }

      const request = new Request(url, {
        method: nodeReq.method,
        headers: reqHeaders,
        body: bodyBuffer?.length ? bodyBuffer : null,
        // Required to send a body on Node's undici-based fetch
        duplex: 'half',
      });

      try {
        const response = await handler(request);

        // Convert Web Headers → plain object for Node
        const resHeaders = {};
        response.headers.forEach((v, k) => {
          resHeaders[k] = v;
        });

        nodeRes.writeHead(response.status, resHeaders);
        const buf = await response.arrayBuffer();
        nodeRes.end(Buffer.from(buf));
      } catch (err) {
        console.error('Unhandled server error:', err);
        if (!nodeRes.headersSent) {
          nodeRes.writeHead(500, { 'Content-Type': 'application/json' });
        }
        nodeRes.end(JSON.stringify({ error: 'Internal server error.' }));
      }
    });

    server.listen(port, () => {
      console.log(`Parties Manager API listening on http://localhost:${port}`);
    });
  }
}

// ─── createDb ────────────────────────────────────────────────────────────────

/**
 * Open a better-sqlite3 Database.
 *
 *   Deno  → imports `npm:better-sqlite3` (via deno.json import map)
 *   Node  → imports `better-sqlite3` from node_modules
 *
 * The returned object is a standard better-sqlite3 Database instance.
 * All callers receive the same API on both runtimes.
 *
 * @param {string} dbPath
 * @returns {Promise<import('better-sqlite3').Database>}
 */
export async function createDb(dbPath) {
  let Database;

  if (IS_DENO) {
    // deno.json maps 'better-sqlite3' → 'npm:better-sqlite3'
    const mod = await import('better-sqlite3');
    Database = mod.default;
  } else {
    const mod = await import('better-sqlite3');
    Database = mod.default;
  }

  return new Database(dbPath);
}
