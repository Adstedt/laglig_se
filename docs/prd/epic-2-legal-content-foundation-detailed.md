# Epic 2: Legal Content Foundation (DETAILED)

**Goal:** Build comprehensive multi-source legal content database with 170,000+ public SEO-optimized pages covering Swedish laws, court precedent, and EU legislation. Provide category structure, search/discovery features, and begin recording law change history for future retention features.

**Content Types (MVP):**

- **Swedish Laws (SFS):** 50,000-100,000 pages - Riksdagen API
- **Swedish Court Cases:** 9,000-16,000 pages - Domstolsverket API
  - HD (Supreme Court): 3,000-5,000 cases
  - HovR (Courts of Appeal): 1,500-3,000 cases
  - HFD (Supreme Administrative Court): 1,500-3,000 cases
  - MÖD (Environmental Court): 600-1,200 cases [Post-MVP: Industry-specific]
  - MIG (Migration Court): 200-500 cases [Post-MVP: Industry-specific]
- **EU Legislation:** 110,000+ pages - EUR-Lex API
  - EU Regulations: 100,000+ pages
  - EU Directives: 10,000-15,000 pages

**Total MVP Pages:** ~170,000-225,000 legal content pages

**Excluded from MVP (Post-MVP/Phase 2):**

- AD (Labour Court) - Data source quality issues, revisit post-MVP
- Propositioner (Government Bills) - Phase 2 professional tier
- EU Court Cases - Phase 2 for legal interpretation
- SOU/Ds (Preparatory Works) - Low SMB value, Phase 3 or skip

## **Value Delivered:** Comprehensive multi-content-type legal library driving massive SEO traffic (170K+ indexable pages) + discovery tools enabling users to find relevant laws, court precedent, and EU compliance requirements + cross-document navigation (laws ↔ cases ↔ EU directives) + historical data collection for Epic 8.

## Story 2.1: Design Multi-Content-Type Data Model

**As a** developer,
**I want** to create a flexible database schema supporting multiple legal document types,
**so that** we can store SFS laws, court cases, and EU legislation with type-specific metadata.

**Acceptance Criteria:**

1. `ContentType` enum created with values: SFS_LAW, HD_SUPREME_COURT, HOVR_COURT_APPEAL, HFD_ADMIN_SUPREME, MOD_ENVIRONMENT_COURT, MIG_MIGRATION_COURT, EU_REGULATION, EU_DIRECTIVE
2. `legal_documents` table created with polymorphic schema:
   - id (UUID), content_type (ContentType), document_number (VARCHAR unique), title (TEXT)
   - summary (TEXT), full_text (TEXT), effective_date (DATE), publication_date (DATE)
   - status (DocumentStatus enum), source_url (TEXT), metadata (JSONB)
   - search_vector (tsvector), embedding (vector(1536))
3. Type-specific tables created:
   - `court_cases` (document_id, court_name, case_number, lower_court, decision_date, parties JSONB)
   - `eu_documents` (document_id, celex_number, eut_reference, national_implementation_measures JSONB)
4. `cross_references` table created (source_document_id, target_document_id, reference_type, context)
5. `amendments` table created for SFS laws with **enhanced metadata from competitive analysis**:
   - base_document_id, amending_document_id (relations to legal_documents)
   - amending_law_title (full title: "Lag (2025:732) om ändring i...")
   - publication_date (when amending law published), effective_date (when takes effect, can be future)
   - affected_sections_raw (Notisum format: "ändr. 6 kap. 17 §; upph. 8 kap. 4 §")
   - affected_sections (JSON: {amended: ["6:17"], repealed: ["8:4"], new: [], renumbered: []})
   - summary (2-3 sentence GPT-4 generated plain language summary)
   - summary_generated_by (enum: GPT_4, HUMAN, SFSR, RIKSDAGEN)
   - detected_method (enum: RIKSDAGEN_TEXT_PARSING, LAGEN_NU_SCRAPING, SFSR_REGISTER, LAGRUMMET_RINFO)
   - metadata (JSONB for debugging), created_at, updated_at
   - **See `docs/notisum-amendment-competitive-analysis.md` for feature parity rationale**
6. `document_subjects` table created (document_id, subject_code, subject_name) for categorization
7. Prisma schema updated with all models and relations
8. Migration generated and applied successfully
9. TypeScript types generated for all models
10. Test data inserted for each content type validates schema

---

## Story 2.2: Ingest 11,351 SFS Laws (1968-Present) from Riksdagen API

**As a** developer,
**I want** to fetch all SFS laws from Riksdagen API and store them in the database,
**so that** we have complete Swedish legal content for the platform.

**Acceptance Criteria:**

