# Notisum Content Type Analysis - Complete Summary

**Purpose:** Comprehensive analysis of all legal document types available in Notisum to inform Laglig.se PRD scope decisions

**Date:** 2025-02-11
**Status:** Complete - All 18 document types analyzed

---

## Executive Summary

Notisum provides access to **18+ distinct legal document types** across three major categories:

1. **Swedish Legislation** (SFS laws, preparatory works)
2. **EU Legislation** (Regulations, directives, court cases)
3. **Swedish Court Case Law** (9 different courts/tribunals)

**Critical finding:** The PRD currently assumes "10,000+ law pages" means only SFS laws, but a competitive SEO strategy requires multiple document types similar to Notisum's approach.

---

## Document Types by Priority for Laglig.se MVP

### Tier 1: ESSENTIAL (Must-Have for MVP)

**Business Impact:** Universal - All businesses need these

| Document Type              | Volume          | Data Source    | Hosted by Notisum | Business Value           | MVP Priority |
| -------------------------- | --------------- | -------------- | ----------------- | ------------------------ | ------------ |
| **SFS Laws & Ordinances**  | 50,000-100,000+ | Riksdagen API  | ✅ Yes            | ⭐⭐⭐⭐⭐ Universal     | **CRITICAL** |
| **HFD/RegR (Admin Court)** | 1,500-3,000     | Domstolsverket | ✅ Yes            | ⭐⭐⭐⭐⭐ Tax/permits   | **CRITICAL** |
| **AD (Labour Court)**      | 2,000-3,000     | Domstolsverket | ❌ BROKEN         | ⭐⭐⭐⭐⭐ All employers | **BLOCKED**  |

**Total Tier 1 Pages:** ~55,000-105,000 pages (excluding broken AD)

---

### Tier 2: HIGH PRIORITY (Strong MVP Candidates)

**Business Impact:** Very high for most businesses

| Document Type               | Volume        | Data Source    | Hosted by Notisum | Business Value               | MVP Priority |
| --------------------------- | ------------- | -------------- | ----------------- | ---------------------------- | ------------ |
| **HD (Supreme Court)**      | 3,000-5,000   | Domstolsverket | ✅ Yes            | ⭐⭐⭐⭐ Legal precedent     | **HIGH**     |
| **HovR (Courts of Appeal)** | 1,500-3,000   | Domstolsverket | ✅ Yes            | ⭐⭐⭐⭐ Practical precedent | **HIGH**     |
| **EU Regulations**          | 100,000+      | EUR-Lex API    | ✅ Yes            | ⭐⭐⭐⭐ All businesses      | **HIGH**     |
| **EU Directives**           | 10,000-15,000 | EUR-Lex API    | ✅ Yes            | ⭐⭐⭐⭐ Compliance          | **HIGH**     |

**Total Tier 2 Pages:** ~115,000-125,000 pages

---

### Tier 3: MODERATE PRIORITY (Industry-Specific)

**Business Impact:** Critical for specific industries only

| Document Type                 | Volume        | Data Source    | Hosted by Notisum | Business Value             | MVP Priority |
| ----------------------------- | ------------- | -------------- | ----------------- | -------------------------- | ------------ |
| **MÖD (Environmental Court)** | 600-1,200     | Domstolsverket | ✅ Yes            | ⭐⭐⭐ Construction/Energy | **MODERATE** |
| **EU Court Cases (CJEU)**     | 30,000-40,000 | EUR-Lex API    | ✅ Yes            | ⭐⭐⭐ EU compliance       | **MODERATE** |
| **MIG (Migration Court)**     | 200-500       | Domstolsverket | ✅ Yes            | ⭐⭐ Int'l hiring          | **LOW-MOD**  |

**Total Tier 3 Pages:** ~30,000-40,000 pages

---

### Tier 4: PROFESSIONAL/PHASE 2 (Legal Professionals)

**Business Impact:** Moderate - Mainly for legal interpretation

