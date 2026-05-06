# Epic 24: Import Befintlig Laglista — Brownfield Enhancement

**Goal:** Add a self-serve import pipeline that lets switchers bring an existing curated law list (Notisum / Lex.nu / JP Infonet / Ramboll / consultant Excel / internal spreadsheet) into Laglig in minutes, using fuzzy + LLM matching against our SFS/AFS/EU catalog with a 24-hour manual-ingest SLA for documents not yet in the catalog. Surfaced both at first-run onboarding (via Epic 25) and via an in-app "create new list" flow for existing users mid-contract.

**Value Delivered:** Today every Swedish lagbevakning prospect arrives with one of three artefacts — a Notisum/Lex.nu Excel export, a consultant-delivered list, or an internal spreadsheet — and Laglig has zero path for any of them. Switchers either abandon onboarding (highest-conversion lane lost), complete onboarding with a generated list that doesn't match the curated one and spend hours diffing, or contact support for a non-existent import workflow. This epic removes the single biggest objection in the switcher conversation — "I can't easily move my list" — and turns each import into a catalog-coverage feedback loop: the more switchers we onboard, the more our catalog converges on Swedish market need.

**Delivers:**
- New schema layer: `LawListImport` aggregate (workspace-scoped, status state machine `UPLOADED → PARSED → MATCHING → AWAITING_REVIEW → COMMITTED | FAILED`), `LawListImportRow` per-row staging with confidence scores + matched-document FK + user decision; `CatalogIngestRequest` queue for unmatched rows with workspace + source-row text + ops handler FK + 24h SLA timestamp
- Excel/CSV parser at `lib/import/parser.ts` with column auto-detect heuristics (titel / SFS-nummer / område / lagansvarig / kommentar) + paste-input fallback for users copying from competitor tools without exporting
- Matching engine at `lib/import/matcher.ts` — two-stage: fuzzy candidate retrieval against `LegalDocument` index (top-K via SFS-number normalisation + title trigram), then LLM disambiguation pass (Claude Sonnet) returning per-row `{matched_doc_id, confidence: 0..1, reasoning}` with structured output
- Server actions in `app/actions/law-list-import.ts` for the import lifecycle: `createImport`, `parseImportFile`, `runMatching`, `acceptRow`, `replaceRowMatch`, `rejectRow`, `commitImport`, `requestCatalogAdd`
- Review UI at `app/(workspace)/laglistor/skapa/[importId]/granska/page.tsx` — full-page surface (NOT a modal), per-row decisions with confidence-tier grouping (high / needs-confirmation / unmatched), candidate-picker for ambiguous rows, side-by-side source-row vs matched-doc preview, batch accept-all-high CTA
- "Request to add" queue admin surface at `app/admin/(dashboard)/catalog-requests/page.tsx` — list + assign + mark-fulfilled flow for ops to ingest unmatched documents within the 24h SLA
- In-app `/laglistor/skapa` (create-list) page rewire — Generate / Import option fork, mirroring the path-choice in Epic 25's onboarding modal
- Email notification on import completion (review ready) and on catalog-request fulfilment

**Requirements covered:** Brief at `docs/import-law-list-brief.md`. Closes the largest single objection in the switcher conversation. Adjacent: Epic 4 (onboarding) — provides the wizard substrate; Epic 6 (Compliance Workspace) — provides `LawList` and `LawListItem` models the import writes into.

**Estimated stories:** 6

**Dependencies:**
- **Epic 6** (Compliance Workspace Kanban — Done): provides `LawList`, `LawListItem`, `LawListItemRequirement` models that the import commits into. Hard dependency.
- **Epic 17** (Document Management — Partial): `LegalDocument` index is the matching target. Hard dependency.
- **Epic 4** (Onboarding — Done): `/laglistor/skapa` exists as the create-list entry point; this epic adds the import branch to it.
- **Epic 11** (Admin shell — Done): hosts the catalog-requests admin page.
- **Epic 14** (Agent / LLM tooling — Done): provides the Anthropic SDK setup, model selection, prompt-caching pattern (Story 14.26), and cost-estimator (Story 14.27) reused by the matcher.

**Priority:** High — switcher lane is the highest-conversion conversion lane (prospects already have budget allocated and a buying process running). Epic 24 ships before Epic 25 because the import pipeline has standalone value via the in-app create-list page; existing users mid-contract migrating from competitors don't need the onboarding wrapper. Token-savings rationale also applies here (Epic 25's B.0 gate stops auto-firing generation for users who'd rather import).

