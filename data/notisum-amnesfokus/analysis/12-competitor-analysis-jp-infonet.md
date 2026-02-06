---
title: 'Konkurrentanalys: JP Infonet vs Notisum -- Positionering for laglig.se'
type: competitive-analysis
version: '1.0'
created: '2026-02-06'
sources:
  jp_infonet:
    files:
      - laglista-arbetsmiljo.xlsx (141 rows, 8 categories)
      - laglista-miljo.xlsx (81 rows, 7 categories)
      - informationssakerhet.xlsx (112 rows, 15 categories)
      - livsmedel.xlsx (55 rows, 10 categories)
      - transport.xlsx (37 rows, 1 category)
    total_rows: 426
    format: Excel (.xlsx)
  notisum:
    lists: 9
    total_rows: 657
    unique_laws: ~477
    format: JSON/CSV
classification: internal-strategy
---

# Konkurrentanalys: JP Infonet vs Notisum -- Positionering for laglig.se

## 1. Executive Summary

This analysis compares two established Swedish legal compliance providers -- JP Infonet and Notisum -- to identify the competitive positioning strategy for laglig.se. The analysis is based on 5 JP Infonet Excel template files (426 total rows) and 9 Notisum law lists (657 total rows, ~477 unique laws).

**Key findings:**

- **JP Infonet's core strength is compliance workflow**, not content depth. Their 13-column Excel schema includes fields for responsibility assignment, compliance status tracking, review dates, root cause analysis, and remediation planning. This is the feature set that compliance officers actually pay for.

- **JP Infonet's row counts are massively inflated by amendment-level tracking.** Their 426 total rows across 5 files represent approximately 120-140 unique base laws. Their Informationssakerhet list claims 112 entries but covers only ~15 unique laws/regulations. Arbetsmiljo's 141 rows reduce to approximately 35-40 unique laws.

- **JP Infonet's content quality is inconsistent.** Base law summaries are generally informative, but amendment-row summaries frequently default to boilerplate text directing users to read the amendment SFS directly -- providing no analytical value.

- **Notisum's core strength is content depth and expert commentary.** Gold-standard lists achieve 70-100% expert commentary coverage with substantive regulatory analysis. However, Notisum provides zero compliance workflow functionality and no amendment tracking.

- **Notisum's coverage is broader but uneven.** Nine lists covering 477 unique laws across more domains than JP, but Tier C lists have sparse commentary and weak categorization.

- **Neither competitor offers smart amendment intelligence.** JP lists every amendment as a separate row (creating noise); Notisum ignores amendments entirely (creating blind spots). laglig.se can own the middle ground: consolidated base-law entries with amendment change summaries.

- **laglig.se can be superior to both** by combining JP's practical compliance workflow with Notisum's content depth, eliminating amendment inflation through intelligent consolidation, and adding original compliance summaries in plain-language "Vi ska/behover..." format.

- **Local regulation tracking and article-level regulatory checklists** are JP-exclusive features that laglig.se should adopt and improve upon as modular, digital-native capabilities.

---

## 2. JP Infonet Product Model

### 2.1 Schema and Data Structure

JP Infonet distributes law lists as Excel workbooks (.xlsx), each containing a single worksheet named "Laglistor". The schema uses 13 active columns followed by 7 empty padding columns (20 columns total):

| Column | Swedish Name   | Purpose                                   | Type                               |
| ------ | -------------- | ----------------------------------------- | ---------------------------------- |
| A      | Omrade         | Top-level domain label                    | Text, repeated per row             |
| B      | Laglista       | Category/subcategory within the domain    | Text                               |
| C      | Kalla          | Law reference (SFS/AFS/EU number + title) | Text, primary identifier           |
| D      | Sammanfattning | Summary of the law or amendment content   | Text, variable quality             |
| E      | Aktivitet      | Required compliance action                | Text, user-editable                |
| F      | Ansvarig       | Person/role responsible for compliance    | Text                               |
| G      | Annat          | Other notes                               | Text, rarely used                  |
| H      | Foljer?        | Compliance status                         | Dropdown: Ja / Nej / Ej tillamplig |
| I      | Datum          | Review/assessment date                    | Date                               |
| J      | Ansvarig       | Reviewer (typically email)                | Text                               |
| K      | Kommentar      | Review comments                           | Text                               |
| L      | Orsak          | Root cause of non-compliance              | Text                               |
| M      | Atgard         | Remediation action plan                   | Text                               |