| Document Type                       | Volume        | Data Source    | Hosted by Notisum  | Business Value              | Phase 2 Priority |
| ----------------------------------- | ------------- | -------------- | ------------------ | --------------------------- | ---------------- |
| **Propositioner**                   | 10,000-15,000 | Riksdagen API  | ✅ Yes             | ⭐⭐⭐ Legal interpretation | **PHASE 2**      |
| **MD (Historical Marketing Court)** | 500-1,000     | Domstolsverket | ✅ Yes (ends 2016) | ⭐⭐ Marketing law          | **PHASE 2**      |

**Total Tier 4 Pages:** ~10,500-16,000 pages

---

### Tier 5: LOW PRIORITY (Skip or External Link Only)

**Business Impact:** Low - Preparatory works or limited applicability

| Document Type                  | Volume      | Data Source     | Hosted by Notisum | Business Value | Recommendation |
| ------------------------------ | ----------- | --------------- | ----------------- | -------------- | -------------- |
| **SOU (Government Inquiries)** | 2,000-3,000 | Regeringen.se   | ❌ External link  | ⭐⭐ Policy    | **SKIP/LINK**  |
| **Departementsserien (Ds)**    | 1,000-2,000 | Regeringen.se   | ❌ External link  | ⭐ Policy      | **SKIP**       |
| **Förordningsmotiv**           | 100-300     | Gov't databases | ⚠️ Sparse/broken  | ⭐ Rare        | **SKIP**       |
| **EU Treaties & Other Acts**   | 10,000+     | EUR-Lex API     | ✅ Yes            | ⭐ Reference   | **SKIP MVP**   |

---

### Tier 6: SKIP ENTIRELY (Not Viable)

**Data Quality Issues or Not Binding**

| Document Type                    | Volume  | Data Source | Issue                             | Recommendation |
| -------------------------------- | ------- | ----------- | --------------------------------- | -------------- |
| **JO (Parliamentary Ombudsman)** | Unknown | jo.se       | ⚠️ Broken links, not binding      | **SKIP**       |
| **JK (Chancellor of Justice)**   | Unknown | jk.se       | ❌ Ends 2014, broken, not binding | **SKIP**       |

---

## Data Source Availability Summary

### ✅ EXCELLENT API ACCESS

- **Riksdagen API:** SFS laws, Propositioner, Utskottsbetänkanden
  - Format: JSON, XML, CSV
  - Authentication: None required
  - Status: ✅ Free, public, comprehensive

- **EUR-Lex API:** All EU legal acts, court cases
  - Format: XML, HTML, PDF, RDF
  - Authentication: None required
  - Status: ✅ Free, public, comprehensive

### ⚠️ LIKELY API/FEED AVAILABLE

- **Domstolsverket:** All Swedish court cases (HD, HovR, HFD, AD, MÖD, MIG, MD)
  - Format: Unknown (investigate)
  - Authentication: Unknown
  - Status: ⚠️ Need to verify API availability

### ❌ NO STRUCTURED API

- **Regeringen.se:** SOU, Ds, Kommittédirektiv, Förordningsmotiv
  - Format: PDF, HTML (scraping required)
  - Authentication: N/A
  - Status: ❌ No public API, would require scraping

### ❌ DATA QUALITY ISSUES

- **AD (Arbetsdomstolen):** Individual pages broken in Notisum
- **JO:** Limited content, broken links
- **JK:** Database ends 2014, 90% broken links

---

## PRD Scope Recommendations

### MVP (Phase 1) - Recommended Content Types

**Core Legal Content (Tier 1 + 2):**

1. ✅ **SFS Laws & Ordinances** (50,000-100,000 pages)
2. ✅ **HFD/RegR Administrative Court** (1,500-3,000 pages)
3. ⚠️ **AD Labour Court** (BLOCKED - investigate data source)
4. ✅ **HD Supreme Court** (3,000-5,000 pages)
5. ✅ **HovR Courts of Appeal** (1,500-3,000 pages)
6. ✅ **EU Regulations** (100,000+ pages)
7. ✅ **EU Directives** (10,000-15,000 pages)

**Total MVP Pages:** ~170,000-225,000 legal content pages

**Exclude from MVP:**

