# InsuranceOS Studio — LLM Vibe Coder (Deno-first, WinterTC)

A lightweight, AI-assisted REST API for managing **Party** entities, engineering **Insurance Contracts**, and the full **Premium → Invoice → Payment** financial lifecycle following [Schema.org](https://schema.org) conventions.  
The LLM acts as a coding copilot: describe what you want in plain English and get back valid JSON-LD.

---

## Features

| Capability | Endpoint |
|---|---|
| Generate parties from natural language | `POST /parties/generate` |
| Validate JSON-LD against Schema.org | `POST /parties/validate` |
| Natural-language query | `POST /parties/query` |
| Party CRUD | `GET/POST/PATCH/DELETE /parties/:id` |
| Generate engineering insurance contracts | `POST /contracts/generate` |
| Contract CRUD | `GET/POST/PATCH/DELETE /contracts/:id` |
| Premium (Beitrags-Sollstellung) CRUD | `GET/POST/PATCH/DELETE /premiums/:id` |
| Invoice (Rechnungsstellung) CRUD | `GET/POST/PATCH/DELETE /invoices/:id` |
| Payment (Zahlungseingang) CRUD | `GET/POST/PATCH/DELETE /payments/:id` |
| Clearing / Ausziffern | `POST /payments/:id/match` |

---

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env and set OPENAI_API_KEY
```

### 3. Run

```bash
npm start
# → http://localhost:3000
```

---

## API Reference

### `POST /parties/generate`

Generate a Party JSON-LD object from a plain-English description.

```json
// Request
{ "prompt": "Create a law firm called Dupont & Associates in Lyon with two lawyers." }

// Response 201
{
  "@context": "https://schema.org",
  "@type": "LegalService",
  "@id": "urn:uuid:...",
  "name": "Dupont & Associates",
  "address": { "@type": "PostalAddress", "addressLocality": "Lyon", "addressCountry": "FR" },
  "employee": [
    { "@type": "Person", "@id": "urn:uuid:...", "name": "Marie Dupont", "hasRole": { "roleName": "Lawyer" } },
    { "@type": "Person", "@id": "urn:uuid:...", "name": "Jean Martin",  "hasRole": { "roleName": "Lawyer" } }
  ]
}
```

### `POST /parties/validate`

Validate a JSON-LD object without storing it.

```json
// Request
{ "data": { "@context": "https://schema.org", "@type": "Person", "@id": "urn:uuid:...", "name": "Alice" } }

// Response 200
{ "valid": true, "errors": [], "suggestions": [] }
```

### `POST /parties`

Create a party from a user-supplied JSON-LD object (validated before storage).

### `GET /parties`

List all parties. Supports query-string filters:

```
GET /parties?type=Organization&addressLocality=Paris
GET /parties?name=dupont
```

### `GET /parties/:id`

Retrieve a single party by its `@id` (URL-encoded).

### `PATCH /parties/:id`

Merge-patch a party — provide only the fields to update.

### `DELETE /parties/:id`

Delete a party. Returns `204 No Content`.

### `POST /parties/query`

Natural-language query against stored parties.

```json
{ "nl_query": "Find all organisations in Berlin" }

// Response
{ "filters": { "type": "Organization", "addressLocality": "Berlin" }, "results": [ ... ] }
```

---

## Financial Accounting Lifecycle

```
[ Contract ]
     │
     ▼
1. PremiumNotice  (status: due → invoiced → paid)
     │
     ▼
2. InsuranceInvoice  (status: draft → issued → partially_paid / paid / overpaid)
     │
     ▼
3. PaymentRecord  (status: received → processing → matched / partially_matched / escalated)
     │
     ▼
4. POST /payments/:id/match  →  clearing / Ausziffern
```

### `POST /premiums`

Create a PremiumNotice (Beitrags-Sollstellung). `status` defaults to `"due"`.

```json
{
  "@context": "https://schema.org",
  "@type": "PremiumNotice",
  "name": "Q1 2024 Premium — CAR Brücke A40",
  "contractId": "urn:uuid:cccccccc-...",
  "status": "due",
  "periodStart": "2024-01-01",
  "periodEnd": "2024-03-31",
  "dueDate": "2024-01-15",
  "frequency": "quarterly",
  "premiumAmount": "EUR 3000.00",
  "taxRate": 19.0,
  "taxAmount": "EUR 570.00",
  "grossAmount": "EUR 3570.00"
}
```

### `GET /premiums`

Query premiums. Supported filters: `contractId`, `status`, `dueDateFrom`, `dueDateTo`.

### `GET /contracts/:id/premiums`

List all premiums for a contract.

### `POST /invoices`

Create an InsuranceInvoice. `invoiceNumber` is auto-assigned (gap-free, `INV-YYYY-NNNNNN`) when omitted. `status` defaults to `"draft"`.

```json
{
  "@context": "https://schema.org",
  "@type": "InsuranceInvoice",
  "name": "Invoice Q1 2024 — CAR Brücke A40",
  "premiumId": "urn:uuid:pppppppp-...",
  "contractId": "urn:uuid:cccccccc-...",
  "status": "issued",
  "issueDate": "2024-01-10",
  "paymentDueDate": "2024-01-31",
  "billingPeriod": "2024-01-01/2024-03-31",
  "netAmount": "EUR 3000.00",
  "taxAmount": "EUR 570.00",
  "totalPaymentDue": "EUR 3570.00",
  "minimumPaymentDue": "EUR 3570.00",
  "provider": { "@type": "InsuranceAgency", "name": "HDI Versicherung AG" },
  "customer": { "@type": "Organization", "name": "Bauunternehmen Mayer GmbH" }
}
```

### `GET /invoices`

Query invoices. Supported filters: `premiumId`, `contractId`, `status`, `invoiceNumber`.

### `GET /premiums/:id/invoices`

List all invoices for a premium.

### `POST /payments`

Create a PaymentRecord (Zahlungseingang). `status` defaults to `"received"`.

```json
{
  "@context": "https://schema.org",
  "@type": "PaymentRecord",
  "name": "Bank transfer 2024-01-28",
  "status": "received",
  "paymentDate": "2024-01-28",
  "amount": "EUR 3570.00",
  "currency": "EUR",
  "transactionReference": "INV-2024-000001 Rechnung Brücke A40",
  "senderName": "Bauunternehmen Mayer GmbH",
  "senderAccountNumber": "DE89370400440532013000"
}
```

### `POST /payments/:id/match`

Trigger the clearing / Ausziffern algorithm for a payment. Returns a clearing result:

```json
// Full match (exact reference)
{
  "outcome": "exact",
  "confidence": "exact",
  "paymentId": "urn:uuid:...",
  "invoiceId": "urn:uuid:...",
  "matchedAmount": "EUR 3570.00",
  "invoiceStatus": "paid",
  "paymentStatus": "matched"
}

// Partial payment (underpayment)
{
  "outcome": "partial",
  "confidence": "fuzzy",
  "matchedAmount": "EUR 2000.00",
  "remainingAmount": "EUR 1570.00",
  "invoiceStatus": "partially_paid",
  "paymentStatus": "partially_matched"
}

// No match — escalated to manual queue
{ "outcome": "escalated", "paymentId": "urn:uuid:..." }
```

**Matching stages:**
1. **Exact reference** — `invoiceNumber` or `premiumId` found in `transactionReference` AND amount matches
2. **Fuzzy** — sender name shares a token with `customer.name` AND amount within tolerance AND date within ±14 days
3. **Difference handling** — underpayment → `partially_paid`; exact → `paid`; overpayment → `overpaid`
4. **Escalation** — all stages fail → `escalated` (manual clearing queue)

### `GET /payments`

Query payments. Supported filters: `status`, `invoiceId`, `paymentDateFrom`, `paymentDateTo`.

### `GET /invoices/:id/payments`

List all payments matched to an invoice.

---

## Data Model

All entities follow [Schema.org](https://schema.org) JSON-LD.

### Party

| Field | Type | Description |
|---|---|---|
| `@context` | `"https://schema.org"` | Required |
| `@type` | string | `Person`, `Organization`, `LocalBusiness`, etc. |
| `@id` | URI | Unique identifier (`urn:uuid:…`) |
| `name` | string | Required |
| `address` | PostalAddress | Nested address object |
| `email` | string | |
| `telephone` | string | |
| `hasRole` | Role \| Role[] | Roles held |
| `employee` | Party[] | Nested employees (for orgs) |

### Role

| Field | Type |
|---|---|
| `roleName` | string |
| `namedPosition` | string |
| `startDate` | ISO 8601 |
| `endDate` | ISO 8601 |

### Contract (Insurance)

The contract model focuses on **engineering insurance** (technische Versicherungen) and also supports general financial products and health insurance plans.

#### `@type` values

| `@type` | German name | Industry code |
|---|---|---|
| `ConstructionInsurance` | Bauleistungsversicherung | CAR |
| `ErectionInsurance` | Montageversicherung | EAR |
| `MachineryInsurance` | Maschinenversicherung stationär | MB |
| `MobileMachineryInsurance` | Maschinenversicherung fahrbar | CAM |
| `ElectronicEquipmentInsurance` | Elektronikversicherung | EEI |
| `FinancialProduct` | Allgemeine Versicherungsprodukte | — |
| `HealthInsurancePlan` | Krankenversicherung | — |

#### Common Contract fields

| Field | Type | Description |
|---|---|---|
| `@context` | `"https://schema.org"` | Required |
| `@type` | string | See table above |
| `@id` | URI | Unique identifier (`urn:uuid:…`) |
| `name` | string | Policy / product name — Required |
| `description` | string | |
| `provider` | Party ref | Insurer (InsuranceAgency or Organisation) |
| `insuredParty` | Party ref | Policyholder (Person or Organisation) |
| `insuredSum` | string | Sum insured incl. currency, e.g. `"EUR 5,000,000"` |
| `validFrom` | ISO 8601 | Policy start date |
| `validThrough` | ISO 8601 | Policy end date |
| `deductible` | string | Deductible / Selbstbehalt, e.g. `"EUR 10,000"` |
| `areaServed` | string | ISO country code or region |
| `feesAndCommissionsSpecification` | string | Premium description |

#### Engineering insurance extension fields

| Field | Type | Description |
|---|---|---|
| `insuredObject` | string | Description of the insured item, project, or machine |
| `constructionSite` | PostalAddress | Location of the construction / erection site |
| `projectDuration` | string | ISO 8601 duration (e.g. `"P18M"`) or free text |
| `coverageExtensions` | string[] | Additional coverage clauses |
| `machineryType` | `"stationary"` \| `"mobile"` | For MB / CAM policies |
| `manufactureYear` | number | Year of manufacture |
| `serialNumber` | string | Machine or equipment serial / chassis number |

### PremiumNotice (`@type: "PremiumNotice"`)

Represents the scheduled premium demand (Beitrags-Sollstellung).

| Field | Type | Description |
|---|---|---|
| `@context` | `"https://schema.org"` | Required |
| `@type` | `"PremiumNotice"` | Required |
| `@id` | URI | Required |
| `name` | string | Required |
| `contractId` | URI | Required — links to the parent Contract |
| `status` | string | `due` → `invoiced` → `paid` (or `cancelled`) |
| `periodStart` | ISO 8601 | Start of the premium period |
| `periodEnd` | ISO 8601 | End of the premium period |
| `dueDate` | ISO 8601 | Payment due date |
| `frequency` | string | `annual`, `semi-annual`, `quarterly`, `monthly` |
| `premiumAmount` | string | Net premium, e.g. `"EUR 3000.00"` |
| `taxRate` | number | Tax rate, e.g. `19.0` |
| `taxAmount` | string | Calculated tax, e.g. `"EUR 570.00"` |
| `grossAmount` | string | Net + tax, e.g. `"EUR 3570.00"` |
| `provider` | Party ref | Insurer |
| `insuredParty` | Party ref | Policyholder |

### InsuranceInvoice (`@type: "InsuranceInvoice"`)

The GoBD-compliant invoice document generated from a PremiumNotice.

| Field | Type | Description |
|---|---|---|
| `@context` | `"https://schema.org"` | Required |
| `@type` | `"InsuranceInvoice"` | Required |
| `@id` | URI | Required |
| `name` | string | Required |
| `premiumId` | URI | Required — links to parent PremiumNotice |
| `contractId` | URI | Links to parent Contract |
| `invoiceNumber` | string | Auto-assigned gap-free number (`INV-YYYY-NNNNNN`) |
| `status` | string | `draft` → `issued` → `partially_paid` / `paid` / `overpaid` |
| `issueDate` | ISO 8601 | Date the invoice was issued |
| `paymentDueDate` | ISO 8601 | Payment deadline |
| `billingPeriod` | string | e.g. `"2024-01-01/2024-03-31"` |
| `netAmount` | string | Net amount |
| `taxAmount` | string | Tax portion |
| `totalPaymentDue` | string | Gross total |
| `minimumPaymentDue` | string | Remaining open balance (updated during clearing) |
| `provider` | Party ref | Insurer |
| `customer` | Party ref | Policyholder snapshot |
| `invoiceUrl` | string | URL to rendered PDF |
| `snapshotData` | object | GoBD snapshot of contract/address at issue time |

### PaymentRecord (`@type: "PaymentRecord"`)

A bank payment imported for clearing (Ausziffern).

| Field | Type | Description |
|---|---|---|
| `@context` | `"https://schema.org"` | Required |
| `@type` | `"PaymentRecord"` | Required |
| `@id` | URI | Required |
| `name` | string | Required |
| `status` | string | `received` → `processing` → `matched` / `partially_matched` / `escalated` |
| `paymentDate` | ISO 8601 | Required |
| `amount` | string | Required, e.g. `"EUR 3570.00"` |
| `currency` | string | ISO 4217, e.g. `"EUR"` |
| `transactionReference` | string | Verwendungszweck / booking text |
| `senderName` | string | Sender account holder name |
| `senderAccountNumber` | string | IBAN |
| `senderBankCode` | string | BIC / sort code |
| `invoiceId` | URI | Assigned invoice (after matching) |
| `premiumId` | URI | Assigned premium (after matching) |
| `matchedAmount` | string | Amount matched to invoice |
| `unmatchedAmount` | string | Remaining unmatched amount |
| `matchConfidence` | string | `exact`, `fuzzy`, or `manual` |

### Status Lifecycle Summary

| Entity | Initial | Intermediate | Final (success) |
|---|---|---|---|
| **PremiumNotice** | `due` | `invoiced` | `paid` |
| **InsuranceInvoice** | `draft` | `issued` / `partially_paid` | `paid` |
| **PaymentRecord** | `received` | `processing` | `matched` |

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | **Required** for `/generate` and `/query` |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model |
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `./parties.db` | SQLite database file |
| `LLM_RATE_LIMIT` | `20` | Max LLM requests per IP per 15 min |

---

## Architecture

```
src/
├── app.js                  # WinterTC fetch handler — route dispatcher
├── db.js                   # SQLite storage (better-sqlite3 / Deno)
├── llm.js                  # OpenAI client + generation/query logic
├── matching.js             # Payment-to-invoice clearing algorithm (Ausziffern)
├── validator.js            # Party validator
├── validator-contract.js   # Contract / engineering insurance validator
├── validator-premium.js    # Premium, Invoice, Payment validators
├── plugins/
│   ├── interfaces.js       # IStoragePlugin / ILLMPlugin / IValidatorPlugin contracts
│   ├── registry.js         # Plugin registry
│   ├── db-plugin.js        # Default storage plugin
│   ├── llm-plugin.js       # Default LLM plugin
│   └── validator-plugin.js # Default validator plugin
├── routes/
│   ├── parties.js          # /parties handlers
│   ├── contracts.js        # /contracts handlers
│   ├── premiums.js         # /premiums handlers
│   ├── invoices.js         # /invoices handlers
│   └── payments.js         # /payments handlers + /payments/:id/match
└── prompts/
    └── system.js           # System prompts + few-shot examples
```

---

## Guardrails

- Output always validated as JSON-LD with `@context: "https://schema.org"`
- Unknown (non-Schema.org) properties are rejected
- LLM auto-corrects once on validation failure before returning an error
- LLM endpoints are rate-limited per IP (default: 20 req / 15 min)
- Raw prompts are not persisted — only the resulting JSON-LD is stored

---

## Out of Scope (v1)

- Authentication / multi-tenancy
- Real-time collaboration
- Full SPARQL query support
- UI / front-end
