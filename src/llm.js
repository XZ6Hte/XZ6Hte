'use strict';

const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const { SYSTEM_PROMPT, FEW_SHOT_MESSAGES, QUERY_EXTRACTION_SYSTEM } = require('./prompts/system');
const { validateParty } = require('./validator');

const MAX_CORRECTION_ATTEMPTS = 1;

let _client = null;

function getClient() {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set.');
    }
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

/**
 * Ask the LLM to generate one or more Party JSON-LD objects from a prompt.
 * Includes one auto-correction attempt if validation fails.
 *
 * @param {string} prompt
 * @returns {Promise<object>} JSON-LD Party object (or array)
 */
async function generateParty(prompt) {
  const messages = [
    ...FEW_SHOT_MESSAGES,
    { role: 'user', content: prompt },
  ];

  let raw = await callLLM(SYSTEM_PROMPT, messages);
  let parsed = parseJSON(raw);

  // Auto-correction loop
  for (let attempt = 0; attempt < MAX_CORRECTION_ATTEMPTS; attempt++) {
    const partiesToCheck = Array.isArray(parsed) ? parsed : [parsed];
    const allErrors = partiesToCheck.flatMap(p => {
      const result = validateParty(p);
      return result.errors;
    });

    if (allErrors.length === 0) break;

    const correctionMessages = [
      ...messages,
      { role: 'assistant', content: raw },
      {
        role: 'user',
        content: `The output has validation errors. Fix them and return corrected JSON only.\n\nErrors:\n${allErrors.join('\n')}`,
      },
    ];
    raw = await callLLM(SYSTEM_PROMPT, correctionMessages);
    parsed = parseJSON(raw);
  }

  // Ensure @id is set on top-level and each employee
  return ensureIds(parsed);
}

/**
 * Parse a natural-language query into database filter criteria.
 *
 * @param {string} nlQuery
 * @returns {Promise<{ type?: string, name?: string, addressLocality?: string }>}
 */
async function extractQueryFilters(nlQuery) {
  const raw = await callLLM(QUERY_EXTRACTION_SYSTEM, [
    { role: 'user', content: nlQuery },
  ]);
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function callLLM(systemPrompt, messages) {
  const client = getClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  const response = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature: 0.2,
  });

  return response.choices[0].message.content;
}

function parseJSON(raw) {
  if (!raw) throw new Error('LLM returned empty response.');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`LLM returned invalid JSON: ${err.message}\n\nRaw output:\n${raw}`);
  }
}

function ensureIds(data) {
  if (Array.isArray(data)) {
    return data.map(item => ensureIds(item));
  }
  if (data && typeof data === 'object') {
    if (!data['@id']) {
      data['@id'] = `urn:uuid:${uuidv4()}`;
    }
    if (Array.isArray(data.employee)) {
      data.employee = data.employee.map(emp => {
        if (emp && typeof emp === 'object' && !emp['@id']) {
          emp['@id'] = `urn:uuid:${uuidv4()}`;
        }
        return emp;
      });
    }
  }
  return data;
}

module.exports = { generateParty, extractQueryFilters };
