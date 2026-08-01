/**
 * src/plugins/interfaces.js — Plugin interface contracts
 *
 * Defines the expected shape of each plugin slot via JSDoc typedefs and
 * guard functions. Calling an assert* function throws a TypeError if the
 * supplied object does not satisfy the interface, allowing the registry to
 * reject invalid plugins at registration time rather than at call time.
 *
 * Pure logic — no runtime-specific APIs. Works on Deno, Node, and any
 * WinterTC-compatible runtime without modification.
 */

// ─── Typedefs ─────────────────────────────────────────────────────────────────

/**
 * @typedef {object} IStoragePlugin
 * @property {(party: object) => Promise<object>}              createParty
 * @property {(id: string) => Promise<object|null>}            getPartyById
 * @property {(id: string, party: object) => Promise<object|null>} updateParty
 * @property {(id: string) => Promise<boolean>}                deleteParty
 * @property {(filters?: object) => Promise<object[]>}         queryParties
 * @property {(contract: object) => Promise<object>}              createContract
 * @property {(id: string) => Promise<object|null>}               getContractById
 * @property {(id: string, contract: object) => Promise<object|null>} updateContract
 * @property {(id: string) => Promise<boolean>}                   deleteContract
 * @property {(filters?: object) => Promise<object[]>}            queryContracts
 */

/**
 * @typedef {object} ILLMPlugin
 * @property {(prompt: string) => Promise<object>}             generateParty
 * @property {(nlQuery: string) => Promise<object>}            extractQueryFilters
 * @property {(prompt: string) => Promise<object>}             generateContract
 * @property {(nlQuery: string) => Promise<object>}            extractContractQueryFilters
 */

/**
 * @typedef {object} IValidatorPlugin
 * @property {(data: unknown) => { valid: boolean, errors: string[], suggestions: string[] }} validateParty
 * @property {(data: unknown) => { valid: boolean, errors: string[], suggestions: string[] }} validateContract
 */

// ─── Guards ───────────────────────────────────────────────────────────────────

const STORAGE_METHODS   = ['createParty', 'getPartyById', 'updateParty', 'deleteParty', 'queryParties',
                           'createContract', 'getContractById', 'updateContract', 'deleteContract', 'queryContracts'];
const LLM_METHODS       = ['generateParty', 'extractQueryFilters', 'generateContract', 'extractContractQueryFilters'];
const VALIDATOR_METHODS = ['validateParty', 'validateContract'];

function assertMethods(plugin, methods, interfaceName) {
  for (const method of methods) {
    if (typeof plugin[method] !== 'function') {
      throw new TypeError(
        `Plugin does not satisfy ${interfaceName}: missing method "${method}".`,
      );
    }
  }
}

/** @param {unknown} plugin */
export function assertStoragePlugin(plugin)   { assertMethods(plugin, STORAGE_METHODS,   'IStoragePlugin'); }

/** @param {unknown} plugin */
export function assertLLMPlugin(plugin)       { assertMethods(plugin, LLM_METHODS,       'ILLMPlugin'); }

/** @param {unknown} plugin */
export function assertValidatorPlugin(plugin) { assertMethods(plugin, VALIDATOR_METHODS, 'IValidatorPlugin'); }
