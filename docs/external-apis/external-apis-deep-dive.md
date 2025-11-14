# External APIs Deep Dive: Integration Strategy

**Date:** 2025-01-05
**Purpose:** Comprehensive analysis of Riksdagen, Domstolsverket/Lagrummet, and EUR-Lex APIs for Epic 2 implementation

---

## Executive Summary

We need to integrate with **3 external data sources** to ingest 170,000+ legal documents:

1. **Riksdagen API** - Parliamentary documents (propositions, bills) - NOT primary source for SFS laws
2. **Lagrummet RInfo Service** - SFS laws + Court cases (HD, HovR, HFD) - PRIMARY SOURCE
3. **EUR-Lex CELLAR API** - EU regulations and directives in Swedish

**Critical Discovery:** SFS laws are NOT available through Riksdagen's dokumentlista API. They must be fetched from **lagrummet.se** RInfo service, which aggregates data from **svenskforfattningssamling.se** (the official government SFS publication site).

---

## 1. Riksdagen API (data.riksdagen.se)

### Overview

- **Type:** REST API
- **Authentication:** None required (public open data)
- **Rate Limits:** Not explicitly documented (TBD - test and monitor)
- **Base URL:** `https://data.riksdagen.se/`
- **Documentation:** https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/

### Supported Formats

- XML
- JSON
- JSONP
- CSV
- HTML
- Text

### Available Endpoints

#### 1. **dokumentlista** - Document List

```
GET https://data.riksdagen.se/dokumentlista/?[params]&utformat=json
```

**Query Parameters:**

- `dok` - Document type (mot, prop, bet, etc.)
- `rm` - Parliamentary year (e.g., "2024/25")
- `p` - Page number
- `sz` - Page size
- `utformat` - Output format (json, xml, csv)
- `sort` - Sort order
- `parti` - Political party filter

**Document Types:**

- `prop` - Government propositions
- `mot` - Members' motions
- `bet` - Committee reports
- `prot` - Chamber protocols
- `frs` - Questions
- `ip` - Interpellations

**Important:** `doktyp=sfs` does NOT exist in Riksdagen API. SFS documents are published by the government, not parliament.

#### 2. **dokument** - Individual Document

```
GET https://data.riksdagen.se/dokument/[docid].[format]
```

**Example:**

```
GET https://data.riksdagen.se/dokument/H8010330.json
```

#### 3. **ledamoter** - Members API

```
GET https://data.riksdagen.se/personlista/?iid=[id]&utformat=json
```

#### 4. **votering** - Voting Records

```
GET https://data.riksdagen.se/voteringlista/?rm=[year]&utformat=json
```

#### 5. **anforande** - Speeches

```
GET https://data.riksdagen.se/anforandelista/?rm=[year]&utformat=json
```

### Use Cases for Laglig.se

**Limited Value - Post-MVP Only:**

- Propositions (prop) could be used for "preparation work" context (Phase 2+)
- Committee reports (bet) for understanding legislative intent (Phase 2+)
- Cross-references from laws to propositions (enhancement feature)

**NOT Needed for MVP:** Riksdagen API is NOT required for Epic 2 ingestion. Focus on Lagrummet RInfo service instead.

### Example Response (dokumentlista JSON)

```json
{
  "@xmlns": "http://data.riksdagen.se/ns/dokument",
  "dokumentlista": {
    "@sida": "1",
    "@traffar": "1523",
    "@antal": "20",
    "dokument": [
      {
        "dok_id": "H8010330",
        "rm": "2024/25",
        "beteckning": "2024/25:330",
        "dok_typ": "prop",
        "typ": "Proposition",
        "titel": "Ändringar i socialtjänstlagen",
        "publicerad": "2024-12-15",
        "datum": "2024-12-15",
        "organ": "Regeringen",
        "dokument_url_text": "https://data.riksdagen.se/dokument/H8010330",
        "dokument_url_html": "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/proposition/H8010330"
      }
    ]
  }
}
```

### Rate Limiting Strategy

- **Estimated:** 10 requests/second (conservative, based on typical Swedish government APIs)
- **Implementation:** Use `p-queue` with concurrency limit
- **Retry Logic:** Exponential backoff for 429/503 errors
- **Monitoring:** Log request count per minute, track API health

---