- ❌ Propositioner (Phase 2)
- ❌ SOU/Ds (External links or Phase 3)
- ❌ MÖD, MIG (Industry-specific, Phase 2)
- ❌ EU Court Cases (Phase 2)
- ❌ JO, JK (Not viable)

---

## Database Schema Implications

### Content Type Taxonomy

```typescript
enum ContentType {
  // Swedish Primary Law
  SFS_LAW = 'sfs_law',
  SFS_ORDINANCE = 'sfs_ordinance',

  // Swedish Court Cases
  HD_SUPREME_COURT = 'hd_supreme_court',
  HOVR_COURT_APPEAL = 'hovr_court_appeal',
  HFD_ADMIN_SUPREME = 'hfd_admin_supreme',
  AD_LABOUR_COURT = 'ad_labour_court',
  MOD_ENVIRONMENT_COURT = 'mod_environment_court',
  MIG_MIGRATION_COURT = 'mig_migration_court',
  MD_MARKETING_COURT = 'md_marketing_court',

  // Swedish Preparatory Works
  PROPOSITION = 'proposition',
  SOU = 'sou',
  DS = 'ds',

  // EU Law
  EU_REGULATION = 'eu_regulation',
  EU_DIRECTIVE = 'eu_directive',
  EU_COURT_CASE = 'eu_court_case',
  EU_TREATY = 'eu_treaty',
}
```

### Document Metadata by Type

**Each content type requires different metadata fields:**

**SFS Laws:**

- SFS number (YYYY:NNNN)
- Title
- Ministry
- Effective date
- Amendment history
- Consolidation status
- Cross-references to other laws

**Court Cases (HD, HovR, HFD, etc.):**

- Case number (varies by court)
- Court name
- Decision date
- Case summary
- Parties involved
- Lower court
- Legal provisions cited
- Subject matter tags

**EU Regulations/Directives:**

- CELEX number
- EU document number
- Publication date
- Entry into force date
- EUT reference (L-series)
- National implementation measures (directives only)
- Amendment status

---

## URL Structure Implications

### Notisum URL Patterns by Document Type

**Swedish Laws:**

- SFS: `?id=YYYYNNNN` (e.g., 20250280)

**Swedish Courts:**

- HD: `?id=HDYYYYNNN` (e.g., HD025003)
- HovR: `?id=RHYYYYNNN` (e.g., RH024001)
- HFD: `?id=RRYYYYNNN` (e.g., RR023001)
- AD: `?id=ADYYYYNNN` (e.g., AD025002)
- MÖD: `?id=MOYYYYNNN` (e.g., MO025001)
- MIG: `?id=MIYYYYNNN` (e.g., MI025001)
- MD: `?id=MDYYYYNN` (e.g., MD016001)

**Swedish Preparatory Works:**

- Proposition: `?id=PYYYYNN` (e.g., P2324028)
- SOU: `?id=SOYYYYNN` (e.g., SO025020)
- Ds: `?id=DSYYYYNN` (e.g., DS202435)

**EU Documents:**

- Regulations: `?id=YYYRNNNNN` (e.g., 323R0139)
- Directives: `?id=YYYLDNNNN` (e.g., 32024L0790)
- Court cases: `?id=YYYYXNNNNN` (e.g., 62190495)

**Laglig.se URL Strategy:**
Each content type should have distinct, SEO-friendly URL structure:

- `/lagar/sfs/2025/280` - SFS laws
- `/rattsfall/hd/2025/3` - Supreme Court cases
- `/rattsfall/hovr/2024/1` - Court of Appeal cases
- `/eu/forordningar/2023/139` - EU regulations
- `/eu/direktiv/2024/790` - EU directives

---

## SEO Strategy Implications

### Content Volume by Type (MVP Scope)

**Total indexable pages for SEO:** ~170,000-225,000 pages

**Breakdown:**

1. **SFS Laws:** 50,000-100,000 pages (largest volume)
2. **EU Regulations:** 100,000+ pages (second largest)
3. **EU Directives:** 10,000-15,000 pages
4. **Court Cases Combined:** 9,000-16,000 pages
   - HD: 3,000-5,000
   - HovR: 1,500-3,000
   - HFD: 1,500-3,000
   - MÖD: 600-1,200
   - MIG: 200-500

