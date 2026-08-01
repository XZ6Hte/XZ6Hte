/**
 * src/llm.js — LLM client
 *
 * Uses globalThis.fetch (WinterTC Web standard API) to call the OpenAI
 * Chat Completions endpoint directly — no SDK dependency required.
 * Works identically on Deno, Node 18+, and any WinterTC runtime.
 */

import { env } from './runtime.js';
import {
  SYSTEM_PROMPT, FEW_SHOT_MESSAGES, QUERY_EXTRACTION_SYSTEM,
  CONTRACT_SYSTEM_PROMPT, CONTRACT_FEW_SHOT_MESSAGES, CONTRACT_QUERY_EXTRACTION_SYSTEM,
} from './prompts/system.js';
import { validateParty } from './validator.js';
import { validateContract } from './validator-contract.js';

const MAX_CORRECTION_ATTEMPTS = 1;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Ask the LLM to generate one or more Party JSON-LD objects from a prompt.
 * Includes one auto-correction attempt if validation fails.
 *
 * @param {string} prompt
 * @returns {Promise<object>} JSON-LD Party object (or array)
 */
export async function generateParty(prompt) {
  const messages = [
    ...FEW_SHOT_MESSAGES,
    { role: 'user', content: prompt },
  ];

  let raw = await callLLM(SYSTEM_PROMPT, messages);
  let parsed = parseJSON(raw);

  // Auto-correction loop
  for (let attempt = 0; attempt < MAX_CORRECTION_ATTEMPTS; attempt++) {
    const partiesToCheck = Array.isArray(parsed) ? parsed : [parsed];
    const allErrors = partiesToCheck.flatMap((p) => {
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
export async function extractQueryFilters(nlQuery) {
  const raw = await callLLM(QUERY_EXTRACTION_SYSTEM, [
    { role: 'user', content: nlQuery },
  ]);
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

/**
 * Ask the LLM to generate one or more Contract JSON-LD objects from a prompt.
 * Includes one auto-correction attempt if validation fails.
 *
 * @param {string} prompt
 * @returns {Promise<object>} JSON-LD Contract object (or array)
 */
export async function generateContract(prompt) {
  const messages = [
    ...CONTRACT_FEW_SHOT_MESSAGES,
    { role: 'user', content: prompt },
  ];

  let raw = await callLLM(CONTRACT_SYSTEM_PROMPT, messages);
  let parsed = parseJSON(raw);

  // Auto-correction loop
  for (let attempt = 0; attempt < MAX_CORRECTION_ATTEMPTS; attempt++) {
    const contractsToCheck = Array.isArray(parsed) ? parsed : [parsed];
    const allErrors = contractsToCheck.flatMap((c) => {
      const result = validateContract(c);
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
    raw = await callLLM(CONTRACT_SYSTEM_PROMPT, correctionMessages);
    parsed = parseJSON(raw);
  }

  // Ensure @id is set
  return ensureContractIds(parsed);
}

/**
 * Parse a natural-language query into contract database filter criteria.
 *
 * @param {string} nlQuery
 * @returns {Promise<{ type?: string, name?: string, partyId?: string }>}
 */
export async function extractContractQueryFilters(nlQuery) {
  const raw = await callLLM(CONTRACT_QUERY_EXTRACTION_SYSTEM, [
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
  const apiKey = env('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is not set.');

  const model = env('OPENAI_MODEL', 'gpt-4o');

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
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
    return data.map((item) => ensureIds(item));
  }
  if (data && typeof data === 'object') {
    if (!data['@id']) {
      data['@id'] = `urn:uuid:${crypto.randomUUID()}`;
    }
    if (Array.isArray(data.employee)) {
      data.employee = data.employee.map((emp) => {
        if (emp && typeof emp === 'object' && !emp['@id']) {
          emp['@id'] = `urn:uuid:${crypto.randomUUID()}`;
        }
        return emp;
      });
    }
  }
  return data;
}

function ensureContractIds(data) {
  if (Array.isArray(data)) {
    return data.map((item) => ensureContractIds(item));
  }
  if (data && typeof data === 'object') {
    if (!data['@id']) {
      data['@id'] = `urn:uuid:${crypto.randomUUID()}`;
    }
    // Ensure party references have @id
    for (const field of ['provider', 'offeredBy', 'insuredParty']) {
      if (data[field] && typeof data[field] === 'object' && !data[field]['@id']) {
        data[field]['@id'] = `urn:uuid:${crypto.randomUUID()}`;
      }
    }
  }
  return data;
}