**Source artefacts:**
- `docs/import-law-list-brief.md` — strategic brief (drafted 2026-04-22)
- `_prototypes/onboarding-tutorial-modal.html` — visual reference for the path-choice card (frame ①) and the import upload step (frame ②b) and the import done-state confidence breakdown (frame ④b). The review surface itself (granska/) is **not** in the prototype — that's a focused full-page UI, scoped in Story 24.4.

---

## Epic Goal

Ship a self-serve import pipeline that resolves user-supplied law lists (Excel / CSV / paste) against the Laglig catalog with high-confidence direct matches, human-confirmed ambiguous matches, and a 24h ops loop for unmatched rows — surfaced both at first-run onboarding (via Epic 25) and as a path on `/laglistor/skapa` for existing users.

## Epic Description

### Existing System Context

- **Current relevant functionality:** `/laglistor/skapa` exists as a create-list flow that today only supports the Generate path (template-driven with optional AI customisation). `LawList` and `LawListItem` are the destination models; import will write directly into them once committed. `LegalDocument` is the canonical catalog (SFS + AFS + EU rättsakter + föreskrifter), already richly indexed for search and used by `/browse/lagar`. No import or review UI exists today.
- **Technology stack (this area):** Next.js 14 App Router, React 18, TypeScript, Tailwind, shadcn/ui, Prisma 5 + PostgreSQL (Supabase), SWR for client cache. SheetJS (`xlsx` package — to be added) for Excel parsing, `papaparse` (to be added) for CSV. Anthropic SDK with prompt caching (Story 14.26) for LLM disambiguation. `lib/anthropic-client.ts` is the existing wrapper.
- **Integration points:**
  - `prisma/schema.prisma` — additive: `LawListImport`, `LawListImportRow`, `CatalogIngestRequest` models + 3 enums (`ImportStatus`, `RowMatchStatus`, `CatalogRequestStatus`)
  - `app/actions/law-list-import.ts` — NEW (entire file)
  - `app/(workspace)/laglistor/skapa/page.tsx` — modify: add Generate / Import path fork
  - `app/(workspace)/laglistor/skapa/[importId]/granska/page.tsx` — NEW
  - `lib/import/parser.ts` — NEW
  - `lib/import/matcher.ts` — NEW (consumes `lib/anthropic-client.ts`)
  - `lib/legal-document/search.ts` — extend with `findMatchCandidates(text, sfsNumber?)` for fuzzy retrieval (additive function, existing search untouched)
  - `app/admin/(dashboard)/catalog-requests/page.tsx` — NEW (admin list + detail view)
  - `emails/import-review-ready.tsx`, `emails/catalog-request-fulfilled.tsx` — NEW
  - `lib/usage/cost-estimator.ts` — extend `PRICING` map if needed (matcher uses Sonnet, already covered)

### Enhancement Details

- **What's being added/changed:**
  1. **Schema layer** — three new models, additive only. No existing column dropped.
  2. **Parser** — file upload (xlsx / xls / csv, max 5 MB) + paste fallback. Auto-detects column meaning from headers + content sniffing. Returns normalised rows.
  3. **Matcher** — two-stage. Stage 1: fuzzy retrieval against `LegalDocument` (SFS-number normalisation, title trigram via existing search infra). Stage 2: LLM disambiguation pass for ambiguous candidates, returning structured JSON with confidence + reasoning. Aggregates per-row.
  4. **Review UI** — full-page surface at `/laglistor/skapa/[importId]/granska`. Three confidence tiers visible at a glance (`Hög` / `Behöver bekräftelse` / `Saknas i katalogen`). Per-row actions: accept match, replace with another candidate, reject, request catalog add (for unmatched rows). Batch "accept all high" CTA. Side-by-side preview when picking among candidates.
  5. **Commit flow** — on user confirmation, accepted rows write into `LawListItem`, rejected rows are dropped, "request catalog add" rows enqueue `CatalogIngestRequest` for ops with 24h SLA timestamp. Email notification.
  6. **Catalog-requests admin surface** — ops sees list of pending requests with workspace + source row + age. Mark fulfilled when document is ingested into the catalog. Triggers re-match attempt on the original import row + email to user.
  7. **`/laglistor/skapa` rewire** — adds the Import branch as a first-class option alongside Generate. Existing users mid-contract use this surface; new users go through Epic 25's onboarding modal which routes to the same import pipeline.
