# Parties Manager — LLM Vibe Coder

A lightweight, AI-assisted REST API for managing **Party** entities (people, organisations, businesses) following [Schema.org](https://schema.org) conventions.  
The LLM acts as a coding copilot: describe what you want in plain English and get back valid JSON-LD.

---

## Features

| Capability | Endpoint |
|---|---|
| Generate parties from natural language | `POST /parties/generate` |
| Validate JSON-LD against Schema.org | `POST /parties/validate` |
| Natural-language query | `POST /parties/query` |
| CRUD operations | `GET/POST/PATCH/DELETE /parties/:id` |

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
├── index.js          # Express app entry point
├── db.js             # SQLite storage (better-sqlite3)
├── llm.js            # OpenAI client + generation/query logic
├── validator.js      # Schema.org constraint validator
├── routes/
│   └── parties.js    # All /parties route handlers
└── prompts/
    └── system.js     # System prompt + few-shot examples
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