1. Node script created to fetch all SFS documents from Riksdagen API
2. Script fetches: title, SFS number, full text, published date, ministry, metadata
3. Rate limiting implemented (conservative 5 requests/second to respect API limits)
4. Data stored in `legal_documents` table with content_type = SFS_LAW
5. SFS-specific metadata stored in `metadata` JSONB field: ministry, law_type (lag/förordning), abbreviations
6. Script handles pagination for 11,351 documents (1968-present coverage)
7. Duplicate detection: Skip laws already in database (by document_number)
8. Error handling: Retry failed requests 3x before logging to Sentry
9. Progress logging: "Processed 5,000/11,351 laws..."
10. Script completes full ingestion in <48 hours (multi-day background job acceptable - ~38 hours estimated at 5 req/sec)
11. Verification: Database contains 11,351 SFS documents (1968-present) after completion
12. **Note:** Riksdagen API provides laws from 1968-present. Pre-1968 laws rarely relevant for SMB compliance. Can add Lagrummet as fallback source in Phase 2 if historical laws requested.
13. **Amendment extraction** (competitive feature - see `docs/historical-amendment-tracking-strategy.md`):
    - For EACH SFS law, parse inline amendment references from full text (e.g., "Lag (2021:1112)")
    - Create Amendment records linking original law → amending law
    - Fetch amending law metadata (already in database from Step 1)
    - Parse affected sections from amending law text: "föreskrivs att 1 kap. 3 § ska ha följande lydelse"
    - Generate 2-3 sentence summary with GPT-4 (Swedish, plain language)
    - Parse effective date from transition provisions: "träder i kraft den 1 juli 2011"
    - Store all 7 data points per amendment (SFS number, title, pub date, affected sections, summary, effective date, user comments placeholder)
14. **Amendment backfill** from lagen.nu (background job, separate from main ingestion):
    - For laws with <5 amendments (suspected incomplete), scrape lagen.nu for complete list
    - Rate limit: 1 request per 2 seconds (respectful)
    - Run as separate background job, does not block main ingestion
15. **Cost impact:** One-time GPT-4 cost ~$238 for summarizing 5,675 amending laws (2,600 tokens × $0.042/amendment)
16. **Performance impact:** +1.6 hours for amendment parsing (regex + text processing), +1.3 hours for lagen.nu backfill
17. **Database impact:** +90,000 Amendment records with full metadata (~45MB storage)
18. Verification: Database contains 90,000+ Amendment records after completion with all 7 fields populated

---

## Story 2.3: Ingest Swedish Court Cases from Domstolsverket API

**As a** developer,
**I want** to fetch court cases from AD, HFD, HD, and HovR (priority order),
**so that** we have comprehensive Swedish case law precedent.

**Acceptance Criteria:**

1. Integration with Domstolsverket PUH API endpoint (verify availability)
2. Node script created to fetch cases from multiple courts (priority order):
   - **AD (Arbetsdomstolen / Labour Court):** AD series - **PRIORITY #1** (employment law - critical for all employers)
   - HFD (Högsta Förvaltningsdomstolen / Supreme Administrative Court): HFD/RÅ series - Priority #2 (tax/administrative law)
   - HD (Högsta Domstolen / Supreme Court): NJA series - Priority #3 (general civil/criminal law)
   - HovR (Hovrätterna / Courts of Appeal): RH series - Priority #4 (practical precedent)