**Template model:** JP ships these files pre-populated with law references and summaries (columns A-D), then includes fictitious company data (columns E-M) to demonstrate the compliance workflow. The sample data uses placeholder identities ("namn.efternamn@mejl.se", "VD i samarbete med HR-chef", "cDAA", "KMA") and sample compliance review entries showing how an organization would track its compliance status over time.

The Excel format means every customer works with a local file copy -- no real-time collaboration, no version control, no audit trail beyond what Excel provides.

### 2.2 Content Coverage

| File                      | Domain                      | Total Rows | Est. Unique Laws | Category Count |
| ------------------------- | --------------------------- | ---------- | ---------------- | -------------- |
| laglista-arbetsmiljo.xlsx | Work Environment            | 141        | ~35-40           | 8              |
| laglista-miljo.xlsx       | Environment                 | 81         | ~30-35           | 7              |
| informationssakerhet.xlsx | Information Security / GDPR | 112        | ~15              | 15             |
| livsmedel.xlsx            | Food Safety                 | 55         | ~35-40           | 10             |
| transport.xlsx            | Transport                   | 37         | ~15-20           | 1              |
| **Totals**                | **5 domains**               | **426**    | **~130-150**     | **41**         |

**Key observation:** JP's 426 rows represent roughly 130-150 unique base laws/regulations. The amendment-per-row model inflates the apparent scope by approximately 2.5-3x.

### 2.3 Amendment Tracking Model

JP Infonet's most distinctive structural choice is tracking every individual amendment (andrings-SFS) as a separate row in the spreadsheet. This means a single base law with 5 amendments occupies 6 rows.

**Amendment inflation examples:**

| Base Law                                       | File                 | Total Rows | Amendment Rows | Inflation |
| ---------------------------------------------- | -------------------- | ---------- | -------------- | --------- |
| Offentlighets- och sekretesslagen (2009:400)   | informationssakerhet | ~80        | ~79            | 80x       |
| Brottsbalken (1962:700)                        | informationssakerhet | 26         | 25             | 26x       |
| Offentlighets- och sekretessforordningen       | informationssakerhet | ~15        | ~14            | 15x       |
| Trafikforordningen (1998:1276)                 | transport            | 9          | 8              | 9x        |
| KIFS 2017:7                                    | laglista-miljo       | ~13        | ~12            | 13x       |
| Avfallsforordningen (2020:614)                 | laglista-miljo       | 7          | 6              | 7x        |
| Kor-/vilotider regulations                     | transport            | 6          | 5              | 6x        |
| Forordning (1977:284) om arbetsskadeforsakring | laglista-arbetsmiljo | 3          | 2              | 3x        |

**Assessment:** This approach has a defensible rationale -- compliance officers need to know about each regulatory change that affects them. However, the execution creates significant usability problems:

1. **Signal-to-noise ratio degrades.** When 80 of 112 rows in an information security list are amendments to a single law, the list loses its value as a compliance overview.
2. **Amendment summaries are frequently empty or boilerplate.** Many amendment rows carry summary text directing users to read the amendment SFS themselves -- defeating the purpose of having a curated law list.
3. **Scrolling fatigue.** Users must scroll through dozens of amendment rows to find the next distinct law.
4. **Category distortion.** The massive "Ovrigt" category in Arbetsmiljo (84 rows) exists primarily because amendment rows needed a category, and they were all dumped into a catch-all bucket.

### 2.4 Compliance Workflow Features

JP's compliance workflow occupies columns E through M, providing a structured process for tracking organizational compliance status:

**Step 1 -- Action Identification (Aktivitet):** For each law/regulation row, the compliance team describes what specific action their organization must take to comply.

**Step 2 -- Responsibility Assignment (Ansvarig):** A named person or role is assigned as the compliance owner. Template examples include "VD i samarbete med HR-chef" (CEO with HR manager) and "KMA" (Quality/Environment coordinator).

**Step 3 -- Compliance Assessment (Foljer?):** A three-value status field: Ja (compliant), Nej (not compliant), Ej tillamplig (not applicable).

**Step 4 -- Review Documentation (Datum, Ansvarig, Kommentar):** The reviewer records the date, their identity, and any observations.

**Step 5 -- Non-Compliance Handling (Orsak, Atgard):** When Foljer? = Nej, fields for root cause documentation and remediation planning.

**Assessment:** This is a practical, well-designed compliance workflow that maps directly to how ISO management systems (14001, 45001) expect legal compliance to be tracked. The critical weakness is that it lives in an Excel file -- no role-based access, no notification system, no audit trail, no dashboard aggregation, no automated reminders.

### 2.5 Category Structure Assessment

JP's categorization quality varies dramatically across the five files:

**Well-structured (Miljo, Livsmedel):**

- Miljo uses 7 meaningful categories (Avfall, Energi, Halsoskydd, Kemikalier, Skydd mot olyckor) that map to real regulatory domains.
- Livsmedel uses 10 specific categories including niche operational categories like "Cafeverksamhet" that demonstrate practical industry knowledge.

**Poorly structured (Arbetsmiljo, Informationssakerhet):**

- Arbetsmiljo has 84 of 141 rows (60%) dumped into "Ovrigt" -- a catch-all that renders the categorization almost meaningless.
- Informationssakerhet's "Ovrigt" contains unrelated laws like Brottsbalken, Foretagshemlighetslagen, and Kamerabevakningslagen -- all of which deserve their own categories.

**Absent (Transport):**

- Transport has zero subcategorization. All 37 rows sit in a single flat list covering dangerous goods, driver qualification, traffic regulations, vehicle requirements, and customs law.

**JP's unique category feature -- Lokala foreskrifter:**
The Miljo list includes 6 rows for municipality-specific environmental regulations covering Kalmar, Linkoping, Stockholm, Umea, Malmo, and Norrkoping. This is a genuinely useful feature that Notisum does not offer.

### 2.6 Content Quality Assessment

**Base law summaries (generally good):** For primary law entries, JP provides informative summaries that describe the law's scope, key requirements, and relevance to the target industry. Typically 2-5 sentences in accessible Swedish.

**Amendment summaries (frequently poor):** A significant proportion default to boilerplate text directing users to read the amendment SFS directly. This pattern appears across all five files.

**Other quality issues:**

- **Placeholder summaries:** Livsmedel contains entries with "Kommentar kommer inom kort" (coming soon).
- **Duplicate entries:** LIVSFS 2023:5 appears identically in both Material and Import/export sections.
- **Inconsistent law referencing:** Miljo refers to Miljobalken by chapter number while other files use SFS numbers.

---

## 3. Notisum Product Model

### 3.1 Schema and Data Structure

Notisum distributes law list content in JSON format, with each list structured as an array of document entries. Each entry represents a single base law or regulation (no amendment-level tracking). The schema includes document identifiers, section/category assignments (SSDD format on gold-standard lists), expert commentary, compliance summaries, and regulatory prefix types. 30 distinct regulatory prefixes catalogued.

### 3.2 Content Coverage