- **How it integrates:**
  - **Schema additions are purely additive.** No existing model is modified. `LawList` and `LawListItem` are written to only on commit, using the existing creation pattern.
  - **Matching uses existing LLM infra** — same client, same prompt-caching pattern, same telemetry (`ChatUsageEvent` rows logged via the existing `onFinish` callback if we route through `streamText`, OR a new `ImportMatchEvent` if the matcher uses a one-shot call — TBD in Story 24.3).
  - **Review UI is a new full-page route**, no impact on existing surfaces.
  - **Admin surface is additive** — new sidebar entry, no modification to existing admin pages.
- **Success criteria (measurable):**
  - A user with a 50-row Notisum-export Excel can complete the upload → review → commit flow in under 5 minutes for the high-confidence subset.
  - At least 70% of typical Swedish-lawlist rows match at "high" confidence on first pass (validated against a sample set of 5 real customer Excels).
  - Unmatched rows produce a `CatalogIngestRequest` that is visible in the admin queue within seconds.
  - Ops can mark a request fulfilled and the originating user gets an email within minutes; the source row is automatically re-matched against the now-ingested document.
  - Zero data leakage between workspaces — `LawListImport` rows are scoped via the existing workspace RLS pattern.
  - Existing `/laglistor/skapa` Generate path is unchanged in behaviour and tests.

---

## Stories

### Story 24.1 — Schema + server-action skeleton

**Scope:** Schema migration + Zod schemas + server-action stubs. **No UI.**

- New Prisma models per §Integration points. Three enums (`ImportStatus`, `RowMatchStatus`, `CatalogRequestStatus`).
- One migration: `add_law_list_import`. Includes RLS policies mirroring `LawList`'s pattern.
- Zod schemas in `lib/validation/law-list-import.ts` for the upload payload, row decision payload, catalog-request payload.
- `app/actions/law-list-import.ts` skeleton with eight server actions stubbed (return `{success: false, error: 'NOT_IMPLEMENTED'}`). Each action wraps in `withWorkspace(cb, 'tasks:edit')`. Real implementations land in 24.2–24.5.
- Vitest unit tests for the Zod schemas + an integration test that creates an import row and verifies workspace-scoped read.

**Definition of Done:**
- [ ] Three new Prisma models + three enums added; migration applied locally + on staging
- [ ] RLS policies pass `pgtap` or equivalent workspace-isolation tests
- [ ] All eight server actions stubbed with `withWorkspace` wrapping
- [ ] Zod schemas compile + accept the brief's example Excel row format
- [ ] Existing tests pass (no regression)

---

### Story 24.2 — File upload + parser + paste fallback

**Scope:** Parser library + the upload step UI. **Matching not yet wired** — uploaded files land in `UPLOADED` status with parsed rows visible in a placeholder preview.

- Add deps: `xlsx` (SheetJS) + `papaparse`. Both are MIT-licensed; verify with project policy.
- `lib/import/parser.ts`:
  - `parseExcel(buffer): ParsedRow[]` — first sheet, first 1000 rows, headers detected
  - `parseCsv(text): ParsedRow[]` — auto-detect delimiter
  - `parsePaste(text): ParsedRow[]` — line-per-row with delimiter sniffing
  - `detectColumns(rows): ColumnMapping` — heuristic mapping from header names + content patterns to canonical fields (`titel`, `sfs_nummer`, `omrade`, `lagansvarig`, `kommentar`). Confidence per mapping; user can override in the upload step.
- Dropzone component reusing the design from `_prototypes/onboarding-tutorial-modal.html` frame ②b. Fil/Klistra-in toggle. "Vi känner igen dessa kolumner" hint. Mall-download (a static `.xlsx` file in `/public/templates/`).
- `parseImportFile` server action implements full parser + writes `LawListImportRow` rows in `UPLOADED` state with the detected column mapping.
- Unit tests: round-trip test with 5 sample files (one per source: Notisum export, Lex.nu export, consultant Excel, internal spreadsheet, paste input).

**Definition of Done:**
- [ ] Parser handles xlsx, xls, csv, paste — 5 sample files round-trip correctly
- [ ] Column auto-detect achieves correct mapping on at least 4 of 5 samples without user override
- [ ] Upload step UI matches prototype (dropzone, paste tab, mall-download link)
- [ ] Server action persists rows with detected mapping
- [ ] Max file size enforced at 5 MB
- [ ] Existing tests pass

---

### Story 24.3 — Matching engine (fuzzy + LLM)