## 2. Lagrummet RInfo Service (PRIMARY SOURCE)

### Overview

- **Type:** RESTful + JSON-LD + SPARQL
- **Authentication:** None required (public open data)
- **Rate Limits:** Not explicitly documented (TBD)
- **Base URL:** `http://service.lagrummet.se/` or `https://rinfo.lagrummet.se/`
- **Documentation:** http://dev.lagrummet.se/dokumentation/ (intermittent availability)
- **GitHub:** https://github.com/rinfo/lagrummet.se

### What It Provides

**SFS Laws (Svensk författningssamling):**

- All current Swedish laws and regulations
- Historical versions
- Amendment tracking (SFS 2024:123 changes SFS 1999:175)
- Official source: aggregates from svenskforfattningssamling.se

**Court Cases (Rättspraxis):**

- HD (Högsta domstolen / Supreme Court) - NJA series
- HovR (Hovrätterna / Courts of Appeal) - RH series
- HFD (Högsta förvaltningsdomstolen / Supreme Administrative Court) - HFD series

**Agency Regulations:**

- Myndighetsföreskrifter from various agencies (Boverket, Transportstyrelsen, etc.)

### Endpoints

#### 1. **Search Endpoint** - Query Documents

```
GET http://service.lagrummet.se/-/publ?q=[query]&_stats=on&_page=0&_pageSize=10
```

**Query Parameters:**

- `q` - Search query (supports Lucene syntax)
- `_page` - Page number (0-indexed)
- `_pageSize` - Results per page
- `_stats` - Include statistics (on/off)

**Example:**

```
GET http://service.lagrummet.se/-/publ?q=arbetsmiljö&_page=0&_pageSize=20
```

#### 2. **Individual Document Data**

```
GET http://service.lagrummet.se/publ/[identifier]/data
```

**Identifiers:**

- SFS: `sfs/[year]:[number]` - Example: `sfs/1999:175`
- Court cases: `rf/nja/[year]/s_[page]` - Example: `rf/nja/2020/s_123`

**Example:**

```
GET http://service.lagrummet.se/publ/sfs/1999/175/data
```

**Response Format:** JSON-LD

#### 3. **Document HTML/RDF**

```
GET http://rinfo.lagrummet.se/publ/[identifier]
```

**Content Negotiation:**

- `Accept: application/json` → JSON-LD
- `Accept: text/html` → Human-readable HTML
- `Accept: application/rdf+xml` → RDF/XML
- `Accept: text/turtle` → Turtle format

#### 4. **SPARQL Endpoint**

```
POST http://service.lagrummet.se/sparql
Content-Type: application/sparql-query
```

**Example Query (Get all SFS from 2024):**

```sparql
PREFIX rinfo: <http://rinfo.lagrummet.se/taxo/2007/09/rinfo/pub#>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT ?uri ?title ?issued
WHERE {
  ?uri a rinfo:Forfattning ;
       dct:title ?title ;
       dct:issued ?issued .
  FILTER (YEAR(?issued) = 2024)
}
ORDER BY DESC(?issued)
LIMIT 100
```

### JSON-LD Response Example

```json
{
  "@context": "http://service.lagrummet.se/json-ld/context.json",
  "@id": "http://rinfo.lagrummet.se/publ/sfs/1999:175",
  "@type": "Forfattning",
  "identifier": "SFS 1999:175",
  "title": "Rättsinformationsförordning (1999:175)",
  "issued": "1999-03-18",
  "inForce": true,
  "publisher": {
    "@id": "http://rinfo.lagrummet.se/org/regeringskansliet",
    "name": "Regeringskansliet"
  },
  "content": {
    "@type": "Document",
    "format": "text/html",
    "url": "http://service.lagrummet.se/publ/sfs/1999/175/content"
  },
  "changedBy": [
    {
      "@id": "http://rinfo.lagrummet.se/publ/sfs/2015:621",
      "identifier": "SFS 2015:621"
    }
  ]
}
```

### Pagination Strategy

**Search Results:**

```json
{
  "@context": "...",
  "startIndex": 0,
  "itemsPerPage": 20,
  "totalResults": 1523,
  "items": [...]
}
```

**Implementation:**

