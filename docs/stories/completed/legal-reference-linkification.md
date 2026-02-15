# Story 2.29: Legal Reference Linkification (Internal Linking)

## Status

Done

## Story

**As a** user reading a legal document on Laglig.se,
**I want** inline references to other laws, regulations, and court cases to be clickable links,
**So that** I can navigate directly to referenced sources, improving legal research flow and content discoverability.

## Context

Legal documents frequently reference other documents in plain text:

- "enligt 5 § lagen (2012:295)"
- "jfr NJA 2020 s. 45"
- "AFS 2001:1"

Currently these are unlinked plain text. Linkifying them at **write-time** (during ingestion) provides:

- **Better UX**: One-click navigation to referenced documents
- **SEO boost**: Internal linking across ~53,000 documents improves crawlability and search rankings
- **Content discoverability**: Users find related content naturally
- **Cross-reference data**: Populates the existing (but empty) `CrossReference` table for future features (e.g., "referenced by" panels, relationship graphs)

### Architecture Decision: Write-Time Linkification (Approach 3)

Linkification runs as a post-processing step during ingestion, baking `<a>` tags directly into the stored `html_content`. This was chosen over client-side or server-side-at-render alternatives because:

1. Zero runtime overhead — important for content-heavy legal pages
2. SEO-friendly — crawlers see real links
3. Fits naturally into the existing ingestion pipeline architecture
4. `html_content` is already the SSOT for rendering
5. A one-time migration script handles existing content; new content is linkified on ingest

### Pipeline Ordering: Linkify AFTER Derived Fields

In pipelines that compute derived fields (e.g., `sync-sfs-updates`), the ordering is:

1. Generate `htmlContent` (from LLM, API, or scraper)
2. Compute `markdownContent = htmlToMarkdown(htmlContent)` — from **unlinkified** source
3. Compute `jsonContent = htmlToJson(htmlContent)` — from **unlinkified** source
4. Compute `plainText = htmlToPlainText(htmlContent)` — from **unlinkified** source
5. **Linkify**: `linkifiedHtml = linkifyHtmlContent(htmlContent, slugMap, sourceDocNumber)`
6. Store `html_content = linkifiedHtml`, `markdown_content`, `json_content`, `full_text`

This ensures derived fields (used for search, RAG, structured queries) remain clean and free of `<a>` tag markup, while the rendered HTML contains navigable links.

> **Note:** `sync-sfs/route.ts` does NOT compute derived fields — linkification simply runs on `htmlContent` before the DB write.

### Scope: EU References Deferred

EU regulation and directive references (e.g., `förordning (EU) 2016/679`, `direktiv 2006/123/EG`) are **deferred to a follow-up story**. EU documents use CELEX numbers as `document_number` (e.g., `32016R0679`), requiring a non-trivial mapping from Swedish reference format → CELEX. This story covers SFS laws, agency regulations, and court cases only.

## Reference Patterns

### Swedish SFS Laws

| Pattern | Example | Normalized `document_number` |
| --- | --- | --- |
| With "lag" | `lag (2012:295)` | `SFS 2012:295` |
| Definite article | `lagen (2012:295)` | `SFS 2012:295` |
| Förordning | `förordning (2018:1472)` | `SFS 2018:1472` |
| With section | `5 § lagen (2012:295)` | `SFS 2012:295` |
| With chapter | `2 kap. 3 § lagen (2012:295)` | `SFS 2012:295` |

> **Note:** Bare `YYYY:NNNN` references (without "lag"/"förordning" context) are intentionally excluded to avoid false positives.

### Agency Regulations (Föreskrifter)

| Pattern | Example | Normalized `document_number` |
| --- | --- | --- |
| AFS | `AFS 2001:1` | `AFS 2001:1` |
| MSBFS | `MSBFS 2020:7` | `MSBFS 2020:7` |
| NFS | `NFS 2016:8` | `NFS 2016:8` |
| TSFS | `TSFS 2009:131` | `TSFS 2009:131` |
| Generic | `{PREFIX}FS YYYY:N` | `{PREFIX}FS YYYY:N` |

### Swedish Court Cases

| Court | Pattern | Example |
| --- | --- | --- |
| HD (Supreme) | `NJA YYYY s. N` | `NJA 2020 s. 45` |
| HFD (Admin) | `HFD YYYY ref. N` | `HFD 2020 ref. 5` |
| HFD (old) | `RÅ YYYY ref. N` | `RÅ 2010 ref. 1` |
| AD (Labour) | `AD YYYY nr N` | `AD 2019 nr 45` |
| MÖD (Env) | `MÖD YYYY:N` | `MÖD 2018:3` |
| MIG (Migr) | `MIG YYYY:N` | `MIG 2017:1` |