**SEO Value Distribution:**

**High Search Volume:**

- SFS Laws - Most searched (common law names like "Aktiebolagslag")
- EU Regulations - GDPR, consumer protection regulations
- Labour Court (AD) - Employment law questions
- Tax Court (HFD) - Tax compliance questions

**Medium Search Volume:**

- Supreme Court (HD) - Legal precedent research
- Courts of Appeal (HovR) - Regional case law
- EU Directives - Sector-specific compliance

**Lower Search Volume:**

- Environmental Court (MÖD) - Industry-specific
- Migration Court (MIG) - Individual/specific company needs

---

## Data Ingestion Strategy

### Phase 1: MVP Data Sources

**High Priority (Start Here):**

1. **Riksdagen API - SFS Laws**
   - Endpoint: `https://data.riksdagen.se/dokumentlista/?doktyp=sfs`
   - Volume: 50,000-100,000 entries
   - Update frequency: Daily/Weekly
   - Complexity: Medium (amendment tracking)
   - Estimated effort: 2-3 weeks

2. **EUR-Lex API - EU Regulations**
   - Endpoint: EUR-Lex SPARQL/REST API
   - Volume: 100,000+ entries
   - Update frequency: Daily
   - Complexity: Medium (CELEX numbering, languages)
   - Estimated effort: 2-3 weeks

3. **EUR-Lex API - EU Directives**
   - Endpoint: EUR-Lex SPARQL/REST API
   - Volume: 10,000-15,000 entries
   - Update frequency: Daily
   - Complexity: Medium (+ National Implementation Measures)
   - Estimated effort: 1-2 weeks

**Medium Priority:**

4. **Domstolsverket - Court Cases**
   - HD, HovR, HFD, (AD if fixed), MÖD, MIG
   - Volume: 9,000-16,000 entries
   - Update frequency: Weekly
   - Complexity: High (different formats per court)
   - **ACTION REQUIRED:** Verify API availability
   - Estimated effort: 3-4 weeks (all courts)

### Phase 2: Professional Tier

5. **Riksdagen API - Propositioner**
   - Volume: 10,000-15,000 entries
   - Complexity: High (lengthy documents, cross-references)

6. **EUR-Lex API - Court Cases**
   - Volume: 30,000-40,000 entries
   - Complexity: Medium (similar to regulations)

### Phase 3: Enterprise/Specialized

7. **Regeringen.se - SOU/Ds** (Scraping required)
   - Volume: 3,000-5,000 entries
   - Complexity: High (no API, scraping needed)

---

## Technical Architecture Implications

### Database Tables Required

**Core Tables:**

```sql
-- Unified legal documents table
legal_documents (
  id UUID PRIMARY KEY,
  content_type ContentType NOT NULL,
  document_number VARCHAR(50) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  full_text TEXT,
  effective_date DATE,
  publication_date DATE,
  status DocumentStatus,
  source_url TEXT,
  metadata JSONB, -- Type-specific metadata
  search_vector tsvector, -- Full-text search
  embedding vector(1536), -- RAG embeddings
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Amendment tracking (for SFS laws)
amendments (
  id UUID PRIMARY KEY,
  base_document_id UUID REFERENCES legal_documents(id),
  amending_document_id UUID REFERENCES legal_documents(id),
  effective_date DATE,
  description TEXT,
  sections_affected TEXT[]
)

-- Cross-references (laws citing laws, cases citing laws)
cross_references (
  id UUID PRIMARY KEY,
  source_document_id UUID REFERENCES legal_documents(id),
  target_document_id UUID REFERENCES legal_documents(id),
  reference_type ReferenceType,
  context TEXT
)

-- Subject matter taxonomy
document_subjects (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES legal_documents(id),
  subject_code VARCHAR(50),
  subject_name VARCHAR(200)
)

-- Court case specific
court_cases (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES legal_documents(id),
  court_name VARCHAR(200),
  case_number VARCHAR(100),
  lower_court VARCHAR(200),
  decision_date DATE,
  parties JSONB
)

-- EU specific
eu_documents (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES legal_documents(id),
  celex_number VARCHAR(50) UNIQUE,
  eut_reference VARCHAR(100),
  national_implementation_measures JSONB -- For directives
)
```