```typescript
async function fetchAllSFSLaws() {
  let page = 0
  const pageSize = 100
  let totalResults = null

  while (totalResults === null || page * pageSize < totalResults) {
    const response = await fetch(
      `http://service.lagrummet.se/-/publ?q=rinfo_main_typ:Forfattning&_page=${page}&_pageSize=${pageSize}`
    )
    const data = await response.json()

    if (totalResults === null) {
      totalResults = data.totalResults
    }

    for (const item of data.items) {
      await processSFSLaw(item)
    }

    page++
  }
}
```

### Rate Limiting Strategy

- **Conservative:** 5 requests/second (lagrummet.se is a smaller service)
- **Retry Logic:** 3 retries with exponential backoff
- **Cache:** Aggressive caching (laws change infrequently)
- **Bulk Processing:** Use SPARQL for large-scale queries instead of REST

### Mapping to Our Data Model

**SFS Law → LegalDocument:**

```typescript
interface LagrummetSFS {
  '@id': string // "http://rinfo.lagrummet.se/publ/sfs/1999:175"
  identifier: string // "SFS 1999:175"
  title: string
  issued: string // ISO date
  inForce: boolean
  content: { url: string }
  changedBy?: Array<{ '@id': string; identifier: string }>
}

// Map to our schema
const legalDocument: LegalDocument = {
  id: generateUUID(),
  content_type: 'SFS_LAW',
  document_number: sfs.identifier, // "SFS 1999:175"
  title: sfs.title,
  slug: slugify(sfs.title + ' ' + sfs.identifier),
  summary: null, // Generated later via GPT-4
  full_text: await fetchFullText(sfs.content.url),
  effective_date: new Date(sfs.issued),
  publication_date: new Date(sfs.issued),
  status: sfs.inForce ? 'ACTIVE' : 'REPEALED',
  source_url: sfs['@id'],
  metadata: {
    lagrummet_id: sfs['@id'],
    in_force: sfs.inForce,
    changed_by: sfs.changedBy || [],
    // Additional metadata from RInfo
  },
  created_at: new Date(),
  updated_at: new Date(),
}
```

**Court Case → LegalDocument + CourtCase:**

```typescript
interface LagrummetCourtCase {
  '@id': string // "http://rinfo.lagrummet.se/publ/rf/nja/2020/s_123"
  identifier: string // "NJA 2020 s. 123"
  title: string // Case summary
  issued: string // Decision date
  court: { name: string } // "Högsta domstolen"
  content: { url: string }
}

// Map to our schema
const legalDocument: LegalDocument = {
  content_type: 'HD_SUPREME_COURT', // Based on court
  document_number: courtCase.identifier,
  // ... rest of mapping
}

const courtCaseData: CourtCase = {
  document_id: legalDocument.id,
  court_name: courtCase.court.name,
  case_number: courtCase.identifier,
  decision_date: new Date(courtCase.issued),
  // ... additional court-specific fields
}
```

---

## 3. EUR-Lex CELLAR API (European Union Legislation)

### Overview

- **Type:** SPARQL + RESTful API
- **Authentication:** None required (public access)
- **Rate Limits:** Not explicitly documented (TBD)
- **SPARQL Endpoint:** https://publications.europa.eu/webapi/rdf/sparql
- **RESTful API:** https://publications.europa.eu/resource/cellar/[id]
- **Documentation:** https://eur-lex.europa.eu/eli-register/technical_information.html
- **Query Builder:** https://op.europa.eu/en/advanced-sparql-query-editor

### What It Provides

**EU Regulations (Förordningar):**

- CELEX format: `3YYYYRNNNN` (e.g., 32016R0679 = GDPR)
- All official EU languages including Swedish (sv)

**EU Directives (Direktiv):**

- CELEX format: `3YYYYLNNNN` (e.g., 32016L0680)
- Swedish translations

**National Implementation Measures (NIM):**

- Links from EU directives → Swedish implementing SFS laws

### Key Concepts

**CELLAR Repository:**

- Publications Office's document repository
- Uses Common Data Model (CDM) - FRBR-compliant OWL ontology
- ELI (European Legislation Identifier) standard

**Work-Expression-Manifestation:**

- **Work:** Abstract concept of the legislation
- **Expression:** Language-specific version (Swedish, English, etc.)
- **Manifestation:** Physical format (PDF, HTML, XML)

### SPARQL Endpoint

#### Query Structure

**Prefixes:**

```sparql
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
```

#### Example 1: Get All Swedish Regulations from 2020

```sparql
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT DISTINCT ?work ?celex ?title ?date
WHERE {
  ?work a cdm:work .
  ?work cdm:work_has_resource-type <http://publications.europa.eu/resource/authority/resource-type/REG> .
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:work_date_document ?date .

  ?expr cdm:expression_belongs_to_work ?work .
  ?expr cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/SWE> .
  ?expr cdm:expression_title ?title .

  FILTER (YEAR(?date) = 2020)
}
ORDER BY DESC(?date)
LIMIT 100
```

#### Example 2: Get Specific Regulation (GDPR) in Swedish

```sparql
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?expr ?title ?html ?pdf
WHERE {
  ?work cdm:resource_legal_id_celex "32016R0679" .

  ?expr cdm:expression_belongs_to_work ?work .
  ?expr cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/SWE> .
  ?expr cdm:expression_title ?title .

  OPTIONAL {
    ?manif_html cdm:manifestation_manifests_expression ?expr .
    ?manif_html cdm:manifestation_type <http://publications.europa.eu/resource/authority/manifestation-type/HTML> .
    ?manif_html cdm:manifestation_url ?html .
  }

  OPTIONAL {
    ?manif_pdf cdm:manifestation_manifests_expression ?expr .
    ?manif_pdf cdm:manifestation_type <http://publications.europa.eu/resource/authority/manifestation-type/PDF> .
    ?manif_pdf cdm:manifestation_url ?pdf .
  }
}
```

#### Example 3: Get EU Directives with Swedish Implementing Laws

```sparql
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX eli: <http://data.europa.eu/eli/ontology#>

