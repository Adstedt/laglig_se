# Epic 9: Myndighetsföreskrifter Integration Pipeline

## Epic Overview

**Epic ID:** Epic 9
**Status:** Done
**Priority:** High — Beta blocker
**Business Owner:** Product Team
**Technical Lead:** Development Team
**Last Updated:** 2026-02-15

> **Completion Note (2026-02-15):** All non-EU template-referenced documents verified with content + AI summaries (187/187 PASS). EU docs verified for presence — 18/18 present, content generation deferred to future story. Stories 12.4 and 12.5 are unblocked.

## Executive Summary

Ingest the non-SFS documents required by the Arbetsmiljö and Miljö seed templates into Laglig.se. This is the critical-path blocker for beta launch — we have 79/81 SFS documents already ingested, but 69 agency-level regulations (AFS, NFS, MSBFS, ELSÄK-FS, etc.) from 10 different authorities have no automated pipeline.

The proven PDF→LLM→HTML pipeline from amendments (Claude, not GPT-4) will be reused. Story 12.1 already created stub `AGENCY_REGULATION` records for ~51 of these documents — this epic fills them with actual content.

## Business Value

- **Beta Blocker:** Templates cannot ship without the underlying documents having content
- **Market Leadership:** Complete regulatory coverage (SFS + agency regulations) is a unique differentiator
- **Enterprise Critical:** Compliance officers need AFS (workplace safety), NFS (environment), MSBFS (fire/explosion) regulations
- **Template Foundation:** Stories 12.4 (Seed Arbetsmiljö) and 12.5 (Seed Miljö) are blocked until these documents are ingested

## Concrete Scope: Seed Template Documents

The exact documents needed are tracked in `data/seed-template-documents.csv`. Below is the authority-level breakdown of non-SFS documents:

### Authority Summary

| Authority | Prefix | Docs Needed | Template | Source Website | Ingestion Complexity |
|-----------|--------|-------------|----------|----------------|---------------------|
| Arbetsmiljöverket | AFS | 15 numbers (~81 entries) | Arbetsmiljö | av.se | High — omnibus PDFs need three-tier chapter splitting |
| Naturvårdsverket | NFS | 13 | Miljö | naturvardsverket.se | Medium — individual PDFs |
| MSB | MSBFS | 12 (6 shared) | Both | msb.se | Medium — individual PDFs |
| Elsäkerhetsverket | ELSÄK-FS | 5 | Arbetsmiljö | elsakerhetsverket.se | Low — few docs |
| Kemikalieinspektionen | KIFS | 2 (shared) | Both | kemi.se | Low — few docs |
| Boverket | BFS | 1 (shared) | Both | boverket.se | Low — single doc |
| Räddningsverket (legacy MSB) | SRVFS | 2 (1 shared) | Both | msb.se | Low — legacy docs |
| Skatteverket | SKVFS | 1 | Arbetsmiljö | skatteverket.se | Low — single doc |
| SCB | SCB-FS | 1 | Miljö | scb.se | Low — single doc |
| SSM | SSMFS | 1 | Miljö | stralsakerhetsmyndigheten.se | Low — single doc |
| Swedac | STAFS | 1 | Miljö | swedac.se | Low — single doc |
| **Total** | | **~69 unique docs** | | **10 authorities** | |

### AFS Documents (Highest Priority — 15 PDFs → ~81 legal_document entries)

AFS documents are consolidated provisions from Arbetsmiljöverket's 2023 reform. Many use `kap.` (chapter) notation. These are classified into three tiers:

- **Standalone:** Flat `§` numbering, no chapters. Stored as one `legal_document` entry.
- **Keep-whole:** Has `kap.` chapters, but chapters are organizational subdivisions of one regulatory area. Stored as one entry.
- **Split:** Has `kap.` chapters covering genuinely distinct regulatory domains. Stored as parent entry + one entry per chapter (kap. 2+). `kap. 1` (Allmänna bestämmelser) is kept on the parent and prepended as a preamble to each chapter entry.

