# Epic: Myndighetsföreskrifter Ingestion & Display

**Epic ID:** 2.M
**Status:** Draft - Awaiting PO Validation
**Priority:** High (Critical for law applicability context)
**Estimated Scope:** 8-12 stories

---

## Executive Summary

Swedish agency regulations (myndighetsföreskrifter) are binding rules issued by government agencies that translate abstract laws into concrete, actionable requirements. While SFS laws define what must be done, föreskrifter define **how** it must be done in practice. This epic adds support for ingesting, storing, and displaying these ~58 agency författningssamlingar, making Laglig.se the most comprehensive Swedish legal information platform.

**Business Value:**

- **Competitive Advantage:** Notisum has this - parity is required
- **User Value:** Users need föreskrifter to understand how laws apply to their business (e.g., AFS for workplace safety, KOVFS for consumer protection)
- **SEO:** Thousands of additional indexed pages (estimated 5,000-15,000 documents)
- **Law List Enhancement:** Föreskrifter can be included in personalized law lists based on industry

---

## Research Findings

### Source Landscape

**Total Agencies with Författningssamlingar:** 58 (per [svenskforfattningssamling.se](https://svenskforfattningssamling.se/centrala2023.html))

**Source Quality Analysis (sampled):**

| Agency             | Code   | Data Format           | API? | Accessibility | Priority |
| ------------------ | ------ | --------------------- | ---- | ------------- | -------- |
| Arbetsmiljöverket  | AFS    | Structured HTML + PDF | No   | Excellent     | P0       |
| Konsumentverket    | KOVFS  | JSON API              | Yes! | Excellent     | P0       |
| Arbetsförmedlingen | AFFS   | HTML listing          | No   | Good          | P1       |
| Bolagsverket       | BOLFS  | Cloudflare CAPTCHA    | No   | Blocked       | P2       |
| Finansinspektionen | FFFS   | PDF-heavy             | No   | Medium        | P1       |
| Skatteverket       | SKVFS  | Structured            | No   | Good          | P1       |
| Livsmedelsverket   | LIVSFS | Structured            | No   | Good          | P1       |
| Transportstyrelsen | TSFS   | PDF-heavy             | No   | Medium        | P1       |

### Technical Challenges Identified

1. **No Central API:** Each agency publishes independently with different:
   - URL structures
   - Data formats (HTML, PDF, some JSON)
   - Metadata schemas
   - Update frequencies

2. **PDF-Heavy Content:** Most föreskrifter are published as PDFs requiring:
   - Download and storage
   - Text extraction (pdf-parse)
   - LLM parsing for structured data (dates, affected laws, sections)

3. **Cross-Reference Complexity:** Föreskrifter reference SFS laws (e.g., "AFS 2023:1 implements 7 kap. arbetsmiljölagen"). Need bidirectional linking.

4. **Access Barriers:** Some agencies (Bolagsverket) use Cloudflare protection

5. **Volume:** Estimated 5,000-15,000 total documents across 58 agencies

### Existing Codebase Patterns

- **Ingestion scripts:** `scripts/ingest-*.ts` pattern established
- **External API clients:** `lib/external/*.ts` pattern established
- **Data model:** `LegalDocument` polymorphic table with `ContentType` enum
- **PDF parsing:** `lib/external/pdf-parser.ts` exists
- **LLM parsing:** `lib/external/llm-amendment-parser.ts` pattern exists

---

## Proposed Data Model Extension

### New ContentTypes (add to Prisma enum)

```prisma
enum ContentType {
  // Existing
  SFS_LAW
  SFS_AMENDMENT
  COURT_CASE_AD
  COURT_CASE_HD
  // ... etc

  // NEW: Myndighetsföreskrifter
  AGENCY_REGULATION       // General catch-all
  AGENCY_REGULATION_AFS   // Arbetsmiljöverket
  AGENCY_REGULATION_KOVFS // Konsumentverket
  AGENCY_REGULATION_FFFS  // Finansinspektionen
  AGENCY_REGULATION_SKVFS // Skatteverket
  AGENCY_REGULATION_LIVSFS // Livsmedelsverket
  // ... add more as agencies are onboarded
}
```

### New Model: AgencyRegulation (type-specific metadata)

```prisma
model AgencyRegulation {
  id              String   @id @default(uuid())
  document_id     String   @unique

  // Agency info
  agency_code     String   // "AFS", "KOVFS", etc.
  agency_name     String   // "Arbetsmiljöverket"

  // Regulation identifiers
  regulation_number String  // "2023:1"
  full_designation  String  // "AFS 2023:1"

  // Relationship to SFS laws
  implementing_sfs  String[] // ["SFS 1977:1160", "SFS 2010:110"]

  // Amendment tracking
  amends_regulation String?  // "AFS 2020:5" (if this is an ändringsföreskrift)
  is_amendment      Boolean  @default(false)

  // Status
  is_current        Boolean  @default(true) // false if superseded
  superseded_by     String?  // "AFS 2025:1"

  // PDF storage
  pdf_storage_path  String?
  pdf_url           String?

  document          LegalDocument @relation(fields: [document_id], references: [id], onDelete: Cascade)

  @@index([agency_code])
  @@index([regulation_number])
  @@index([implementing_sfs])
  @@map("agency_regulations")
}
```

### Cross-Reference Extension

Add `ReferenceType.IMPLEMENTS_SFS` to link föreskrifter → laws:

```prisma
enum ReferenceType {
  CITES
  IMPLEMENTS
  AMENDS
  REFERENCES
  RELATED
  IMPLEMENTS_SFS  // NEW: Föreskrift implements specific SFS law
}
```

---

## Proposed Story Breakdown

### Phase 1: Foundation (MVP - 3 agencies)

**Story 2.M.1: Data Model & Infrastructure**

- Add new ContentTypes to enum
- Create AgencyRegulation model
- Update CrossReference for föreskrift→SFS links
- Migration script
- **AC:** Schema deployed, existing data unaffected

**Story 2.M.2: Agency Adapter Pattern**

- Create `lib/external/agency-adapters/` directory
- Define `AgencyAdapter` interface:
  ```typescript
  interface AgencyAdapter {
    agencyCode: string
    fetchIndex(): Promise<RegulationIndex[]>
    fetchDocument(id: string): Promise<RegulationDocument>
    parseMetadata(doc: RegulationDocument): AgencyRegulationMetadata
  }
  ```
- Implement base adapter with common logic (PDF download, text extraction, LLM parsing)
- **AC:** Adapter pattern documented, base class implemented

**Story 2.M.3: Arbetsmiljöverket (AFS) Adapter**

- Implement scraper for https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/
- Parse regulation list (AFS YYYY:N format)
- Download PDFs
- Extract text and metadata via LLM
- Link to implementing SFS laws (arbetsmiljölagen, etc.)
- **AC:** All ~200 AFS regulations ingested with full text

**Story 2.M.4: Konsumentverket (KOVFS) Adapter**

- Leverage discovered API: `publikationer-api.konsumentverket.se`
- Parse JSON responses
- Download PDFs from provided links
- Extract metadata
- **AC:** All ~50 KOVFS regulations ingested

**Story 2.M.5: Generic Scraper for HTML-based Agencies**

- Configurable scraper for agencies with similar HTML structures
- Support for: AFFS, FFFS, SKVFS, LIVSFS
- Configuration-driven (URLs, selectors, patterns)
- **AC:** At least 2 additional agencies ingested via config

### Phase 2: Display & SEO

**Story 2.M.6: Föreskrift Detail Pages**

- Route: `/foreskrifter/[agency]/[designation]` (e.g., `/foreskrifter/afs/2023-1`)
- Display:
  - Full text (rendered from extracted content)
  - PDF download link
  - Linked SFS laws
  - Amendment history
  - Effective date
- SEO metadata
- **AC:** Detail pages render correctly, indexed by Google

**Story 2.M.7: Agency Browse Pages**

- Route: `/foreskrifter/[agency]` (e.g., `/foreskrifter/afs`)
- List all regulations for agency
- Filter by year, status (current/historical)
- **AC:** Browse pages functional for all ingested agencies

**Story 2.M.8: Föreskrifter Catalogue Page**

- Route: `/rattskallor/foreskrifter`
- List all agencies with föreskrifter
- Count of regulations per agency
- Search across all föreskrifter
- **AC:** Main catalogue page functional

### Phase 3: Integration & Automation

**Story 2.M.9: Cross-Reference Display**

- On SFS law pages: Show "Implementing Föreskrifter" section
- On Föreskrift pages: Show "Implements" SFS laws
- Bidirectional navigation
- **AC:** Cross-references visible on both page types

**Story 2.M.10: Law List Integration**

- Include relevant föreskrifter in personalized law lists
- E.g., Restaurant → AFS regulations for workplace safety
- Update RAG context to include föreskrifter
- **AC:** Föreskrifter appear in law list suggestions

**Story 2.M.11: Automated Sync**

- Cron job: `sync-agency-regulations`
- Check for new/updated regulations daily
- Change detection and notification
- Error handling and retry logic
- **AC:** Daily sync runs, detects new regulations

### Phase 4: Scale (Future)

**Story 2.M.12-20: Additional Agency Adapters**

- Prioritize remaining agencies based on user demand
- Target: 20+ agencies by end of Phase 4

---

## Priority Agencies (Recommended Order)

Based on SMB relevance and data accessibility:

**P0 - MVP (Critical for launch):**

1. **AFS** - Arbetsmiljöverket (workplace safety - every employer needs this)
2. **KOVFS** - Konsumentverket (consumer protection - retail/e-commerce)
3. **LIVSFS** - Livsmedelsverket (food safety - restaurants, food industry)

**P1 - High Value:** 4. **FFFS** - Finansinspektionen (financial services) 5. **SKVFS** - Skatteverket (tax rules - every business) 6. **TSFS** - Transportstyrelsen (transport industry) 7. **HSLF-FS** - Healthcare regulations (healthcare industry)

**P2 - Moderate Value:** 8. **BFS** - Boverket (construction, real estate) 9. **NFS** - Naturvårdsverket (environmental regulations) 10. **SKOLFS** - Skolverket (education sector)

---

## Technical Approach

### Ingestion Pipeline

```
┌─────────────────┐
│  Agency Adapter │
│ (per-agency)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Fetch Index    │  ← Scrape/API call for regulation list
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Download PDFs  │  ← Store in Supabase Storage
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Extract Text   │  ← pdf-parse
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LLM Parsing    │  ← Extract: title, dates, affected SFS, sections
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Store to DB    │  ← LegalDocument + AgencyRegulation
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Create Links   │  ← CrossReference to SFS laws
└─────────────────┘
```

### File Structure

```
lib/
├── external/
│   ├── agency-adapters/
│   │   ├── index.ts              # Adapter registry
│   │   ├── base-adapter.ts       # Common logic
│   │   ├── afs-adapter.ts        # Arbetsmiljöverket
│   │   ├── kovfs-adapter.ts      # Konsumentverket
│   │   ├── generic-html-adapter.ts # Configurable HTML scraper
│   │   └── types.ts              # Shared types
scripts/
├── ingest-agency-regulations.ts   # Main ingestion script
├── sync-agency-regulations.ts     # Daily sync script
```

### LLM Parsing Prompt (Example for AFS)

```
Extract structured data from this Swedish agency regulation (föreskrift):

Text: [PDF extracted text]

Return JSON:
{
  "title": "Systematiskt arbetsmiljöarbete",
  "regulation_number": "2023:1",
  "agency_code": "AFS",
  "effective_date": "2024-01-01",
  "publication_date": "2023-06-15",
  "implementing_sfs": ["SFS 1977:1160"],
  "amends_regulation": null,
  "summary": "Föreskrifter om systematiskt arbetsmiljöarbete...",
  "affected_sections": ["3 §", "5-7 §§"]
}
```

---

## Risks & Mitigations

| Risk                               | Impact | Likelihood | Mitigation                                                        |
| ---------------------------------- | ------ | ---------- | ----------------------------------------------------------------- |
| Agency changes website structure   | Medium | Medium     | Adapter pattern isolates changes; monitoring alerts               |
| Cloudflare/CAPTCHA blocking        | High   | Low        | Start with accessible agencies; consider headless browser for P2  |
| PDF text extraction quality varies | Medium | High       | LLM parsing with confidence scores; manual review queue           |
| Volume overwhelming storage        | Low    | Low        | Supabase Storage scales; compress PDFs if needed                  |
| LLM costs for parsing              | Medium | Medium     | Batch processing; cache results; use Haiku for simple extractions |
| Cross-reference accuracy           | Medium | Medium     | LLM + human validation for initial batch; user feedback mechanism |

---

## Success Metrics

- **Coverage:** 3+ agencies ingested in Phase 1, 10+ by Phase 2
- **Accuracy:** >95% correct SFS cross-references
- **SEO:** Föreskrift pages indexed within 2 weeks of launch
- **User Engagement:** Föreskrifter included in 20%+ of generated law lists
- **Sync Reliability:** <1% failed sync jobs

---

## Dependencies

- **Existing:** PDF parsing (`lib/external/pdf-parser.ts`), LLM integration (OpenAI)
- **External:** Agency websites remaining accessible
- **Story 2.5:** SEO page generation patterns
- **Story 2.8:** Cross-document navigation system

---

## Questions for Product Review

1. **Scope Priority:** Should we include amendments (ändringsföreskrifter) from the start, or add in Phase 2?
2. **Historical Depth:** How far back should we ingest? (Currently most agencies have 10-20 years of history)
3. **Change Notification:** Should föreskrift changes trigger user notifications (like SFS law changes)?
4. **Law List Weighting:** How prominently should föreskrifter appear in personalized law lists vs. SFS laws?
5. **PDF Storage:** Store original PDFs or just extracted text? (Cost vs. user value of download)

---

## References

- [Lagrummet - Myndigheters föreskrifter](https://lagrummet.se/rattsinformation/myndigheters-foreskrifter)
- [Svenskforfattningssamling - Myndigheter lista](https://svenskforfattningssamling.se/centrala2023.html)
- [Arbetsmiljöverket föreskrifter](https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/)
- [Konsumentverket publikationer API](https://publikationer.konsumentverket.se/)
- [Författningssamlingsförordning (1976:725)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/forfattningssamlingsforordning-1976725_sfs-1976-725/)

---

_Document created: 2025-12-15_
_Author: Sarah (PO Agent)_
_Status: Awaiting stakeholder review_
