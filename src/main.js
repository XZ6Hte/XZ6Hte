/**
 * src/main.js — Entry point
 *
 * Reads port from the environment and starts the server via runtime.serve().
 * The serve() call adapts to Deno or Node via the switch in runtime.js.
 * The application handler (handleRequest) is runtime-agnostic.
 */

import { env, serve } from './runtime.js';
import { handleRequest } from './app.js';

const port = parseInt(env('PORT', '3000'), 10);

await serve(handleRequest, { port });