| AFS Number | Tier | Entries | Topics | Priority |
|------------|------|---------|--------|----------|
| AFS 2023:1 | Standalone | 1 | SAM — Systematiskt arbetsmiljöarbete | P0 |
| **AFS 2023:2** | **Split — 8 kap.** | **1 + 8** | OSA, arbetsanpassning, första hjälpen, våld/hot, ensamarbete, gravida, minderåriga, arbetstidsanteckningar | P0 |
| AFS 2023:3 | Keep-whole | 1 | Projektering och byggarbetsmiljösamordning (11 kap, 3 avdelningar — roles/phases within construction coordination) | P0 |
| AFS 2023:4 | Standalone | 1 | Produkter — maskiner | P1 |
| AFS 2023:5 | Standalone | 1 | Produkter — tryckbärande anordningar | P1 |
| AFS 2023:6 | Standalone | 1 | Produkter — enkla tryckkärl | P1 |
| AFS 2023:7 | Keep-whole | 1 | Produkter — utrustning explosiva atmosfärer (4 kap, one product category ATEX) | P1 |
| AFS 2023:8 | Standalone | 1 | Produkter — förbud ledade skärverktyg röjsågar | P1 |
| **AFS 2023:9** | **Split — 5 kap.** | **1 + 5** | Arbetskorgar, fallskyddsnät, stegar, ställningar, trycksatta anordningar (produkt) | P1 |
| **AFS 2023:10** | **Split — 12 kap.** | **1 + 12** | Buller, vibrationer, fall, ras, ergonomi, kemiska risker (4 kap), smittrisker, optisk strålning, EMF | P0 |
| **AFS 2023:11** | **Split — 14 kap.** | **1 + 14** | Arbetsutrustning, bildskärm, truckar, motorsågar, traktorer, stegar, ställningar, trycksatta (2 kap), lyft (3 kap), pressar, PPE | P0 |
| AFS 2023:12 | Keep-whole | 1 | Utformning av arbetsplatser (7 kap — layout, evacuation, climate, safety, signs) | P0 |
| **AFS 2023:13** | **Split — 16 kap.** | **1 + 16** | Djur, asbest, berg/gruv, bygg, dykeri, frisör, hamn, GMO, kylda lokaler, mast/stolp, provning, fordon, rök/kemdykning, smältning, sprängning, vintervägshållning | P1 |
| AFS 2023:14 | Standalone | 1 | Gränsvärden för luftvägsexponering | P1 |
| **AFS 2023:15** | **Split — 11 kap.** | **1 + 11** | Medicinska kontroller: generella, vibrationer/natt, allergi (2 kap), fibros, metaller, fysisk ansträngning, övriga, flyg, hälsoundersökningar, läkaranmälan | P0 |
| | | **81 total** | 6 standalone + 3 keep-whole + 6 parents + 66 chapters | |

**Bold** = omnibus documents with many chapters requiring split handling.

> **Post-implementation note (Story 9.1 complete):** The chapter counts above reflect the **initial plan** based on document analysis. Actual implementation in Story 9.1 confirmed 81 total entries (6 standalone + 3 keep-whole + 6 parents + 66 chapters) but several chapter counts were revised during ingestion — e.g., AFS 2023:10 expanded from 12 to 17 chapters, AFS 2023:12 was reclassified from Keep-whole to Split (2 kap.), AFS 2023:15 was reclassified from Split to Standalone. See `data/seed-template-documents.csv` (column `chapter_count`) for the template-scoped chapter counts used by the audit script. Story 9.4's baseline audit will verify actual DB state.

