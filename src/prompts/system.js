/**
 * src/prompts/system.js
 *
 * System prompt and few-shot examples for the LLM.
 * Pure data — no runtime-specific APIs.
 */

import { PARTY_TYPES } from '../validator.js';

/**
 * System prompt injected into every LLM call.
 * Defines the Schema.org Party vocabulary and output rules.
 */
export const SYSTEM_PROMPT = `
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
export const FEW_SHOT_MESSAGES = [
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
export const QUERY_EXTRACTION_SYSTEM = `
You are a query parser for a Parties database.
Given a natural-language query, extract filter criteria and return ONLY a JSON object with these optional fields:
  - type: one of Person, Organization, LocalBusiness, InsuranceAgency, LegalService, MedicalOrganization, EducationalOrganization, GovernmentOrganization, NGO, Corporation
  - name: partial name to search for
  - addressLocality: city or locality to filter by

Return an empty object {} if no filters can be extracted.
Never include extra fields or explanations. Output only valid JSON.
`;

// ─── Contract prompts ──────────────────────────────────────────────────────────

import { CONTRACT_TYPES } from '../validator-contract.js';

/**
 * System prompt for generating Contract JSON-LD objects.
 * Covers engineering insurance (technische Versicherungen) as the primary domain.
 */
export const CONTRACT_SYSTEM_PROMPT = `
You are an expert in Schema.org structured data, specialising in engineering insurance contracts
(technische Versicherungen: Bauleistung, Montage, Maschinen stationär/fahrbar, Elektronik)
as well as general financial products and health insurance.

## Your job
Given a natural-language description, produce a single valid JSON-LD Contract document (or an array of them).
When asked to extract filter criteria from a query, produce a JSON object of filter fields only.

## Output rules
1. ALWAYS return valid JSON. Never wrap the JSON in markdown fences or add extra commentary.
2. The root object MUST have "@context": "https://schema.org".
3. "@type" MUST be one of: ${[...CONTRACT_TYPES].join(', ')}.
4. "@id" MUST be a URN in the form "urn:uuid:<uuid-v4>".
5. "name" (string) is REQUIRED (e.g. the policy or product name).
6. At least one party reference is REQUIRED: "provider" (the insurer) or "insuredParty" (the policyholder).
7. Only use Schema.org properties plus the domain extensions listed below. Never invent other custom properties.
8. "provider" and "insuredParty" must each have "@id" and/or "name".
9. "provider.@type" should be "InsuranceAgency" or another Organisation type.
10. "insuredParty.@type" should be "Person" or an Organisation type.
11. Dates must be ISO 8601 strings (YYYY-MM-DD).
12. If a piece of information is not mentioned, omit the field entirely — do not use null.

## Engineering insurance @type mapping (technische Versicherungen)
- ConstructionInsurance       → Bauleistungsversicherung (Construction All Risk, CAR)
- ErectionInsurance           → Montageversicherung (Erection All Risk, EAR)
- MachineryInsurance          → Maschinenversicherung stationär (Machinery Breakdown, MB)
- MobileMachineryInsurance    → Maschinenversicherung fahrbar (Mobile Machinery, CAM)
- ElectronicEquipmentInsurance→ Elektronikversicherung (Electronic Equipment, EEI)

## Allowed top-level Contract properties
@context, @type, @id, name, alternateName, description,
provider, offeredBy, insuredParty,
feesAndCommissionsSpecification, areaServed,
identifier, url, sameAs, image,
annualPercentageRate, interestRate,
validFrom, validThrough,
healthPlanId, healthPlanMarketingUrl, includesHealthPlanNetwork,
healthPlanDrugOption, usesHealthPlanIdStandard,
insuredObject, insuredSum, constructionSite, projectDuration,
deductible, coverageExtensions, machineryType, manufactureYear, serialNumber.

## provider / offeredBy properties
@type (InsuranceAgency, Organization, …), @id, name, url.

## insuredParty properties (domain extension — policyholder)
@type (Person, Organization, …), @id, name.