## Acceptance Criteria

### AC1: Reference Detection Library

1. A `detectReferences(text)` function exists in `lib/linkify/` that detects SFS law, agency regulation, and court case reference patterns listed above
2. Returns structured data: matched text, normalized document number, start/end positions, content type
3. Overlapping matches are resolved (longest match wins)
4. Comprehensive unit tests cover all patterns, edge cases, and overlaps

### AC2: HTML-Aware Linkification Function

5. A `linkifyHtmlContent(html, slugMap, sourceDocNumber)` function processes HTML content using `cheerio` and injects `<a>` tags into text nodes only
6. Does NOT linkify inside existing `<a>` tags, `<code>` blocks, or HTML attributes
7. Self-references are excluded (a document does not link to itself, matched via `sourceDocNumber`)
8. References to documents not in the database are left as plain text
9. Links use correct routes via `getDocumentUrl()` (e.g., `/lagar/{slug}`, `/foreskrifter/{slug}`, `/rattsfall/{court}/{slug}`)
10. Links include `class="legal-ref"` and `title` attribute with the target document's title (HTML-attribute-escaped to prevent XSS)

### AC3: Slug Lookup Map

11. A utility builds an in-memory `document_number → { slug, content_type, title }` map from the database
12. Batch-fetched in a single query (no N+1)
13. Reusable across documents during bulk processing

### AC4: CrossReference Population

14. When linkifying, detected references are stored in the existing `CrossReference` table
15. `reference_type` is set to `REFERENCES`
16. `context` stores a text snippet surrounding the reference
17. Duplicate cross-references are handled gracefully (upsert)

### AC5: Ingestion Pipeline Integration

18. Linkification runs as a post-processing step: AFTER derived fields (`markdown_content`, `json_content`, `full_text`) are computed from unlinkified HTML, BEFORE the DB write stores the linkified `html_content`
19. Integrated into the SFS sync cron (`sync-sfs/route.ts`) for newly ingested laws
20. Integrated into the amendment sync cron (`sync-sfs-updates/route.ts`)
21. Integrated into the agency regulation pipelines (AFS scraper, agency PDF ingester)
22. Linkification is idempotent — achieved by stripping any existing `<a class="legal-ref">` tags before re-linkifying

### AC6: Backfill Migration Script

23. A `scripts/backfill-linkify.ts` script processes all existing documents with `html_content`
24. Processes in batches (e.g., 100 at a time) with progress logging
25. Populates both linkified `html_content` and `CrossReference` records
26. Safe to re-run (idempotent via strip-then-linkify)

### AC7: Fix `getDocumentUrl()` Coverage

27. `lib/prefetch/get-document-url.ts` is updated to handle `AGENCY_REGULATION` → `/foreskrifter/{slug}` and `SFS_AMENDMENT` → `/lagar/andringar/{slug}`

### AC8: Link Styling

28. `.legal-document a.legal-ref` CSS styles are added to `globals.css` with dotted underline, primary color, and solid underline on hover

## Tasks / Subtasks

- [x] **Task 1: Fix `getDocumentUrl()` gaps** (AC: 27)
  - [x] Add `AGENCY_REGULATION` → `/foreskrifter/{slug}` mapping
  - [x] Add `SFS_AMENDMENT` → `/lagar/andringar/{slug}` mapping
  - [x] Update `ContentTypeKey` type to include new types
  - [x] Add unit tests for new mappings

- [x] **Task 2: Build reference detection library** (AC: 1-4)
  - [x] Create `lib/linkify/detect-references.ts` with `DetectedReference` interface
  - [x] Implement SFS law pattern detection (with section/chapter extraction)
  - [x] Implement agency regulation pattern detection (`{PREFIX}FS YYYY:N`)
  - [x] Implement court case pattern detection (NJA, HFD, RÅ, AD, MÖD, MIG)
  - [x] Implement overlap resolution (longest match wins)
  - [x] Write comprehensive unit tests (~30-40 test cases)

- [x] **Task 3: Build slug lookup map utility** (AC: 11-13) — _Task 4 depends on this_
  - [x] Create `lib/linkify/build-slug-map.ts`
  - [x] Single-query fetch of all `{ document_number, slug, content_type, title }` from `LegalDocument`
  - [x] Return typed `Map<string, SlugMapEntry>`