### RAG Implementation Implications

**Challenge:** Different document types have different structures

**SFS Laws:**

- Structured by chapters (kap.) and sections (§)
- Need to preserve hierarchy in embeddings
- Cross-references within law text

**Court Cases:**

- Narrative structure (facts, analysis, conclusion)
- Long documents (5-20 pages typically)
- Multiple sections to embed separately

**EU Regulations:**

- Structured by articles
- Multiple languages (focus on Swedish)
- Complex numbering (CELEX)

**Chunking Strategy by Document Type:**

```typescript
interface ChunkingStrategy {
  sfs_law: {
    method: 'by_section' // Chunk by § (section)
    maxTokens: 500
    preserveContext: ['chapter', 'section_number']
  }
  court_case: {
    method: 'by_semantic_section' // Facts, Analysis, Conclusion
    maxTokens: 800
    preserveContext: ['court', 'case_number', 'decision_date']
  }
  eu_regulation: {
    method: 'by_article'
    maxTokens: 500
    preserveContext: ['celex', 'article_number']
  }
  proposition: {
    method: 'by_section' // Propositioner have numbered sections
    maxTokens: 1000 // Longer chunks for context
    preserveContext: ['proposition_number', 'section_title']
  }
}
```

---

## Competitive Analysis: Notisum vs. Laglig.se

### What Notisum Provides

**Strengths:**

- ✅ Comprehensive coverage (18+ document types)
- ✅ Long historical data (40+ years for some types)
- ✅ Full text hosting (most types)
- ✅ Cross-linking between documents
- ✅ Amendment tracking (SFS)
- ✅ Chronological navigation

**Weaknesses:**

- ❌ Outdated UI/UX
- ❌ No AI assistance
- ❌ No plain-language explanations
- ❌ No industry-specific filtering
- ❌ No compliance tracking
- ❌ Data quality issues (AD, JO, JK)
- ❌ Expensive subscription model

### What Laglig.se Should Differentiate On

**Phase 1 Differentiators:**

1. **AI-Powered RAG** - Natural language questions
2. **Plain Swedish Summaries** - Not legalese
3. **Industry-Specific Filtering** - "Show me what matters to restaurants"
4. **Compliance Tracking** - "Track changes affecting your business"
5. **SNI Code Integration** - Automatic relevance filtering
6. **Change Monitoring** - "New law affects you" alerts

**Phase 2 Differentiators:** 7. **HR Compliance Toolkit** - Built on AD labour court cases 8. **Tax Compliance Wizard** - Built on HFD tax cases 9. **Environmental Permit Guide** - Built on MÖD cases 10. **Cross-Document Intelligence** - "This law + these 5 court cases + EU directive"

**Phase 3 Differentiators:** 11. **Predictive Compliance** - "New SOU suggests changes in 2 years" 12. **Risk Scoring** - "Your practice has medium risk based on AD precedent" 13. **Automated Legal Opinions** - AI-generated guidance with citations

---

## Data Quality Issues Summary

### ❌ BLOCKERS - Cannot Use

| Document Type                  | Issue                                | Impact                       | Workaround                                    |
| ------------------------------ | ------------------------------------ | ---------------------------- | --------------------------------------------- |
| **AD (Labour Court)**          | Individual pages empty/broken        | Critical business value lost | Investigate Domstolsverket direct access      |
| **JK (Chancellor of Justice)** | Database ends 2014, 90% broken links | Outdated, unusable           | Skip entirely, or source from jk.se if needed |

### ⚠️ DATA ISSUES - Use with Caution

