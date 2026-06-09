# Epic 17 Addendum: Dual-Version Document Visibility — Brownfield Enhancement

> ## ✅ EPIC CLOSED — 2026-06-04
>
> **All 3 stories Done.** Trilogy shipped in 2 days (drafted 2026-06-03; closed 2026-06-04).
>
> | Story | Status | QA Gate | Quality |
> |---|---|---|---|
> | **17.16** — Dual-Version Data Model + Dispatch Refactor (foundation) | ✅ Done (`docs/stories/completed/`) | PASS | 92 |
> | **17.17** — Styrdokument Table + Doc Page Dual-Version UX | ✅ Done (`docs/stories/completed/`) | PASS | 96 |
> | **17.18** — Agent Reads + Citation Routing Under the Dual-Version Model | ✅ Done (`docs/stories/completed/`) | PASS | 95 |
>
> **Compliance contract restored end-to-end.** The 17.10b DEC-2 invariant (*"the agent never cites a DRAFT as canonical policy"*) now holds under Model B: approved policy stays visible + searchable + correctly citable throughout every revision window; in-progress drafts surface as a secondary signal with the `[Utkast: X (utkast vN)]` pill and explicit "ett pågående utkast föreslår" framing. Owner live smoke against Supabase production data validated all three load-bearing checks (alias-freeze invariant via SQL on 17.16; composite badge + Skicka/Godkänn/Neka/Förkasta flow on 17.17; self-healing chunk migration + DEC-2 LLM hold across 3 adversarial prompt phrasings on 17.18).
>
> **Story 17.11c (agent auto-branch on APPROVED)** remains as a separate follow-up — PO can draft it now that the foundation + UX + agent surface are all stable. The original ~50-line scope estimate still holds; 17.11c becomes trivial against the corrected Model B foundation.
>
> ---

**Goal:** Replace the single-pointer `WorkspaceDocument` versioning model (status-flipping on revision) with a dual-pointer model where the currently-effective approved version AND the currently-in-progress draft are first-class, concurrently queryable states — so compliance documents remain visible, searchable, and accurately citable throughout their revision lifecycle.

**Value Delivered:** Today, when a user revises an APPROVED styrdokument via "Skapa nytt utkast", `createDraftFromApproved` flips `status: APPROVED → DRAFT`, repoints `current_version_id` to the new draft, NULLs `approved_by`/`approved_at`, and deindexes the document from search. The previously-effective approved policy disappears from the table, the doc page, search results, and the agent's citation grounding for the entire duration of the draft window. This violates the core compliance-domain expectation that *"what's currently in force"* must be answerable at every moment — and actively degrades the AI agent's value proposition (its `[Källa:]` citations regress to `[Utkast:]` workspace-wide during any revision). This epic encodes the dual state correctly: effective approved version stays visible and searchable, draft in progress is its own state with its own indicators, and the agent grounds its answers in the right version with the right confidence signal.