| List                         | Domain                      | Doc Count | Quality Tier  |
| ---------------------------- | --------------------------- | --------- | ------------- |
| Arbetsmiljo                  | Work Environment            | 112       | Gold standard |
| Arbetsmiljo Tjansteforetag   | Work Environment (Services) | 74        | Gold standard |
| Miljo                        | Environment                 | 81        | Gold standard |
| Miljo Tjansteforetag         | Environment (Services)      | ~60       | Mid-tier      |
| Miljo Sverige                | Environment (National)      | ~50       | Basic         |
| Informationssakerhet Sverige | Information Security        | ~70       | Mid-tier      |
| Fastighet and Bygg           | Property and Construction   | ~55       | Mid-tier      |
| Halsa and Sjukvard           | Healthcare                  | ~85       | Basic         |
| Livsmedel Sverige            | Food Safety                 | ~70       | Mid-tier      |
| **Totals**                   | **~8 domains**              | **~657**  |               |

**Unique laws: ~477** after deduplication across overlapping lists.

### 3.3 Content Quality Assessment

**Tier A -- Gold Standard (3 lists):** 70-100% expert commentary. Systematic SSDD indexing.
**Tier B -- Mid-Level (3-4 lists):** 30-60% commentary. Partial categorization.
**Tier C -- Basic (2-3 lists):** 0-30% commentary. Minimal structure.

### 3.4 Strengths and Weaknesses

**Strengths:** Content depth on gold-standard lists is unmatched. Clean one-row-per-law architecture. Broader domain coverage (9 lists). Structured SSDD indexing. 30 regulatory prefix types.

## **Weaknesses:** No compliance workflow (fatal gap vs JP). No amendment tracking. No local regulations. Uneven tier quality. Naming confusion. JSON not end-user-friendly.

## 4. Head-to-Head Comparison

### 4.1 Feature Matrix

| Dimension                     | JP Infonet                      | Notisum              | laglig.se (Proposed)                     |
| ----------------------------- | ------------------------------- | -------------------- | ---------------------------------------- |
| **Format**                    | Excel (.xlsx)                   | JSON/CSV             | Web app + API + Excel export             |
| **Architecture**              | Row per law + row per amendment | Row per base law     | Row per base law with amendment metadata |
| **Compliance status**         | Yes (Ja/Nej/Ej tillamplig)      | No                   | Yes, with history and audit trail        |
| **Responsibility assignment** | Yes (free text)                 | No                   | Yes, with role-based access control      |
| **Review date tracking**      | Yes (single date field)         | No                   | Yes, with recurring review schedules     |
| **Root cause / remediation**  | Yes (free text)                 | No                   | Yes, with structured fields + templates  |
| **Expert commentary**         | No                              | Yes (70-100% Tier A) | Yes, original compliance summaries       |
| **Amendment summaries**       | Partial (many say read the SFS) | No                   | Yes, AI-generated change analysis        |
| **Category structure**        | Inconsistent (massive Ovrigt)   | SSDD on 3 lists      | Consistent balanced sections all lists   |
| **Local regulations**         | Yes (6 municipalities)          | No                   | Yes, modular municipality layer          |
| **GDPR article breakdown**    | Yes (13 articles)               | No (single entry)    | Yes, extended to other frameworks        |
| **Regulatory prefixes**       | ~10 types                       | 30 types             | 30+ types                                |
| **Domain count**              | 5                               | ~8                   | 10+                                      |
| **Unique law coverage**       | ~130-150                        | ~477                 | 500+                                     |
| **Collaboration**             | No (local Excel)                | No (static)          | Yes (web-native)                         |
| **Alerts**                    | No                              | No                   | Yes (regulatory change alerts)           |
| **Search**                    | Excel Ctrl+F                    | None                 | Full-text + faceted                      |
| **Audit trail**               | No                              | No                   | Yes                                      |
| **API**                       | No                              | No                   | Yes (REST)                               |
| **Multi-user**                | No                              | No                   | Yes (team workspaces)                    |
| **Dashboard**                 | No                              | No                   | Yes (compliance dashboards)              |

### 4.2 Domain Coverage Comparison