| Document Type            | Issue                         | Impact                         | Workaround                                               |
| ------------------------ | ----------------------------- | ------------------------------ | -------------------------------------------------------- |
| **JO (Parl. Ombudsman)** | Limited content, broken links | Low value anyway (not binding) | Skip or link to jo.se                                    |
| **Förordningsmotiv**     | Sparse data, many dead links  | Very low value (rare docs)     | Skip entirely                                            |
| **MD (Marketing Court)** | Historical only (ends 2016)   | Outdated                       | Label clearly as historical, supplement with current PMD |

### ✅ EXTERNAL LINK ONLY - Notisum Doesn't Host

| Document Type | Notisum Approach              | Impact                | Laglig.se Approach |
| ------------- | ----------------------------- | --------------------- | ------------------ |
| **SOU**       | Index + link to regeringen.se | Lower priority anyway | Same or skip MVP   |
| **Ds**        | Index + link to regeringen.se | Lower priority anyway | Same or skip MVP   |

---

## Epic 2 Revision Requirements

### Current PRD Epic 2 Scope (INCORRECT)

> "Epic 2: Legal Content Foundation (Alla Lagar)
> Goal: Build comprehensive 10,000+ law database with public SEO-optimized pages..."

**Problem:** Assumes "law database" = only SFS laws

### Recommended PRD Epic 2 Revision

> "**Epic 2: Legal Content Foundation**
> **Goal:** Build comprehensive legal content database with 170,000+ public SEO-optimized pages covering Swedish and EU law, court precedent, and regulations.
>
> **Content Types (MVP):**
>
> - Swedish laws and ordinances (SFS) - 50,000-100,000 pages
> - Swedish Supreme Court (HD) - 3,000-5,000 pages
> - Swedish Courts of Appeal (HovR) - 1,500-3,000 pages
> - Supreme Administrative Court (HFD) - 1,500-3,000 pages
> - [AD Labour Court - PENDING data source investigation]
> - EU Regulations - 100,000+ pages
> - EU Directives - 10,000-15,000 pages
>
> **User Stories Must Address:**
>
> - Multiple content type ingestion pipelines
> - Content type-specific metadata schemas
> - Content type-specific chunking strategies for RAG
> - Cross-document linking (laws ↔ court cases ↔ EU law)
> - Content type filtering in search/discovery
> - Amendment tracking (SFS laws)
> - National implementation tracking (EU directives)
>
> **Success Criteria:**
>
> - All 7 content types ingested and indexed
> - RAG search works across all content types
> - Cross-references between document types functional
> - SEO pages generating organic traffic"

---

## User Story Additions Required

### Current Epic 2 Stories (From PRD)

The current epic focuses only on SFS laws:

- Story 2.1: SFS Law Ingestion
- Story 2.2: Law Content Display
- Story 2.3: etc.

### Required New Stories

**2.X: Multi-Content-Type Data Model**

- As a: System
- I want: Flexible schema supporting multiple legal document types
- So that: We can store SFS laws, court cases, EU regulations with type-specific metadata
- Acceptance Criteria:
  - ContentType enum with all MVP types
  - Polymorphic document table with JSONB metadata
  - Type-specific tables for courts, EU docs
  - Cross-reference system linking documents

**2.Y: Court Case Ingestion Pipeline**

- As a: System
- I want: Ingest court cases from HD, HovR, HFD, MÖD, MIG
- So that: Users can search case law precedent
- Acceptance Criteria:
  - Domstolsverket API integration (pending verification)
  - Parser for each court's format
  - Case metadata extraction (parties, court, dates)
  - Full text storage and indexing
  - Cross-references to cited laws extracted

**2.Z: EU Law Ingestion Pipeline**

- As a: System
- I want: Ingest EU regulations and directives from EUR-Lex
- So that: Users can search EU compliance requirements
- Acceptance Criteria:
  - EUR-Lex API integration
  - CELEX number parsing
  - Swedish translation prioritization
  - National Implementation Measures (NIM) for directives
  - Cross-references to Swedish implementing laws

**2.AA: Content Type-Specific RAG Chunking**

- As a: System
- I want: Different chunking strategies for different document types
- So that: RAG retrieval is optimized for each content structure
- Acceptance Criteria:
  - SFS laws chunked by § (section)
  - Court cases chunked by semantic section
  - EU regulations chunked by article
  - Context preserved in metadata
  - Chunk overlap configured per type