3. For each court, script fetches: case number, decision date, court name, summary, full text, lower court (if available), parties (extract from full text)
4. Data stored in `legal_documents` table with appropriate content_type (AD_LABOUR_COURT, HFD_ADMIN_SUPREME, HD_SUPREME_COURT, HOVR_COURT_APPEAL)
5. Court-specific metadata stored in `court_cases` table
6. Case numbering formats preserved (AD YYYY nr N, HFD YYYY ref N, NJA YYYY s NN, RH YYYY:N)
7. Script extracts cross-references to cited SFS laws from `lagrumLista` field and stores in `cross_references` table
8. Rate limiting per API guidelines (conservative 5 req/sec recommended)
9. Progress logging per court: "AD: 500/2,500 cases, HFD: 300/2,000 cases, HD: 400/4,000 cases, HovR: 200/1,500 cases..."
10. Error handling with retry logic
11. Script completes in <12 hours for all four courts (run as multi-day background job if needed)
12. Verification: Database contains 10,000-20,000 court cases after completion (increased from 6-11K to include AD)
13. **Competitive Advantage:** AD data is working in Domstolsverket PUH API (Notisum's AD coverage is broken - empty case pages). This gives us THE MOST CRITICAL court for employers that competitors cannot provide.

---

## Story 2.4: Ingest EU Regulations and Directives from EUR-Lex API

**As a** developer,
**I want** to fetch EU regulations and directives in Swedish from EUR-Lex,
**so that** we have comprehensive EU compliance content.

**Acceptance Criteria:**

1. Integration with EUR-Lex SPARQL/REST API
2. Node script created to fetch EU documents in Swedish:
   - Regulations: CELEX format 3YYYYRNNNN
   - Directives: CELEX format 3YYYYLNNNN
3. Script fetches: CELEX number, EU document number, title (Swedish), full text (Swedish), publication date, entry into force date, EUT reference
4. Data stored in `legal_documents` table with content_type EU_REGULATION or EU_DIRECTIVE
5. EU-specific metadata stored in `eu_documents` table
6. For directives, fetch National Implementation Measures (NIM) from EUR-Lex NIM database
7. NIM data stored in `eu_documents.national_implementation_measures` JSONB field
8. Script extracts cross-references between EU directives and Swedish implementing SFS laws
9. Cross-references stored in `cross_references` table
10. Rate limiting per EUR-Lex API guidelines
11. Progress logging: "Regulations: 10,000/100,000, Directives: 1,000/10,000..."
12. Script completes in <12 hours for all EU documents
13. Verification: Database contains 110,000+ EU documents after completion

---

## Story 2.5: Generate SEO-Optimized Pages for All Content Types

**As a** visitor,
**I want** to view any legal document (law, court case, EU regulation) on a public, SEO-optimized page,
**so that** I can discover Laglig.se through Google search.

**Acceptance Criteria:**

1. Dynamic routes created for each content type:
   - `/lagar/[lawSlug]` for SFS laws
   - `/rattsfall/hd/[caseSlug]` for HD cases
   - `/rattsfall/hovr/[caseSlug]` for HovR cases
   - `/rattsfall/hfd/[caseSlug]` for HFD cases
   - `/eu/forordningar/[regSlug]` for EU regulations
   - `/eu/direktiv/[dirSlug]` for EU directives
2. All pages use Server-Side Rendering (SSR) for SEO
3. URL slugs generated from titles + document numbers
4. Each page displays type-appropriate content:
   - SFS: Law title, SFS number, full text, effective date, amendments
   - Court cases: Case number, court, decision date, summary, full judgment, cited laws
   - EU: Document number, CELEX, title, full text, national implementation (directives)
5. Meta tags optimized per content type
6. Structured data (JSON-LD) for legal documents and court cases
7. Sitemap.xml auto-generated listing ALL 170,000+ pages (split into multiple sitemaps if needed)
8. Canonical URLs set for all content types
9. Core Web Vitals: LCP <2.5s, CLS <0.1, FID <100ms
10. Mobile-responsive layout for all content types
11. Legal disclaimer in footer: "AI-assisted guidance, not legal advice"

---

## Story 2.6: Implement Content Type-Specific Categorization

**As a** visitor,
**I want** to browse legal content by category and content type,
**so that** I can discover relevant laws, court cases, and EU regulations for my needs.

**Acceptance Criteria:**

1. 10 top-level subject categories defined: Arbetsrätt, Dataskydd, Skatterätt, Bolagsrätt, Miljö & Bygg, Livsmedel & Hälsa, Finans, Immaterialrätt, Konsumentskydd, Transport & Logistik
2. AI categorization script uses GPT-4 to classify ALL document types
3. Categorization prompt adapted per content type:
   - SFS laws: title + first 500 chars → category + B2B/Private/Both
   - Court cases: case summary + decision → category + subject tags
   - EU documents: title + recitals → category + industry applicability
4. Categories stored in `document_subjects` table
5. Category pages created for each content type:
   - `/lagar/kategorier/arbetsratt` - SFS laws in category
   - `/rattsfall/kategorier/arbetsratt` - Court cases in category
   - `/eu/kategorier/arbetsratt` - EU legislation in category
6. Document count shown per category per type
7. Category pages SEO-optimized with meta tags
8. Verification: All 170,000+ documents have assigned categories
9. Manual review of 100 random categorizations (mixed types) shows >90% accuracy
10. Content type filter on category pages: "Show only: Laws | Court Cases | EU Legislation"

---

## Story 2.7: Build Multi-Content-Type Search and Filtering

**As a** user,
**I want** to search across all legal content types with filtering,
**so that** I can quickly find specific laws, court precedent, or EU regulations.

**Acceptance Criteria:**

1. Unified search page created: `/sok` (search)
2. Full-text search implemented using PostgreSQL `tsvector` across all content types
3. Search queries match: titles, document numbers, full text, summaries
4. Search results display mixed content types with clear type badges
5. Each result shows: title, document number, content type, category, snippet
6. Results ranked by relevance using weighted ranking:
   - Title match: weight 1.0
   - Document number match: weight 0.9
   - Full text match: weight 0.5
7. Filters available:
   - Content Type (Laws, HD Cases, HovR Cases, HFD Cases, EU Regulations, EU Directives)
   - Category (Arbetsrätt, Dataskydd, etc.)
   - Business Type (B2B/Private/Both)
   - Date Range (publication date)
8. Search performance <800ms for 170,000+ documents
9. Pagination (20 results per page)
10. No results state with suggestions
11. Mobile-responsive search interface
12. Search analytics tracked (query, results count, clicks)

---

## Story 2.8: Implement Cross-Document Navigation System

**As a** user,
**I want** to navigate between related documents (law → cases citing it → EU directive requiring it),
**so that** I understand the complete legal landscape.

**Acceptance Criteria:**

1. SFS law pages display "Referenced in Court Cases" section showing all court cases that cite this law
2. Court case pages display "Cited Laws" section showing all SFS laws cited in the judgment
3. EU directive pages display "Swedish Implementation" section showing SFS laws implementing the directive
4. SFS law pages display "Implements EU Directive" section if law is implementing EU law
5. Cross-references automatically extracted during ingestion (Stories 2.2, 2.3, 2.4)
6. Manual cross-reference creation interface for authenticated users (link documents)
7. Bidirectional navigation works (A → B means B → A link appears)
8. Cross-reference links show context snippet: "This case interprets § 7 regarding..."
9. Cross-reference counts shown: "Referenced in 12 court cases"
10. Mobile-responsive cross-reference sections
11. Verification: Sample SFS law shows all expected court case references

---

## Story 2.9: Create SNI Code-Based Multi-Content Discovery

**As a** visitor,
**I want** to enter my industry code (SNI) and see all relevant legal content,
**so that** I understand my sector's complete compliance landscape (laws + court precedent + EU regulations).

**Acceptance Criteria:**

1. SNI discovery page created: `/upptack-lagar/bransch` (discover laws/industry)
2. Input field for SNI code (5 digits)
3. SNI code validation (format: XXXXX)
4. Industry starter packs created for 15 common sectors
5. Each starter pack contains curated mix of content types:
   - 12-25 SFS laws relevant to industry
   - 3-8 key court cases showing precedent
   - 5-12 EU regulations/directives affecting industry
6. Results page shows tabbed view:
   - "Lagar" tab: SFS laws
   - "Rättsfall" tab: Court cases with brief summaries
   - "EU-lagstiftning" tab: EU regulations and directives
7. Each tab sortable by relevance, date, category
8. "Lägg till i Min Lista" (Add to My List) CTA requires authentication
9. SEO-optimized pages for each industry: `/upptack-lagar/bransch/bygg-och-anlaggning`
10. SNI → content mapping stored in database
11. Mobile-responsive layout with tab navigation

---

## Story 2.10: Implement Content Type-Specific RAG Chunking Strategies

**As a** developer,
**I want** to chunk different content types appropriately for RAG embeddings,
**so that** semantic search retrieves optimal context for each document type.

**Acceptance Criteria:**

1. Chunking strategy configuration defined per content type:
   - **SFS laws:** Chunk by § (section), preserve chapter context, max 500 tokens
   - **Court cases:** Chunk by semantic section (Facts, Analysis, Conclusion), max 800 tokens
   - **EU regulations:** Chunk by article, preserve preamble context, max 500 tokens
   - **EU directives:** Chunk by article, preserve recitals context, max 500 tokens
2. Metadata preserved in each chunk:
   - SFS: chapter number, section number, law title
   - Court case: court name, case number, section type (Facts/Analysis/Conclusion)
   - EU: article number, CELEX, document type
3. Chunk overlap configured: 50 tokens overlap between adjacent chunks
4. Embedding generation script processes all 170,000+ documents
5. Embeddings generated using OpenAI `text-embedding-3-small` (1536 dimensions)
6. Embeddings stored in `legal_documents.embedding` vector field
7. Vector index created (HNSW) for fast similarity search
8. Script handles rate limits (max 1,000 requests/minute)
9. Progress logging per content type: "SFS: 5,000/50,000, HD: 200/3,000..."
10. Script completes in <16 hours for all content types
11. Test query: "employee sick leave rights" returns relevant chunks from SFS laws AND court cases
12. Verification: Database contains 100,000-200,000 chunk embeddings

---

## Story 2.11: Begin Recording Multi-Content-Type Change History

**As a** product owner,
**I want** to start collecting change history for ALL content types NOW (even without UI),
**so that** by Epic 8, we have 10+ weeks of historical data.

**Acceptance Criteria:**

1. Daily cron job created (runs 00:00 UTC)
2. Job monitors changes across all content types:
   - **SFS laws:** Check for new amendments, repeals, title changes
   - **Court cases:** Check for new published cases (HD, HovR, HFD)
   - **EU regulations/directives:** Check for new EU legislation, amendments
3. For each content type, compare current version to previous version
4. Detect changes:
   - New documents added (new SFS, new court cases, new EU acts)
   - Content changes (SFS amendments, corrected court case text)
   - Status changes (SFS repealed, EU directive superseded)
5. Changes stored in `content_changes` table: id, document_id, change_type, old_value, new_value, detected_at, content_type
6. No user-facing UI (background data collection)
7. Job logs: "Detected 45 changes today: 12 new SFS, 8 new court cases, 25 new EU acts"
8. Errors logged to Sentry
9. Job completes in <3 hours
10. Database accumulates change history silently
11. Verification: After 2 weeks, database contains change records for all content types
12. Change detection tested: Mock SFS amendment detected correctly
13. **NEW: Amendment enrichment** when SFS changes detected (competitive feature):
    - For new/updated SFS laws, extract amendment references from full text
    - Parse affected sections: "föreskrivs att 1 kap. 3 § ska ha följande lydelse"
    - Generate 2-3 sentence GPT-4 summary in Swedish (plain language)
    - Parse effective date from transition provisions
    - Create/update Amendment records with all 7 fields
    - Cost: ~$0.42/month for ~10 new amendments detected nightly
    - See `docs/historical-amendment-tracking-strategy.md` Section 12.5 for implementation

---

**Epic 2 Complete: 11 stories, 4-5 weeks estimated**
**As a** developer,
**I want** to create a flexible database schema supporting multiple legal document types,
**so that** we can store SFS laws, court cases, and EU legislation with type-specific metadata.

**Acceptance Criteria:**

1. `ContentType` enum created with values: SFS_LAW, HD_SUPREME_COURT, HOVR_COURT_APPEAL, HFD_ADMIN_SUPREME, MOD_ENVIRONMENT_COURT, MIG_MIGRATION_COURT, EU_REGULATION, EU_DIRECTIVE
2. `legal_documents` table created with polymorphic schema:
   - id (UUID), content_type (ContentType), document_number (VARCHAR unique), title (TEXT)
   - summary (TEXT), full_text (TEXT), effective_date (DATE), publication_date (DATE)
   - status (DocumentStatus enum), source_url (TEXT), metadata (JSONB)
   - search_vector (tsvector), embedding (vector(1536))
3. Type-specific tables created:
   - `court_cases` (document_id, court_name, case_number, lower_court, decision_date, parties JSONB)
   - `eu_documents` (document_id, celex_number, eut_reference, national_implementation_measures JSONB)
4. `cross_references` table created (source_document_id, target_document_id, reference_type, context)
5. `amendments` table created for SFS laws with **enhanced metadata from competitive analysis**:
   - base_document_id, amending_document_id (relations to legal_documents)
   - amending_law_title (full title: "Lag (2025:732) om ändring i...")
   - publication_date (when amending law published), effective_date (when takes effect, can be future)
   - affected_sections_raw (Notisum format: "ändr. 6 kap. 17 §; upph. 8 kap. 4 §")
   - affected_sections (JSON: {amended: ["6:17"], repealed: ["8:4"], new: [], renumbered: []})
   - summary (2-3 sentence GPT-4 generated plain language summary)
   - summary_generated_by (enum: GPT_4, HUMAN, SFSR, RIKSDAGEN)
   - detected_method (enum: RIKSDAGEN_TEXT_PARSING, LAGEN_NU_SCRAPING, SFSR_REGISTER, LAGRUMMET_RINFO)
   - metadata (JSONB for debugging), created_at, updated_at
   - **See `docs/notisum-amendment-competitive-analysis.md` for feature parity rationale**
6. `document_subjects` table created (document_id, subject_code, subject_name) for categorization
7. Prisma schema updated with all models and relations
8. Migration generated and applied successfully
9. TypeScript types generated for all models
10. Test data inserted for each content type validates schema

---

## Story 2.2: Ingest 11,351 SFS Laws (1968-Present) from Riksdagen API

**As a** developer,
**I want** to fetch all SFS laws from Riksdagen API and store them in the database,
**so that** we have complete Swedish legal content for the platform.

**Acceptance Criteria:**

1. Node script created to fetch all SFS documents from Riksdagen API
2. Script fetches: title, SFS number, full text, published date, ministry, metadata
3. Rate limiting implemented (conservative 5 requests/second to respect API limits)
4. Data stored in `legal_documents` table with content_type = SFS_LAW
5. SFS-specific metadata stored in `metadata` JSONB field: ministry, law_type (lag/förordning), abbreviations
6. Script handles pagination for 11,351 documents (1968-present coverage)
7. Duplicate detection: Skip laws already in database (by document_number)
8. Error handling: Retry failed requests 3x before logging to Sentry
9. Progress logging: "Processed 5,000/11,351 laws..."
10. Script completes full ingestion in <48 hours (multi-day background job acceptable - ~38 hours estimated at 5 req/sec)
11. Verification: Database contains 11,351 SFS documents (1968-present) after completion
12. **Note:** Riksdagen API provides laws from 1968-present. Pre-1968 laws rarely relevant for SMB compliance. Can add Lagrummet as fallback source in Phase 2 if historical laws requested.
13. **Amendment extraction** (competitive feature - see `docs/historical-amendment-tracking-strategy.md`):
    - For EACH SFS law, parse inline amendment references from full text (e.g., "Lag (2021:1112)")
    - Create Amendment records linking original law → amending law
    - Fetch amending law metadata (already in database from Step 1)
    - Parse affected sections from amending law text: "föreskrivs att 1 kap. 3 § ska ha följande lydelse"
    - Generate 2-3 sentence summary with GPT-4 (Swedish, plain language)
    - Parse effective date from transition provisions: "träder i kraft den 1 juli 2011"
    - Store all 7 data points per amendment (SFS number, title, pub date, affected sections, summary, effective date, user comments placeholder)
14. **Amendment backfill** from lagen.nu (background job, separate from main ingestion):
    - For laws with <5 amendments (suspected incomplete), scrape lagen.nu for complete list
    - Rate limit: 1 request per 2 seconds (respectful)
    - Run as separate background job, does not block main ingestion
15. **Cost impact:** One-time GPT-4 cost ~$238 for summarizing 5,675 amending laws (2,600 tokens × $0.042/amendment)
16. **Performance impact:** +1.6 hours for amendment parsing (regex + text processing), +1.3 hours for lagen.nu backfill
17. **Database impact:** +90,000 Amendment records with full metadata (~45MB storage)
18. Verification: Database contains 90,000+ Amendment records after completion with all 7 fields populated

---

## Story 2.3: Ingest Swedish Court Cases from Domstolsverket API

**As a** developer,
**I want** to fetch court cases from AD, HFD, HD, and HovR (priority order),
**so that** we have comprehensive Swedish case law precedent.

**Acceptance Criteria:**

1. Integration with Domstolsverket PUH API endpoint (verify availability)
2. Node script created to fetch cases from multiple courts (priority order):
   - **AD (Arbetsdomstolen / Labour Court):** AD series - **PRIORITY #1** (employment law - critical for all employers)
   - HFD (Högsta Förvaltningsdomstolen / Supreme Administrative Court): HFD/RÅ series - Priority #2 (tax/administrative law)
   - HD (Högsta Domstolen / Supreme Court): NJA series - Priority #3 (general civil/criminal law)
   - HovR (Hovrätterna / Courts of Appeal): RH series - Priority #4 (practical precedent)
3. For each court, script fetches: case number, decision date, court name, summary, full text, lower court (if available), parties (extract from full text)
4. Data stored in `legal_documents` table with appropriate content_type (AD_LABOUR_COURT, HFD_ADMIN_SUPREME, HD_SUPREME_COURT, HOVR_COURT_APPEAL)
5. Court-specific metadata stored in `court_cases` table
6. Case numbering formats preserved (AD YYYY nr N, HFD YYYY ref N, NJA YYYY s NN, RH YYYY:N)
7. Script extracts cross-references to cited SFS laws from `lagrumLista` field and stores in `cross_references` table
8. Rate limiting per API guidelines (conservative 5 req/sec recommended)
9. Progress logging per court: "AD: 500/2,500 cases, HFD: 300/2,000 cases, HD: 400/4,000 cases, HovR: 200/1,500 cases..."
10. Error handling with retry logic
11. Script completes in <12 hours for all four courts (run as multi-day background job if needed)
12. Verification: Database contains 10,000-20,000 court cases after completion (increased from 6-11K to include AD)
13. **Competitive Advantage:** AD data is working in Domstolsverket PUH API (Notisum's AD coverage is broken - empty case pages). This gives us THE MOST CRITICAL court for employers that competitors cannot provide.

---

## Story 2.4: Ingest EU Regulations and Directives from EUR-Lex API

**As a** developer,
**I want** to fetch EU regulations and directives in Swedish from EUR-Lex,
**so that** we have comprehensive EU compliance content.

**Acceptance Criteria:**

1. Integration with EUR-Lex SPARQL/REST API
2. Node script created to fetch EU documents in Swedish:
   - Regulations: CELEX format 3YYYYRNNNN
   - Directives: CELEX format 3YYYYLNNNN
3. Script fetches: CELEX number, EU document number, title (Swedish), full text (Swedish), publication date, entry into force date, EUT reference
4. Data stored in `legal_documents` table with content_type EU_REGULATION or EU_DIRECTIVE
5. EU-specific metadata stored in `eu_documents` table
6. For directives, fetch National Implementation Measures (NIM) from EUR-Lex NIM database
7. NIM data stored in `eu_documents.national_implementation_measures` JSONB field
8. Script extracts cross-references between EU directives and Swedish implementing SFS laws
9. Cross-references stored in `cross_references` table
10. Rate limiting per EUR-Lex API guidelines
11. Progress logging: "Regulations: 10,000/100,000, Directives: 1,000/10,000..."
12. Script completes in <12 hours for all EU documents
13. Verification: Database contains 110,000+ EU documents after completion

---

## Story 2.5: Generate SEO-Optimized Pages for All Content Types

**As a** visitor,
**I want** to view any legal document (law, court case, EU regulation) on a public, SEO-optimized page,
**so that** I can discover Laglig.se through Google search.

**Acceptance Criteria:**

1. Dynamic routes created for each content type:
   - `/lagar/[lawSlug]` for SFS laws
   - `/rattsfall/hd/[caseSlug]` for HD cases
   - `/rattsfall/hovr/[caseSlug]` for HovR cases
   - `/rattsfall/hfd/[caseSlug]` for HFD cases
   - `/eu/forordningar/[regSlug]` for EU regulations
   - `/eu/direktiv/[dirSlug]` for EU directives
2. All pages use Server-Side Rendering (SSR) for SEO
3. URL slugs generated from titles + document numbers
4. Each page displays type-appropriate content:
   - SFS: Law title, SFS number, full text, effective date, amendments
   - Court cases: Case number, court, decision date, summary, full judgment, cited laws
   - EU: Document number, CELEX, title, full text, national implementation (directives)
5. Meta tags optimized per content type
6. Structured data (JSON-LD) for legal documents and court cases
7. Sitemap.xml auto-generated listing ALL 170,000+ pages (split into multiple sitemaps if needed)
8. Canonical URLs set for all content types
9. Core Web Vitals: LCP <2.5s, CLS <0.1, FID <100ms
10. Mobile-responsive layout for all content types
11. Legal disclaimer in footer: "AI-assisted guidance, not legal advice"

---

## Story 2.6: Implement Content Type-Specific Categorization

**As a** visitor,
**I want** to browse legal content by category and content type,
**so that** I can discover relevant laws, court cases, and EU regulations for my needs.

**Acceptance Criteria:**

1. 10 top-level subject categories defined: Arbetsrätt, Dataskydd, Skatterätt, Bolagsrätt, Miljö & Bygg, Livsmedel & Hälsa, Finans, Immaterialrätt, Konsumentskydd, Transport & Logistik
2. AI categorization script uses GPT-4 to classify ALL document types
3. Categorization prompt adapted per content type:
   - SFS laws: title + first 500 chars → category + B2B/Private/Both
   - Court cases: case summary + decision → category + subject tags
   - EU documents: title + recitals → category + industry applicability
4. Categories stored in `document_subjects` table
5. Category pages created for each content type:
   - `/lagar/kategorier/arbetsratt` - SFS laws in category
   - `/rattsfall/kategorier/arbetsratt` - Court cases in category
   - `/eu/kategorier/arbetsratt` - EU legislation in category
6. Document count shown per category per type
7. Category pages SEO-optimized with meta tags
8. Verification: All 170,000+ documents have assigned categories
9. Manual review of 100 random categorizations (mixed types) shows >90% accuracy
10. Content type filter on category pages: "Show only: Laws | Court Cases | EU Legislation"

---

## Story 2.7: Build Multi-Content-Type Search and Filtering

**As a** user,
**I want** to search across all legal content types with filtering,
**so that** I can quickly find specific laws, court precedent, or EU regulations.

**Acceptance Criteria:**

1. Unified search page created: `/sok` (search)
2. Full-text search implemented using PostgreSQL `tsvector` across all content types
3. Search queries match: titles, document numbers, full text, summaries
4. Search results display mixed content types with clear type badges
5. Each result shows: title, document number, content type, category, snippet
6. Results ranked by relevance using weighted ranking:
   - Title match: weight 1.0
   - Document number match: weight 0.9
   - Full text match: weight 0.5
7. Filters available:
   - Content Type (Laws, HD Cases, HovR Cases, HFD Cases, EU Regulations, EU Directives)
   - Category (Arbetsrätt, Dataskydd, etc.)
   - Business Type (B2B/Private/Both)
   - Date Range (publication date)
8. Search performance <800ms for 170,000+ documents
9. Pagination (20 results per page)
10. No results state with suggestions
11. Mobile-responsive search interface
12. Search analytics tracked (query, results count, clicks)

---

## Story 2.8: Implement Cross-Document Navigation System

**As a** user,
**I want** to navigate between related documents (law → cases citing it → EU directive requiring it),
**so that** I understand the complete legal landscape.

**Acceptance Criteria:**

1. SFS law pages display "Referenced in Court Cases" section showing all court cases that cite this law
2. Court case pages display "Cited Laws" section showing all SFS laws cited in the judgment
3. EU directive pages display "Swedish Implementation" section showing SFS laws implementing the directive
4. SFS law pages display "Implements EU Directive" section if law is implementing EU law
5. Cross-references automatically extracted during ingestion (Stories 2.2, 2.3, 2.4)
6. Manual cross-reference creation interface for authenticated users (link documents)
7. Bidirectional navigation works (A → B means B → A link appears)
8. Cross-reference links show context snippet: "This case interprets § 7 regarding..."
9. Cross-reference counts shown: "Referenced in 12 court cases"
10. Mobile-responsive cross-reference sections
11. Verification: Sample SFS law shows all expected court case references

---

## Story 2.9: Create SNI Code-Based Multi-Content Discovery

**As a** visitor,
**I want** to enter my industry code (SNI) and see all relevant legal content,
**so that** I understand my sector's complete compliance landscape (laws + court precedent + EU regulations).

**Acceptance Criteria:**

1. SNI discovery page created: `/upptack-lagar/bransch` (discover laws/industry)
2. Input field for SNI code (5 digits)
3. SNI code validation (format: XXXXX)
4. Industry starter packs created for 15 common sectors
5. Each starter pack contains curated mix of content types:
   - 12-25 SFS laws relevant to industry
   - 3-8 key court cases showing precedent
   - 5-12 EU regulations/directives affecting industry
6. Results page shows tabbed view:
   - "Lagar" tab: SFS laws
   - "Rättsfall" tab: Court cases with brief summaries
   - "EU-lagstiftning" tab: EU regulations and directives
7. Each tab sortable by relevance, date, category
8. "Lägg till i Min Lista" (Add to My List) CTA requires authentication
9. SEO-optimized pages for each industry: `/upptack-lagar/bransch/bygg-och-anlaggning`
10. SNI → content mapping stored in database
11. Mobile-responsive layout with tab navigation

---

## Story 2.10: Implement Content Type-Specific RAG Chunking Strategies

**As a** developer,
**I want** to chunk different content types appropriately for RAG embeddings,
**so that** semantic search retrieves optimal context for each document type.

**Acceptance Criteria:**

1. Chunking strategy configuration defined per content type:
   - **SFS laws:** Chunk by § (section), preserve chapter context, max 500 tokens
   - **Court cases:** Chunk by semantic section (Facts, Analysis, Conclusion), max 800 tokens
   - **EU regulations:** Chunk by article, preserve preamble context, max 500 tokens
   - **EU directives:** Chunk by article, preserve recitals context, max 500 tokens
2. Metadata preserved in each chunk:
   - SFS: chapter number, section number, law title
   - Court case: court name, case number, section type (Facts/Analysis/Conclusion)
   - EU: article number, CELEX, document type
3. Chunk overlap configured: 50 tokens overlap between adjacent chunks
4. Embedding generation script processes all 170,000+ documents
5. Embeddings generated using OpenAI `text-embedding-3-small` (1536 dimensions)
6. Embeddings stored in `legal_documents.embedding` vector field
7. Vector index created (HNSW) for fast similarity search
8. Script handles rate limits (max 1,000 requests/minute)
9. Progress logging per content type: "SFS: 5,000/50,000, HD: 200/3,000..."
10. Script completes in <16 hours for all content types
11. Test query: "employee sick leave rights" returns relevant chunks from SFS laws AND court cases
12. Verification: Database contains 100,000-200,000 chunk embeddings

---

## Story 2.11: Begin Recording Multi-Content-Type Change History

**As a** product owner,
**I want** to start collecting change history for ALL content types NOW (even without UI),
**so that** by Epic 8, we have 10+ weeks of historical data.

**Acceptance Criteria:**

1. Daily cron job created (runs 00:00 UTC)
2. Job monitors changes across all content types:
   - **SFS laws:** Check for new amendments, repeals, title changes
   - **Court cases:** Check for new published cases (HD, HovR, HFD)
   - **EU regulations/directives:** Check for new EU legislation, amendments
3. For each content type, compare current version to previous version
4. Detect changes:
   - New documents added (new SFS, new court cases, new EU acts)
   - Content changes (SFS amendments, corrected court case text)
   - Status changes (SFS repealed, EU directive superseded)
5. Changes stored in `content_changes` table: id, document_id, change_type, old_value, new_value, detected_at, content_type
6. No user-facing UI (background data collection)
7. Job logs: "Detected 45 changes today: 12 new SFS, 8 new court cases, 25 new EU acts"
8. Errors logged to Sentry
9. Job completes in <3 hours
10. Database accumulates change history silently
11. Verification: After 2 weeks, database contains change records for all content types
12. Change detection tested: Mock SFS amendment detected correctly
13. **NEW: Amendment enrichment** when SFS changes detected (competitive feature):
    - For new/updated SFS laws, extract amendment references from full text
    - Parse affected sections: "föreskrivs att 1 kap. 3 § ska ha följande lydelse"
    - Generate 2-3 sentence GPT-4 summary in Swedish (plain language)
    - Parse effective date from transition provisions
    - Create/update Amendment records with all 7 fields
    - Cost: ~$0.42/month for ~10 new amendments detected nightly
    - See `docs/historical-amendment-tracking-strategy.md` Section 12.5 for implementation

---

## Story 2.12: Rättskällor Catalogue/Browse Page

**As a** visitor or authenticated user,
**I want** to browse all legal documents (laws, court cases, EU legislation) through a catalogue/browse interface at `/rattskallor`,
**so that** I can discover, filter, and explore legal content without needing to perform a specific search query.

**Acceptance Criteria:**

1. Base route `/rattskallor` displays paginated catalogue of ALL legal document types (SFS laws, court cases, EU legislation)
2. Pre-filtered sub-routes implemented:
   - `/rattskallor/lagar` - Shows only SFS laws (content_type = SFS_LAW)
   - `/rattskallor/rattsfall` - Shows only court cases (AD, HD, HovR, HFD, MÖD, MIG)
   - `/rattskallor/eu-ratt` - Shows only EU legislation (EU_REGULATION, EU_DIRECTIVE)
3. Integrated search bar with debounced search-as-you-type (300ms debounce):
   - Search suggestions appear in dropdown as user types
   - Pressing Enter or clicking "Search" filters results
   - Results often already cached from debounced requests
4. Same filter/facet components as `/sok` page available (reuse existing UX):
   - Content Type filter (when on base `/rattskallor` route)
   - Document Status filter (Active, Amended, Repealed)
   - Category filter (same as `/sok` - uses `document_subjects` table)
   - Business Type filter (B2B/Private/Both)
   - Date range filter (publication date)
5. Traditional pagination with page selector:
   - Results per page selector: 25, 50, 100 (default: 25)
   - Page numbers displayed with "Page X of Y" indicator
   - SEO-friendly URLs: `/rattskallor/lagar?page=2&per_page=50`
6. Pre-fetching strategy implemented:
   - On initial page load, pre-fetch page 2 results in background after render
   - When user hovers/scrolls near pagination controls, pre-fetch target page
7. Each result displays: title, document number, content type badge, category tags, publication date, snippet/summary
8. Results sortable by: Relevance (when search active), Publication Date (newest/oldest), Title (A-Z)
9. Mobile-responsive layout:
   - Desktop: Sidebar filters + main results area (same as `/sok`)
   - Mobile: Filter drawer accessible via button
10. All pages use Server-Side Rendering (SSR) for SEO
11. Proper meta tags and Open Graph data for each route:
    - `/rattskallor`: "Bläddra i svensk lagstiftning | Laglig.se"
    - `/rattskallor/lagar`: "Svenska lagar (SFS) | Laglig.se"
    - `/rattskallor/rattsfall`: "Svenska rättsfall | Laglig.se"
    - `/rattskallor/eu-ratt`: "EU-lagstiftning | Laglig.se"
12. Search performance <800ms for browsing queries across 170,000+ documents
13. Core Web Vitals targets met: LCP <2.5s, CLS <0.1, FID <100ms
14. Authenticated users see same experience as public visitors (auth-specific features deferred to separate story)

---

**Epic 2 Complete: 12 stories, 5-6 weeks estimated**

---