| Domain                    | JP Infonet     | Notisum               | laglig.se     |
| ------------------------- | -------------- | --------------------- | ------------- |
| Arbetsmiljo               | Yes (141 rows) | Yes (112+74 docs)     | Yes           |
| Miljo                     | Yes (81 rows)  | Yes (81+~60+~50 docs) | Yes           |
| Informationssakerhet/GDPR | Yes (112 rows) | Yes (~70 docs)        | Yes           |
| Livsmedel                 | Yes (55 rows)  | Yes (~70 docs)        | Yes           |
| Transport                 | Yes (37 rows)  | No                    | Yes           |
| Fastighet and Bygg        | No             | Yes (~55 docs)        | Yes           |
| Halsa and Sjukvard        | No             | Yes (~85 docs)        | Yes           |
| Industry variants         | No             | Yes (2 lists)         | Yes (modular) |
| Financial Services        | No             | No                    | Planned (P2)  |
| Education                 | No             | No                    | Planned (P3)  |

### 4.3 Content Depth: Same-Law Comparison

**Arbetsmiljolagen (1977:1160):** JP has 1 base + amendments with operational summary. Notisum has 1 row with expert commentary. laglig.se: consolidated entry with expert summary, compliance requirements, amendment timeline, status tracking.

**Avfallsforordningen (2020:614):** JP has 7 rows (1+6 amendments), amendment summaries mostly boilerplate. Notisum has 1 row with expert commentary. laglig.se: single entry with collapsible amendment history.

**Offentlighets- och sekretesslagen (2009:400):** JP has ~80 rows (1+~79 amendments\!) -- extreme inflation. Nearly all amendment summaries are boilerplate. Notisum has 1 row. laglig.se: single entry with structured changelog.

## **GDPR (EU 2016/679):** JP breaks into 13 article-level items -- actually superior to Notisum single entry. laglig.se adopts this pattern and extends to other framework regulations.

## 5. Amendment Inflation Analysis

### 5.1 Inflation by File

| File                      | Total Rows | Unique Laws  | Amendment Rows | Inflation     | Coverage      |
| ------------------------- | ---------- | ------------ | -------------- | ------------- | ------------- |
| informationssakerhet.xlsx | 112        | ~15          | ~97            | **7.5x**      | 13% unique    |
| laglista-arbetsmiljo.xlsx | 141        | ~35-40       | ~101-106       | **3.5-4.0x**  | 25-28% unique |
| laglista-miljo.xlsx       | 81         | ~30-35       | ~46-51         | **2.3-2.7x**  | 37-43% unique |
| transport.xlsx            | 37         | ~15-20       | ~17-22         | **1.9-2.5x**  | 41-54% unique |
| livsmedel.xlsx            | 55         | ~35-40       | ~15-20         | **1.4-1.6x**  | 64-73% unique |
| **Totals**                | **426**    | **~130-150** | **~276-296**   | **~2.8-3.3x** | **~31-35%**   |

### 5.2 Worst Offenders

| Law/Regulation                               | File                 | Total Rows | Boilerplate Rows |
| -------------------------------------------- | -------------------- | ---------- | ---------------- |
| Offentlighets- och sekretesslagen (2009:400) | informationssakerhet | ~80        | ~75-79           |
| Brottsbalken (1962:700)                      | informationssakerhet | 26         | ~23-25           |
| Offentlighets- och sekretessforordningen     | informationssakerhet | ~15        | ~13-14           |
| KIFS 2017:7                                  | laglista-miljo       | ~13        | ~11-12           |
| Trafikforordningen (1998:1276)               | transport            | 9          | ~7-8             |

### 5.3 The Informationssakerhet Case Study

JP Informationssakerhet is the most extreme example:

- **Claimed scope:** 112 rows across 15 categories
- **Actual unique laws:** ~15
- **Breakdown:** 13 GDPR article entries (one EU regulation), OSL with ~80 amendment rows, OSL Forordning ~15, Foretagshemlighetslagen (3), Kamerabevakningslagen (3), Brottsbalken (26), Lag om elektronisk kommunikation (11), AFS 1999:7 (1)
- **Effective unique regulation count:** 7-8 distinct laws plus 13 GDPR article entries
- Organization must process 112 rows to understand obligations under fewer than 10 instruments.