**2.AB: Cross-Document Linking System**

- As a: User
- I want: Navigate between related documents (law → cases interpreting it → EU directive requiring it)
- So that: I understand legal landscape completely
- Acceptance Criteria:
  - SFS laws link to amending laws
  - SFS laws link to propositioner (Phase 2)
  - Court cases link to laws cited
  - EU directives link to Swedish implementation laws
  - Bidirectional navigation works

**2.AC: Content Type Filtering in Search**

- As a: User
- I want: Filter search results by content type (only laws, only court cases, etc.)
- So that: I find the right type of legal authority
- Acceptance Criteria:
  - Content type filter in search UI
  - Faceted search by type
  - "Show me court cases on this topic"
  - "Show me laws on this topic"
  - Combined type search works

---

## Data Volume Estimates - Final Summary

### MVP Scope (Tier 1 + 2)

| Content Type           | Estimated Pages | Data Quality | API Available  | Priority |
| ---------------------- | --------------- | ------------ | -------------- | -------- |
| **SFS Laws**           | 50,000-100,000  | ✅ Excellent | ✅ Riksdagen   | CRITICAL |
| **EU Regulations**     | 100,000+        | ✅ Excellent | ✅ EUR-Lex     | HIGH     |
| **EU Directives**      | 10,000-15,000   | ✅ Excellent | ✅ EUR-Lex     | HIGH     |
| **HD Supreme Court**   | 3,000-5,000     | ✅ Good      | ⚠️ Verify      | HIGH     |
| **HovR Courts Appeal** | 1,500-3,000     | ✅ Good      | ⚠️ Verify      | HIGH     |
| **HFD Admin Supreme**  | 1,500-3,000     | ✅ Good      | ⚠️ Verify      | CRITICAL |
| **AD Labour Court**    | 2,000-3,000     | ❌ BROKEN    | ⚠️ Investigate | BLOCKED  |
| **MÖD Environment**    | 600-1,200       | ✅ Good      | ⚠️ Verify      | MODERATE |
| **MIG Migration**      | 200-500         | ✅ Good      | ⚠️ Verify      | LOW-MOD  |

**Total MVP Pages: ~170,000-225,000** (excluding broken AD)

**With AD fixed: ~172,000-228,000 pages**

---

## Action Items for PRD Update

### 1. Update Epic 2 Scope and Title

- [ ] Rename from "Legal Content Foundation (Alla Lagar)" to "Legal Content Foundation"
- [ ] Update goal to reflect 170,000+ pages, multiple content types
- [ ] Clarify SFS + court cases + EU law

### 2. Add New User Stories

- [ ] Story: Multi-content-type data model
- [ ] Story: Court case ingestion pipeline
- [ ] Story: EU law ingestion pipeline
- [ ] Story: Content type-specific RAG chunking
- [ ] Story: Cross-document linking system
- [ ] Story: Content type filtering in search

### 3. Update Functional Requirements

- [ ] FR1: Expand beyond "10,000+ Swedish laws" to "170,000+ legal content pages"
- [ ] Add FR for court case database
- [ ] Add FR for EU law database
- [ ] Add FR for cross-document navigation

### 4. Update Technical Requirements

- [ ] Add Riksdagen API integration requirement
- [ ] Add EUR-Lex API integration requirement
- [ ] Add Domstolsverket API/feed requirement (verify first)
- [ ] Add multi-content-type database schema
- [ ] Add content-type-specific RAG strategy

### 5. Update Data Model Section

- [ ] Add ContentType enum
- [ ] Add polymorphic document schema
- [ ] Add court case specific tables
- [ ] Add EU document specific tables
- [ ] Add cross-reference tables

### 6. Investigation Tasks Before Architect Handoff

- [ ] **CRITICAL:** Investigate AD (Labour Court) data source - why broken in Notisum?
  - Check Domstolsverket direct access
  - Check arbetsdomstolen.se
  - This is BLOCKER for MVP if not resolved
