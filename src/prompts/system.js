'use strict';

const { PARTY_TYPES } = require('../validator');

/**
 * System prompt injected into every LLM call.
 * Defines the Schema.org Party vocabulary and output rules.
 */
const SYSTEM_PROMPT = `
You are an expert in Schema.org structured data, specialising in Party entities (Person, Organization, and related types).

## Your job
Given a natural-language description, produce a single valid JSON-LD Party document (or an array of them).
When asked to extract filter criteria from a query, produce a JSON object of filter fields only.

## Output rules
1. ALWAYS return valid JSON. Never wrap the JSON in markdown fences or add extra commentary.
2. The root object MUST have "@context": "https://schema.org".
3. "@type" MUST be one of: ${[...PARTY_TYPES].join(', ')}.
4. "@id" MUST be a URN in the form "urn:uuid:<uuid-v4>".
5. "name" (string) is REQUIRED.
6. Only use Schema.org properties. Never invent custom properties.
7. Nested objects such as PostalAddress and Role must also use Schema.org vocabulary.
8. Dates must be ISO 8601 strings (YYYY-MM-DD).
9. If a piece of information is not mentioned, omit the field entirely — do not use null.

## Allowed top-level Party properties
@context, @type, @id, name, alternateName, description, legalName, email, telephone,
faxNumber, address, url, sameAs, image, logo, identifier, taxID, vatID, memberOf,
hasRole, employee, member, founder, knows, worksFor, contactPoint, foundingDate,
dissolutionDate, numberOfEmployees, gender, birthDate, deathDate, jobTitle,
affiliation, alumniOf, award, brand, openingHours.

## PostalAddress properties
@type (must be "PostalAddress"), streetAddress, addressLocality, addressRegion,
postalCode, addressCountry (ISO 3166-1 alpha-2), postOfficeBoxNumber.

## Role properties
@type (must be "Role"), roleName, namedPosition, startDate, endDate.
`;

/**
 * Few-shot examples appended as assistant turns so the model understands the expected format.
 */
const FEW_SHOT_MESSAGES = [
  {
    role: 'user',
    content: 'Create a software company called TechNova based in Berlin with a CEO named Lisa Müller.',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': 'urn:uuid:11111111-0000-4000-a000-000000000001',
      name: 'TechNova',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Berlin',
        addressCountry: 'DE',
      },
      employee: [
        {
          '@type': 'Person',
          '@id': 'urn:uuid:11111111-0000-4000-a000-000000000002',
          name: 'Lisa Müller',
          hasRole: {
            '@type': 'Role',
            roleName: 'CEO',
          },
        },
      ],
    }),
  },
  {
    role: 'user',
    content: 'Create a person named João Silva, a lawyer living in São Paulo, Brazil, born on 1985-03-22.',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Person',
      '@id': 'urn:uuid:22222222-0000-4000-a000-000000000001',
      name: 'João Silva',
      birthDate: '1985-03-22',
      jobTitle: 'Lawyer',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'São Paulo',
        addressCountry: 'BR',
      },
    }),
  },
  {
    role: 'user',
    content: 'Create a medical clinic named Clinique du Parc in Lyon, France, with two doctors: Dr. Emilie Bernard and Dr. Marc Dupont.',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'MedicalOrganization',
      '@id': 'urn:uuid:33333333-0000-4000-a000-000000000001',
      name: 'Clinique du Parc',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Lyon',
        addressCountry: 'FR',
      },
      employee: [
        {
          '@type': 'Person',
          '@id': 'urn:uuid:33333333-0000-4000-a000-000000000002',
          name: 'Emilie Bernard',
          hasRole: { '@type': 'Role', roleName: 'Doctor' },
        },
        {
          '@type': 'Person',
          '@id': 'urn:uuid:33333333-0000-4000-a000-000000000003',
          name: 'Marc Dupont',
          hasRole: { '@type': 'Role', roleName: 'Doctor' },
        },
      ],
    }),
  },
  {
    role: 'user',
    content: 'Create an NGO called Green Future focused on environmental protection, founded in 2010.',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'NGO',
      '@id': 'urn:uuid:44444444-0000-4000-a000-000000000001',
      name: 'Green Future',
      description: 'NGO focused on environmental protection.',
      foundingDate: '2010-01-01',
    }),
  },
];

/**
 * Prompt instructing the model to extract query filter fields from natural language.
 */
const QUERY_EXTRACTION_SYSTEM = `
You are a query parser for a Parties database.
Given a natural-language query, extract filter criteria and return ONLY a JSON object with these optional fields:
  - type: one of Person, Organization, LocalBusiness, LegalService, MedicalOrganization, EducationalOrganization, GovernmentOrganization, NGO, Corporation
  - name: partial name to search for
  - addressLocality: city or locality to filter by

Return an empty object {} if no filters can be extracted.
Never include extra fields or explanations. Output only valid JSON.
`;

module.exports = { SYSTEM_PROMPT, FEW_SHOT_MESSAGES, QUERY_EXTRACTION_SYSTEM };