### 5.4 Implications for laglig.se

1. **User trust:** laglig.se differentiates by being transparent about actual regulatory scope.
2. **Review efficiency:** Consolidated model eliminates scrolling through ~100 amendment rows.
3. **Content cost:** Single entry amendment metadata update vs adding new rows per amendment.

---

## 6. laglig.se Competitive Positioning

### 6.1 Superior Information Architecture

**vs. JP Infonet:** Eliminate massive Ovrigt catch-alls. Consistent subcategorization depth across all domains. Systematic section indexing across ALL lists. Target max 15-20 entries per section.

**vs. Notisum:** Apply gold-standard SSDD structuring to ALL lists. Eliminate naming confusion. Standardize categorization terminology across domains.

**Architecture principles:** Section depth max 2 levels. Section size 8-20 entries. Operational naming (not generic labels). Cross-referencing for multi-domain laws.

### 6.2 Smart Amendment Intelligence

Reject both JP model (every amendment is a row) and Notisum model (amendments invisible). Optimal approach:

**Consolidated base-law entry** with: current description and compliance summary, latest amendment date prominently displayed, collapsible amendment history showing SFS number/date, AI-generated change summary, impact assessment, and affected provisions.

**Amendment alerting layer:** Notifications when tracked laws are amended with human-readable change summaries (never boilerplate). Flag whether amendment changes compliance obligations or is merely technical/editorial.

### 6.3 Compliance Workflow Integration

**Core workflow (learning from JP):** 5-value compliance status (Ja/Nej/Ej tillamplig/Under utredning/Delvis). Responsibility assignment with org directory. Recurring review schedules. Structured root cause and remediation tracking.

**Digital-native additions:** Full audit trail. Dashboard aggregation. Team notifications. Evidence attachment. Compliance reports for ISO audits. Multi-site support.

### 6.4 Original Content Advantage

**Three content layers:**

1. **Compliance summary ("Vi ska/behover..." format):** Plain-language from organization perspective.
2. **Regulatory overview:** Structured summary of purpose, scope, affected organizations, provisions, penalties.
3. **Amendment intelligence:** AI-assisted change summaries answering: What changed? Who affected? Action needed?

This exceeds JP (inconsistent summaries only) and Notisum (expert commentary without actionable guidance).

### 6.5 Local Regulation Layer

Modular municipality layer activated by organization location. Initial coverage: 10 largest Swedish municipalities. Domain-specific: miljoforeskrifter, halsoskyddsforeskrifter, alkoholserveringsforeskrifter, building regulations. Neither JP (6 municipalities, 1 domain) nor Notisum (zero) offers comprehensive local tracking.

### 6.6 GDPR/Regulatory Checklist Pattern

Adopt JP article-level GDPR breakdown and generalize:

| Regulation                                   | Granularity                    | Items |
| -------------------------------------------- | ------------------------------ | ----- |
| GDPR (EU 2016/679)                           | Article-level                  | 15-20 |
| Miljobalken (1998:808)                       | Chapter-level                  | 10-12 |
| Arbetsmiljolagen (1977:1160)                 | Chapter + key AFS              | 8-10  |
| Diskrimineringslagen (2008:567)              | Ground-level + active measures | 10-12 |
| Dataskyddslagen (2018:218)                   | Section-level                  | 5-8   |
| NIS2-direktivet                              | Obligation category            | 8-10  |
| Offentlighets- och sekretesslagen (2009:400) | Secrecy category               | 5-10  |
| Plan- och bygglagen (2010:900)               | Chapter-level                  | 8-12  |

Each gets overview entry AND individual checklist entries enabling per-regulation compliance percentage.

### 6.7 Domain Expansion Roadmap

**Phase 1 (P1):** Arbetsmiljo, Miljo, Informationssakerhet/GDPR, Livsmedel
**Phase 2 (P1-P2):** Transport, Fastighet and Bygg, Halsa and Sjukvard
**Phase 3 (P2):** Industry overlays -- Tjansteforetag, Tillverkning, Offentlig sektor, Handel
**Phase 4 (P2-P3):** Financial services, Education, Public administration, Energy, Telecom

