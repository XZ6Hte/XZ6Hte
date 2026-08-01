'use strict';

require('dotenv').config();

const express = require('express');
const rateLimit = require('express-rate-limit');
const partiesRouter = require('./routes/parties');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));

// Rate-limit LLM-backed endpoints to prevent abuse
const llmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.LLM_RATE_LIMIT || '20', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many LLM requests. Please wait before trying again.' },
});

app.use('/parties/generate', llmLimiter);
app.use('/parties/query', llmLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/parties', partiesRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Error handler ────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error.' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Parties Manager API listening on http://localhost:${PORT}`);
});

module.exports = app;