SELECT ?directive ?celex ?title ?swedish_law
WHERE {
  ?directive a cdm:work .
  ?directive cdm:work_has_resource-type <http://publications.europa.eu/resource/authority/resource-type/DIR> .
  ?directive cdm:resource_legal_id_celex ?celex .

  ?expr cdm:expression_belongs_to_work ?directive .
  ?expr cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/SWE> .
  ?expr cdm:expression_title ?title .

  # National Implementation Measures
  ?directive eli:transposed_by ?nim .
  ?nim eli:country <http://publications.europa.eu/resource/authority/country/SWE> .
  ?nim eli:title_citation_string ?swedish_law .
}
LIMIT 100
```

### RESTful API

**Fetch Document Metadata:**

```
GET https://publications.europa.eu/resource/cellar/{uuid}
Accept: application/json
```

**Example:**

```
GET https://publications.europa.eu/resource/cellar/3e485e15-11bd-11e6-ba9a-01aa75ed71a1
Accept: application/json
```

**Fetch Document Content (HTML/PDF):**

```
GET https://eur-lex.europa.eu/legal-content/SV/TXT/HTML/?uri=CELEX:32016R0679
```

### Language Codes

**Swedish:** `SWE` or `sv`

- Authority URI: `http://publications.europa.eu/resource/authority/language/SWE`
- ISO 639-1: `sv`
- ISO 639-2: `swe`

### Rate Limiting Strategy

- **Estimated:** 10 requests/second (Publications Office is robust)
- **Batch Queries:** Use SPARQL for bulk metadata, then fetch content individually
- **Cache Aggressively:** EU legislation changes slowly
- **Pagination:** SPARQL LIMIT/OFFSET with 100 results per query

### Mapping to Our Data Model

**EU Regulation → LegalDocument + EUDocument:**

```typescript
interface CELLARRegulation {
  work: string // Work URI
  celex: string // "32016R0679"
  title: string
  date: string // ISO date
  html_url: string
  pdf_url: string
}

// Map to our schema
const legalDocument: LegalDocument = {
  id: generateUUID(),
  content_type: 'EU_REGULATION',
  document_number: regulation.celex, // "32016R0679"
  title: regulation.title,
  slug: slugify(regulation.title + ' ' + regulation.celex),
  summary: null, // Generated later via GPT-4
  full_text: await fetchHTML(regulation.html_url),
  effective_date: new Date(regulation.date),
  publication_date: new Date(regulation.date),
  status: 'ACTIVE',
  source_url: `https://eur-lex.europa.eu/legal-content/SV/TXT/?uri=CELEX:${regulation.celex}`,
  metadata: {
    work_uri: regulation.work,
    celex: regulation.celex,
    html_url: regulation.html_url,
    pdf_url: regulation.pdf_url,
  },
  created_at: new Date(),
  updated_at: new Date(),
}