---

## 7. Strengths to Steal from Each Competitor

### 7.1 From JP Infonet

1. **Compliance workflow schema.** Adopt Aktivitet/Ansvarig/Foljer?/Datum/Kommentar/Orsak/Atgard but implement in web app with audit trails and dashboards.
2. **Local regulation tracking.** Scale from 6 municipalities to full national coverage as modular layer.
3. **GDPR article-level decomposition.** Extend beyond GDPR to other framework regulations.
4. **Amendment awareness.** Implement through consolidated entries with change summaries, not row-per-amendment.
5. **Onboarding templates.** Offer template compliance configurations for different organization types.
6. **Niche operational categories.** Include industry-specific categories like Cafeverksamhet that map to real business activities.
7. **Three-value compliance status.** Adopt Ja/Nej/Ej tillamplig and extend with Delvis and Under utredning.

### 7.2 From Notisum

1. **Expert commentary depth.** Match or exceed Tier A quality across ALL lists through original content and AI-assisted analysis.
2. **One-row-per-law architecture.** Adopt as primary view with amendment details as sub-elements.
3. **SSDD section indexing.** Apply across all domains for consistent navigation.
4. **Broad regulatory prefix coverage.** Match and exceed 30 prefix types.
5. **Industry-variant lists.** Formalize as modular overlay system.
6. **Domain breadth.** Include healthcare and property/construction from launch.
7. **Content-first philosophy.** Never sacrifice content quality for feature velocity.

---

## 8. Weaknesses to Exploit

### 8.1 JP Infonet Weaknesses

1. **Amendment inflation destroys usability.** 112 entries = 15 unique laws. laglig.se markets "real coverage."
2. **Lazy amendment summaries.** Boilerplate "read the SFS yourself" is content failure. laglig.se commits to genuine change summaries.
3. **Excel lock-in.** No collaboration, version control, dashboards, mobile, API. laglig.se is web-native.
4. **Massive Ovrigt categories.** 60% in "Other" = failed taxonomy. laglig.se guarantees max 10% Ovrigt.
5. **No structured indexing.** Free-text labels prevent automated processing. laglig.se has systematic indexing.
6. **Duplicate entries.** LIVSFS 2023:5 in two categories identically. laglig.se has referential integrity.
7. **Incomplete content.** "Kommentar kommer inom kort" in shipped products. laglig.se ships only complete content.
8. **No search.** Only Excel Ctrl+F. laglig.se has full-text faceted search.
9. **No update mechanism.** Manual merge required when regulations change.
10. **Inconsistent law referencing.** Miljobalken by chapter in one file, SFS in another.

### 8.2 Notisum Weaknesses

1. **Zero compliance workflow.** Fatal gap. laglig.se fills completely.
2. **No amendment tracking.** Smart amendment intelligence eliminates blind spot.
3. **Naming confusion.** Miljo vs Miljo Sverige vs Miljo Tjansteforetag. laglig.se has clear naming.
4. **Tier C lists add limited value.** laglig.se maintains consistent quality across all lists.
5. **No local regulation coverage.** laglig.se adds modular municipality layer.
6. **JSON format not end-user-friendly.** laglig.se provides web interface.
7. **No GDPR granularity.** laglig.se decomposes into article-level checklist items.
8. **Document overlap across lists.** laglig.se has referential integrity with cross-references.
9. **Static content delivery.** No alerts, personalization, or dynamic filtering.
10. **No compliance reporting.** Cannot generate audit or management review reports.

---

## 9. Recommended laglig.se Feature Priorities

