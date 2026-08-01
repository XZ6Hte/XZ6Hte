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
 * @property {(premium: object) => Promise<object>}               createPremium
 * @property {(id: string) => Promise<object|null>}               getPremiumById
 * @property {(id: string, premium: object) => Promise<object|null>} updatePremium
 * @property {(id: string) => Promise<boolean>}                   deletePremium
 * @property {(filters?: object) => Promise<object[]>}            queryPremiums
 * @property {(invoice: object) => Promise<object>}               createInvoice
 * @property {(id: string) => Promise<object|null>}               getInvoiceById
 * @property {(id: string, invoice: object) => Promise<object|null>} updateInvoice
 * @property {(id: string) => Promise<boolean>}                   deleteInvoice
 * @property {(filters?: object) => Promise<object[]>}            queryInvoices
 * @property {() => Promise<object[]>}                            getOpenInvoices
 * @property {(payment: object) => Promise<object>}               createPayment
 * @property {(id: string) => Promise<object|null>}               getPaymentById
 * @property {(id: string, payment: object) => Promise<object|null>} updatePayment
 * @property {(id: string) => Promise<boolean>}                   deletePayment
 * @property {(filters?: object) => Promise<object[]>}            queryPayments
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
 * @property {(data: unknown) => { valid: boolean, errors: string[], suggestions: string[] }} validatePremium
 * @property {(data: unknown) => { valid: boolean, errors: string[], suggestions: string[] }} validateInvoice
 * @property {(data: unknown) => { valid: boolean, errors: string[], suggestions: string[] }} validatePayment
 */

// ─── Guards ───────────────────────────────────────────────────────────────────

const STORAGE_METHODS   = ['createParty', 'getPartyById', 'updateParty', 'deleteParty', 'queryParties',
                           'createContract', 'getContractById', 'updateContract', 'deleteContract', 'queryContracts',
                           'createPremium', 'getPremiumById', 'updatePremium', 'deletePremium', 'queryPremiums',
                           'createInvoice', 'getInvoiceById', 'updateInvoice', 'deleteInvoice', 'queryInvoices', 'getOpenInvoices',
                           'createPayment', 'getPaymentById', 'updatePayment', 'deletePayment', 'queryPayments'];
const LLM_METHODS       = ['generateParty', 'extractQueryFilters', 'generateContract', 'extractContractQueryFilters'];
const VALIDATOR_METHODS = ['validateParty', 'validateContract', 'validatePremium', 'validateInvoice', 'validatePayment'];

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