- [ ] **HIGH:** Verify Domstolsverket API/feed availability for all courts
  - HD, HovR, HFD, MÖD, MIG
  - Document API endpoints, authentication, format
- [ ] **MEDIUM:** Test EUR-Lex API for Swedish translations
  - Verify Swedish content availability
  - Test CELEX number resolution
  - Test National Implementation Measures (NIM) for directives

### 7. Update Out-of-Scope / Phase 2

- [ ] Move Propositioner to Phase 2 (Professional tier)
- [ ] Move EU Court Cases to Phase 2
- [ ] Move SOU/Ds to Phase 3 or skip
- [ ] Mark JO, JK as "Not viable - skip"
- [ ] Mark Förordningsmotiv as "Skip - sparse data"

---

## Competitive SEO Impact

### Notisum's SEO Strategy

Notisum covers 18+ document types, creating **massive content footprint**:

- Every SFS law = separate page
- Every court case = separate page
- Every EU regulation = separate page
- Total: Hundreds of thousands of indexed pages

**Result:** Notisum ranks for:

- Law names: "aktiebolagslag", "arbetsmiljölag"
- EU regulations: "gdpr", "mifid"
- Court cases: "NJA 2020 s 123"
- Legal topics: "uppsägning arbetsmiljö"

### Laglig.se SEO Strategy (Recommended)

**Match Notisum's content coverage breadth:**

- SFS laws: 50,000-100,000 pages
- EU regulations: 100,000+ pages
- Court cases: 9,000-16,000 pages
- Total: ~170,000-225,000 pages

**Exceed Notisum on quality:**

- ✅ Plain Swedish summaries (not legalese)
- ✅ AI-generated explanations
- ✅ Industry-specific relevance
- ✅ "What this means for your business"
- ✅ Related document suggestions

**Target long-tail keywords Notisum misses:**

- "Vad gäller när jag säger upp någon"
- "GDPR krav för små företag"
- "Miljötillstånd restaurang"
- "Arbetstidslagen övertid regler"

**Differentiation:**

- **Notisum:** Comprehensive legal database (lawyers, legal professionals)
- **Laglig.se:** Business compliance assistant (SMB owners, HR, compliance officers)

---

## Final Recommendation

### MVP Content Scope

**Include (Tier 1 + 2):**

1. ✅ SFS Laws & Ordinances (50K-100K pages) - Riksdagen API
2. ✅ HFD Administrative Supreme Court (1.5K-3K pages) - Domstolsverket
3. ⚠️ AD Labour Court (2K-3K pages) - **INVESTIGATE DATA SOURCE FIRST**
4. ✅ HD Supreme Court (3K-5K pages) - Domstolsverket
5. ✅ HovR Courts of Appeal (1.5K-3K pages) - Domstolsverket
6. ✅ EU Regulations (100K+ pages) - EUR-Lex API
7. ✅ EU Directives (10K-15K pages) - EUR-Lex API

**Total: ~170,000-225,000 pages**

**Explicitly Exclude from MVP:**

- ❌ Propositioner (Phase 2 - Professional tier)
- ❌ SOU, Ds (Phase 3 or skip - low SMB value)
- ❌ EU Court Cases (Phase 2)
- ❌ MÖD, MIG (Phase 2 - industry-specific)
- ❌ MD (Historical only, ends 2016)
- ❌ JO, JK (Not viable - data issues, not binding)
- ❌ Förordningsmotiv (Sparse, low value)

### Next Steps

1. **Update PRD** with revised Epic 2 scope and new user stories
2. **Investigate AD data source** - This is BLOCKING for MVP
3. **Verify Domstolsverket API** availability for all courts
4. **Proceed to Architecture phase** with clarified multi-content-type scope

---

## Document Status

✅ **COMPLETE** - All 18 Notisum document types analyzed
✅ **ACTIONABLE** - Clear recommendations for PRD update
⚠️ **BLOCKERS IDENTIFIED** - AD data source needs investigation before MVP finalization

**Next:** Update PRD Epic 2 and proceed to Architect handoff with clarified scope.
