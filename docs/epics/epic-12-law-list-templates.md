# Epic 12: Law List Templates & Standard Regulatory Packages

## Epic Overview

**Epic ID:** Epic 12
**Status:** Draft
**Priority:** High (core product differentiator, enables multiple downstream features)
**Business Owner:** Product Team
**Technical Lead:** Development Team

## Executive Summary

Create a curated library of expert-quality law list templates that serve as both a browsable product catalog for users and the structured foundation for AI-assisted law list generation. Phase 1 delivers 3 gold-standard domains (Arbetsmiljö, Arbetsmiljö för tjänsteföretag, Miljö) covering 265 documents with original laglig.se compliance summaries, expert commentary, structured sections, and SSDD indexing — all derived from the Notisum competitive analysis.

## Business Value

### Strategic Benefits

- **Immediate User Value**: Users can browse and adopt pre-built compliance checklists instead of building from scratch
- **AI Quality Leap**: Templates replace AI "invention" with expert-curated source data, dramatically improving onboarding accuracy
- **Notisum Parity+**: Matches competitor coverage while adding original compliance summaries and actionable guidance (a field Notisum has 0% coverage on)
- **Foundation for Scale**: Template architecture supports iterating from 3 domains to 9+ with consistent quality
- **Conversion Driver**: "Browse our 112-law Arbetsmiljö template" is a concrete value proposition for sales and marketing

### Target Users

- Compliance officers who know their domain and want a ready-made starting point
- New users during onboarding who benefit from AI-assembled personalized lists drawn from templates
- SMB owners exploring "what laws apply to my business" via the template catalog

## Success Metrics

| Metric                 | Target                                                   | Measurement                                       |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------- |
| Templates Published    | 3 (Phase 1)                                              | Published templates in catalog                    |
| Template Items         | 265 items across 3 templates (~188 unique documents)     | TemplateItem count / distinct document_id count   |
| Content Completeness   | 100% compliance summaries, 100% expert commentary        | Fields populated per item                         |
| Stub Documents Created | ~130 agency regulation stubs                             | LegalDocument records with AGENCY_REGULATION type |
| Template Adoption Rate | >20% of new workspaces adopt a template in first session | Analytics                                         |
| AI Assembly Accuracy   | >90% relevance score vs. pure AI generation              | Manual review sample                              |

## Existing System Context

### Current Data Model

- `LegalDocument`: 170K+ docs (SFS from Riksdagen, court cases, EU legislation). **Missing**: Agency regulations (AFS, BFS, NFS, KIFS, MSBFS, ELSAK-FS, SRVFS — ~44% of template content)
- `ContentType` enum: `SFS_LAW`, `SFS_AMENDMENT`, `COURT_CASE_*`, `EU_REGULATION`, `EU_DIRECTIVE`. **Missing**: `AGENCY_REGULATION`
- `LawList` / `LawListGroup` / `LawListItem`: Workspace-scoped collections with compliance tracking, grouping, and ordering. These are the target entities when a user "adopts" a template.

### Related Epics

- **Epic 4 (Onboarding)**: Currently generates law lists via AI from SNI code + questions. Epic 12 Story 12.11 (Story Block 5) refactors this to assemble from templates instead.
- **Epic 9 (Myndighetsföreskrifter)**: Plans full PDF→LLM→HTML ingestion pipeline for 60+ agencies. Epic 12 creates stub records that Epic 9 will backfill with full content. **Epic 12 does not depend on Epic 9** — stubs are sufficient for templates.
- **Epic 11 (Admin Backoffice)**: Provides the admin shell where template management UI lives.

### Analysis Data (Input)

All analysis lives in `data/notisum-amnesfokus/analysis/`:

| File                               | Purpose                                                                           | Status   |
| ---------------------------------- | --------------------------------------------------------------------------------- | -------- |
| `00-index.md`                      | Master index, terminology, statistics                                             | Complete |
| `01-arbetsmiljo.md`                | Gold standard — 112 docs, 9 sections, fully categorized                           | Complete |
| `02-arbetsmiljo-tjansteforetag.md` | 55 docs, 7 sections, 100% subset of 01                                            | Complete |
| `03-miljo.md`                      | Second reference — 98 docs, 9 sections, fully categorized                         | Complete |
| `10-cross-list-analysis.md`        | 9x9 overlap matrix, source registry (30 prefixes), subset relationships           | Complete |
| `11-agent-training-guide.md`       | Construction patterns, SSDD indexing, compliance summary voice, quality checklist | Complete |

### Document Ingestion Gap (Phase 1 Only)

For the 3 gold-standard templates, roughly 50-55% of referenced documents are agency regulations not yet in the database:

