'use strict';

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { validateParty } = require('../validator');
const { generateParty, extractQueryFilters } = require('../llm');
const {
  createParty,
  getPartyById,
  updateParty,
  deleteParty,
  queryParties,
} = require('../db');

const router = Router();

// ─── POST /parties/generate ──────────────────────────────────────────────────
// Generate one or more Party JSON-LD objects from a natural-language prompt.
router.post('/generate', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: '"prompt" (string) is required.' });
  }

  const generated = await generateParty(prompt.trim());

  // Persist all generated parties (top-level + any nested employees with a known type)
  const parties = Array.isArray(generated) ? generated : [generated];
  const stored = [];
  for (const party of parties) {
    const { valid, errors } = validateParty(party);
    if (!valid) {
      return res.status(422).json({ error: 'Generated party failed validation.', errors, party });
    }
    stored.push(createParty(party));
  }

  res.status(201).json(stored.length === 1 ? stored[0] : stored);
});

// ─── POST /parties/validate ──────────────────────────────────────────────────
// Validate a Party JSON-LD object without storing it.
router.post('/validate', (req, res) => {
  const { data } = req.body;
  if (!data) {
    return res.status(400).json({ error: '"data" field is required.' });
  }
  const result = validateParty(data);
  res.json(result);
});

// ─── POST /parties/query ─────────────────────────────────────────────────────
// Natural-language query → filtered list of parties.
router.post('/query', async (req, res) => {
  const { nl_query } = req.body;
  if (!nl_query || typeof nl_query !== 'string' || !nl_query.trim()) {
    return res.status(400).json({ error: '"nl_query" (string) is required.' });
  }

  const filters = await extractQueryFilters(nl_query.trim());
  const results = queryParties(filters);
  res.json({ filters, results });
});

// ─── GET /parties ─────────────────────────────────────────────────────────────
// List all parties with optional query-string filters.
router.get('/', (req, res) => {
  const filters = {};
  if (req.query.type)            filters.type = req.query.type;
  if (req.query.name)            filters.name = req.query.name;
  if (req.query.addressLocality) filters.addressLocality = req.query.addressLocality;

  const results = queryParties(filters);
  res.json(results);
});

// ─── POST /parties ────────────────────────────────────────────────────────────
// Create a party from a user-supplied JSON-LD object.
router.post('/', (req, res) => {
  const party = req.body;
  if (!party || typeof party !== 'object' || Array.isArray(party)) {
    return res.status(400).json({ error: 'Request body must be a JSON-LD Party object.' });
  }

  // Assign an @id if missing
  if (!party['@id']) {
    party['@id'] = `urn:uuid:${uuidv4()}`;
  }

  const { valid, errors, suggestions } = validateParty(party);
  if (!valid) {
    return res.status(422).json({ valid: false, errors, suggestions });
  }

  res.status(201).json(createParty(party));
});

// ─── GET /parties/:id ─────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const party = getPartyById(decodeURIComponent(req.params.id));
  if (!party) return res.status(404).json({ error: 'Party not found.' });
  res.json(party);
});

// ─── PATCH /parties/:id ───────────────────────────────────────────────────────
// Merge patch into the existing party and re-validate.
router.patch('/:id', (req, res) => {
  const id = decodeURIComponent(req.params.id);
  const existing = getPartyById(id);
  if (!existing) return res.status(404).json({ error: 'Party not found.' });

  const patch = req.body;
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return res.status(400).json({ error: 'Request body must be a JSON patch object.' });
  }

  // Merge patch over existing; @id cannot be changed
  const merged = { ...existing, ...patch, '@id': id };

  const { valid, errors, suggestions } = validateParty(merged);
  if (!valid) {
    return res.status(422).json({ valid: false, errors, suggestions });
  }

  const updated = updateParty(id, merged);
  if (!updated) return res.status(404).json({ error: 'Party not found.' });
  res.json(updated);
});

// ─── DELETE /parties/:id ──────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const deleted = deleteParty(decodeURIComponent(req.params.id));
  if (!deleted) return res.status(404).json({ error: 'Party not found.' });
  res.status(204).end();
});

module.exports = router;
