/**
 * src/plugins/validator-plugin.js — Default validator plugin (validator.js)
 *
 * Wraps the validator.js module as an IValidatorPlugin so it can be
 * registered with the plugin registry. Swap this file with any alternative
 * IValidatorPlugin implementation to replace the validation logic.
 */

import { validateParty } from '../validator.js';

/** @type {import('./interfaces.js').IValidatorPlugin} */
export const validatorPlugin = {
  validateParty,
};
