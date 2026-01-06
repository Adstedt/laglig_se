# Epic 9: Legal Intelligence & AI Enrichment (DETAILED)

**Goal:** Enrich raw legal content with AI-generated contextual analysis using parliamentary documents (propositions, committee reports) to provide genuine legal insight beyond raw text.

**Value Delivered:** Users understand not just *what* changed in laws, but *why* it changed, the political context, and practical implications. Differentiates Laglig.se from competitors who only show raw legal text.

**Competitive Context:** No Swedish legal platform currently provides AI-generated legal comments with parliamentary context. Lagen.nu and Notisum show raw text only. This creates a unique value proposition:

- AI-generated plain language summaries explaining legislative intent
- Parliamentary context (propositions, committee reports, debates)
- Structured comments optimized for both quick scanning and deep analysis
- SEO-optimized detailed content driving organic traffic

## Background: Parliamentary Documents

Swedish laws (lagar) go through a documented legislative process:

| Document | Swedish | Purpose | API Source |
|----------|---------|---------|------------|
| Proposition | Prop. | Government's proposal with reasoning | data.riksdagen.se |
| Committee Report | Bet. (Betänkande) | Parliament committee analysis | data.riksdagen.se |
| Parliamentary Decision | Rskr. | Final riksdag decision | data.riksdagen.se |

**Note:** Förordningar (ordinances, ~60% of SFS) are issued directly by the government and have NO parliamentary documents. This epic focuses on lagar (~40% of SFS).

**Data availability:** Riksdagen's open API provides metadata and full text (HTML/PDF) for all parliamentary documents from 1971 onwards.

---

## Story 9.1: Legal Comment Generation System

**As a** legal researcher, compliance officer, or user receiving email notifications,
**I want** high-quality, contextual comments for law amendments that explain the change, its purpose, and practical implications,
**so that** I can quickly understand what changed and why without reading the full proposition.

**Acceptance Criteria:**

### Data Model & Integration

1. New `ParliamentaryDocument` model created with fields:
   - `id` (UUID), `type` (PROPOSITION | COMMITTEE_REPORT | PARLIAMENTARY_DECISION)
   - `designation` (e.g., "2025/26:22"), `riksdagen_id` (e.g., "HD0322")
   - `title`, `summary` (extracted/generated), `organ` (department/committee)
   - `published_date`, `decision_date`
   - `html_url`, `pdf_url`, `text_content` (optional, for betänkanden)
   - `raw_json` (original API response)

2. Junction table `SfsParliamentaryReference` linking SFS documents to parliamentary documents

3. New `LegalComment` model for generated comments:
   - `summary_short` (~150 words, for UI cards and emails)
   - `summary_detailed` (~800 words, for accordion/SEO)
   - `key_points` (JSON array of 4-6 bullet points)
   - `affected_companies`, `political_notes`, `context_sources`

### Riksdagen API Integration

4. Service `lib/riksdagen/client.ts` with rate limiting, retry logic, caching
5. Parser extracts prop/bet/rskr references from SFS footnotes

### Comment Generation

6. LLM-powered comment generator using proposition + betänkande + amendment content as context
7. Generates both short (UI/email) and detailed (accordion/SEO) versions
8. Stores generation metadata for cost tracking

### UI Integration

9. Amendment pages display comment sections with accordion for detailed view
10. Comments rendered as semantic HTML for SEO
11. Email notification template includes short summary

### Operational

12. Admin action to regenerate comments
13. Batch script for generating missing comments
14. Cost tracking per comment

---

## Story 9.2: Proposition Summary Extraction (Future)

**As a** user viewing a law or amendment,
**I want** to see a summary of the original proposition,
**so that** I understand the government's reasoning behind the legislation.

**Acceptance Criteria:**

1. For lagar with linked propositions, display "Regeringens motivering" section
2. Summary extracted from proposition's "Sammanfattning" section or generated via LLM
3. Link to full proposition on riksdagen.se
4. Works for both base laws and amendments

---

## Story 9.3: Cross-Reference to Preparatory Works (Future)

**As a** legal researcher,
**I want** to navigate from a law section to relevant preparatory works,
**so that** I can understand the legislative intent for specific provisions.

**Acceptance Criteria:**

1. Law page shows "Förarbeten" section linking to relevant propositions
2. Section-level linking where possible (specific § → specific prop section)
3. Display prop number, title, and relevant section reference
4. Works for amendments (show which prop introduced the change)

---

## Story 9.4: AI "Why Did This Law Change?" Feature (Future)

**As a** compliance officer,
**I want** to ask "why did this law change?" and get a contextual answer,
**so that** I can explain changes to stakeholders.

**Acceptance Criteria:**

1. "Varför ändrades denna lag?" button on amendment pages
2. AI generates explanation using proposition + betänkande context
3. Includes political context (was it contested? reservations?)
4. Cites sources (prop, bet)

---

## Story 9.5: Automated Legal Impact Analysis (Future)

**As a** business owner,
**I want** automated analysis of how a law change impacts my company,
**so that** I can prioritize compliance work.

**Acceptance Criteria:**

1. For amendments on user's law list, generate impact assessment
2. Uses company profile (SNI code, employee count, industry) as context
3. Outputs: High/Medium/Low priority, recommended actions, deadline if applicable
4. Integrates with notification system (Story 8.x)

---

**Epic 9 Estimated Stories:** 5-7

**Dependencies:**
- Epic 2 (Legal Content Foundation) - Amendment documents exist
- Epic 8 (Change Monitoring) - Notification infrastructure

**Technical Foundation:**
- Riksdagen Open Data API (data.riksdagen.se)
- OpenAI GPT-4 for comment generation
- Existing LegalDocument/SfsDocument models

---