| Prefix    | Source Agency            | Approx. Docs Needed | In DB?  |
| --------- | ------------------------ | ------------------- | ------- |
| AFS       | Arbetsmiljöverket        | ~41 unique          | No      |
| BFS       | Boverket                 | ~3                  | No      |
| NFS       | Naturvårdsverket         | ~8                  | No      |
| KIFS      | Kemikalieinspektionen    | ~2                  | No      |
| MSBFS     | MSB                      | ~6                  | No      |
| ELSAK-FS  | Elsäkerhetsverket        | ~2                  | No      |
| SRVFS     | Räddningsverket (legacy) | ~2                  | No      |
| Other     | Various                  | ~5                  | No      |
| **SFS**   | **Riksdagen**            | **~135**            | **Yes** |
| **EU/EG** | **EUR-Lex**              | **~20**             | **Yes** |

**Approach**: Create stub `LegalDocument` records for missing agency regulations using reference data from the analysis files (SFS number, official title, regulatory body, source type). Stubs contain metadata only — no full text. Epic 9 backfills full content later.

---

## Key Architecture Decisions

### Decision 1: Templates are system-level entities, not workspace-scoped

Templates live outside the workspace multi-tenancy model. They are created and managed by admins, published globally, and "adopted" by workspaces. This prevents duplication and ensures consistency.

**New models**: `LawListTemplate`, `TemplateSection`, `TemplateItem` (see Story 12.4 for schema).

### Decision 2: Tjänsteföretag variants are metadata-only records that query parent items

A variant template is a lightweight `LawListTemplate` record (with `is_variant = true` and `parent_template_id` set) that contains **no TemplateItem records of its own**. All items live on the parent template. The variant is rendered at query time by:

1. Fetching all `TemplateItem` records from the parent template where `is_service_company_relevant = true`
2. Applying `variant_section_override` for the ~2 promoted items (documents moved to different sections in the variant view)
3. Re-numbering sections sequentially (dropping empty sections, e.g., parent Section 04 → skipped)

This means:

- **No data duplication** — items exist once on the parent
- **Automatic consistency** — updating a compliance summary on the parent propagates to the variant immediately
- **Variant-specific sections** are stored as `TemplateSection` records on the variant template, defining the re-numbered section structure (7 sections for Arb.tj. vs. 9 for parent)

**API contract for variant rendering:**

```
GET /api/templates/{variant-slug}
  → Reads variant's TemplateSection records (7 sections with re-numbered names)
  → Joins parent's TemplateItem records WHERE is_service_company_relevant = true
  → Applies variant_section_override for promoted items
  → Returns combined result as if it were a standalone template
```

**Adoption contract:** When a user adopts a variant, the adoption flow (Story 12.10) queries this same API and copies the resolved result into workspace entities — identical behavior to adopting a non-variant template.

### Decision 3: Stub records extend ContentType enum

Add `AGENCY_REGULATION` to `ContentType`. Stubs have `document_number`, `title`, `content_type`, `status = ACTIVE`, `metadata` (regulatory body, source type classification), but `full_text = null`, `html_content = null`. This aligns with Epic 9's planned schema and avoids later migration.

### Decision 4: Template adoption creates real LawList entities

When a user adopts a template, the system copies template data into the workspace's existing `LawList`, `LawListGroup`, and `LawListItem` models. This means:

- Users can customize their adopted list without affecting the template
- All existing compliance tracking, Kanban, task, and notification features work immediately
- Templates are a seeding mechanism, not a runtime dependency

### Decision 5: AI content generation uses the agent training guide

The compliance summaries and expert commentary are generated by LLM using `data/notisum-amnesfokus/analysis/11-agent-training-guide.md` as the system prompt. This guide defines:

- Laglig.se voice patterns ("Vi ska...", "Vi behöver...")
- Structural rules (2-4 sentences, obligation-focused, active voice)
- Expert commentary four-part structure (scope, applicability, key requirements, recent changes)
- Quality checklist for validation

Human review is supported via a draft → review → published workflow in the admin backoffice.

---

## Story Breakdown

### Story Block 1: Data Foundation (Blocking)

---

#### Story 12.1: Extend ContentType & Create Stub Ingestion Script

**As a** developer,
**I want** to add the AGENCY_REGULATION content type and create stub LegalDocument records for all agency regulations referenced in the 3 gold-standard templates,
**so that** template items can reference valid documents in the database.

**Acceptance Criteria:**

1. `ContentType` enum extended with `AGENCY_REGULATION`
2. Prisma migration generated and applied
3. Node script created that reads analysis files (01, 02, 03) and extracts all non-SFS, non-EU document references
4. Script creates `LegalDocument` stub records with:
   - `content_type`: `AGENCY_REGULATION`
   - `document_number`: Official reference (e.g., "AFS 2023:1")
   - `title`: Official statute title from analysis
   - `slug`: Auto-generated (e.g., "afs-2023-1")
   - `status`: `ACTIVE`
   - `source_url`: Agency website URL (best-effort)
   - `metadata`: `{ regulatoryBody, sourceType, replacesOldReference, analysisFile }`
   - `full_text`: null (stub)
   - `html_content`: null (stub)