const euDocument: EUDocument = {
  document_id: legalDocument.id,
  celex_number: regulation.celex,
  eut_reference: null, // Extract from metadata
  national_implementation_measures: {}, // Populate via NIM query
}
```

**EU Directive with NIM → LegalDocument + EUDocument + CrossReference:**

```typescript
interface CELLARDirective {
  directive: string
  celex: string
  title: string
  swedish_law: string // "SFS 2018:218"
}

// Create EU directive document
const directive: LegalDocument = {
  /* ... */
}

// Create EUDocument with NIM
const euDoc: EUDocument = {
  document_id: directive.id,
  celex_number: directive.celex,
  national_implementation_measures: {
    sweden: [
      {
        law: directive.swedish_law, // "SFS 2018:218"
        type: 'transposition',
      },
    ],
  },
}

// Create CrossReference linking EU directive → Swedish implementing law
const crossRef: CrossReference = {
  id: generateUUID(),
  source_document_id: directive.id, // EU directive
  target_document_id: await findSFSByNumber(directive.swedish_law), // Swedish law
  reference_type: 'IMPLEMENTS',
  context:
    'This directive is implemented in Swedish law by ' + directive.swedish_law,
  created_at: new Date(),
}
```

---

## 4. Integration Architecture

### Ingestion Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Epic 2: Legal Content Ingestion           │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  Lagrummet RInfo │ ──────┐
│  (SFS + Cases)   │       │
└──────────────────┘       │
                           │
┌──────────────────┐       │      ┌───────────────────┐
│   EUR-Lex        │ ──────┼─────▶│  Ingestion Queue  │
│   (EU Reg/Dir)   │       │      │   (BullMQ/Redis)  │
└──────────────────┘       │      └───────────────────┘
                           │               │
┌──────────────────┐       │               │
│  Riksdagen API   │ ──────┘               │
│  (Post-MVP)      │                       │
└──────────────────┘                       ▼
                                  ┌─────────────────┐
                                  │  Worker Process │
                                  │  (Vercel Cron)  │
                                  └─────────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      ▼                      ▼
          ┌──────────────────┐   ┌──────────────────┐   ┌─────────────────┐
          │  Parse & Validate│   │   Generate GPT-4 │   │  Create Vector  │
          │  (Zod Schemas)   │   │   Summaries      │   │  Embeddings     │
          └──────────────────┘   └──────────────────┘   └─────────────────┘
                    │                      │                      │
                    └──────────────────────┼──────────────────────┘
                                           ▼
                                  ┌─────────────────┐
                                  │  Supabase DB    │
                                  │  (PostgreSQL)   │
                                  └─────────────────┘
                                           │
                                           ▼
                                  ┌─────────────────┐
                                  │  SEO Pages      │
                                  │  Generation     │
                                  └─────────────────┘
```

### Worker Implementation Strategy

**Epic 2, Story 2.2-2.4: Ingestion Scripts**

```typescript
// scripts/ingest/lagrummet-sfs.ts

import { Queue } from 'bullmq'
import { z } from 'zod'

const LagrummetSFSSchema = z.object({
  '@id': z.string(),
  identifier: z.string(),
  title: z.string(),
  issued: z.string(),
  inForce: z.boolean(),
  content: z.object({ url: z.string() }),
})

const ingestionQueue = new Queue('legal-content-ingestion', {
  connection: { host: 'redis.example.com', port: 6379 },
})

async function ingestSFSLaws() {
  let page = 0
  const pageSize = 100

  while (true) {
    // Fetch from Lagrummet
    const response = await fetch(
      `http://service.lagrummet.se/-/publ?q=rinfo_main_typ:Forfattning&_page=${page}&_pageSize=${pageSize}`,
      { headers: { Accept: 'application/json' } }
    )

    if (!response.ok) {
      console.error(`Failed to fetch page ${page}: ${response.statusText}`)
      break
    }

    const data = await response.json()

    // Validate with Zod
    for (const item of data.items) {
      try {
        const validated = LagrummetSFSSchema.parse(item)

        // Add to queue
        await ingestionQueue.add('process-sfs', validated, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        })
      } catch (error) {
        console.error(`Validation error for ${item['@id']}:`, error)
      }
    }

    // Check if done
    if (data.items.length < pageSize) break

    page++

    // Rate limiting
    await sleep(200) // 5 requests/second
  }
}