- [x] **Task 4: Build HTML-aware linkification function** (AC: 5-10) — _Depends on Tasks 2 and 3_
  - [x] Create `lib/linkify/linkify-html.ts`
  - [x] Use `cheerio` to load HTML and walk text nodes only (skip `<a>`, `<code>`, `<script>`, `<style>`)
  - [x] For idempotency: strip existing `<a class="legal-ref">` tags (unwrap to text) before detecting references
  - [x] Run `detectReferences()` on each text node, inject `<a>` tags with correct href via `getDocumentUrl()`
  - [x] HTML-escape `title` attribute values to prevent XSS from document titles containing `"` or `<`
  - [x] Handle self-reference exclusion (accept `sourceDocNumber` param, skip matches against it)
  - [x] Handle missing documents gracefully (no link if not in slug map)
  - [x] Unit tests for HTML-aware processing, idempotency, self-ref exclusion, escaping

- [x] **Task 5: Implement CrossReference population** (AC: 14-17)
  - [x] Extract context snippet (~50 chars surrounding text) for each reference
  - [x] Upsert into `CrossReference` table with `reference_type = REFERENCES`
  - [x] Handle deduplication (unique on source+target pair)

- [x] **Task 6: Create barrel export** — _Convenience_
  - [x] Create `lib/linkify/index.ts` exporting public API (consistent with `lib/transforms/index.ts`)

- [x] **Task 7: Integrate into ingestion pipelines** (AC: 18-22)
  - [x] Add linkification step to `sync-sfs/route.ts` — linkify `htmlContent` before DB write (no derived fields in this pipeline)
  - [x] Add linkification step to `sync-sfs-updates/route.ts` — linkify AFTER `htmlToMarkdown`/`htmlToJson`/`htmlToPlainText`, BEFORE DB write
  - [x] Add linkification step to AFS scraping pipeline — same ordering as amendments
  - [x] Add linkification step to agency PDF ingestion pipeline — same ordering as amendments

- [x] **Task 8: Build backfill migration script** (AC: 23-26)
  - [x] Create `scripts/backfill-linkify.ts`
  - [x] Batch processing (100 docs at a time) with progress logging and ETA
  - [x] Populate both `html_content` and `CrossReference`
  - [x] Test on small subset (~100 docs) before full run
  - [x] Log stats: documents processed, references found, links created, cross-references upserted

- [x] **Task 9: Add link CSS styling** (AC: 28)
  - [x] Add `.legal-document a.legal-ref` styles to `globals.css`

## Dev Notes

### Relevant Source Tree

```
lib/prefetch/get-document-url.ts       — URL routing utility (needs AGENCY_REGULATION + SFS_AMENDMENT)
lib/transforms/                        — Existing HTML→markdown/json/plaintext transforms
lib/transforms/index.ts                — Barrel export pattern to follow
lib/linkify/                           — NEW: linkification library (to be created)
lib/linkify/index.ts                   — NEW: barrel export
lib/linkify/detect-references.ts       — NEW: reference pattern matching
lib/linkify/linkify-html.ts            — NEW: HTML-aware link injection
lib/linkify/build-slug-map.ts          — NEW: DB lookup map builder
app/api/cron/sync-sfs/route.ts         — SFS law ingestion cron (no derived fields)
app/api/cron/sync-sfs-updates/route.ts — Amendment ingestion cron (has derived fields at lines 458-463)
scripts/ingest-afs-regulations-v2.ts   — AFS HTML scraping pipeline
scripts/ingest-agency-pdfs.ts          — MSBFS/NFS PDF ingestion pipeline
app/globals.css                        — Legal document styles (.legal-document)
components/features/legal-document-card.tsx — Renders html_content via dangerouslySetInnerHTML
```

### Key Technical Details