| Priority | Feature                            | Description                                | Competitor Gap                            | Effort |
| -------- | ---------------------------------- | ------------------------------------------ | ----------------------------------------- | ------ |
| **P1**   | Compliance status tracking         | 5-value status per law with audit trail    | JP: Excel only; Notisum: none             | Medium |
| **P1**   | Balanced section architecture      | SSDD-style indexing, max 10% Ovrigt        | JP: massive Ovrigt; Notisum: 3 lists only | Medium |
| **P1**   | Original compliance summaries      | Vi ska/behover format for every law        | JP: some; Notisum: not action-oriented    | High   |
| **P1**   | Smart amendment intelligence       | Consolidated base law + change summaries   | JP: poor summaries; Notisum: ignores      | High   |
| **P1**   | Responsibility assignment          | Role-based per law                         | JP: free-text; Notisum: none              | Low    |
| **P1**   | Review scheduling                  | Recurring dates with reminders             | JP: single date; Notisum: none            | Medium |
| **P2**   | Compliance dashboard               | Org-wide percentage, overdue, open actions | Neither has this                          | Medium |
| **P2**   | Regulatory checklist decomposition | Article/chapter-level breakdown            | JP: GDPR only; Notisum: none              | Medium |
| **P2**   | Local regulation layer             | Municipality-specific modular overlay      | JP: 6 in 1 domain; Notisum: none          | High   |
| **P2**   | Amendment change alerts            | Notifications with impact summaries        | Neither has this                          | Medium |
| **P2**   | Compliance reporting               | ISO audit, management review reports       | Neither has this                          | Medium |
| **P2**   | Root cause / remediation           | Structured documentation with deadlines    | JP: free-text; Notisum: none              | Low    |
| **P2**   | Transport domain                   | Full law list with balanced sections       | JP: covers; Notisum: absent               | Medium |
| **P2**   | Evidence attachment                | Supporting document upload per law         | Neither has this                          | Medium |
| **P3**   | Multi-site compliance              | Per facility/location tracking             | Neither has this                          | High   |
| **P3**   | Industry overlay system            | Modular emphasis layers                    | Notisum: 2 manual variants                | High   |
| **P3**   | API access                         | REST API for system integration            | Neither has this                          | Medium |
| **P3**   | Financial services domain          | Bank/insurance/fintech regulations         | Neither covers this                       | High   |
| **P3**   | Onboarding templates               | Pre-configured compliance data             | JP: fictitious demos                      | Low    |
| **P3**   | Full-text search with facets       | Domain, status, and category filters       | Neither has meaningful search             | Medium |

---

## 10. Summary Positioning Statement

laglig.se positions itself as the modern, AI-powered Swedish legal compliance platform that eliminates the false choice between content depth and practical compliance workflow. Today, organizations must choose between JP Infonet Excel templates -- which offer a solid compliance tracking workflow but suffer from amendment inflation, inconsistent content quality, and the fundamental limitations of spreadsheet-based compliance management -- and Notisum expert law lists, which provide deep regulatory analysis on their best lists but offer zero compliance workflow functionality and ignore amendments entirely. Neither competitor provides a complete solution, and both rely on dated delivery formats that prevent collaboration, automation, and intelligent alerting.

laglig.se resolves this gap by building a web-native compliance platform that combines the best elements of both competitors while eliminating their respective weaknesses. From JP Infonet, laglig.se adopts the compliance workflow pattern (status tracking, responsibility assignment, review scheduling, non-compliance documentation) and the practical compliance design patterns (local regulation tracking, article-level regulatory checklists). From Notisum, laglig.se adopts the clean one-row-per-law architecture, systematic section indexing, and the commitment to content depth. To both, laglig.se adds what neither provides: smart amendment intelligence that consolidates regulatory changes into actionable change summaries, AI-assisted original content in plain-language Vi ska/behover format, digital-native collaboration and reporting, and automated regulatory change alerting.

The result is a platform where compliance officers can see their complete regulatory landscape without amendment noise, track their compliance status with full audit trails, receive proactive notifications when regulations change, and generate reports for ISO audits and management reviews -- all from a single, modern interface. By combining genuine content depth with practical workflow tools and intelligent automation, laglig.se does not merely match JP Infonet and Notisum; it makes the choice between them obsolete.
