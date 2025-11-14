# Riksdagen API Analysis & SQL Model Evaluation

**Date:** 2025-01-05
**Purpose:** Evaluate Riksdagen's suggested SQL schema for potential adoption in Laglig.se architecture

---

## 1. Riksdagen Open Data Overview

### Available Data Types

1. **Documents (dokument)** - Laws, government proposals, parliamentary decisions
2. **Members (person)** - Parliamentarians from ~1990 onward
3. **Votes (votering)** - Voting records from 1993/94 forward
4. **Speeches (anförande)** - Debate statements from 1993/94 onward
5. **Calendar (planering)** - Meeting schedules, debates, committees

### Key Characteristics

- **Free & Open:** No fees or licenses required
- **Attribution Required:** Must cite "Sveriges riksdag" as source
- **Contact:** riksdagsinformation@riksdagen.se
- **No Rate Limits Specified:** (Need to check API documentation)

---

## 2. Riksdagen's SQL Schema Structure

### Core Tables (19 total)

**Document-Centric:**

```
dokument              - Core document metadata (ID, type, title, dates, HTML)
├── dokutskottsforslag  - Committee proposals within documents
├── dokmotforslag       - Counter-proposals with party affiliations
├── dokaktivitet        - Document activity tracking
├── dokintressent       - Document stakeholders
├── dokforslag          - Individual proposals with legislative references
├── dokuppgift          - Document assignments/tasks
├── dokbilaga           - Document attachments (PDFs, images)
└── dokreferens         - Cross-references between documents
```

**Parliamentary Activity:**

```
debatt                - Debate recordings with video metadata
votering              - Voting records per legislator
anforande             - Speeches/statements with text
```

**Personnel:**

```
person                - Legislator biographical data
├── personuppdrag       - Individual assignments/roles
└── personuppgift       - Additional person info
```

**Administrative:**

```
organ                 - Parliamentary bodies/committees
roll                  - Role definitions
planering             - Scheduling/planning
riksmote              - Parliamentary sessions
```

### Key Design Patterns

- **Denormalized approach:** Embedded reference data for fast API queries
- **SQL Server conventions:** nvarchar, datetime, int types
- **Document-centric hierarchy:** Everything stems from `dokument`

---

## 3. Comparison: Riksdagen Schema vs. Laglig.se Schema

### What Matches (Already Implemented) ✅

| Riksdagen Table | Laglig.se Equivalent | Notes                                    |
| --------------- | -------------------- | ---------------------------------------- |
| `dokument`      | `LegalDocument`      | Core document entity ✅                  |
| `dokreferens`   | `CrossReference`     | Cross-document links ✅                  |
| `dokaktivitet`  | `LawChangeHistory`   | Activity tracking (different purpose) ✅ |

### What's Different (By Design)

| Riksdagen Table                                     | Laglig.se Approach                       | Reason                                           |
| --------------------------------------------------- | ---------------------------------------- | ------------------------------------------------ |
| `dokutskottsforslag`, `dokmotforslag`, `dokforslag` | Stored in `LegalDocument.metadata` JSONB | Multi-source aggregation requires flexibility    |
| `person`, `personuppdrag`                           | `Employee` (different domain)            | We track company employees, not parliamentarians |
| `debatt`, `votering`, `anforande`                   | Not implemented                          | Outside MVP scope (no voting/debate tracking)    |
| `organ`, `roll`                                     | Not needed                               | Not tracking parliamentary structure             |
| `riksmote`                                          | Not needed                               | Not tracking parliamentary sessions              |

### What We Could Add (Inspired by Riksdagen)

| Riksdagen Table                | Potential Laglig.se Addition | Value Proposition                                                                 |
| ------------------------------ | ---------------------------- | --------------------------------------------------------------------------------- |
| **`dokbilaga` (attachments)**  | **`DocumentAttachment`**     | Allow users to attach PDFs/images to laws (e.g., internal compliance docs, notes) |
| `dokuppgift` (assignments)     | Already have `LawTask`       | ✅ Covered                                                                        |
| `dokintressent` (stakeholders) | Could add `LawStakeholder`   | Track which departments/employees care about each law (low priority)              |

---

## 4. Recommendation: Hybrid Approach

### ✅ KEEP Our Schema (Primary Architecture)

**Reasons:**

1. **Multi-source aggregation:** We ingest from Riksdagen (SFS), Domstolsverket (court cases), EUR-Lex (EU legislation). Riksdagen's schema is single-source only.
2. **SaaS multi-tenancy:** Our schema has `workspace_id` on all tables for RLS. Riksdagen's is single-tenant.
3. **Polymorphic content types:** Our `LegalDocument` + `CourtCase` + `EUDocument` design handles multiple document types cleanly. Riksdagen only handles parliamentary documents.
4. **Modern stack:** We use Prisma + PostgreSQL + pgvector. Riksdagen uses SQL Server conventions.
5. **B2B SaaS needs:** We track employees, kollektivavtal, workspaces, subscriptions, AI chat—none of this exists in Riksdagen's schema.

### 🔄 ADOPT Selective Concepts

**1. DocumentAttachment Table (Inspired by `dokbilaga`)**

```typescript
interface DocumentAttachment {
  id: string
  legal_document_id: string // FK to LegalDocument
  workspace_id: string // Multi-tenancy
  file_url: string // Supabase Storage
  file_name: string
  file_size_bytes: number
  mime_type: string
  uploaded_by: string // FK to User
  description: string | null
  created_at: Date
}
```