## Engineering insurance extension properties
- insuredObject:       Free-text description of the insured item, project, or machine.
- insuredSum:          Sum insured as a string including currency (e.g. "EUR 5,000,000").
- constructionSite:    PostalAddress of the construction or erection site.
- projectDuration:     Project duration as ISO 8601 duration (e.g. "P18M") or free text.
- deductible:          Deductible / Selbstbehalt as a string with amount (e.g. "EUR 5,000").
- coverageExtensions:  Array of strings listing additional coverage clauses.
- machineryType:       "stationary" for MB policies, "mobile" for CAM policies.
- manufactureYear:     Year the machine/equipment was manufactured (number).
- serialNumber:        Machine or equipment serial / chassis number (string).
`;

/**
 * Few-shot examples for contract generation.
 * Covers both general insurance and engineering insurance (technische Versicherungen).
 */
export const CONTRACT_FEW_SHOT_MESSAGES = [
  {
    role: 'user',
    content: 'Create a comprehensive home insurance policy called "Komplett-Schutz" offered by Allianz Germany to customer Maria Schmidt.',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FinancialProduct',
      '@id': 'urn:uuid:aaaaaaaa-0000-4000-a000-000000000001',
      name: 'Komplett-Schutz',
      description: 'Comprehensive home insurance covering fire, water damage, and theft.',
      provider: {
        '@type': 'InsuranceAgency',
        '@id': 'urn:uuid:aaaaaaaa-0000-4000-a000-000000000002',
        name: 'Allianz Germany',
        url: 'https://www.allianz.de',
      },
      insuredParty: {
        '@type': 'Person',
        '@id': 'urn:uuid:aaaaaaaa-0000-4000-a000-000000000003',
        name: 'Maria Schmidt',
      },
      areaServed: 'DE',
      validFrom: '2024-01-01',
      validThrough: '2024-12-31',
      feesAndCommissionsSpecification: 'Monthly premium: €45.00',
    }),
  },
  {
    role: 'user',
    content: 'Create a health insurance plan called "Basic Health Plan 2024" offered by AOK for the Hamburg region.',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'HealthInsurancePlan',
      '@id': 'urn:uuid:bbbbbbbb-0000-4000-a000-000000000001',
      name: 'Basic Health Plan 2024',
      description: 'Statutory health insurance plan covering general medical services.',
      provider: {
        '@type': 'InsuranceAgency',
        '@id': 'urn:uuid:bbbbbbbb-0000-4000-a000-000000000002',
        name: 'AOK',
        url: 'https://www.aok.de',
      },
      areaServed: 'Hamburg',
      validFrom: '2024-01-01',
      validThrough: '2024-12-31',
    }),
  },
  {
    role: 'user',
    content: 'Create a construction all-risk policy called "CAR Brücke A40" for a highway bridge project by Bauunternehmen Mayer GmbH, insured by HDI, sum insured EUR 12,000,000, project runs 18 months from 2024-03-01, deductible EUR 10,000.',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ConstructionInsurance',
      '@id': 'urn:uuid:cccccccc-0000-4000-a000-000000000001',
      name: 'CAR Brücke A40',
      description: 'Construction All Risk insurance for a highway bridge project on the A40.',
      provider: {
        '@type': 'InsuranceAgency',
        '@id': 'urn:uuid:cccccccc-0000-4000-a000-000000000002',
        name: 'HDI Versicherung AG',
        url: 'https://www.hdi.de',
      },
      insuredParty: {
        '@type': 'Organization',
        '@id': 'urn:uuid:cccccccc-0000-4000-a000-000000000003',
        name: 'Bauunternehmen Mayer GmbH',
      },
      insuredObject: 'Highway bridge construction on the A40 motorway, including earthworks, concrete works, and steel superstructure.',
      insuredSum: 'EUR 12,000,000',
      projectDuration: 'P18M',
      validFrom: '2024-03-01',
      validThrough: '2025-08-31',
      deductible: 'EUR 10,000',
      areaServed: 'DE',
    }),
  },
  {
    role: 'user',
    content: 'Create an erection all-risk policy "EAR Turbine Unit 3" for the installation of a gas turbine by Siemens Energy, insured by Munich Re, sum insured EUR 25,000,000, site in Mannheim, valid from 2024-06-01 for 12 months.',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ErectionInsurance',
      '@id': 'urn:uuid:dddddddd-0000-4000-a000-000000000001',
      name: 'EAR Turbine Unit 3',
      description: 'Erection All Risk insurance for the installation of a gas turbine (Unit 3).',
      provider: {
        '@type': 'InsuranceAgency',
        '@id': 'urn:uuid:dddddddd-0000-4000-a000-000000000002',
        name: 'Munich Re',
        url: 'https://www.munichre.com',
      },
      insuredParty: {
        '@type': 'Organization',
        '@id': 'urn:uuid:dddddddd-0000-4000-a000-000000000003',
        name: 'Siemens Energy AG',
      },
      insuredObject: 'Gas turbine Unit 3 including auxiliary systems, erection, testing, and commissioning.',
      insuredSum: 'EUR 25,000,000',
      constructionSite: {
        '@type': 'PostalAddress',
        addressLocality: 'Mannheim',
        addressCountry: 'DE',
      },
      validFrom: '2024-06-01',
      validThrough: '2025-05-31',
      areaServed: 'DE',
    }),
  },
  {
    role: 'user',
    content: 'Create a machinery breakdown policy "MB Kompressor K-7" for a stationary air compressor (serial 48291-X, manufactured 2019) owned by ChemPlant GmbH, insured by Zurich, sum insured EUR 800,000.',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'MachineryInsurance',
      '@id': 'urn:uuid:eeeeeeee-0000-4000-a000-000000000001',
      name: 'MB Kompressor K-7',
      description: 'Machinery breakdown insurance for stationary air compressor K-7.',
      provider: {
        '@type': 'InsuranceAgency',
        '@id': 'urn:uuid:eeeeeeee-0000-4000-a000-000000000002',
        name: 'Zurich Insurance',
        url: 'https://www.zurich.de',
      },
      insuredParty: {
        '@type': 'Organization',
        '@id': 'urn:uuid:eeeeeeee-0000-4000-a000-000000000003',
        name: 'ChemPlant GmbH',
      },
      insuredObject: 'Stationary air compressor K-7, including drive motor and control systems.',
      insuredSum: 'EUR 800,000',
      machineryType: 'stationary',
      serialNumber: '48291-X',
      manufactureYear: 2019,
    }),
  },
  {
    role: 'user',
    content: 'Create a mobile machinery policy "CAM Bagger 3" for an excavator (chassis XJ-99342, 2021) owned by Erdmann Tiefbau, provided by Allianz, sum insured EUR 350,000.',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'MobileMachineryInsurance',
      '@id': 'urn:uuid:ffffffff-0000-4000-a000-000000000001',
      name: 'CAM Bagger 3',
      description: 'Mobile machinery insurance for excavator (Bagger 3).',
      provider: {
        '@type': 'InsuranceAgency',
        '@id': 'urn:uuid:ffffffff-0000-4000-a000-000000000002',
        name: 'Allianz Germany',
        url: 'https://www.allianz.de',
      },
      insuredParty: {
        '@type': 'Organization',
        '@id': 'urn:uuid:ffffffff-0000-4000-a000-000000000003',
        name: 'Erdmann Tiefbau GmbH',
      },
      insuredObject: 'Hydraulic excavator (Bagger 3) including attachments.',
      insuredSum: 'EUR 350,000',
      machineryType: 'mobile',
      serialNumber: 'XJ-99342',
      manufactureYear: 2021,
    }),
  },
  {
    role: 'user',
    content: 'Create an electronic equipment insurance "EEI Serverpark Rechenzentrum Nord" for a data centre server farm owned by DataHub AG, insured by Generali, sum insured EUR 4,500,000, deductible EUR 2,500.',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ElectronicEquipmentInsurance',
      '@id': 'urn:uuid:11111111-1111-4000-a000-000000000001',
      name: 'EEI Serverpark Rechenzentrum Nord',
      description: 'Electronic equipment insurance for the server farm at Rechenzentrum Nord.',
      provider: {
        '@type': 'InsuranceAgency',
        '@id': 'urn:uuid:11111111-1111-4000-a000-000000000002',
        name: 'Generali Deutschland AG',
        url: 'https://www.generali.de',
      },
      insuredParty: {
        '@type': 'Organization',
        '@id': 'urn:uuid:11111111-1111-4000-a000-000000000003',
        name: 'DataHub AG',
      },
      insuredObject: 'Server farm including racks, networking equipment, UPS systems, and cooling infrastructure at Rechenzentrum Nord.',
      insuredSum: 'EUR 4,500,000',
      deductible: 'EUR 2,500',
    }),
  },
];

/**
 * Prompt for extracting contract query filters from natural language.
 */
export const CONTRACT_QUERY_EXTRACTION_SYSTEM = `
You are a query parser for a Contracts database covering engineering insurance (technische Versicherungen)
and general insurance products.

Given a natural-language query, extract filter criteria and return ONLY a JSON object with these optional fields:
  - type: one of FinancialProduct, HealthInsurancePlan, ConstructionInsurance, ErectionInsurance,
          MachineryInsurance, MobileMachineryInsurance, ElectronicEquipmentInsurance
  - name: partial contract/policy name to search for
  - partyId: the exact @id URI of a party (insurer or insured) to filter by

Return an empty object {} if no filters can be extracted.
Never include extra fields or explanations. Output only valid JSON.
`;