**Scope:** Matcher library + the matching server action. **Review UI deferred to 24.4** — matched rows land in `AWAITING_REVIEW` with confidence + candidate list visible via API.

- `lib/legal-document/search.ts` — extend with `findMatchCandidates(text, sfsNumber?, limit=5): MatchCandidate[]`. Combines SFS-number exact normalisation (e.g., "SFS 1998:808" ≡ "1998:808") with title trigram similarity. Returns top-K with raw similarity scores.
- `lib/import/matcher.ts`:
  - `matchRow(parsedRow): MatchResult` — Stage 1 fuzzy retrieval, Stage 2 LLM disambiguation (Anthropic Sonnet, structured output, prompt-cached system message)
  - Returns `{matched_doc_id: string | null, confidence: 'high' | 'medium' | 'unmatched', candidates: [...], reasoning: string}`
  - Confidence tiering: ≥0.85 = high; 0.5–0.85 = medium; <0.5 = unmatched
  - Deterministic re-runnable: same input → same output (caching keyed on row hash)
- LLM prompt at `lib/import/matcher-prompt.ts` — Swedish, structured JSON output schema, examples for ambiguous Swedish-law titles.
- `runMatching(importId)` server action — iterates `UPLOADED` rows, calls `matchRow` per row in batches of 10 (parallelised with `Promise.all`), writes results to `LawListImportRow.matched_document_id` + `confidence_tier` + `match_reasoning`. Sets import status to `AWAITING_REVIEW` on completion.
- Telemetry: each `matchRow` call records token counts via the existing cost-estimator and writes a `ChatUsageEvent` row with `context_type='import_matching'`.
- Manual smoke: feed 50-row sample Excel, verify ≥70% high-confidence on first pass.

**Definition of Done:**
- [ ] `findMatchCandidates` returns top-5 with stable scores on a benchmark fixture
- [ ] `matchRow` produces structured output for all 5 sample files in 24.2
- [ ] At least 70% of rows in the benchmark land in `high` tier
- [ ] Token usage telemetry recorded with correct `context_type`
- [ ] Cache hit rate measurable on second run of the same import
- [ ] Unit tests cover all three confidence tier branches
- [ ] Existing tests pass

---

### Story 24.4 — Review surface (full-page, per-row decisions)

**Scope:** Full-page review UI + per-row decision actions + commit flow. This is the user-facing surface where switchers actually approve their list.