**Use Case:** Users can attach internal compliance documents, checklists, or notes to laws in their workspace. E.g., attach a filled-out GDPR compliance checklist PDF to GDPR law card.

**Priority:** Post-MVP (nice-to-have)

**2. Metadata Mapping (Use their field names in JSONB)**

When ingesting from Riksdagen API, map their fields to our `LegalDocument.metadata` JSONB:

```typescript
// Riksdagen API response → Our LegalDocument.metadata
{
  // From Riksdagen's dokument table
  "dokument_url_html": "https://...",
  "systemdatum": "2025-01-05",
  "publicerad": "2025-01-05",
  "kalla": "riksdagen",

  // From dokutskottsforslag if applicable
  "utskottsforslag": [...],

  // From dokforslag
  "forslag": [...]
}
```

**Benefit:** Preserves Riksdagen's rich metadata for future features without schema changes.

### 📖 USE Their API Structure for Ingestion Scripts

**Epic 2, Story 2.2:** When building the SFS ingestion script, use Riksdagen's API structure:

```typescript
// Script: scripts/ingest-riksdagen-sfs.ts

async function ingestRiksdagenSFS() {
  // 1. Fetch from Riksdagen API (their dokument endpoint)
  const response = await fetch(
    'https://data.riksdagen.se/dokumentlista/?sok=...&doktyp=sfs'
  )

  // 2. Map to our LegalDocument schema
  const documents = response.dokumentlista.dokument.map((rikDoc) => ({
    content_type: 'SFS_LAW',
    document_number: rikDoc.dokument_id, // e.g., "SFS 2024:1234"
    title: rikDoc.titel,
    summary: rikDoc.summary || null,
    full_text: await fetchFullText(rikDoc.dokument_url_html),
    publication_date: new Date(rikDoc.publicerad),
    source_url: rikDoc.dokument_url_html,
    metadata: {
      // Store ALL Riksdagen metadata in JSONB
      systemdatum: rikDoc.systemdatum,
      publicerad: rikDoc.publicerad,
      utskottsforslag: rikDoc.utskottsforslag,
      // ... etc
    },
  }))

  // 3. Upsert to our database
  await prisma.legalDocument.createMany({
    data: documents,
    skipDuplicates: true,
  })
}
```

---

## 5. SQL Model Analysis: Can We Use It Directly?

### ❌ NO - Full Adoption Not Recommended

**Blockers:**

1. **Single-source design:** Only handles Riksdagen data, not court cases or EU legislation
2. **No multi-tenancy:** No `workspace_id`, no RLS policies
3. **SQL Server conventions:** We use PostgreSQL with pgvector
4. **No SaaS features:** No users, workspaces, subscriptions, employees, AI chat
5. **Denormalized for read-heavy:** We need normalized for SaaS writes + reads
6. **Parliament-specific:** Tracks debates, votes, parliamentarians—irrelevant to B2B compliance

### ✅ YES - Inspiration for Metadata Structure

**What We Gain:**

- Understanding of Riksdagen's data model helps us map their API responses correctly
- Their `dokbilaga` concept inspires our DocumentAttachment feature
- Their `dokreferens` validates our CrossReference design
- Their metadata fields guide our JSONB structure

---

## 6. Action Items for Section 5: API Specification

When drafting API routes for Epic 2 (Legal Content Ingestion):

### Story 2.2: Ingest SFS Laws from Riksdagen API

**Endpoint to Build:**

```
POST /api/admin/ingest/riksdagen-sfs
```

**Implementation Notes:**

1. Use Riksdagen's open data API (no auth required)
2. Fetch `dokument` with `doktyp=sfs`
3. Map their fields to our `LegalDocument` schema
4. Store full Riksdagen metadata in our `metadata` JSONB
5. Extract `dokreferens` → populate our `CrossReference` table
6. Rate limiting: Max 10 requests/second (per their guidelines)
7. Progress tracking: Use `BackgroundJob` entity for 50K+ documents

**Zod Schema:**

```typescript
const RiksdagenDocumentSchema = z.object({
  dokument_id: z.string(),
  titel: z.string(),
  publicerad: z.string(),
  dokument_url_html: z.string(),
  summary: z.string().optional(),
  // ... map all Riksdagen fields
})
```

---

## 7. Summary & Recommendation

### For Tomorrow's Section 5 Work:

**✅ DO:**

- Document Riksdagen API integration in API Specification
- Show field mapping: Riksdagen response → our LegalDocument
- Include rate limits, error handling, retry logic
- Reference this analysis document

**❌ DON'T:**

- Adopt Riksdagen's SQL schema wholesale
- Create separate tables for `dokutskottsforslag`, `dokmotforslag` (use JSONB instead)
- Track parliamentarians, debates, votes (out of scope)

**🔮 FUTURE (Post-MVP):**

- Add `DocumentAttachment` table inspired by `dokbilaga`
- Consider `LawStakeholder` table inspired by `dokintressent` (if users request it)

---

**Conclusion:** Riksdagen's SQL model is valuable for understanding their data structure and API, but our multi-source, multi-tenant SaaS architecture requires a different schema design. We'll use their model as a **mapping reference** for ingestion scripts, not as a base schema.

**Status:** Ready to proceed with Section 5: API Specification tomorrow with this context in mind.
