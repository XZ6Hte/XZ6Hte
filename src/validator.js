/**
 * Schema.org-aware validator for Party JSON-LD documents.
 *
 * Rules enforced:
 *  1. @context must be "https://schema.org" (or equivalent)
 *  2. @type must be a known Party-compatible Schema.org type
 *  3. name (string) is required
 *  4. @id is required
 *  5. No unknown (non-Schema.org) top-level properties
 *  6. Nested PostalAddress is validated when present
 *  7. Nested Role objects are validated when present
 *
 * Pure logic — no runtime-specific APIs. Works on Deno, Node, and any
 * WinterTC-compatible runtime without modification.
 */

export const SCHEMA_CONTEXTS = new Set([
  'https://schema.org',
  'https://schema.org/',
  'http://schema.org',
  'http://schema.org/',
]);

export const PARTY_TYPES = new Set([
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

/** All Schema.org properties accepted at the Party level. */
const PARTY_PROPERTIES = new Set([
  '@context', '@type', '@id',
  'name', 'alternateName', 'description', 'legalName',
  'email', 'telephone', 'faxNumber',
  'address', 'url', 'sameAs', 'image', 'logo',
  'identifier', 'taxID', 'vatID',
  'memberOf', 'hasRole', 'employee', 'member', 'founder',
  'knows', 'worksFor', 'contactPoint',
  'foundingDate', 'dissolutionDate',
  'numberOfEmployees', 'numberOfRooms',
  'gender', 'birthDate', 'deathDate',
  'jobTitle', 'affiliation', 'alumniOf',
  'award', 'brand', 'owns',
  'openingHours', 'currenciesAccepted', 'paymentAccepted', 'priceRange',
]);

const ADDRESS_PROPERTIES = new Set([
  '@type',
  'streetAddress', 'addressLocality', 'addressRegion',
  'postalCode', 'addressCountry', 'postOfficeBoxNumber',
]);

const ROLE_PROPERTIES = new Set([
  '@type', 'roleName', 'namedPosition', 'startDate', 'endDate',
]);

/**
 * Validate a JSON-LD Party object.
 *
 * @param {unknown} data
 * @returns {{ valid: boolean, errors: string[], suggestions: string[] }}
 */
export function validateParty(data) {
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
    errors.push('Missing "@type". Must be a Party type such as "Person" or "Organization".');
    suggestions.push(`Valid types: ${[...PARTY_TYPES].join(', ')}.`);
  } else if (!PARTY_TYPES.has(type)) {
    errors.push(`"@type" "${type}" is not a recognised Party type.`);
    suggestions.push(`Valid Party types are: ${[...PARTY_TYPES].join(', ')}.`);
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

  // 5. Unknown top-level properties
  for (const key of Object.keys(data)) {
    if (!PARTY_PROPERTIES.has(key)) {
      errors.push(`Unknown property "${key}" is not part of the Schema.org Party vocabulary.`);
      suggestions.push(`Remove or rename "${key}". Allowed properties: ${[...PARTY_PROPERTIES].join(', ')}.`);
    }
  }

  // 6. address validation
  if (data.address !== undefined) {
    const addrErrors = validateAddress(data.address);
    errors.push(...addrErrors);
  }

  // 7. hasRole validation
  if (data.hasRole !== undefined) {
    const roles = Array.isArray(data.hasRole) ? data.hasRole : [data.hasRole];
    roles.forEach((role, i) => {
      const roleErrors = validateRole(role, i);
      errors.push(...roleErrors);
    });
  }

  // 8. employee array validation
  if (data.employee !== undefined) {
    const employees = Array.isArray(data.employee) ? data.employee : [data.employee];
    employees.forEach((emp, i) => {
      if (emp && typeof emp === 'object') {
        const nested = validateParty({ '@context': ctx, ...emp });
        nested.errors.forEach((e) => errors.push(`employee[${i}]: ${e}`));
      }
    });
  }

  return { valid: errors.length === 0, errors, suggestions };
}

function validateAddress(addr) {
  const errors = [];
  if (!addr || typeof addr !== 'object') {
    errors.push('"address" must be a PostalAddress object.');
    return errors;
  }
  if (addr['@type'] && addr['@type'] !== 'PostalAddress') {
    errors.push(`"address.@type" must be "PostalAddress", got "${addr['@type']}".`);
  }
  for (const key of Object.keys(addr)) {
    if (!ADDRESS_PROPERTIES.has(key)) {
      errors.push(`Unknown address property "${key}". Use Schema.org PostalAddress properties.`);
    }
  }
  return errors;
}

function validateRole(role, index) {
  const errors = [];
  if (!role || typeof role !== 'object') {
    errors.push(`hasRole[${index}] must be a Role object.`);
    return errors;
  }
  for (const key of Object.keys(role)) {
    if (!ROLE_PROPERTIES.has(key)) {
      errors.push(`hasRole[${index}]: unknown property "${key}". Use Schema.org Role properties.`);
    }
  }
  if (role.startDate && !/^\d{4}-\d{2}-\d{2}/.test(role.startDate)) {
    errors.push(`hasRole[${index}].startDate must be an ISO 8601 date string (YYYY-MM-DD).`);
  }
  if (role.endDate && !/^\d{4}-\d{2}-\d{2}/.test(role.endDate)) {
    errors.push(`hasRole[${index}].endDate must be an ISO 8601 date string (YYYY-MM-DD).`);
  }
  return errors;
}
