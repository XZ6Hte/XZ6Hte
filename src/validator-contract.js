/**
 * Schema.org-aware validator for Contract/Insurance JSON-LD documents.
 *
 * Rules enforced:
 *  1. @context must be "https://schema.org" (or equivalent)
 *  2. @type must be a known Contract-compatible Schema.org type
 *  3. name (string) is required
 *  4. @id is required
 *  5. At least one party reference (provider, offeredBy, or insuredParty) is required
 *  6. No unknown top-level properties (insuredParty is a permitted domain extension)
 *  7. provider / offeredBy / insuredParty references are validated when present
 *  8. Date fields (validFrom, validThrough) must be ISO 8601 strings
 *
 * Pure logic — no runtime-specific APIs. Works on Deno, Node, and any
 * WinterTC-compatible runtime without modification.
 */

import { SCHEMA_CONTEXTS } from './validator.js';

export const CONTRACT_TYPES = new Set([
  'FinancialProduct',
  'HealthInsurancePlan',
]);

/** Schema.org types that are valid for provider / insuredParty references. */
const PARTY_REF_TYPES = new Set([
  'Person',
  'Organization',
  'LocalBusiness',
  'InsuranceAgency',
  'LegalService',
  'MedicalOrganization',
  'EducationalOrganization',
  'GovernmentOrganization',
  'NGO',
  'Corporation',
]);

/**
 * All Schema.org properties (plus the domain extension "insuredParty") accepted
 * at the Contract level.
 */
const CONTRACT_PROPERTIES = new Set([
  '@context', '@type', '@id',
  'name', 'alternateName', 'description',
  'provider',           // insurer: Organization / InsuranceAgency ref
  'offeredBy',          // synonym for provider (schema:offeredBy)
  'insuredParty',       // domain extension — policyholder Party @id ref
  'feesAndCommissionsSpecification',
  'areaServed',
  'identifier',
  'url', 'sameAs', 'image',
  'annualPercentageRate',
  'interestRate',
  'validFrom',
  'validThrough',
  // HealthInsurancePlan-specific
  'healthPlanId',
  'healthPlanMarketingUrl',
  'includesHealthPlanNetwork',
  'healthPlanDrugOption',
  'usesHealthPlanIdStandard',
]);

/**
 * Validate a JSON-LD Contract object.
 *
 * @param {unknown} data
 * @returns {{ valid: boolean, errors: string[], suggestions: string[] }}
 */
export function validateContract(data) {
  const errors = [];
  const suggestions = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Input must be a JSON object.'], suggestions: [] };
  }

  // 1. @context
  const ctx = data['@context'];
  if (!ctx) {
    errors.push('Missing "@context". It must be "https://schema.org".');
    suggestions.push('Add "@context": "https://schema.org" to the root of your object.');
  } else if (!SCHEMA_CONTEXTS.has(ctx)) {
    errors.push(`"@context" must be "https://schema.org", got "${ctx}".`);
  }

  // 2. @type
  const type = data['@type'];
  if (!type) {
    errors.push('Missing "@type". Must be a Contract type such as "FinancialProduct" or "HealthInsurancePlan".');
    suggestions.push(`Valid types: ${[...CONTRACT_TYPES].join(', ')}.`);
  } else if (!CONTRACT_TYPES.has(type)) {
    errors.push(`"@type" "${type}" is not a recognised Contract type.`);
    suggestions.push(`Valid Contract types are: ${[...CONTRACT_TYPES].join(', ')}.`);
  }

  // 3. @id
  if (!data['@id']) {
    errors.push('Missing "@id". Provide a URI or URN identifier (e.g. "urn:uuid:<uuid>").');
    suggestions.push('Generate a UUID with crypto.randomUUID() and prefix it with "urn:uuid:".');
  }

  // 4. name
  if (!data.name) {
    errors.push('Missing required field "name" (schema:name).');
  } else if (typeof data.name !== 'string') {
    errors.push('"name" must be a string.');
  }

  // 5. At least one party reference
  if (!data.provider && !data.offeredBy && !data.insuredParty) {
    errors.push(
      'At least one party reference is required: "provider" (insurer) or "insuredParty" (policyholder).',
    );
    suggestions.push(
      'Add "provider": { "@type": "InsuranceAgency", "@id": "...", "name": "..." } for the insurer, ' +
      'or "insuredParty": { "@id": "..." } for the policyholder.',
    );
  }

  // 6. Unknown top-level properties
  for (const key of Object.keys(data)) {
    if (!CONTRACT_PROPERTIES.has(key)) {
      errors.push(`Unknown property "${key}" is not part of the Schema.org Contract vocabulary.`);
      suggestions.push(
        `Remove or rename "${key}". Allowed properties: ${[...CONTRACT_PROPERTIES].join(', ')}.`,
      );
    }
  }

  // 7. provider / offeredBy reference validation
  for (const field of ['provider', 'offeredBy']) {
    if (data[field] !== undefined) {
      errors.push(...validatePartyRef(data[field], field));
    }
  }

  // 8. insuredParty reference validation
  if (data.insuredParty !== undefined) {
    errors.push(...validatePartyRef(data.insuredParty, 'insuredParty'));
  }

  // 9. Date field validation
  for (const dateField of ['validFrom', 'validThrough']) {
    if (data[dateField] !== undefined) {
      if (typeof data[dateField] !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(data[dateField])) {
        errors.push(`"${dateField}" must be an ISO 8601 date string (YYYY-MM-DD).`);
      }
    }
  }

  return { valid: errors.length === 0, errors, suggestions };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate a party reference (provider, offeredBy, insuredParty).
 * Accepts either a URI string or an inline party object.
 *
 * @param {unknown} ref
 * @param {string}  field  Property name (for error messages)
 * @returns {string[]}
 */
function validatePartyRef(ref, field) {
  const errors = [];
  if (typeof ref === 'string') {
    // URI string reference — valid
    return errors;
  }
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
    errors.push(`"${field}" must be a party reference object or a URI string.`);
    return errors;
  }
  if (ref['@type'] && !PARTY_REF_TYPES.has(ref['@type'])) {
    errors.push(
      `"${field}.@type" "${ref['@type']}" is not a recognised party type. ` +
      `Use one of: ${[...PARTY_REF_TYPES].join(', ')}.`,
    );
  }
  if (!ref['@id'] && !ref.name) {
    errors.push(`"${field}" must have at least "@id" or "name" to identify the party.`);
  }
  return errors;
}
