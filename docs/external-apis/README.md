# External APIs Documentation

This directory contains comprehensive documentation for all external APIs used in laglig.se, organized by implementation phase and purpose.

## 📁 Directory Structure

```
external-apis/
├── README.md                                          # This file
├── external-apis-deep-dive.md                        # Overview of all APIs
│
├── 📊 Core API References (MVP)
│   ├── riksdagen-api-comprehensive-analysis.md      # Complete Riksdagen API guide (SFS laws)
│   └── domstolsverket-api-comprehensive-analysis.md # Complete Domstolsverket PUH API guide (Court cases)
│
├── 📦 mvp-implementation/                            # MVP-specific implementation strategies
│   ├── sfs-change-detection-strategy.md             # How to detect law changes
│   ├── historical-amendment-tracking-strategy.md    # Amendment tracking implementation
│   ├── notisum-amendment-competitive-analysis.md    # Competitive analysis vs Notisum
│   └── api-stack-alignment-verification.md          # API ↔ PRD ↔ Schema alignment check
│
├── 🚀 future-phases/                                 # Post-MVP feature documentation
│   ├── phase-2-forarbeten-integration.md            # Legislative preparatory works (propositioner, SOU)
│   └── phase-3-political-analytics.md               # Political context & party analytics
│
└── 📚 archive/                                       # Superseded documents (historical reference)
    └── riksdagen-api-analysis.md                    # Old analysis (superseded by comprehensive version)
```

---

## 🎯 Quick Reference

### For MVP Development (Epic 2.2 & 2.3)

**Start here:**

1. Read `external-apis-deep-dive.md` for overview
2. Use `riksdagen-api-comprehensive-analysis.md` for SFS law ingestion (Epic 2.2)
3. Use `domstolsverket-api-comprehensive-analysis.md` for court case ingestion (Epic 2.3)
4. Refer to `mvp-implementation/` for specific implementation strategies

**Key MVP documents:**

- **SFS Laws:** `riksdagen-api-comprehensive-analysis.md` (Section 12 has production-ready code)
- **Court Cases:** `domstolsverket-api-comprehensive-analysis.md` (Section 10 has implementation guide)
- **Change Detection:** `mvp-implementation/sfs-change-detection-strategy.md`
- **Amendments:** `mvp-implementation/historical-amendment-tracking-strategy.md`

### For Post-MVP Planning

**Phase 2 (Q1-Q2 2025):** Legislative Context Enhancement

- Read `future-phases/phase-2-forarbeten-integration.md`
- Integrates propositioner, betänkanden, SOU (preparatory works)
- Improves RAG quality by adding "WHY laws exist" context

**Phase 3 (Q3-Q4 2025):** Political Analytics Layer

- Read `future-phases/phase-3-political-analytics.md`
- Adds political party attribution, voting records, ideological scoring
- Transforms platform into policy intelligence tool

---

## 📊 API Status Overview

| API                          | Purpose                         | MVP Phase | Docs Status | Implementation Status |
| ---------------------------- | ------------------------------- | --------- | ----------- | --------------------- |
| **Riksdagen Dokument API**   | SFS laws (11,351 laws)          | Epic 2.2  | ✅ Complete | 🔄 Ready to implement |
| **Domstolsverket PUH API**   | Court cases (AD, HD, HFD, HovR) | Epic 2.3  | ✅ Complete | 🔄 Ready to implement |
| **Riksdagen Förarbeten API** | Propositioner, SOU, betänkanden | Phase 2   | ✅ Planned  | ⏳ Post-MVP           |
| **Riksdagen Political API**  | Voting records, party data      | Phase 3   | ✅ Planned  | ⏳ Post-MVP           |

---

## 🔍 Document Descriptions

### Core API References

#### `riksdagen-api-comprehensive-analysis.md`

**Purpose:** Complete technical reference for Riksdagen's Dokument API (SFS laws)

**Key sections:**