5. Script is idempotent (re-running doesn't create duplicates — matches on `document_number`)
6. Script validates that all SFS and EU references already exist in the database; logs missing ones
7. ~130 stub records created covering AFS, BFS, NFS, KIFS, MSBFS, ELSAK-FS, SRVFS, and other agency prefixes
8. Verification query confirms all 265 document references across the 3 templates resolve to a `LegalDocument` record

9. Stub records excluded from public-facing views:
   - Existing law browse pages (`/lagar`) filter out `AGENCY_REGULATION` documents where `full_text IS NULL`
   - Existing search queries exclude stubs (add `AND (content_type != 'AGENCY_REGULATION' OR full_text IS NOT NULL)` to search conditions)
   - If a user navigates to a stub's detail page via a template link, show a placeholder: "Dokumentet är registrerat men fullständigt innehåll läggs till inom kort" with a link to the agency's official source URL
   - Stubs are visible in the admin backoffice (for management purposes)

**Technical Notes:**

- The analysis CSV (`laglistor-all-combined.csv`) and JSON files contain all reference data needed
- `AGENCY_REGULATION` aligns with Epic 9's planned content type
- Stubs are intentionally minimal — Epic 9 backfills full content via PDF→LLM→HTML pipeline
- Stub filtering should be implemented as a reusable query scope/helper to keep it DRY across browse, search, and API endpoints

---

#### Story 12.2: Design Template Data Model

**As a** developer,
**I want** to create the database schema for law list templates, sections, and items,
**so that** we have a system-level template catalog independent of workspaces.

**Acceptance Criteria:**

1. `LawListTemplate` model created:
   - `id` (UUID), `name` (string), `slug` (string, unique), `description` (text)
   - `domain` (string — e.g., "arbetsmiljo", "miljo")
   - `target_audience` (text — who this template is for)
   - `status` (enum: DRAFT, IN_REVIEW, PUBLISHED, ARCHIVED)
   - `version` (integer, starts at 1, increments on publish)
   - `document_count` (integer — denormalized for catalog display)
   - `section_count` (integer — denormalized)
   - `primary_regulatory_bodies` (string[] — e.g., ["Arbetsmiljöverket", "Riksdagen"])
   - `parent_template_id` (UUID, nullable — for subset relationships)
   - `is_variant` (boolean — true for tjänsteföretag-style filtered views)
   - `variant_filter_field` (string, nullable — e.g., "is_service_company_relevant")
   - `metadata` (JSONB — extensible)
   - `created_by` (UUID, FK to User), `published_at` (DateTime, nullable)
   - `created_at`, `updated_at`

2. `TemplateSection` model created:
   - `id` (UUID), `template_id` (UUID, FK to LawListTemplate)
   - `section_number` (string — "01", "02", ..., "09")
   - `name` (string — Swedish, laglig.se original)
   - `description` (text — what this section covers)
   - `position` (float — for ordering)
   - `item_count` (integer — denormalized)
   - `created_at`, `updated_at`
   - Unique constraint on `(template_id, section_number)`

3. `TemplateItem` model created:
   - `id` (UUID), `template_id` (UUID, FK), `section_id` (UUID, FK to TemplateSection)
   - `document_id` (UUID, FK to LegalDocument)
   - `index` (string — SSDD format, e.g., "0100", "0210")
   - `position` (float — for ordering within section)
   - `compliance_summary` (text — laglig.se voice, 2-4 sentences)
   - `expert_commentary` (text — four-part structure)
   - `source_type` (string — "lag", "forordning", "foreskrift", "eu-forordning", "allmanna-rad", etc.)
   - `regulatory_body` (string — e.g., "Arbetsmiljöverket")
   - `last_amendment` (string, nullable — e.g., "SFS 2025:732")
   - `replaces_old_reference` (string, nullable — "ersätter AFS 2001:1")
   - `is_service_company_relevant` (boolean, default true)
   - `variant_section_override` (string, nullable — alternative section for variant views)
   - `cross_list_references` (string[] — template slugs where this doc also appears)
   - `content_status` (enum: STUB, AI_GENERATED, HUMAN_REVIEWED, APPROVED)
   - `generated_by` (string, nullable — "gpt-4o", "human", etc.)
   - `reviewed_by` (UUID, nullable, FK to User)
   - `reviewed_at` (DateTime, nullable)
   - `created_at`, `updated_at`
   - Unique constraint on `(template_id, document_id)`

4. Prisma migration generated and applied
5. TypeScript types generated for all models
6. Database indexes created for:
   - `LawListTemplate`: `slug`, `status`, `domain`
   - `TemplateSection`: `(template_id, position)`
   - `TemplateItem`: `(template_id, section_id, position)`, `document_id`, `content_status`

**Design Notes:**

- Templates are **not** workspace-scoped — they live at the system level
- `parent_template_id` enables the Arb.tj. → Arb. subset relationship
- `content_status` tracks the AI generation → human review pipeline
- `cross_list_references` enables the overlap viewer in admin

---

### Story Block 2: AI-Assisted Content Generation

---

#### Story 12.3: Build Template Content Generation Pipeline

**As a** content creator,
**I want** an AI pipeline that generates compliance summaries and expert commentary for template items using the agent training guide,
**so that** we can populate templates efficiently with consistent, high-quality laglig.se-voice content.

**Acceptance Criteria:**

1. Node script/service created that processes a template and generates content for all items
2. System prompt derived from `data/notisum-amnesfokus/analysis/11-agent-training-guide.md`:
   - Section 5: Compliance Summary Style Guide (voice, structure, examples)
   - Section 6: Expert Commentary Writing Patterns (four-part structure)
   - Section 10: DO/DON'T patterns
3. Per-item context includes:
   - Official statute title and SFS/AFS number
   - Section assignment and section name (for domain context)
   - Source type classification (lag, förordning, föreskrift, etc.)
   - Any existing commentary from analysis files (as reference, not to copy)
   - Cross-list information (if document appears in other templates)
4. LLM generates for each item:
   - `compliance_summary`: 2-4 sentences in laglig.se voice ("Vi ska...", "Vi behöver...")
   - `expert_commentary`: Four-part structure (scope, applicability, key requirements, recent changes)
5. Output validated against quality rules:
   - Summary starts with obligation-focused phrasing
   - Summary is 2-4 sentences
   - Commentary covers all four parts
   - Active voice, present tense
   - No copied text from external sources
6. Items updated with `content_status = AI_GENERATED`, `generated_by = "gpt-4o"` (or model used)
7. Cost tracking: tokens used and cost per item logged
8. Batch processing with rate limiting (handles 112 items without timeout)
9. Script is resumable (skips items already generated, unless force-regenerate flag)
10. Estimated cost: ~$15-25 for all 265 items across 3 templates (at ~1,500 tokens/item)

**Technical Notes:**

- Use the 10 original compliance summary examples from file 11 as few-shot examples in the prompt
- For AFS 2023 consolidated provisions, include the "ersätter" mapping context
- For multi-topic laws (Miljöbalken, AFS 2023:10), include chapter-specific guidance from the analysis
- Generation runs per-template, not globally — section context matters for relevance

---

#### Story 12.4: Seed Arbetsmiljö Template (Gold Standard)

**As a** product owner,
**I want** the Arbetsmiljö law list template fully populated with 112 documents across 9 sections,
**so that** it serves as the reference implementation and first published template.

**Acceptance Criteria:**

1. `LawListTemplate` record created:
   - name: "Arbetsmiljö"
   - domain: "arbetsmiljo"
   - target_audience: "Alla svenska arbetsgivare oavsett bransch"
   - primary_regulatory_bodies: ["Arbetsmiljöverket", "Riksdagen", "EU"]
2. 9 `TemplateSection` records created with laglig.se original names from analysis file 01:
   - 01: Grundläggande regelverk (7 docs)
   - 02: Arbetsrätt och personalförvaltning (20 docs)
   - 03: Arbetsplatsens utformning och särskilda arbetsförhållanden (10 docs)
   - 04: Fysisk belastning och lokalförhållanden (5 docs)
   - 05: Maskiner och utrustning (8 docs)
   - 06: Brand och explosion (9 docs)
   - 07: Elsäkerhet (6 docs)
   - 08: Kemiska risker och farliga ämnen (4 docs)
   - 09: Kompletterande bestämmelser och specialområden (43 docs)
3. 112 `TemplateItem` records created with:
   - SSDD index numbers from analysis file 01
   - `document_id` referencing correct `LegalDocument` record
   - `source_type` classification (lag, förordning, föreskrift, etc.)
   - `is_service_company_relevant` flags set (55 of 112 = true, based on file 02)
   - `replaces_old_reference` for AFS 2023 consolidated provisions
4. AI content generation run (Story 12.3) populates all compliance summaries and expert commentary
5. Template `document_count` = 112, `section_count` = 9
6. All cross-list references populated (22 shared with Miljö, 37 shared with Miljö Sverige, etc.)
7. Quality checklist from file 11 Section 8 passes:
   - Every document has valid reference number
   - No section has fewer than 3 documents (except possibly section 08 with 4)
   - SSDD index has no duplicates
   - Section numbers sequential
   - All summaries in laglig.se voice

**Data Source:** `data/notisum-amnesfokus/analysis/01-arbetsmiljo.md` + `laglistor-all-combined.csv`

---

#### Story 12.5: Seed Miljö Template

**As a** product owner,
**I want** the Miljö law list template fully populated with 98 documents across 9 sections,
**so that** we have a second domain template demonstrating cross-domain patterns.

**Acceptance Criteria:**

1. `LawListTemplate` record created for Miljö domain
2. Section structure redesigned from source's 9 sections to fix two quality violations:
   - **Section 08 merge**: Source Section 08 (Brandskydd) has only 2 documents — below the 3-document minimum. Merge into Section 06 (Farliga ämnen och kemikalier) or a new combined "Brand, kemikalier och farliga ämnen" section.
   - **Section 09 split**: Source Section 09 has 47 documents (48%) — exceeds the 30% "Other" threshold. Split into the following proposed sub-sections:
     - Avfallshantering och producentansvar (~8 docs)
     - Strålning och strålskydd (~3 docs)
     - Energi, klimat och utsläppshandel (~6 docs)
     - Seveso och farlig verksamhet (~4 docs)
     - EU-produktkrav och marknadskontroll (~8 docs: batteries, WEEE, F-gases, ozone, PIC, POPs, deforestation, CBAM)
     - Övriga specialbestämmelser (~18 docs remaining)
   - Final section count: 12-14 sections (from original 9). Exact count determined during implementation based on document distribution.
3. 98 `TemplateItem` records with SSDD indexes, document links, source types
4. `is_service_company_relevant` flags set (30 of 98 = true, based on file 04 overlap)
5. AI content generation populates all summaries and commentary
6. Cross-list references populated (22 shared with Arbetsmiljö, 14 shared with Fastighet-Bygg)
7. Quality checklist passes — specifically:
   - No section has fewer than 3 documents
   - No section exceeds 30% of total documents
   - Section names are original laglig.se Swedish names

**Data Source:** `data/notisum-amnesfokus/analysis/03-miljo.md` + `laglistor-all-combined.csv`

---

#### Story 12.6: Derive Arbetsmiljö för Tjänsteföretag Variant

**As a** product owner,
**I want** the Arbetsmiljö för tjänsteföretag template derived as a filtered view of the Arbetsmiljö parent template,
**so that** service-company users get a focused 55-law template without maintaining a separate data structure.

**Acceptance Criteria:**

1. `LawListTemplate` record created with:
   - `parent_template_id` pointing to Arbetsmiljö template
   - `is_variant` = true
   - `variant_filter_field` = "is_service_company_relevant"
   - `document_count` = 55, `section_count` = 7
2. **No TemplateItem records created** — variant queries parent's items at runtime (per Decision 2)
3. 7 `TemplateSection` records created on the variant template defining the re-numbered section structure:
   - 01: Grundläggande regelverk (6 docs — parent Section 01 minus AFS 2023:15)
   - 02: Arbetsrätt och personalförvaltning (21 docs — parent Section 02 + Utstationeringslagen promoted from 09)
   - 03: Arbetsplatsens utformning (10 docs — parent Section 03 unchanged)
   - 04: Maskiner och utrustning (5 docs — parent Section 05 reduced, industrial machinery dropped)
   - 05: Brand och explosion (6 docs — parent Section 06 reduced, pressurized equipment dropped)
   - 06: Elsäkerhet (3 docs — parent Section 07 reduced)
   - 07: Kemiska risker (4 docs — parent Section 08 unchanged)
   - Parent Section 04 (Fysisk belastning) and 09 (Kompletterande) dropped entirely
4. 2 promoted items on the parent template have `variant_section_override` set (moved from parent Section 09 to variant Section 02)
5. Variant API endpoint resolves correctly:
   - `GET /api/templates/arbetsmiljo-tjansteforetag` returns 55 items across 7 sections
   - Compliance summaries and expert commentary read from parent's TemplateItem records
6. Adoption of the variant (Story 12.10) creates a workspace LawList with 55 items and 7 groups
7. Verify: editing a parent item's compliance summary is immediately reflected when querying the variant

**Data Source:** `data/notisum-amnesfokus/analysis/02-arbetsmiljo-tjansteforetag.md`

---

### Story Block 3: Admin Backoffice

---

#### Story 12.7a: Template List & Detail CRUD in Admin

**As an** admin,
**I want** to view, create, and edit law list templates and their sections in the admin backoffice,
**so that** I can manage the template catalog structure.

**Acceptance Criteria:**

1. New admin route group: `/admin/templates`
2. Template list page:
   - Table showing all templates (name, domain, status, doc count, section count, published date)
   - Filter by status (DRAFT, IN_REVIEW, PUBLISHED, ARCHIVED)
   - Sort by name, domain, updated date
3. Template detail/edit page:
   - Edit template metadata (name, description, target audience, regulatory bodies)
   - View sections with item counts, reorder sections via drag-and-drop
   - Drill into section → see all items with compliance summary previews
4. Section management:
   - Add/remove/rename sections
   - Move items between sections
   - View section against quality rules (min 3 docs, max 30% in "Other")

**Technical Notes:**

- Builds on Epic 11 admin shell (layout, auth, navigation)
- Uses existing TanStack Table + shadcn/ui patterns from admin backoffice
- Template management is a new sidebar nav item under admin

---

#### Story 12.7b: Template Item Content Editor & Review Workflow

**As an** admin,
**I want** to review and edit AI-generated compliance summaries and expert commentary per template item,
**so that** I can ensure content quality before publishing a template.

**Acceptance Criteria:**

1. Template item editor page (accessible from section drill-down in 12.7a):
   - View/edit compliance summary and expert commentary (markdown editor)
   - View content_status badge (STUB → AI_GENERATED → HUMAN_REVIEWED → APPROVED)
   - "Mark as reviewed" action (sets `content_status = HUMAN_REVIEWED`, `reviewed_by`, `reviewed_at`)
   - "Approve" action (sets `content_status = APPROVED`)
   - Bulk actions: "Mark all AI_GENERATED as HUMAN_REVIEWED", "Regenerate selected"
2. Template publish workflow with explicit state machine rules:
   - DRAFT → IN_REVIEW: Requires all items at minimum `AI_GENERATED` (no STUB items remaining)
   - IN_REVIEW → PUBLISHED: Requires admin approval click. All items at minimum `AI_GENERATED`. Increments `version`, sets `published_at`.
   - PUBLISHED → ARCHIVED: Admin action, soft removal from catalog
   - **Item content_status does NOT block publishing** — `AI_GENERATED` is the minimum bar. `HUMAN_REVIEWED` and `APPROVED` are quality aspirations tracked per-item but not enforced for publish.
   - If an item is regenerated after template is PUBLISHED, its content_status resets to `AI_GENERATED` and a warning badge shows on the template ("1 item re-generated since last publish")
3. Content status dashboard on template detail: progress bar showing STUB / AI_GENERATED / HUMAN_REVIEWED / APPROVED counts

---

#### Story 12.7c: Cross-List Overlap Viewer

**As an** admin,
**I want** to see which documents appear across multiple templates and identify inconsistencies,
**so that** I can maintain consistency in compliance summaries across the catalog.

**Acceptance Criteria:**

1. Admin route: `/admin/templates/overlap`
2. Table showing all documents that appear in 2+ templates
3. For each shared document: list of templates it belongs to, compliance summary preview per template
4. Highlight inconsistencies: flag documents where compliance summaries differ significantly across templates
5. "Sync summaries" action: copy compliance summary from one template to another for shared documents

---

### Story Block 4: User-Facing Template Catalog

---

#### Story 12.8: Template Catalog Browse Page

**As a** user or visitor,
**I want** to browse available law list templates by domain,
**so that** I can find a relevant starting point for my compliance work.

**Acceptance Criteria:**

1. Public route: `/laglistor` (or `/templates` — TBD based on SEO analysis)
2. Catalog page displays all PUBLISHED templates as cards:
   - Template name, domain badge, description excerpt
   - Key stats: document count, section count
   - Target audience tag (e.g., "Alla arbetsgivare", "Tjänsteföretag")
   - Primary regulatory body icons/badges
3. Filter by domain or target audience
4. Tjänsteföretag variants shown as toggle on parent template card ("Visa tjänsteföretagsversion")
5. Each card links to template detail/preview page
6. SEO: Page is SSR, indexable, with structured data (schema.org)
7. Mobile-responsive card grid (1 col mobile, 2-3 col desktop)
8. Empty state for domains with no published templates ("Kommer snart")

---

#### Story 12.9: Template Detail & Preview Page

**As a** user,
**I want** to preview a template's full structure before adopting it,
**so that** I can evaluate whether it covers my compliance needs.

**Acceptance Criteria:**

1. Route: `/laglistor/{slug}` (e.g., `/laglistor/arbetsmiljo`)
2. Template header: name, description, target audience, regulatory bodies, doc/section counts
3. Section accordion view:
   - Each section shows name, description, document count
   - Expand to see list of laws (title, SFS number, source type badge)
   - First 2-3 compliance summaries shown as preview (rest behind "Visa alla")
4. Sidebar or top CTA: "Använd denna mall" (Adopt this template)
   - If logged in → triggers adoption flow (Story 12.10)
   - If not logged in → redirects to signup with template pre-selected
5. Tjänsteföretag toggle (if variant exists): "Visa version för tjänsteföretag"
   - Filters view to show only relevant items, re-numbers sections
6. Stats bar: "112 lagar | 9 kategorier | Senast uppdaterad: 2026-02-10"
7. SEO: SSR, structured data, meta description from template description

---

#### Story 12.10: Adopt Template into Workspace

**As a** workspace member,
**I want** to adopt a template into my workspace as a new law list,
**so that** I get a pre-built compliance checklist I can customize.

**Acceptance Criteria:**

1. "Använd denna mall" button on template preview page
2. If user has multiple workspaces, workspace selector shown
3. Adoption creates:
   - New `LawList` in target workspace with name = template name
   - `LawListGroup` records for each template section (name, position)
   - `LawListItem` records for each template item with:
     - `document_id` from template item
     - `commentary` = template compliance summary
     - `ai_commentary` = template expert commentary
     - `category` = section name
     - `group_id` = corresponding LawListGroup
     - `status` = NOT_STARTED
     - `source` = TEMPLATE (new enum value)
     - `position` from template SSDD index
4. For tjänsteföretag variant adoption: only service-company-relevant items copied
5. Post-adoption redirect to workspace law list view
6. Toast notification: "Mallen 'Arbetsmiljö' har lagts till med 112 lagar"
7. Adopted list is fully independent — editing doesn't affect template
8. If workspace already has a list with same name, append " (2)" suffix
9. `LawListItemSource` enum extended with `TEMPLATE` value

**Technical Notes:**

- Adoption is a bulk insert operation — should complete in <3 seconds for 112 items
- Consider background job for very large templates (>200 items) with progress indicator
- Template version tracked in `LawList.metadata` as `{ source_template_id, source_template_version }` for future "template updated" notifications (see Phase 2 roadmap)
- **Field mapping note:** `LawListItem.commentary` is reused for the template's compliance summary. In onboarding-generated lists, this field holds personalized context ("Gäller eftersom ni har 12 anställda"). For template-adopted lists, it holds the laglig.se compliance summary ("Vi ska bedriva ett systematiskt arbetsmiljöarbete..."). The `source` field (`TEMPLATE` vs `ONBOARDING`) distinguishes the semantic intent. `LawListItem.ai_commentary` holds expert commentary in both cases, which is semantically consistent.

---

### Story Block 5: Onboarding & AI Integration

---

#### Story 12.11: Template-Powered AI List Assembly

**As a** new user going through onboarding,
**I want** the AI to assemble my personalized law list from expert-curated templates rather than inventing laws from scratch,
**so that** my generated list includes structured sections, compliance summaries, and expert commentary from day one.

**Acceptance Criteria:**

1. Refactor Epic 4 Story 4.3 (AI law list generation) to use templates as source data:
   - Phase 1 (pre-signup): AI selects 15-30 highest-priority items from matching templates
   - Phase 2 (post-signup): AI fills remaining 45-65 items from templates + supplementary laws
2. Template matching logic based on onboarding context:
   - SNI code → relevant domain templates (e.g., construction → Arbetsmiljö + Miljö + Fastighet)
   - Employee count → tjänsteföretag variant vs. full template
   - Contextual answers → specific section emphasis
3. Items drawn from templates retain:
   - Compliance summaries (as `commentary`)
   - Expert commentary (as `ai_commentary`)
   - Section structure (as `LawListGroup`)
   - SSDD ordering (as `position`)
4. AI adds personalized context commentary: "Gäller eftersom ni har 12 anställda"
5. Laws not covered by any template are still AI-generated (fallback to current behavior)
6. Generated list source tracking: `TEMPLATE` for template-sourced items, `AI_GENERATED` for others
7. Template coverage metric: % of generated items sourced from templates vs. AI-invented

**Technical Notes:**

- This story only activates for domains where published templates exist
- As more templates are published (Phase 2: Fastighet, Hälsa, Livsmedel, InfoSäk), coverage increases automatically
- This is the highest-impact integration — it turns templates from static catalogs into active quality infrastructure

---

#### Story 12.12: Post-Onboarding Template Recommendations

**As a** user who has completed onboarding,
**I want** to see recommended templates based on my company profile,
**so that** I can expand my compliance coverage beyond the AI-generated list.

**Acceptance Criteria:**

1. After onboarding completion, dashboard shows "Rekommenderade mallar" section
2. Recommendations based on:
   - SNI code → domain matching
   - Employee count → variant selection
   - Laws already in workspace → templates with significant overlap
3. Each recommendation card shows: template name, "X lagar som kan gälla dig", preview CTA
4. "Lägg till" button triggers adoption flow (Story 12.10)
5. Dismissible: user can hide recommendations
6. Maximum 3 recommendations shown

---

## Dependencies

### Blocks

| Story            | Blocked By   | Reason                                            |
| ---------------- | ------------ | ------------------------------------------------- |
| 12.4, 12.5, 12.6 | 12.1         | Templates need document references to exist       |
| 12.4, 12.5, 12.6 | 12.2         | Templates need schema to exist                    |
| 12.4, 12.5       | 12.3         | Content generation pipeline needed for seeding    |
| 12.6             | 12.4         | Variant derived from parent template              |
| 12.7a            | 12.2         | Admin UI needs schema                             |
| 12.7b            | 12.7a        | Item editor builds on template detail page        |
| 12.7c            | 12.7a        | Overlap viewer needs template list infrastructure |
| 12.8, 12.9       | 12.4 or 12.5 | Catalog needs at least one published template     |
| 12.10            | 12.2         | Adoption needs schema                             |
| 12.11            | 12.4 or 12.5 | AI assembly needs published templates             |

### External Dependencies

- **Epic 11 (Admin Backoffice)**: Story 12.7 builds on admin shell (auth, layout, navigation)
- **Epic 9 (Myndighetsföreskrifter)**: Backfills stub records with full content (non-blocking for Epic 12)
- **Epic 4 (Onboarding)**: Story 12.11 refactors existing generation logic

### Suggested Implementation Order

```
Phase A: Foundation (Stories 12.1, 12.2)
    ↓
Phase B: Content (Stories 12.3, 12.4, 12.5, 12.6) — can run 12.4 + 12.5 in parallel
    ↓
Phase C: Admin (Stories 12.7a, 12.7b, 12.7c) — 12.7a can start during Phase B once schema exists
    ↓
Phase D: User-Facing (Stories 12.8, 12.9, 12.10) — needs at least one published template
    ↓
Phase E: AI Integration (Stories 12.11, 12.12) — highest value, but depends on D
```

---

## Compatibility Requirements

- [x] Existing `LegalDocument` model unchanged (only new enum value added)
- [x] Existing `LawList` / `LawListItem` / `LawListGroup` models unchanged (adoption creates standard records)
- [x] Existing workspace APIs remain unchanged
- [x] Database schema changes are additive (new tables + one enum extension)
- [x] UI changes follow existing shadcn/ui + TanStack Table patterns
- [x] No changes to existing onboarding flow until Story 12.11

## Risk Mitigation

| Risk                                              | Impact | Probability | Mitigation                                                                                               |
| ------------------------------------------------- | ------ | ----------- | -------------------------------------------------------------------------------------------------------- |
| AI-generated content quality insufficient         | High   | Medium      | Human review workflow (Story 12.7b), quality checklist validation, few-shot examples from training guide |
| Stub records cause confusion in UI                | Medium | Low         | Story 12.1 AC #9 filters stubs from public search/browse; placeholder page for stub detail views         |
| Template adoption performance (112 bulk inserts)  | Low    | Low         | Background job with progress indicator for large templates                                               |
| Analysis data has errors in document references   | Medium | Medium      | Validation script in 12.1 cross-checks all references against DB                                         |
| Section 09 "Other" bloat (43 docs in Arbetsmiljö) | Medium | High        | Addressed in Story 12.4 quality checklist — split if exceeds 30% threshold                               |
| Miljö section structure violations                | Medium | High        | Story 12.5 explicitly redesigns sections: merge Section 08 (2 docs), split Section 09 (47 docs)          |
| Scope creep into full Epic 9 ingestion            | High   | Medium      | Hard boundary: stubs only, no PDF processing, no scraping                                                |

## Definition of Done

- [ ] 3 templates published (Arbetsmiljö, Arb. tjänsteföretag, Miljö)
- [ ] 265 template items with AI-generated compliance summaries and expert commentary
- [ ] ~130 agency regulation stub records in database
- [ ] Admin can manage templates via backoffice
- [ ] Users can browse, preview, and adopt templates
- [ ] AI onboarding draws from templates when available
- [ ] All quality checklist items from agent training guide pass
- [ ] No regression in existing features

## Phase 2 Roadmap (Post-Epic 12)

Once Phase 1 is validated, expand to remaining 6 domains from the analysis:

| Priority | Domain                   | Analysis Status                       | Docs | Effort                             |
| -------- | ------------------------ | ------------------------------------- | ---- | ---------------------------------- |
| 1        | Fastighet och byggande   | Uncategorized, sections proposed      | 110  | High — needs full section design   |
| 2        | Hälsa och sjukvård       | Uncategorized, sections proposed      | 91   | High                               |
| 3        | Informationssäkerhet     | Partially structured                  | 42   | Medium                             |
| 4        | Livsmedel                | Uncategorized, sections proposed      | 53   | Medium                             |
| 5        | Miljö för tjänsteföretag | Partially structured (variant)        | 32   | Low — variant of Miljö             |
| 6        | Miljö Sverige            | Uncategorized (actually workplace/HR) | 64   | Medium — needs domain reassignment |

Additionally, the 4 empty Notisum topic areas (Förvaltning, Skog/jordbruk, Säkerhet, Trafik) represent greenfield template opportunities for future expansion.

### Deferred Feature: Template Update Propagation

When templates are updated after users have adopted them (new laws added, summaries improved, sections restructured), adopted lists become stale. Phase 1 does not address this — adopted lists are frozen snapshots. Future work:

- **Detection:** Compare `LawList.metadata.source_template_version` against current `LawListTemplate.version`
- **Notification:** "Mallen 'Arbetsmiljö' har uppdaterats sedan du använde den — 3 nya lagar, 5 uppdaterade sammanfattningar"
- **Action:** "Synka" button that shows a diff and lets users selectively merge template updates into their list
- **Prerequisite:** Story 12.10 already stores `source_template_id` and `source_template_version` in LawList metadata to enable this

---

## QA Results

### Review Date: 2026-02-06

### Reviewed By: Quinn (Test Architect)

**Scope:** Full epic-level review covering architecture decisions, story completeness, data model consistency, cross-epic alignment, and numerical accuracy.

### Gate Status

Gate: CONCERNS → docs/qa/gates/12-epic-law-list-templates.yml

**Revision:** All 9 concerns addressed (1 high, 5 medium, 3 low):

- ARCH-001: Variant model clarified — metadata-only record with runtime query contract defined
- ARCH-002: Story 12.7 split into 12.7a (CRUD), 12.7b (content editor + review workflow), 12.7c (overlap viewer)
- ARCH-003: Stub visibility ACs added to Story 12.1 (AC #9)
- ARCH-004: State machine rules defined in Story 12.7b — AI_GENERATED is minimum bar for publish
- REQ-001: Success metric corrected to "265 items (~188 unique documents)"
- REQ-002: Miljö Section 08 merge and Section 09 split defined with proposed sub-sections
- REQ-003: Field mapping semantics documented in Story 12.10 technical notes
- DOC-001: "Story Block 6" reference corrected to "Story 12.11 (Story Block 5)"
- REQ-004: Template update propagation added to Phase 2 roadmap with prerequisite tracking

Gate: PASS (post-revision) → docs/qa/gates/12-epic-law-list-templates.yml

---

_Epic created: 2026-02-06_
_Last updated: 2026-02-06_
_Status: Draft — QA PASS (revised). Ready for implementation planning._