- **Document scale**: **53,148 documents** with `html_content` (10,794 SFS laws, 24,930 SFS amendments, 5,571 EU regulations, 21 EU directives, 11,726 court cases, 106 agency regulations). 59,986 total documents (6,838 stubs without content). EU documents have `html_content` but will NOT be linkified in this story — they are only potential link targets.
- **HTML parsing**: Use `cheerio` for HTML text-node walking. Already a project dependency used in 7+ files under `lib/` (`afs-scraper.ts`, `afs-html-transformer.ts`, `afs-chapter-splitter.ts`, `llm-output-validator.ts`, `html-to-json.ts`, `html-to-markdown.ts`, `eurlex.ts`).
- **Pipeline ordering (critical)**: In `sync-sfs-updates/route.ts` (lines 458-463), derived fields are computed from `htmlContent` before the DB write. Linkification MUST run after those transforms so that `markdown_content`, `json_content`, `full_text` remain free of `<a>` tag markup. The pipeline becomes: `htmlContent` → derive fields → linkify → store linkified HTML + clean derived fields.
- **`sync-sfs/route.ts` is simpler**: It stores `html_content` directly without computing derived fields. Linkification runs on `htmlContent` before the write.
- **HTML sanitization**: The `/lagar/` page sanitizes with `sanitize-html` and allows `<a>` tags with `href`, `name`, `class` attributes — linkified content passes through correctly.
- **`getDocumentUrl()`** already handles SFS_LAW, court cases, and EU types. It needs AGENCY_REGULATION and SFS_AMENDMENT added (Task 1).
- **CrossReference model** exists in schema with `source_document_id`, `target_document_id`, `reference_type` (enum: CITES, IMPLEMENTS, AMENDS, REFERENCES, RELATED, LEGAL_BASIS), and `context`. Table is currently empty.
- **Idempotency mechanism**: Before running reference detection, strip all existing `<a class="legal-ref">...</a>` tags by unwrapping them back to their text content. This makes the function safe to re-run on already-linkified content.

### Edge Cases

1. **Self-references**: A law referencing itself → skip (match `sourceDocNumber` param against detected `documentNumber`)
2. **Already-linkified content**: Strip existing `<a class="legal-ref">` tags (unwrap to text) before re-linkifying. This is the idempotency guarantee.
3. **References inside footnotes**: Footnotes contain legislative references (Prop, Bet, Rskr) — these are a separate concern and out of scope for this story.
4. **Bare `YYYY:NNNN`**: Intentionally excluded from SFS matching to avoid false positives (dates, other numbering).
5. **Agency regulation stubs**: ~6,838 stub records have no `html_content` — these won't be linkified but CAN be link targets if their `document_number` matches a detected reference.
6. **Title attribute escaping**: Document titles may contain `"`, `<`, `&`, etc. Always HTML-attribute-escape the `title` value when building the `<a>` tag.

### Sample Input/Output