- Route: `app/(workspace)/laglistor/skapa/[importId]/granska/page.tsx`
- Layout: `PageHeader` (title: "Granska matchningar för \[filename\]", meta: row counts per tier) + `TableToolbar` (filter chips: "Alla / Hög / Behöver bekräftelse / Saknas") + virtualised table (TanStack Virtual) for >50 rows
- Per-row UI:
  - Source row (titel / SFS / kommentar) on left
  - Matched doc preview on right (when present)
  - Confidence pill (`success` / `warning` / `danger` tones via Epic 22's badge primitives)
  - Action buttons: Acceptera / Byt matchning ▾ (opens candidate picker dropdown) / Avvisa / Begär tillägg (only for unmatched)
- Server actions wire up: `acceptRow`, `replaceRowMatch`, `rejectRow`, `requestCatalogAdd`
- `commitImport(importId)` server action — writes accepted rows into `LawList` + `LawListItem`, enqueues catalog requests for "begär tillägg" rows, sends `import-review-ready.tsx` email follow-up if user navigates away mid-review (deferred 24h reminder).
- Empty state when import has zero rows (defensive — shouldn't happen but graceful).
- Confidence breakdown card (mirrors prototype frame ④b) at top: "98 hög / 14 bekräftelse / 8 saknas" — clickable to filter.
- Batch action: "Acceptera alla höga" (only enabled when `pendingHighCount > 0`).

**Definition of Done:**
- [ ] Review page renders for a 50+ row import in <2s on staging
- [ ] All four per-row actions work and persist correctly
- [ ] Batch accept-all-high works idempotently
- [ ] Commit transitions import status to `COMMITTED`, writes correct `LawList` + `LawListItem` rows
- [ ] "Begär tillägg" rows produce correct `CatalogIngestRequest` entries
- [ ] Empty state + error states render
- [ ] Visual matches prototype frame ④b (where applicable)
- [ ] Existing tests pass

---

### Story 24.5 — Catalog-requests admin queue

**Scope:** Admin surface for ops to fulfil unmatched-row requests within the 24h SLA. Auto-rematch on fulfilment.

- Route: `app/admin/(dashboard)/catalog-requests/page.tsx`
- Listing: workspace + source row text + requested-at age (red >24h, amber 12–24h, green <12h) + assigned ops handler + status pill
- Detail panel: full source row context (workspace name, originating import filename, all source columns) + free-text admin note field + "Mark as fulfilled" CTA + "Reject as duplicate" CTA
- On "fulfilled": admin enters the `LegalDocument.id` they ingested. Server action validates the doc exists, sets `CatalogIngestRequest.fulfilled_at`, re-runs `matchRow` on the original `LawListImportRow`, sends `catalog-request-fulfilled.tsx` email to the workspace owner.
- On "rejected as duplicate": ops marks status `REJECTED`, optional reason, no email.
- Sidebar nav entry under existing admin sidebar group ("Innehåll" or new "Operations" group — defer to admin sidebar pattern).
- 24h SLA breach indicator + count visible on admin dashboard home.

**Definition of Done:**
- [ ] Queue lists pending requests sorted by age (oldest first)
- [ ] Fulfilment flow works end-to-end on staging (test request created, fulfilled, email sent, row re-matched)
- [ ] SLA-breach indicator turns red at >24h
- [ ] Permission gate: only OWNER role on the laglig.se admin workspace can act
- [ ] Existing admin pages unchanged
- [ ] Existing tests pass

---

### Story 24.6 — `/laglistor/skapa` rewire (Generate / Import fork)

**Scope:** Add the Import branch as a first-class path on the existing in-app create-list page. **No new logic** — wires the existing pipeline (Stories 24.2–24.4) into the create-list entry point.

- Modify `app/(workspace)/laglistor/skapa/page.tsx`: add a path-choice step matching Epic 25's onboarding modal frame ① (two cards — Generera / Importera). Route to existing Generate flow OR to new `[importId]/upload` step.
- Reuse the upload component from Story 24.2; reuse the review page from Story 24.4 unchanged.
- Empty-state copy update: "Skapa ny lista" page now hints "Du kan generera, importera eller bygga manuellt" upfront.
- Test: existing Generate flow works unchanged; new Import flow lands on the review page after matching completes.

**Definition of Done:**
- [ ] `/laglistor/skapa` shows path-choice on entry
- [ ] Generate path unchanged in behaviour + tests
- [ ] Import path completes upload → matching → review without leaving the create-list flow
- [ ] Existing tests pass; new tests cover the path-choice branch

---

## Compatibility Requirements

- [x] Existing `/laglistor/skapa` Generate flow unchanged (verified in 24.6 acceptance)
- [x] Existing `LawList` and `LawListItem` schemas unchanged (additive write only)
- [x] Existing `LegalDocument` schema unchanged (read-only)
- [x] No existing API routes modified (all additions are new server actions)
- [x] LLM cost reflected in `ChatUsageEvent` telemetry with `context_type='import_matching'` for admin visibility
- [x] No regression in workspace RLS isolation (new tables follow existing pattern)

## Risk Mitigation

- **Primary Risk:** Matching accuracy below 70% on real customer files would force users into many manual decisions and erode the value prop. Mitigation: benchmark against 5 real Excels in Story 24.3 acceptance; if accuracy is lower, iterate on the LLM prompt before shipping 24.4. Catalog gaps are a separate failure mode addressed by the 24h SLA queue.
- **Secondary Risk:** LLM disambiguation costs balloon at scale. Mitigation: prompt-caching is already proven (Story 14.26); cost-per-row estimate documented in 24.3; admin telemetry surfaces `import_matching` context type for cost visibility.
- **Tertiary Risk:** Schema migration locks tables on a busy production workspace. Mitigation: all new tables are additive (no existing-table modifications), migration runs in seconds.
- **Rollback Plan:** Feature flag the path-choice on `/laglistor/skapa` (off → Generate-only) and the Epic 25 path-choice modal. Schema additions stay (cheap to keep, costly to drop and re-add). LLM matcher can be disabled via flag if cost runs hot.

## Definition of Done

- [ ] All 6 stories completed with acceptance criteria met
- [ ] At least one switcher imports a real list end-to-end on staging without support intervention
- [ ] Catalog-request 24h SLA documented in ops runbook
- [ ] Cost-per-import estimate documented based on 24.3 telemetry
- [ ] No regression in existing `/laglistor/skapa` Generate flow
- [ ] No regression in workspace RLS isolation tests
- [ ] Existing test suite passes