// Worker process (api/cron/ingest-worker/route.ts)
export async function GET() {
  const worker = new Worker('legal-content-ingestion', async (job) => {
    const sfs = job.data

    // 1. Fetch full text
    const fullText = await fetchFullText(sfs.content.url)

    // 2. Generate summary (GPT-4)
    const summary = await generateSummary(fullText)

    // 3. Create embeddings
    const chunks = chunkText(fullText, 500)
    const embeddings = await Promise.all(
      chunks.map((chunk) => generateEmbedding(chunk))
    )

    // 4. Upsert to database
    await prisma.legalDocument.upsert({
      where: { document_number: sfs.identifier },
      create: {
        content_type: 'SFS_LAW',
        document_number: sfs.identifier,
        title: sfs.title,
        summary,
        full_text: fullText,
        effective_date: new Date(sfs.issued),
        publication_date: new Date(sfs.issued),
        status: sfs.inForce ? 'ACTIVE' : 'REPEALED',
        source_url: sfs['@id'],
        metadata: sfs,
      },
      update: {
        full_text: fullText,
        summary,
        status: sfs.inForce ? 'ACTIVE' : 'REPEALED',
        updated_at: new Date(),
      },
    })

    // 5. Insert embeddings
    // ... (similar pattern)
  })

  return Response.json({ status: 'worker running' })
}
```

---

## 5. Epic 2 Implementation Checklist

### Story 2.2: Ingest SFS Laws (Lagrummet)

- [ ] Set up Lagrummet RInfo client
- [ ] Implement pagination for `/publ` search endpoint
- [ ] Zod schema validation for SFS documents
- [ ] Queue system (BullMQ + Redis)
- [ ] Worker process for background ingestion
- [ ] Full-text extraction (HTML → plain text)
- [ ] GPT-4 summary generation
- [ ] Rate limiting (5 req/sec)
- [ ] Error handling & retry logic
- [ ] Progress tracking (BackgroundJob entity)
- [ ] Estimate: 50,000 SFS laws × 2sec/law = 28 hours runtime

### Story 2.3: Ingest Court Cases (Lagrummet)

- [ ] Query Lagrummet for court cases (HD, HovR, HFD)
- [ ] Parse court-specific metadata (case number, decision date)
- [ ] Populate CourtCase table
- [ ] Extract cross-references to SFS laws
- [ ] Create CrossReference records
- [ ] Estimate: 9,000 cases × 3sec/case = 7.5 hours runtime

### Story 2.4: Ingest EU Legislation (EUR-Lex)

- [ ] Set up SPARQL client for CELLAR endpoint
- [ ] Query for Swedish regulations (resource-type REG)
- [ ] Query for Swedish directives (resource-type DIR)
- [ ] Fetch HTML/PDF content
- [ ] Query NIM (National Implementation Measures)
- [ ] Link EU directives → Swedish SFS laws
- [ ] Populate EUDocument table
- [ ] Estimate: 110,000 docs × 1sec/doc = 30 hours runtime

### Story 2.10: Generate Embeddings

- [ ] Semantic chunking strategy per content type
  - SFS: Chunk by § (section), max 500 tokens
  - Court cases: Chunk by semantic section, max 800 tokens
  - EU: Chunk by article, max 500 tokens
- [ ] OpenAI embedding generation (text-embedding-3-small)
- [ ] Store in LawEmbedding table
- [ ] Create HNSW vector index
- [ ] Rate limiting (1000 req/min OpenAI limit)
- [ ] Estimate: 170K docs × 5 chunks avg = 850K embeddings × 0.5sec = 118 hours

### Story 2.11: Begin Change Detection

- [ ] Daily cron job (Vercel Cron)
- [ ] Compare current vs previous versions
- [ ] Detect changes (new, amended, repealed)
- [ ] Store in LawChangeHistory table
- [ ] No UI (silent background collection)

---

## 6. Cost Estimates

### OpenAI API Costs

**Embeddings:**

- Model: `text-embedding-3-small`
- Price: $0.00002 / 1K tokens
- Total tokens: 850K chunks × 600 tokens avg = 510M tokens
- Cost: 510,000 × $0.00002 = **$10,200**

**GPT-4 Summaries:**

- Model: `gpt-4-turbo`
- Price: $0.01 / 1K input tokens, $0.03 / 1K output tokens
- Input: 170K docs × 500 tokens avg = 85M tokens → $850
- Output: 170K docs × 100 tokens avg = 17M tokens → $510
- Cost: **$1,360**

**Total One-Time Ingestion:** ~$11,560

**Ongoing Costs (Monthly):**

- Change detection: ~500 changes/month × $0.01 = $5
- New user summaries: 1000 users × 68 laws × $0.01 = $680/month
- **Monthly recurring:** ~$685

### Infrastructure Costs

**Supabase:**

- Database: ~165GB → Pro plan ($25/month) + storage overage ($0.125/GB) = $45/month
- Vector index: Included in database storage

**Vercel:**

- Hobby: Free (testing)
- Pro: $20/month (production)
- Serverless function execution: $0.12 / 1M requests

**Redis (Upstash or similar):**

- Queue system: ~$10/month

**Total Monthly Infrastructure:** ~$75/month

---

## 7. Risk Assessment

### Critical Risks

**1. Lagrummet Service Availability (HIGH RISK)**

- **Issue:** `dev.lagrummet.se` documentation has intermittent timeouts
- **Mitigation:**
  - Use GitHub repo as fallback documentation
  - Implement aggressive retry logic
  - Cache all fetched data locally
  - Consider scraping svenskforfattningssamling.se as fallback

**2. Rate Limiting Unknown (MEDIUM RISK)**

- **Issue:** No official rate limits documented for Lagrummet or EUR-Lex
- **Mitigation:**
  - Start conservative (5 req/sec)
  - Monitor for 429/503 errors
  - Implement exponential backoff
  - Add logging dashboard

**3. Data Format Changes (LOW RISK)**

- **Issue:** JSON-LD structure could change without notice
- **Mitigation:**
  - Strict Zod validation
  - Version pinning where possible
  - Alerting on validation failures
  - Manual review of first 100 documents

**4. OpenAI Cost Overrun (MEDIUM RISK)**

- **Issue:** $11K one-time cost for embeddings
- **Mitigation:**
  - Batch processing to avoid duplication
  - Checkpoint system (resume from failure)
  - Consider cheaper embedding models (text-embedding-3-small is cheapest)
  - Phase 2: Migrate to self-hosted embeddings (e.g., sentence-transformers)

**5. EUR-Lex Swedish Translation Coverage (LOW RISK)**

- **Issue:** Not all EU legislation has Swedish translations
- **Mitigation:**
  - Fall back to English if Swedish unavailable
  - Mark documents as "English only" in metadata
  - Notify user in UI

---

## 8. Testing Strategy

### Integration Tests

**Lagrummet RInfo:**

```typescript
describe('Lagrummet RInfo Integration', () => {
  it('should fetch SFS law list', async () => {
    const response = await fetch(
      'http://service.lagrummet.se/-/publ?q=rinfo_main_typ:Forfattning&_page=0&_pageSize=10'
    )
    expect(response.ok).toBe(true)
    const data = await response.json()
    expect(data.items).toHaveLength(10)
  })

  it('should fetch individual SFS law', async () => {
    const response = await fetch(
      'http://service.lagrummet.se/publ/sfs/1999/175/data'
    )
    expect(response.ok).toBe(true)
    const law = await response.json()
    expect(law.identifier).toMatch(/SFS \d{4}:\d+/)
  })

  it('should handle rate limiting gracefully', async () => {
    // Send 20 requests rapidly
    const promises = Array.from({ length: 20 }, (_, i) =>
      fetch(`http://service.lagrummet.se/-/publ?q=test&_page=${i}`)
    )
    const results = await Promise.allSettled(promises)
    const failed = results.filter((r) => r.status === 'rejected')
    expect(failed.length).toBe(0)
  })
})
```

**EUR-Lex SPARQL:**

```typescript
describe('EUR-Lex SPARQL Integration', () => {
  it('should query Swedish regulations', async () => {
    const query = `
      PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
      SELECT ?celex WHERE {
        ?work cdm:resource_legal_id_celex ?celex .
        FILTER (STRSTARTS(?celex, "32020R"))
      } LIMIT 5
    `
    const response = await fetch(
      'https://publications.europa.eu/webapi/rdf/sparql',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sparql-query',
          Accept: 'application/json',
        },
        body: query,
      }
    )
    expect(response.ok).toBe(true)
    const data = await response.json()
    expect(data.results.bindings.length).toBeGreaterThan(0)
  })
})
```

### Manual Verification

- [ ] Fetch 10 random SFS laws → Verify titles match svenskforfattningssamling.se
- [ ] Fetch 10 random court cases → Verify against domstol.se search
- [ ] Fetch 10 EU regulations → Verify against eur-lex.europa.eu
- [ ] Check cross-references: EU directive → Swedish implementing law
- [ ] Verify change detection: Mock SFS amendment → Ensure detected

---

## 9. Next Steps for Section 5

When drafting **Section 5: API Specification**, include:

### Internal API Endpoints (Our Backend)

**Epic 2: Ingestion Admin Endpoints**

```
POST /api/admin/ingest/sfs
POST /api/admin/ingest/court-cases
POST /api/admin/ingest/eu-legislation
GET  /api/admin/ingest/status
```

**Epic 3: RAG Query Endpoint**

```
POST /api/chat/query
{
  "query": "What are employee rights during sick leave?",
  "context": ["law-id-1", "law-id-2"],
  "workspace_id": "ws-123"
}
```

**Epic 4: Onboarding Endpoints**

```
POST /api/onboarding/fetch-company
{
  "orgNumber": "556789-1234"
}