**Input HTML** (from a law's `html_content`):
```html
<p>Bestämmelser om arbetstid finns i arbetstidslagen (1982:673).
Arbetsgivaren ska följa föreskrifterna i AFS 2001:1 om systematiskt
arbetsmiljöarbete. Se även AD 2019 nr 45.</p>
```

**Output HTML** (after linkification):
```html
<p>Bestämmelser om arbetstid finns i <a href="/lagar/arbetstidslag-1982-673" class="legal-ref" title="Arbetstidslag (1982:673)">arbetstidslagen (1982:673)</a>.
Arbetsgivaren ska följa föreskrifterna i <a href="/foreskrifter/afs-2001-1" class="legal-ref" title="Systematiskt arbetsmiljöarbete">AFS 2001:1</a> om systematiskt
arbetsmiljöarbete. Se även <a href="/rattsfall/ad/ad-2019-nr-45" class="legal-ref" title="AD 2019 nr 45">AD 2019 nr 45</a>.</p>
```

**Input with existing links** (idempotent re-run):
```html
<p>Se <a href="/lagar/old-slug" class="legal-ref" title="Old">lagen (2012:295)</a>.</p>
```

**Output** (stripped and re-linked with current slug):
```html
<p>Se <a href="/lagar/current-slug" class="legal-ref" title="Current Title">lagen (2012:295)</a>.</p>
```

### Testing

- **Test location**: `tests/unit/lib/linkify/`
- **Framework**: Vitest (consistent with existing test setup)
- **Key test files**:
  - `detect-references.test.ts` — pattern matching for SFS, agency regs, court cases; overlaps; edge cases
  - `linkify-html.test.ts` — HTML-aware processing, idempotency (strip+re-link), self-reference exclusion, missing doc handling, title escaping, nested HTML structures
  - `build-slug-map.test.ts` — map construction (mock Prisma)
- **Test patterns**: Use inline HTML fixtures, not file-based. Mock Prisma for DB-dependent tests.
- **Integration testing**: Manual verification via the backfill script on a small subset (~100 docs) before full run.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- cheerio `decodeEntities: false` option not exposed in TypeScript types — resolved with `as any` cast
- cheerio DOM types (`AnyNode`, `Text`, `Element`) not re-exported — resolved by adding `domhandler` as direct dependency
- cheerio entity handling with `decodeEntities: false`: angle brackets in quoted attributes are valid HTML and safe, no XSS risk

### Completion Notes List

- All 9 tasks implemented and passing
- 63 new unit tests across 3 test files (detect-references: 32, linkify-html: 27, build-slug-map: 4)
- TypeScript compiles clean (`npx tsc --noEmit` passes)
- 20 pre-existing test failures in full regression (unrelated to linkification: workspace-switcher UI, content-type badge colors, etc.)
- Backfill script supports `--dry-run` and `--limit N` flags for safe testing
- `domhandler@5.0.3` added as direct dependency (was already transitive via cheerio)

### File List

**New files:**
- `lib/linkify/detect-references.ts` — Reference pattern matching (SFS, agency regs, court cases)
- `lib/linkify/build-slug-map.ts` — DB lookup map builder
- `lib/linkify/linkify-html.ts` — HTML-aware link injection with cheerio
- `lib/linkify/save-cross-references.ts` — CrossReference table population
- `lib/linkify/index.ts` — Barrel export
- `scripts/backfill-linkify.ts` — Backfill migration script
- `tests/unit/lib/linkify/detect-references.test.ts` — 32 tests
- `tests/unit/lib/linkify/linkify-html.test.ts` — 27 tests
- `tests/unit/lib/linkify/build-slug-map.test.ts` — 4 tests

**Modified files:**
- `lib/prefetch/get-document-url.ts` — Added AGENCY_REGULATION and SFS_AMENDMENT mappings
- `tests/unit/lib/prefetch/get-document-url.test.ts` — Added tests for new mappings
- `app/api/cron/sync-sfs/route.ts` — Integrated linkification before DB write
- `app/api/cron/sync-sfs-updates/route.ts` — Integrated linkification after derived fields
- `scripts/ingest-afs-regulations-v2.ts` — Integrated linkification into AFS pipeline
- `scripts/ingest-agency-pdfs.ts` — Integrated linkification into agency PDF pipeline
- `app/globals.css` — Added `.legal-document a.legal-ref` CSS styles
- `package.json` — Added `domhandler` dependency

## QA Results

**Reviewer:** Quinn (Test Architect)
**Date:** 2026-02-13
**Gate Decision:** PASS

### Requirements Traceability

| AC | Sub-criteria | Status | Evidence |
|----|-------------|--------|----------|
| AC1 | detectReferences() exists in lib/linkify/ | PASS | `lib/linkify/detect-references.ts:110` |
| AC1 | Returns structured data (matchedText, documentNumber, start/end, contentType) | PASS | `DetectedReference` interface lines 9-26 |
| AC1 | Overlapping matches resolved (longest wins) | PASS | `resolveOverlaps()` lines 161-189, test at line 263 |
| AC1 | Comprehensive unit tests | PASS | 41 tests in detect-references.test.ts |
| AC2 | linkifyHtmlContent() uses cheerio, injects into text nodes only | PASS | `lib/linkify/linkify-html.ts:93-131`, processNode() walks text nodes |
| AC2 | Skip existing `<a>`, `<code>`, `<script>`, `<style>`, `<pre>` | PASS | SKIP_TAGS set line 21, tests lines 123-153 |
| AC2 | Self-reference exclusion | PASS | resolveLink() line 142, tests lines 184-203 |
| AC2 | Missing docs = plain text | PASS | resolveLink() returns null line 146, tests lines 205-225 |
| AC2 | Correct routes via getDocumentUrl() | PASS | resolveLink() line 151 |
| AC2 | class="legal-ref" + title attribute with XSS escaping | PASS | buildLinkHtml() line 170, escapeAttr() lines 40-46, tests lines 228-283 |
| AC3 | In-memory slug map from single query | PASS | `build-slug-map.ts`, 4 tests |
| AC4 | CrossReference population | PASS | `save-cross-references.ts`, delete+createMany transaction |
| AC4 | reference_type = REFERENCES | PASS | Line 78 |
| AC4 | Context snippets | PASS | extractContext() lines 14-26 |
| AC4 | Deduplication | PASS | seen Set lines 47-62 |
| AC5 | Pipeline ordering (linkify AFTER derived fields) | PASS | sync-sfs-updates: confirmed at line 471, AFS: line 127, agency PDFs: line 299 |
| AC5 | Integrated into sync-sfs | PASS | sync-sfs/route.ts line 343 |
| AC5 | Integrated into sync-sfs-updates | PASS | sync-sfs-updates/route.ts line 471 |
| AC5 | Integrated into AFS + agency PDF pipelines | PASS | ingest-afs-regulations-v2.ts lines 127,211,250; ingest-agency-pdfs.ts line 299 |
| AC5 | Idempotent (strip then relink) | PASS | Step 1 strips `a[href]:not(.paragraf)`, Step 2 re-parses, Step 3 re-linkifies. Test at line 176 |
| AC6 | Backfill script with batch processing | PASS | `scripts/backfill-linkify.ts`, BATCH_SIZE=100 |
| AC6 | Progress logging + ETA | PASS | Lines 169-179 |
| AC6 | Populates html_content + CrossReference | PASS | Lines 137-149 |
| AC6 | Idempotent re-run | PASS | strip-then-relink via linkifyHtmlContent |
| AC7 | AGENCY_REGULATION → /foreskrifter/{slug} | PASS | get-document-url.ts updated |
| AC7 | SFS_AMENDMENT → /lagar/andringar/{slug} | PASS | get-document-url.ts updated |
| AC8 | CSS styles for .legal-ref | PASS | globals.css: dotted underline, primary color, solid on hover |

**Coverage: 28/28 sub-criteria PASS**

### Code Quality Assessment

**Strengths:**
- Clean separation of concerns: detect → resolve → linkify → save
- Robust overlap resolution algorithm with correct longest-match-wins semantics
- Proper HTML escaping (escapeAttr, escapeText) prevents XSS via document titles
- Text node merging after link stripping (re-parse step) solves real-world compound name splitting
- `isContentTypeMatch()` correctly handles SFS_AMENDMENT ↔ SFS_LAW compatibility
- Stycket ordinals support handles Swedish legal citation conventions properly
- Hyphenated agency prefix support (ELSÄK-FS, SCB-FS) with optional hyphen in regex
- `decodeEntities: false` preserves Swedish characters through cheerio round-trip

**No issues found.**

### Test Architecture Assessment

- **83 tests** across 3 test files (detect-references: 41, linkify-html: 38, build-slug-map: 4)
- **Pattern coverage**: SFS laws (14 tests), agency regulations (7 tests), court cases (6 tests), mixed (2 tests), overlaps (2 tests), edge cases (7 tests) — plus compound names, stycket, section deep-linking
- **HTML awareness**: Skip tags (5 tests), idempotency (2 tests), self-ref (2 tests), missing docs (2 tests), title escaping (3 tests), Riksdagen stripping (4 tests), deep-linking (3 tests), compound names (3 tests)
- **Mocking**: Prisma properly mocked in build-slug-map tests
- **Test quality**: Good use of helper functions (docNumbers, createSlugMap), clear test names, comprehensive edge cases

### NFR Assessment

| NFR | Status | Notes |
|-----|--------|-------|
| Security | PASS | XSS prevented via escapeAttr/escapeText, no user input reaches DB unsanitized |
| Performance | PASS | Single-query slug map, batch processing, no N+1 queries |
| Reliability | PASS | Idempotent operation, graceful handling of missing docs, error handling in backfill |
| Maintainability | PASS | Clean module boundaries, typed interfaces, barrel exports |

### Observations (informational, not blocking)

1. **Story file metadata drift**: File List shows "32 tests" for detect-references and "27 tests" for linkify-html — actual counts are 41 and 38 respectively (post-enhancement). Completion Notes say "63 new unit tests" — actual is 83. This is cosmetic and does not affect code quality.
2. **Pre-existing test failures**: Story notes 20 pre-existing failures unrelated to linkification — these are not regressions from this story.

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2025-12-25 | 1.0 | Initial backlog draft with pattern analysis and code examples | James (Dev) |
| 2026-02-13 | 2.0 | Refined to proper story format. Fixed routes (use `getDocumentUrl()`), added agency regulation patterns, corrected document count, added `getDocumentUrl()` fix as prerequisite, included CrossReference population, structured tasks/subtasks | Sarah (PO) |
| 2026-02-13 | 2.1 | Validation fixes: Resolved derived fields ordering (linkify AFTER transforms), specified cheerio for HTML parsing, deferred EU linkification to follow-up story, added idempotency mechanism (strip-then-relink), added title attribute escaping requirement, explicit task dependencies (3→4), added sample input/output, added barrel export task, added Dev Agent Record and QA Results stubs | Sarah (PO) |
| 2026-02-13 | 3.0 | Implementation complete. All 9 tasks done. 63 new unit tests, TypeScript clean, 4 pipeline integrations, backfill script with dry-run support, CSS styling added. | James (Dev) |