**Source:** All AFS 2023-series PDFs are available at [av.se/lag-och-ratt/foreskrifter/](https://www.av.se/lag-och-ratt/foreskrifter/)

### NFS Documents (13 unique, all Miljö template)

| NFS Number | Title |
|------------|-------|
| NFS 2001:2 | Allmänna råd om egenkontroll |
| NFS 2004:10 | Deponering av avfall |
| NFS 2004:15 | Buller från byggplatser |
| NFS 2015:2 | Spridning av växtskyddsmedel |
| NFS 2015:3 | Yrkesmässig spridning av biocidprodukter |
| NFS 2016:8 | Miljörapport |
| NFS 2018:11 | Radioaktivt avfall |
| NFS 2020:5 | Antecknings- och rapporteringsskyldighet farligt avfall |
| NFS 2021:6 | Mätningar och provtagningar |
| NFS 2021:10 | Skydd mot mark-/vattenförorening vid brandfarliga vätskor |
| NFS 2022:2 | Transport av avfall |
| NFS 2023:2 | Uppgifter om avfall |
| NFS 2023:13 | Uppgifter om förpackningar |

**Source:** [naturvardsverket.se/om-oss/foreskrifter/](https://www.naturvardsverket.se/om-oss/foreskrifter/)

### MSBFS Documents (12 unique, 6 shared between templates)

| MSBFS Number | Template | Title |
|-------------|----------|-------|
| MSBFS 2010:4 | Miljö | Brandfarliga eller explosiva varor (klassificering) |
| MSBFS 2011:3 | Miljö | Transportabla tryckbärande anordningar |
| MSBFS 2013:3 | Both | Undantag från tillståndsplikten |
| MSBFS 2014:6 | Miljö | Rengöring (sotning) och brandskyddskontroll |
| MSBFS 2015:8 | Miljö | Seveso-föreskrifter |
| MSBFS 2015:9 | Both | Säkerhetsrådgivare för transport av farligt gods |
| MSBFS 2016:4 | Miljö | Tillstånd för överföring/import av explosiva varor |
| MSBFS 2018:3 | Miljö | Cisterner med anslutna rörledningar |
| MSBFS 2020:1 | Both | Hantering av brandfarlig gas och aerosoler |
| MSBFS 2023:2 | Both | Hantering av brandfarliga vätskor |
| MSBFS 2024:10 | Both | Transport av farligt gods (ADR-S) |
| MSBFS 2025:2 | Both | Hantering av explosiva varor |

**Source:** [msb.se/sv/regler/foreskrifter/](https://www.msb.se/sv/regler/foreskrifter/)

### ELSÄK-FS Documents (5, all Arbetsmiljö template)

| ELSÄK-FS Number | Title |
|-----------------|-------|
| ELSÄK-FS 2017:2 | Elinstallationsarbete |
| ELSÄK-FS 2017:3 | Elinstallationsföretag |
| ELSÄK-FS 2022:1 | Utförande av starkströmsanläggningar |
| ELSÄK-FS 2022:2 | Skyltning av starkströmsanläggningar |
| ELSÄK-FS 2022:3 | Kontroll av starkströmsanläggningar |

**Source:** [elsakerhetsverket.se/foreskrifter/](https://www.elsakerhetsverket.se/om-oss/foreskrifter/)

### Remaining Documents (7 unique, low volume)

| Doc Number | Authority | Template |
|------------|-----------|----------|
| KIFS 2017:7 | Kemikalieinspektionen | Both |
| KIFS 2022:3 | Kemikalieinspektionen | Both |
| BFS 2011:16 (OVK) | Boverket | Both |
| SRVFS 2004:3 | Räddningsverket (legacy MSB) | Both |
| SRVFS 2004:7 | Räddningsverket (legacy MSB) | Miljö |
| SKVFS 2015:6 | Skatteverket | Arbetsmiljö |
| SCB-FS 2024:25 | SCB | Miljö |
| SSMFS 2018:2 | SSM | Miljö |
| STAFS 2020:1 | Swedac | Miljö |

## Current State

### What Already Exists

- **SFS documents:** 79/81 ingested with full text + HTML (2 trivially fixable gaps)
- **EU regulations:** Story 2.4 in progress, ~5,083 ingested. 18 specific EU docs needed for templates
- **Stub records:** Story 12.1 created ~51 `AGENCY_REGULATION` stub records (no content, just metadata)
- **Content pipeline:** Story 12.3 built the AI content generation pipeline (summaries + compliance guidance)
- **PDF→HTML pipeline:** Proven from amendment processing, uses Claude (not GPT-4)
- **ContentType enum:** Already extended with `AGENCY_REGULATION` (Story 12.1)

### What's Missing

- **Actual content** for the 69 agency regulation stubs (no full_text, no html_content)
- **PDF discovery/download** layer for each authority website
- **Chapter-level splitting** logic for omnibus AFS documents
- **Automated sync** for detecting new/updated regulations

## Technical Approach

### Core Principle

Reuse the proven amendment PDF→LLM→HTML pipeline (Claude Opus/Sonnet, `type: "document"`) for converting agency regulation PDFs into semantic HTML. No need for GPT-4 Vision — Claude handles PDFs natively.

### Key Technologies

- **PDF Processing:** Direct PDF buffer as `type: "document"` to Claude (proven in `lib/sfs/amendment-llm-prompt.ts`)
- **LLM Model:** Claude (Anthropic) — same as amendment pipeline
- **HTML Structure:** Standardized `.legal-document` classes (same as SFS laws)
- **Storage:** PostgreSQL `legal_documents` table with `content_type = 'AGENCY_REGULATION'`
- **Content Generation:** Story 12.3 pipeline for summaries + compliance guidance (runs after ingestion)

### AFS Three-Tier Classification & Chapter Splitting

AFS documents are classified into three tiers based on whether their `kap.` chapters represent distinct regulatory domains or organizational subdivisions:

- **Tier 1 — Standalone** (6 docs: 2023:1, 2023:4, 2023:5, 2023:6, 2023:8, 2023:14): No chapters. Store as single entries.
- **Tier 2 — Keep-whole** (3 docs: 2023:3, 2023:7, 2023:12): Has `kap.` chapters but chapters are subdivisions of one area. Store as single entries.
- **Tier 3 — Split** (6 docs: 2023:2, 2023:9, 2023:10, 2023:11, 2023:13, 2023:15): Chapters cover distinct regulatory domains. Store as parent + chapter entries.

Split document structure:
- **document_number format:** `AFS 2023:10 kap. 3` (for chapter 3 of AFS 2023:10)
- **Parent entry:** Contains overview/TOC + full `kap. 1` (Allmänna bestämmelser)
- **Chapter entries:** Each gets `kap. 1` prepended as a definitions preamble
- **LLM extraction:** Send full PDF to Claude per chapter, asking it to extract the specific chapter as standalone HTML

### Processing Pipeline

```
PDF Download → Claude (type: "document") → Semantic HTML → Validate → Store in legal_documents
                                                                          ↓
                                                              Story 12.3 Content Pipeline
                                                              (AI summaries + compliance guidance)
                                                                          ↓
                                                              Stories 12.4/12.5 Template Seeding
```

## Story Breakdown (To Be Created)

The epic's stories should be restructured to prioritize the seed template documents over the generic "60+ agencies" goal. The original 9.1-9.8 numbering conflicts with the existing Story 9.1 (Legal Comment Generation), so stories should use new numbering.

### Proposed Story Sequence

**Phase 1: AFS Ingestion (Highest Impact — unlocks Arbetsmiljö template)**

- Download all 15 AFS 2023-series PDFs from av.se
- Process through Claude PDF→HTML pipeline
- Classify into three tiers (standalone, keep-whole, split) and split omnibus documents into chapter-level entries
- Validate HTML output against `.legal-document` CSS
- ~81 legal_document entries created (6 standalone + 3 keep-whole + 6 parents + 66 chapters)

**Phase 2: MSBFS + NFS Ingestion (Unlocks both templates)**

- Download 12 MSBFS + 13 NFS PDFs
- Process through same pipeline (no chapter splitting needed)
- 25 legal_document entries created

**Phase 3: Remaining Authorities (ELSÄK-FS, KIFS, BFS, SRVFS, SKVFS, SCB-FS, SSMFS, STAFS)**

- Download remaining 14 PDFs from 8 authority websites
- Process through pipeline
- 14 legal_document entries created

**Phase 4: Quality Assurance + Backfill**

- Fix the 2 missing SFS documents (SFS 1977:480, SFS 1999:678)
- Fix SFS 1999:381 (exists but empty content)
- Verify all 18 EU regulations needed for templates exist (from Story 2.4)
- Validate all ~188 unique template entries have content
- Run Story 12.3 content generation pipeline on all new documents

### Future Scope (Post-Beta)

The original epic vision of automated discovery for 60+ agencies, daily/weekly sync crons, and cross-reference detection remains valid but is deferred to post-beta. The immediate goal is manual/semi-automated ingestion of the specific 69 documents needed for the two seed templates.

## Dependencies

- **Story 12.1** (Done): Stub records + ContentType enum
- **Story 12.3** (Done): Content generation pipeline (runs after ingestion)
- **Story 2.4** (In Progress): EU regulation ingestion (18 specific docs needed)
- **Stories 12.4/12.5** (Blocked): Template seeding — blocked until this epic completes

## Data Reference

Full document inventory: `data/seed-template-documents.csv`
Analysis files: `data/notisum-amnesfokus/analysis/01-arbetsmiljo.md`, `data/notisum-amnesfokus/analysis/03-miljo.md`

## Definition of Done

- [ ] All 69 agency regulation documents have `full_text` and `html_content` populated
- [ ] AFS omnibus documents are split into chapter-level entries (~50 entries from 12 PDFs)
- [ ] All 81 SFS documents are verified present with content (fix 2 missing + 1 empty)
- [ ] All 18 EU regulations needed for templates are verified present (coordinate with Story 2.4)
- [ ] HTML structure is consistent with existing `.legal-document` CSS
- [ ] Story 12.3 content generation pipeline has been run on all new documents
- [ ] Stories 12.4 and 12.5 are unblocked

---

_Epic created: 2024-01-15_
_Last updated: 2026-02-15_
_Status: Done_