POST /api/onboarding/generate-law-list-phase1
{
  "sniCode": "56.10",
  "employeeCount": 12,
  "contextualAnswers": { ... }
}

POST /api/onboarding/generate-law-list-phase2
GET  /api/onboarding/phase2-status/:workspaceId
```

### External API Wrapper Services

Create TypeScript clients for each external API:

```typescript
// lib/external-apis/lagrummet.ts
export class LagrummetClient {
  async searchSFS(query: string, page: number): Promise<SFSSearchResult>
  async fetchSFSLaw(year: number, number: number): Promise<SFSLaw>
  async fetchCourtCase(identifier: string): Promise<CourtCase>
}

// lib/external-apis/eurlex.ts
export class EURLexClient {
  async querySPARQL(query: string): Promise<SPARQLResult>
  async fetchRegulation(celex: string, lang: 'sv'): Promise<EURegulation>
  async fetchDirective(celex: string, lang: 'sv'): Promise<EUDirective>
  async fetchNIM(directiveCelex: string, country: 'SWE'): Promise<NIM[]>
}
```

---

## 10. Conclusion

### Summary

We have **3 external APIs** to integrate:

1. **Lagrummet RInfo** (PRIMARY) - SFS laws + Court cases
   - REST + JSON-LD + SPARQL
   - ~59,000 SFS laws + ~9,000 court cases
   - Rate limit: Conservative 5 req/sec

2. **EUR-Lex CELLAR** (PRIMARY) - EU legislation
   - SPARQL + REST
   - ~110,000 regulations/directives in Swedish
   - Rate limit: 10 req/sec

3. **Riksdagen API** (POST-MVP) - Parliamentary documents
   - REST + JSON
   - Propositions, bills, reports
   - NOT needed for MVP

### Key Decisions

✅ **Use Lagrummet RInfo as primary SFS source** (not Riksdagen)
✅ **Use SPARQL for bulk queries** (EUR-Lex, Lagrummet)
✅ **Queue-based ingestion** (BullMQ + Redis)
✅ **Vercel Cron workers** (not continuous processes)
✅ **Aggressive caching** (laws change infrequently)

### Estimated Timeline

- **Epic 2 Stories 2.2-2.4:** 3 weeks implementation
- **Epic 2 Story 2.10 (Embeddings):** 1 week implementation + 118 hours runtime
- **Total ingestion runtime:** ~163 hours (~7 days)
- **One-time cost:** ~$11,560 (OpenAI)

### Ready for Section 5

All external API research complete. Ready to design our internal API specification with this context.

---

**Status:** External API deep dive complete ✅
**Next:** Section 5 - API Specification (internal endpoints + Zod schemas)
