# Changelog

## Version 1.5 (2026-04-07)

**Post-Epic 17 Documentation Alignment — Brownfield Epics 9–17**

**Major Changes:**

- **Epic 9 — Legal Intelligence & AI Enrichment (Partial):** Agency regulation ingestion complete (AFS, BFS, NFS via HTML scraping pipeline). 187 entries verified. Parliamentary context enrichment deferred.
- **Epic 11 — Admin Backoffice (Done):** Full internal admin system at `/admin`. Customer dashboard, workspace/user management, user impersonation with audit trail, cron job dashboard with execution logs. 7 stories completed.
- **Epic 12 — Law List Templates & Standard Packages (Done):** Curated template library with 265 documents across 3 domains (Arbetsmiljö, Tjänsteföretag, Miljö). Template data model, admin management UI, authenticated catalog with browse/preview/adopt. 12 stories completed.
- **Epic 13 — ELI Structured Data (Added to backlog):** European Legislation Identifier standard. Not yet scoped into stories. Low priority, post-launch.
- **Epic 14 — Compliance Agent (Done):** Full agentic AI compliance partner replacing Epic 3's original RAG approach. System prompt, 8+ agent tools (search_laws, get_company_context, etc.), headless skills, streaming chat UI with reasoning display, change assessment flow. 18 stories completed — exceeded 14-story estimate.
- **Epic 15 — BolagsAPI Integration (Mostly Done):** Company data enrichment via BolagsAPI. Onboarding auto-fill, enriched agent context. 3 of 4 stories complete. SNI reference system remaining.
- **Epic 16 — Conversion Funnel & First-Value Optimization (Done):** Frictionless signup, landing page company preview, contextual onboarding questions, headless agent skill for personalized law list generation. 4 stories completed.
- **Epic 17 — Document Management System (Partial, PR #40 merged):** Tiptap rich text editor, WorkspaceDocument/Version/Template models, document lifecycle (DRAFT → APPROVED → ARCHIVED), .docx import/export, PDF export, compliance templates. 9 of 13 estimated stories complete. Advanced features remaining.

**Scope Changes:**

- Total tracked stories increased from ~89 (v1.0) to ~200 across 17 epics
- Epic 3 (RAG Chat) largely superseded by Epic 14's agentic architecture — drag-and-drop context building stories remain in backlog
- Epic 5 (Workspace Management) remains partial — Stripe billing, usage limits, and team invites not started
- Epic 7 (HR Module) and Epic 13 (ELI) not started — decision needed on MVP inclusion

**Technical Additions:**

- Tiptap v3.21 rich text editor stack (20 packages)
- Document processing pipeline: mammoth (Word import), docx (Word export), puppeteer-core + chromium (PDF export)
- Streamdown markdown streaming renderer (replaced react-markdown)
- AI agent tool-use architecture with Vercel AI SDK
- Agency regulation HTML scraping pipeline (lib/agency/)
- BolagsAPI integration (lib/bolagsapi/)
- Admin backoffice with impersonation and audit logging
- 13 cron jobs for content sync, notifications, and maintenance

---

## Version 1.4 (2026-01-30)

**Workspace Onboarding & Invitation Flow (Epic 10)**

**Major Changes:**

- **NEW Epic 10 - Workspace Onboarding:** Added brownfield epic to fix critical new-user blocker where signup leads to crash (no workspace exists). Three stories covering post-auth routing guard, workspace creation wizard, and invitation acceptance flow.

- **Epic 10 Stories:**
  - Story 10.1: Post-Auth Workspace Guard & Onboarding Routing - catches `NO_WORKSPACE` error, redirects to `/onboarding`
  - Story 10.2: Workspace Creation Wizard - multi-step form (company info with Bolagsverket-aligned fields, review & confirm)
  - Story 10.3: Invitation Model & Acceptance Flow - `WorkspaceInvitation` Prisma model, token-based acceptance during onboarding

- **Epic 5 Impact:** Story 5.3 (Team Invite System) now depends on Epic 10's `WorkspaceInvitation` model for the invitation sending flow

- **Architecture Impact:** Added P0 workflow for post-auth workspace onboarding routing (new user path through workspace creation)

**Explicitly Deferred:**

- Tier/plan selection during onboarding (moved to trial-expiry flow)
- Bolagsverket API lookup (manual entry for now, fields aligned for future auto-fill)
- Law list generator wizard step (slots in after company info step when backend ready)
- Stripe billing integration (separate epic)
- Invitation email sending (Story 5.3)

**Rationale:**

1. **Critical blocker:** New users currently cannot use the platform at all after signup - `getWorkspaceContext()` throws unhandled `NO_WORKSPACE` error
2. **No tier selection during onboarding:** Users haven't seen product value yet and all trials are identical (14-day, Team-level access). Tier selection belongs at trial expiry.
3. **Extensible wizard:** Architecture supports inserting future steps (law list generator) without rework
4. **Both user paths:** Covers new users creating workspaces AND invited users joining existing ones

---

## Version 1.3 (2025-11-03)

**Dynamic Onboarding & Comprehensive Law Generation Update**

**Major Changes:**

- **Epic 4 Onboarding Flow Enhancement:** Updated from static Bolagsverket-only analysis to conversational dynamic questioning flow
  - Added Story 4.2b: NEW - Dynamic contextual questioning (3-5 AI-selected questions based on industry + previous answers)
  - Updated Story 4.3: Changed from "15-25 laws" to "two-phase generation (15-30 high-priority pre-signup, 60-80 total post-signup)"
  - Added Story 4.4b: NEW - Post-signup Phase 2 background law generation

- **Two-Phase Law Generation Strategy:**
  - **Phase 1 (Pre-Signup):** Generate 15-30 highest-priority laws from Bolagsverket data + dynamic question answers to demonstrate value before signup
  - **Phase 2 (Post-Signup):** Generate remaining 45-65 laws in background (30-60 seconds) for comprehensive 60-80 law coverage matching Notisum parity

- **Dynamic Questioning Logic:**
  - AI selects 3-5 contextual questions based on SNI code (industry), employee count, and previous answers
  - Industry-specific questions (e.g., Restaurang → "Serverar ni alkohol?", Bygg → "Arbetar ni med farliga ämnen?")
  - Employee-count-triggered questions (e.g., 10+ employees → "Har ni skyddsombud?")
  - Follow-up questions based on answers (e.g., "Ja" to alcohol → "Vilken typ av serveringstillstånd?")
  - Hard limit: 5 questions maximum to prevent interrogation fatigue

- **Functional Requirements Updated:**
  - FR2: Onboarding flow now includes dynamic questioning, not just Bolagsverket scraping
  - FR3: Law lists expanded from 15-25 to 60-80 laws with two-phase generation

- **UX Impact:**
  - Pre-signup: Shows "+45-65 mer lagar efter registrering" badge to create conversion trigger
  - Post-signup: Dashboard shows progress bar "Kompletterar din laglista... 23/68 lagar"
  - User can interact with Dashboard during Phase 2 generation (non-blocking background process)
  - Laws categorized into: Grundläggande, Arbetsmiljö, Branschspecifika, GDPR & Data, Ekonomi, Miljö, Övrigt

**Rationale:**

1. **Dynamic Questioning:** Bolagsverket data alone insufficient for accurate law selection. Industry-specific context (alcohol licensing, hazardous materials, subcontractors, etc.) dramatically affects applicable laws.
2. **60-80 Law Coverage:** Competitive analysis of Notisum shows typical law lists contain 60-80 laws. Generating only 15-25 laws underserves users and misses compliance gaps.
3. **Two-Phase Strategy:** Balances conversion (show value fast) with comprehensiveness (match competitor coverage). Phase 1 demonstrates "magic" in 2-3 minutes, Phase 2 completes coverage post-signup without blocking user.

**Technical Implications:**

- AI question selection requires GPT-4 with industry knowledge base
- Phase 2 generation uses background job (not blocking request/response)
- Session storage preserves partial onboarding state (24-hour expiry) for browser-close recovery
- CompanyContext object stores all answers for downstream AI chat, notifications, and analytics

---

## Version 1.2 (2025-11-02)

**Multi-Content-Type Architecture Update**

**Major Changes:**

- **Epic 2 Scope Expansion:** Changed from "10,000+ law database" to "170,000+ multi-content-type legal database"
  - Added Swedish Court Cases (AD, HD, HovR, HFD, MÖD, MIG): 15,000-20,000 pages
  - Added EU Legislation (Regulations, Directives): 110,000+ pages
  - **UPDATED (v1.3):** AD (Arbetsdomstolen / Labour Court) IS included in MVP as Priority #1 court - Domstolsverket PUH API has working AD data (fixes Notisum's broken AD coverage)
  - Excluded Propositioner, EU Court Cases to Phase 2

- **Epic 2 Stories:** Restructured from 8 to 11 stories
  - Story 2.1: NEW - Multi-content-type data model design
  - Story 2.2: Updated - SFS laws ingestion (50,000+ documents)
  - Story 2.3: NEW - Court cases ingestion (AD, HFD, HD, HovR - priority order)
  - Story 2.4: NEW - EU legislation ingestion (Regulations, Directives)
  - Story 2.5: Updated - SEO pages for all content types with type-specific routes
  - Story 2.6: Updated - Content-type-specific categorization
  - Story 2.7: NEW - Multi-content-type search and filtering
  - Story 2.8: NEW - Cross-document navigation system
  - Story 2.9: Updated - SNI discovery with multi-content results
  - Story 2.10: NEW - Content-type-specific RAG chunking strategies
  - Story 2.11: Updated - Multi-content-type change history tracking

- **Database Schema:** Polymorphic design to support multiple content types
  - `legal_documents` table (polymorphic for all types)
  - `court_cases` table (type-specific metadata)
  - `eu_documents` table (CELEX, NIM data)
  - `cross_references` table (laws ↔ cases ↔ EU directives)
  - `amendments` table (SFS amendment tracking)
  - `document_subjects` table (categorization)

- **Functional Requirements Updated:**
  - FR1: 10,000+ laws → 170,000+ legal documents
  - FR4: RAG sources expanded to include court cases and EU legislation
  - FR8: Change monitoring expanded to all content types
  - FR24: Individual pages support content-type-appropriate tabs
  - FR36: Categorization applies to all 170,000+ documents

- **Architecture Requirements Updated:**
  - Multi-source API dependencies: Riksdagen, Domstolsverket, EUR-Lex
  - Content-type-specific indexing strategies for pgvector
  - Multi-content-type change detection jobs

**Rationale:** Competitive analysis of Notisum revealed their SEO strategy relies on comprehensive content coverage across 18+ document types. To compete, Laglig.se MVP must cover SFS laws, court precedent, and EU legislation (7 content types, ~170K pages) to drive sufficient SEO traffic.

**Data Source Status:**

- ✅ Riksdagen API: Available, confirmed
- ✅ EUR-Lex API: Available, confirmed
- ✅ Domstolsverket API: Available, confirmed
- ❌ AD Labour Court: Data quality issues in Notisum, investigate alternative sources post-MVP

## Version 1.1 (2025-11-01)

**PRD Completion - Ready for Architect Handoff**

**Changes:**

- Added Post-MVP Roadmap section with explicit out-of-scope features
- Added User Research & Validation Approach section
- Added Technical Risk Areas section (6 high-complexity areas flagged)
- Added Next Steps section with UX Expert and Architect handoff prompts
- Updated status to "Complete - Ready for Architect"

## Version 1.0 (2025-01-01)

**Initial PRD Draft**

- Complete epic structure (8 epics, 86 stories)
- Functional and Non-Functional Requirements (41 FR, 26 NFR)
- Goals, user research, competitive analysis
- Technical stack defined
- Revenue model and pricing tiers

---