**Delivers:**
- Schema additions on `WorkspaceDocument`: `current_approved_version_id` (`@unique`, nullable), `current_draft_version_id` (`@unique`, nullable), `draft_status` (enum: `DRAFT` / `IN_REVIEW`, nullable). Two pointers, two independent state machines.
- Schema additions on `WorkspaceDocumentVersion`: `approved_at` (`DateTime?`), `approved_by` (`String?`), `superseded_at` (`DateTime?`) — per-version audit timestamps that enable historical "what policy was in effect on date X" queries cleanly without joining `ActivityLog`.
- Backfill migration covering three pre-existing data shapes: (a) `status=APPROVED` rows → populate `current_approved_version_id` from `current_version_id`; (b) `status=DRAFT/IN_REVIEW` with a prior APPROVED version in history → split pointers; (c) `status=DRAFT/IN_REVIEW` never-approved → only `current_draft_version_id` populated.
- Refactor of `createDraftFromApproved` (`app/actions/documents.ts:823`): create the new version, set `current_draft_version_id` + `draft_status: DRAFT`. **Do NOT touch top-level `status`. Do NOT NULL `approved_by`/`approved_at`. Do NOT deindex.** The doc remains operationally APPROVED with a draft in progress.
- New server actions: `promoteDraftToApproved(documentId)` (atomic: copy draft pointer → approved pointer, null draft pointer + draft_status, stamp `approved_at`/`approved_by`, stamp prior approved version's `superseded_at`); `discardDraft(documentId)` (null draft pointer + draft_status, leave approved untouched).
- Composite status badge in the styrdokument table: `Godkänd v3 · Utkast v4 pågår` for the dual state; standard single badges otherwise. Filter chips treat APPROVED-with-draft as APPROVED for the "Visa godkända" view.
- Doc page dual-version header: approved metadata (`Godkänd av X den Y`) stays visible at all times; draft banner appears in the editor (`Du redigerar utkast v4 som ersätter Godkänd v3 efter godkännande`) with a discard-draft action.
- Agent tool refactor: `add_document_section` and `update_document` (Stories 17.11 / 17.11b) tool-time + dispatch-time guards reframe from `status ∈ (DRAFT, IN_REVIEW)` to `current_draft_version_id IS NOT NULL OR top-level status is "never-approved DRAFT"`. Agent writes always target the draft version, never the approved version.
- Agent read tool refactor: `search_workspace_documents` indexes against `current_approved_version` content (so the effective policy remains findable during draft windows); `get_workspace_document` returns both snapshots when both are present so the agent can hedge its answers. Citation grammar extended: `[Källa: <titel>]` for stable approved, with optional `(utkast pågår)` suffix or paired `[Utkast: <titel>]` when a relevant draft is concurrent.

**Requirements covered:** Cross-cutting compliance integrity for FR7 (compliance workspace), FR25 (audit trail), and Epic 17's stated lifecycle (`DRAFT → IN_REVIEW → APPROVED → SUPERSEDED → ARCHIVED`). The current implementation conflates document-level lifecycle with version-level state; this addendum separates the two cleanly.

**Estimated stories:** 3

**Dependencies:**
- **Epic 17** (Document Management System) — Done in core: source of `WorkspaceDocument` / `WorkspaceDocumentVersion` schema, `createDraftFromApproved` (`app/actions/documents.ts:823`), `saveDocumentVersion` (`app/actions/documents.ts:590`), `document-table.tsx`, `DocumentStatusBadge`.
- **Story 17.10** (Agent workspace-document reads) — Done: `search_workspace_documents`, `get_workspace_document`, `list_workspace_documents` — Story 17.18 refactors their read sources.
- **Story 17.10b** (Auto-reindex contract) — Done: `saveDocumentVersion` wraps `indexWorkspaceDocument` in `after()`. Story 17.16 updates this contract so the indexed content tracks the approved pointer (not just `current_version_id`).
- **Story 17.11** (Agent `update_document`) — Done: tool-time + dispatch-time DRAFT/IN_REVIEW guard at `lib/agent/tools/update-document.ts:170` and `app/actions/pending-agent-actions.ts:493`. Story 17.16 reframes these against the new pointer model.
- **Story 17.11b** (Agent `add_document_section`) — Ready for Review: same guard shape as 17.11. Same reframe.
- **Epic 22** (UI Primitives Alignment) — Active: the new composite status badge in Story 17.17 should compose from the `Badge` `tone × variant` matrix introduced there. Coordinate naming if 22.x is mid-flight.

**Priority:** High. The visibility gap is a concrete compliance risk (auditor visits during draft windows see DRAFT-state docs), and the citation grade regression actively degrades the agent's value proposition. Cost grows with data volume — current production has small footprint, so migration risk is at its minimum now and only increases over time.

**Source artefacts:**
- Architectural analysis: conversation between James (dev) and Sarah (PO) on 2026-06-03 — full Model A/B/C comparison with domain-specific framing.
- Story 17.11b Dev Agent Record — surfaces the visibility gap as a live observation during smoke-testing the APPROVED-doc agent guard refusal.
- Live code reference: `app/actions/documents.ts:823` (current `createDraftFromApproved`).

---

## Epic Goal

Encode the dual-version state of a compliance document — currently-effective approved AND currently-in-progress draft — as concurrent first-class pointers on `WorkspaceDocument`, refactor every read/write surface to honor the right pointer for its context, and preserve the audit trail (approved metadata + per-version timestamps) throughout revision windows.

## Epic Description

### Existing System Context

- **Current relevant functionality:**
  - `WorkspaceDocument` has a single `current_version_id` pointer and a single `status` enum (`DRAFT` / `IN_REVIEW` / `APPROVED` / `SUPERSEDED` / `ARCHIVED`).
  - `WorkspaceDocumentVersion` rows are immutable + append-only — every version ever created is preserved. `change_summary`, `created_by`, `created_at` are stamped on each version.
  - `createDraftFromApproved(documentId)` (`app/actions/documents.ts:823`): on a status-APPROVED doc, creates a new version (number = current + 1, content copied from current), sets `current_version_id` → new version, flips `status: APPROVED → DRAFT`, NULLs `approved_by`/`approved_at`, runs `after(deindexWorkspaceDocument(...))`, writes an `ActivityLog` row of `document_status_changed` with old/new status.
  - `saveDocumentVersion(...)` (`app/actions/documents.ts:590`): appends a new version, bumps `current_version_*`, writes `document_version_saved` activity log, triggers `indexWorkspaceDocument` via `after()`. Used by the editor autosave path AND by agent dispatch paths from Stories 17.11/17.11b.
  - `WorkspaceDocumentStatus.SUPERSEDED` exists in the enum but is **unused** by any code path today. Hints at a different design intent that was never implemented.
  - Document table (`components/features/documents/document-table.tsx`) renders the single `status` enum via `DocumentStatusBadge`.
  - Doc page header renders `approved_by` + `approved_at` from the `WorkspaceDocument` row — both currently NULLed during draft windows.
  - Agent read tools `search_workspace_documents`, `get_workspace_document`, `list_workspace_documents` (Story 17.10) read content from `current_version` and stamp `[Källa:]` for APPROVED status rows / `[Utkast:]` for DRAFT/IN_REVIEW status rows (Story 17.10b extension).
  - Agent write tools `update_document`, `add_document_section` (Stories 17.11, 17.11b) guard on `status ∈ {DRAFT, IN_REVIEW}` at both tool time and approval-dispatch time.

- **Technology stack (this area):** Next.js 14 App Router, Prisma 5.x ORM, PostgreSQL 15 (Supabase), TypeScript, React 18, Tailwind, shadcn/ui, `@upstash/vector` for embeddings (per Story 17.10b reindex pipeline).

- **Integration points:**
  - `prisma/schema.prisma` — `model WorkspaceDocument` (lines ~2027–2080) + `model WorkspaceDocumentVersion` + `enum WorkspaceDocumentStatus`.
  - `app/actions/documents.ts` — `createDraftFromApproved` (`:823`), `saveDocumentVersion` (`:590`), `updateDocumentStatus`, `createDocument`.
  - `app/actions/pending-agent-actions.ts` — `approvePendingAction` `UPDATE_DOCUMENT` branch (line ~471), `ADD_DOCUMENT_SECTION` branch (added by 17.11b).
  - `lib/agent/tools/update-document.ts` + `lib/agent/tools/add-document-section.ts` — tool-time guards.
  - `lib/agent/tools/search-workspace-documents.ts` + `lib/agent/tools/get-workspace-document.ts` + `lib/agent/tools/list-workspace-documents.ts` — read sources.
  - `components/features/documents/document-table.tsx` + `components/features/documents/document-status-badge.tsx` — table render.
  - `components/features/documents/document-page-header.tsx` (or equivalent) — doc page header.
  - `components/features/documents/editor/...` — editor banner mount points.
  - `lib/workspace-documents/index-workspace-document.ts` — reindex source.

### Enhancement Details

- **What's being added/changed:**
  1. **Schema delta** — two new pointer columns + draft sub-status on `WorkspaceDocument`; three per-version audit timestamps on `WorkspaceDocumentVersion`. Migration is **additive only** (no column drops, no enum value drops). `current_version_id` is kept temporarily for a deprecation window — every read site is migrated, but the column is not dropped in this epic (cleaner to drop in a follow-up once all callers are confirmed converted).
  2. **Refactor of `createDraftFromApproved`** — write to draft pointer, leave approved metadata untouched, do NOT deindex (the approved version is still effective and must remain findable).
  3. **New `promoteDraftToApproved` action** — replaces the implicit "draft becomes approved when status flips" pattern with an explicit, atomic transition. Stamps version-level `approved_at`/`approved_by`; stamps prior approved version's `superseded_at`.
  4. **New `discardDraft` action** — explicit clean throw-away path for in-progress drafts.
  5. **UX surfaces** — composite status badge in styrdokument table for the dual state; doc page header preserves approved metadata throughout draft windows; editor banner clarifies the draft-replaces-approved relationship; discard-draft control available in the editor.
  6. **Agent tool refactor** — write tool guards reframe against `current_draft_version_id` presence; read tools surface the right version with the right citation; `get_workspace_document` returns both snapshots so the agent can hedge.

- **How it integrates:**
  - Backfill migration runs once on apply, mapping the three pre-existing data shapes onto the new pointers. After backfill, every read site is updated to consult the correct pointer for its concern. `current_version_id` is left in place as a deprecated alias that points at the more recent of `(current_approved_version_id, current_draft_version_id)` — minimizes breakage if any read path is missed during migration.
  - Tool guards in Stories 17.11/17.11b are reframed but their AC numbering stays unchanged — the new guard logic is functionally equivalent for the cases the existing tests cover (DRAFT/IN_REVIEW → write allowed; APPROVED/SUPERSEDED/ARCHIVED → write refused) AND additionally allows the "APPROVED with current_draft_version_id" case which the existing model couldn't express. Tests extend rather than replace.
  - `saveDocumentVersion` semantics: when `current_draft_version_id` is set on the parent doc, new versions are written as draft updates (pointer advances, top-level status untouched); when no draft is set and the doc is in a never-approved DRAFT state, behavior matches today's path.
  - Auto-reindex (17.10b) refactored to key off `current_approved_version_id` for the "official policy" index entry, with the draft version optionally indexed as a secondary signal (decision deferred to Story 17.18).

- **Success criteria:**
  - During a revision of an APPROVED policy, every read surface (table, doc page, search, agent) continues to return the approved version's content as the effective answer, with the draft surfaced as a secondary signal.
  - `approved_by` / `approved_at` are preserved on the document row throughout the revision window.
  - On draft approval, the transition is atomic and stamps version-level audit timestamps.
  - On draft discard, the approved version is untouched and no orphan data is left behind.
  - The agent's `[Källa:]` citations remain accurate for the effective policy at all times; `[Utkast:]` is used only when the agent is explicitly grounding in the draft.
  - Existing tests in Stories 17.11 / 17.11b stay green (the tool guards reframe without changing their observable behavior for previously-covered cases). Full unit + integration test suite passes.

---

## Stories

Three stories sequenced foundation → UI → agent. Each story includes regression coverage of the surfaces it touches. Each story is independently shippable: 17.16 lands the model without UX changes (surfaces continue to render via the deprecated `current_version_id` alias); 17.17 layers the new UX on the now-correct model; 17.18 finishes by refactoring the agent reads and citations.

### 17.16 — Dual-Version Data Model + Dispatch Refactor (foundation)

Schema migration adding the dual pointers, draft sub-status, and per-version approval timestamps. Backfill of the three pre-existing data shapes. Refactor `createDraftFromApproved` to populate the draft pointer without touching approved metadata or deindexing. New `promoteDraftToApproved` and `discardDraft` server actions. Tool-time + dispatch-time guard refactor in 17.11 / 17.11b: writeable iff `current_draft_version_id IS NOT NULL OR (top-level status is never-approved DRAFT)`. `saveDocumentVersion` writes target the draft pointer when present. `current_version_id` kept as deprecated alias; reads continue to work transparently. Tests: schema constraint coverage, migration backfill correctness (3 cases), `createDraftFromApproved` no longer NULLs metadata, `promoteDraftToApproved` atomic transition + version-level timestamp stamping, `discardDraft` clean nulling, full regression of Stories 17.11 + 17.11b test suites (passing under the reframed guards).

### 17.17 — Styrdokument Table + Doc Page UX (dual-version visibility surfaces)

Composite status badge in the styrdokument table (`Godkänd v3 · Utkast v4 pågår`) for the dual state; standard single badges for stable states. Filter chips: "Visa godkända" includes APPROVED-with-draft-pending. Row click defaults to the approved view; edit affordance opens the draft. Doc page header: `Godkänd av X den Y` metadata stays visible throughout draft windows; secondary "Utkast pågår" pill appears when relevant. Editor banner: `Du redigerar utkast v4 som ersätter Godkänd v3 efter godkännande`. Discard-draft button surfaced in the editor when a draft is in progress (calls the action from 17.16). Tests: RTL coverage of badge variants, header states, editor banner mount/unmount, filter-chip semantics; E2E spot test for the full "approve → branch → see approved-with-draft-pending → discard draft" cycle.

### 17.18 — Agent Reads + Citation Routing (dual-version aware)

`search_workspace_documents` refactor: indexes against `current_approved_version` content as the canonical entry for effective policy; surfaces "draft pending" as a metadata signal rather than a separate hit. `get_workspace_document` refactor: returns both snapshots (approved + draft) when both are present so the agent can hedge its answers (`"Er gällande arbetsmiljöpolicy kräver X[Källa: Arbetsmiljöpolicy v3]. Ett pågående utkast föreslår en skärpning till Y[Utkast: Arbetsmiljöpolicy (utkast v4)]."`). `list_workspace_documents` reflects the dual state. Citation grammar extended in system prompt. 17.10b auto-reindex contract refactored: approved version content drives the canonical embedding; draft version content optionally indexed as a secondary embedding (decision in this story's AC). Tests: tool guard regression (read tools find the right version), citation routing assertions, system-prompt token-budget check (per 17.10's 6500 cap convention).

---

## Compatibility Requirements

- [x] **No breaking changes to existing APIs.** All schema additions are nullable; backfill restores parity. `current_version_id` stays as a deprecated alias throughout this epic — every read site is migrated but the column is not dropped. Drop happens in a follow-up cleanup story once telemetry confirms no callers remain.
- [x] **Database changes are additive only.** Three new columns on `WorkspaceDocumentVersion`, three on `WorkspaceDocument`, one new enum. No drops, no renames. Backfill is idempotent (safe to re-run).
- [x] **UI changes follow existing design patterns.** Composite badge uses Epic 22's `Badge` `tone × variant` matrix (coordinate naming if 22.x in-flight); editor banner reuses the existing approval-card frame chrome where applicable.
- [x] **Performance impact is minimal.** Two new `@unique` indexes on the pointer columns; the dual-pointer reads are O(1) FK joins, same shape as today's `current_version_id` read. Search indexing source changes content target but volume + frequency unchanged.

## Risk Mitigation

- **Primary Risk:** Backfill migration on production data could leave rows in inconsistent state (e.g., a doc with `current_version_id` set but both new pointers null due to a backfill edge case not anticipated). This would manifest as a doc that appears to have no content under the new read paths.
- **Mitigation:**
  - Backfill SQL is written as a single transaction with explicit row counts asserted at the end (refuses to commit if any row is left with both pointers null when its current_version_id was set).
  - `current_version_id` stays as a deprecated alias throughout this epic. Read code can fall back to it if both new pointers are unexpectedly null (defensive, behind a `console.error` log so we catch any cases).
  - Migration is applied to a Supabase preview environment first; smoke test verifies all three data shapes backfill correctly before applying to production.
- **Rollback Plan:**
  - Schema additions are nullable, so rollback is "stop reading the new columns" + revert the code. The backfilled data stays in place; the deprecated `current_version_id` continues to work.
  - If a critical issue is caught post-deploy, code rollback alone restores the prior model behavior. No data deletion needed.
  - Worst case (catastrophic data corruption from a buggy `createDraftFromApproved` refactor): version-row immutability means we can replay from `WorkspaceDocumentVersion` history to reconstruct correct pointer state per doc.

## Definition of Done

- [ ] All three stories (17.16, 17.17, 17.18) shipped with their acceptance criteria met.
- [ ] Schema migration applied successfully to production; backfill row counts match expected for each of the three data shapes.
- [ ] Existing test suites for Stories 17.10, 17.10b, 17.11, 17.11b pass without modification (where the tool-guard reframe is observationally equivalent) or with extended assertions (where the reframe adds new allowed cases).
- [ ] During a live revision of an APPROVED policy, an end-to-end manual smoke confirms: table row shows composite badge, doc page header retains approved metadata, search returns approved content, agent `[Källa:]` citation grounds in approved content with optional `[Utkast:]` hedge for the pending draft, approval of the draft cleanly promotes pointers + stamps version-level timestamps, discard returns to stable APPROVED state.
- [ ] System-prompt token budget guardrail (per 17.10 convention, < 6500 tokens) respected.
- [ ] Zero regression in 17.11/17.11b behavior for the previously-covered cases (DRAFT/IN_REVIEW → write allowed, APPROVED → write refused with guidance).

---

## Story Manager Handoff

"Please develop the three detailed stories drafted in `docs/stories/17.16.*.md`, `docs/stories/17.17.*.md`, `docs/stories/17.18.*.md` for this brownfield epic. Key considerations:

- This is an enhancement to an existing system running Next.js 14 App Router + Prisma 5 + Supabase PostgreSQL + Tiptap editor + Vercel AI SDK (per `docs/architecture/3-tech-stack.md`).
- Integration points: `app/actions/documents.ts` (`createDraftFromApproved`, `saveDocumentVersion`), `app/actions/pending-agent-actions.ts` (UPDATE_DOCUMENT + ADD_DOCUMENT_SECTION dispatch branches), `lib/agent/tools/update-document.ts` + `lib/agent/tools/add-document-section.ts` (write tool guards), `lib/agent/tools/search-workspace-documents.ts` + `get-workspace-document.ts` + `list-workspace-documents.ts` (read tools), `components/features/documents/document-table.tsx` + `document-status-badge.tsx` + doc page header + editor banner mounts, `lib/workspace-documents/index-workspace-document.ts` (auto-reindex source).
- Existing patterns to follow: Story 17.11b's brownfield-additive shape (extend existing files, do not break shipped surfaces); Story 17.10b's `after()` reindex pattern for auto-indexing; Story 14.22's approval-card lineage (no `execute:true` writes from the agent — all writes flow through `PendingAgentAction`).
- Critical compatibility requirements: `current_version_id` MUST remain functional as a deprecated alias throughout this epic; backfill MUST be idempotent and assertively row-counted; tool-guard reframes in 17.11/17.11b MUST be observationally equivalent for the cases the existing tests cover (DRAFT/IN_REVIEW → write allowed, APPROVED → refused).
- Each story must include verification that existing functionality remains intact — the existing test suites for the touched stories serve as the canonical regression bar.

The epic should maintain system integrity while delivering dual-version document visibility — encoding the currently-effective approved version and the currently-in-progress draft as concurrent first-class states queryable from every read surface, throughout the entire revision lifecycle of a compliance document."

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-06-03 | 1.0 | **Initial draft (Sarah, PO).** Created via brownfield-create-epic flow after architectural analysis between James (dev) and Sarah (PO) surfaced the dual-version-visibility gap during smoke-testing of 17.11b. Scope locked to 3 stories per brownfield-create-epic limit. Scope decisions (recorded in conversation): (a) agent auto-branch on APPROVED **kept as separate follow-up Story 17.11c**, not folded into this epic — keeps story boundaries clean and 17.11c becomes a tiny extension once Model B foundation lands; (b) composite single-row status badge as the table UX shape (`Godkänd v3 · Utkast v4 pågår`); (c) discard-draft action included; (d) per-version approval timestamps included. Status: Draft pending review and validation. | Sarah (PO) |
