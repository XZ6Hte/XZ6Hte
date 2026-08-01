/**
 * src/plugins/llm-plugin.js — Default LLM plugin (OpenAI via llm.js)
 *
 * Wraps the llm.js module as an ILLMPlugin so it can be registered
 * with the plugin registry. Swap this file with any alternative
 * ILLMPlugin implementation to replace the language model backend.
 */

import { generateParty, extractQueryFilters, generateContract, extractContractQueryFilters } from '../llm.js';

/** @type {import('./interfaces.js').ILLMPlugin} */
export const llmPlugin = {
  generateParty,
  extractQueryFilters,
  generateContract,
  extractContractQueryFilters,
};
