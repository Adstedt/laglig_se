# Changelog

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