- Section 3: API endpoints and parameters
- Section 4: Response structure analysis
- Section 5: Data volume estimates (11,351 laws, ~38 hours ingestion)
- Section 7: Amendment tracking (7 distinct approaches)
- Section 12: **Production-ready implementation code** (effective dates, REPEALED detection, cross-references)

**Use for:** Epic 2.2 (SFS law ingestion)

#### `domstolsverket-api-comprehensive-analysis.md`

**Purpose:** Complete technical reference for Domstolsverket's PUH API (court cases)

**Key sections:**

- Section 3: API structure and endpoints
- Section 4: Court-by-court data analysis (AD, HD, HFD, HovR, MÖD, MIG)
- Section 6: Competitive intelligence (Notisum's broken AD data = our advantage!)
- Section 10: **Implementation guide** (chunking strategy, metadata extraction)

**Use for:** Epic 2.3 (Court case ingestion)

#### `external-apis-deep-dive.md`

**Purpose:** High-level overview of all external APIs

**Use for:** Understanding the full API landscape before diving into specific APIs

---

### MVP Implementation Strategies

#### `mvp-implementation/sfs-change-detection-strategy.md`

**Purpose:** Comprehensive strategy for detecting when SFS laws are amended

**Key approaches:**

- Footer parsing (primary method)
- Metadata comparison
- HTML diff detection
- Title/status changes

**Use for:** Epic 2.2 (change notification system)

#### `mvp-implementation/historical-amendment-tracking-strategy.md`

**Purpose:** How to track full amendment history for each law

**Key features:**

- 7-field amendment data model (aligns with PRD)
- Backward link parsing (from amending law → amended law)
- Forward link parsing (from amended law → amending law)
- Multi-tier confidence scoring (HIGH/MEDIUM/LOW)

**Use for:** Epic 2.2 (amendment history display)

#### `mvp-implementation/notisum-amendment-competitive-analysis.md`

**Purpose:** Competitive analysis of how Notisum handles amendments

**Key insights:**

- Notisum has 3-field model (we have 7 fields = competitive advantage)
- Notisum shows "Ändrad" vs "Upphävd" status (we match this + add more detail)

**Use for:** Understanding competitive landscape for amendments

#### `mvp-implementation/api-stack-alignment-verification.md`

**Purpose:** Verification that API capabilities align with PRD requirements and Prisma schema

**Status:** 91% implementation-ready (2 critical blockers resolved, 5 high-priority gaps closed)

**Use for:** Pre-development validation checklist

---

### Future Phases

#### `future-phases/phase-2-forarbeten-integration.md`

**Status:** Post-MVP (Q1-Q2 2025)
**Priority:** High - Crucial for legal AI quality

**What it adds:**

- Propositioner (government proposals explaining WHY laws were introduced)
- Betänkanden (committee reports)
- SOU (government inquiries)
- Riksdagsskrivelser (parliamentary communications)

**Business value:**

- Dramatically improves RAG quality (AI understands legislative intent)
- Professional tier differentiator (SEK 1,500-2,500/month)
- 30,000 documents, ~3 GB storage, $300-500 embedding cost

**Key quote:**

> "Transform from 'Here's what the law says' to 'Here's what the law says AND why it was created'"

#### `future-phases/phase-3-political-analytics.md`

**Status:** Post-MVP (Q3-Q4 2025, after Phase 2)
**Priority:** High - Unique competitive moat

**What it adds:**

- Political party attribution (which minister/party proposed each law)
- Detailed voting records (which parties voted for/against)
- Ideological scoring (-10 left to +10 right)
- Amendment political shift analysis (e.g., left → right transitions)

**Business value:**

- Policy Intelligence tier (SEK 3,500-5,000/month)
- Projected ARR: SEK 3.7M-4.6M (~€320K-400K)
- Development cost: SEK 224K (~€19K)
- Expands market to journalists, researchers, lobbyists, policy analysts

**Key quote:**

> "Understand WHY laws exist, WHO created them, and WHEN they might change"

**Unique positioning:** NO competitor has this (Notisum, Lagrummet, Zeteo all lack political context)

---

### Archive

#### `archive/riksdagen-api-analysis.md`

**Status:** Superseded by `riksdagen-api-comprehensive-analysis.md`

**Why archived:** The comprehensive version (920 lines) includes everything from the original analysis (272 lines) plus production-ready implementation code, detailed data volume estimates, and complete amendment tracking strategies.

**Keep for:** Historical reference if needed

---

## 🎓 Learning Path

### For Backend Developers (Epic 2.2 & 2.3)

**Week 1: API Understanding**

1. Read `external-apis-deep-dive.md` (30 min)
2. Read `riksdagen-api-comprehensive-analysis.md` Sections 1-6 (2 hours)
3. Read `domstolsverket-api-comprehensive-analysis.md` Sections 1-5 (2 hours)

**Week 2: Implementation Planning**

1. Read `riksdagen-api-comprehensive-analysis.md` Section 12 (1 hour)
2. Read `mvp-implementation/sfs-change-detection-strategy.md` (1 hour)
3. Read `mvp-implementation/historical-amendment-tracking-strategy.md` (1 hour)
4. Review `mvp-implementation/api-stack-alignment-verification.md` (30 min)

**Week 3+: Development**

- Use Section 12 code snippets as reference implementation
- Refer to specific sections as needed during development

### For Product/Strategy (Post-MVP Planning)

**Phase 2 Planning:**

1. Read `future-phases/phase-2-forarbeten-integration.md` Sections 1-4, 9 (1 hour)
2. Focus on Section 9: Competitive Positioning & Pricing

**Phase 3 Planning:**

1. Read `future-phases/phase-3-political-analytics.md` Sections 1-2, 6, 11 (1 hour)
2. Focus on Section 6: Competitive Analysis
3. Focus on Section 11: Go-to-Market Strategy

---

## 📈 Data Volume Summary

| Data Source                      | Volume           | Ingestion Time | Storage | Priority |
| -------------------------------- | ---------------- | -------------- | ------- | -------- |
| **SFS Laws**                     | 11,351 laws      | ~38 hours      | ~400 MB | Epic 2.2 |
| **Court Cases**                  | 50,000-100,000   | ~72-144 hours  | ~2-4 GB | Epic 2.3 |
| **Förarbeten** (Phase 2)         | ~30,000 docs     | ~24 hours      | ~3 GB   | Post-MVP |
| **Political Metadata** (Phase 3) | ~11,000 contexts | ~6 hours       | ~12 MB  | Post-MVP |

---

## 🔗 Cross-References

**Related documentation:**

- `/docs/prd.md` - Product Requirements (Epic 2.2 & 2.3 align with these API docs)
- `/docs/prisma-schema-preview.prisma` - Database schema (ContentType enum, LegalDocument, Amendment models)
- `/docs/competitive-analysis/` - Notisum competitive intelligence
- `/docs/feature-specifications/` - Frontend feature specs

**Key alignment:**

- PRD Story 2.2 → `riksdagen-api-comprehensive-analysis.md`
- PRD Story 2.3 → `domstolsverket-api-comprehensive-analysis.md`
- PRD Amendment tracking → `mvp-implementation/historical-amendment-tracking-strategy.md`

---

## 📝 Document Maintenance

**Last updated:** 2025-11-06
**Status:** All MVP documentation complete and implementation-ready (91% → 100% after critical blocker fixes)

**Next updates needed:**

- [ ] Add API rate limiting notes once we start production testing
- [ ] Document actual ingestion performance vs estimates
- [ ] Add troubleshooting section based on real implementation issues
- [ ] Update Phase 2/3 timelines based on MVP launch date

**Document owners:**

- MVP API docs: Backend team
- Phase 2/3 planning docs: Product/Strategy team
- Alignment verification: Cross-functional (Backend + Product)
