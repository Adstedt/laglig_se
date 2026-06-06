# Agent Partner — Full Completion Checklist

**Purpose:** Master checklist tracking every story required to deliver the full agent-partner vision (reads attachments + existing bevis, diagnoses gaps, proposes concrete actions, drafts styrdokument, continuously nudges users toward compliant state).

**Scope:** Spans 3 epics — prerequisite work in Epic 14 (Compliance Agent) and Epic 17 (DMS), sibling additions to Epic 14, and the new Epic 19 (Agent Partner).

**Linked epic:** [`docs/prd/epic-19-agent-partner-skills-subagents.md`](../prd/epic-19-agent-partner-skills-subagents.md)

**Created:** 2026-04-19
**Last updated:** 2026-06-06 (authoring triad closed — **17.11c ✅ Done 2026-06-06 (gate PASS q95)** moved to `completed/`. Same-day SM→PO→Dev→QA cycle: SM drafted v1.0; PO validate-story-draft GO 9.5/10; Dev implementation 24 new tests across 6 suites; QA PASS quality 95; owner live smoke 4/4 probes PASS including the load-bearing DEC-2 stress probe ("Den godkända versionen (v11) innehåller ännu inget avsnitt om åldersgräns" — the agent correctly framed the auto-branched draft as non-canonical). **Phase 5 (Authoring) fully shipped** — 17.10 + 17.10b + 17.11 + 17.11b + 17.11c + dual-version trilogy 17.16/17.17/17.18 all in `completed/`. 17 stories added to the Done column since the 2026-05-24 snapshot. **Next major authoring deliverable is 19.8** (`draft_styrdokument` type-aware). Two follow-ups surfaced in 17.11c smoke: AGENT-001 (agent hallucinates content on empty-approved docs) + UX-prose-leak (agent says `update_document`/`APPROVED` when explaining capabilities) — both PO-owned, candidates for 19.8's prompt sweep or standalone hardening.)
**Owner:** Sarah (PO)

---

## 🧱 Prerequisite foundations (already in flight — not new work)

### Epic 17 — DMS + agent integration (Draft)

- [x] **17.8** — Text extraction pipeline for uploaded files ✅ **DONE** (`completed/`)
  *PDF/DOCX/XLSX → `WorkspaceFile.extracted_text`; pdf-parse, mammoth, exceljs*
- [x] **17.9** — Chunk & embed into RAG pipeline ✅ **DONE — split into 17.9 / 17.9b / 17.9c** (all `completed/`)
  *17.9 `USER_FILE` chunks · 17.9b `WORKSPACE_DOCUMENT`/styrdokument chunks · 17.9c `search_workspace_files` tool. (17.9d file-aware citation pill drafted, not built.)*
- [x] **17.10** — Agent tools: `search_workspace_documents`, `get_workspace_document`, `list_workspace_documents` ✅ **DONE** (2026-06-01, `completed/`; gate PASS 95 → q94→q95 after owner smoke)
  *Three read tools on the 17.9c pattern over the 17.9b WORKSPACE_DOCUMENT chunks. No schema change, no migration. Token budget bumped 5500 → 6500 (conscious growth for a real new tool surface). CITE-002 collision disambiguator ships as designed. Owner smoke 8/8 PASS against Nordviken. Closed WDS-001 (no styrdokument discovery tool).*
- [x] **17.10b** — DRAFT/IN_REVIEW indexing + status-aware citations ✅ **DONE** (2026-06-02, `completed/`; gate PASS 97 [q93→q97 post-smoke])
  *Indexable set widens from `{APPROVED}` to `{DRAFT, IN_REVIEW, APPROVED}`. Content-hash (not status) is the new reindex trigger. Citation pipeline splits into `[Källa:]` (canonical APPROVED) vs `[Utkast:]` (DRAFT/IN_REVIEW) with rehype `data-tier` attribute. System prompt teaches "enligt utkast till…" framing. New infra: `20260602100000_add_workspace_document_reindex_flags` migration + `/api/cron/sweep-draft-reindex` (60s idle debounce) + one-time backfill script. Owner smoke 5/5 PASS — including the **DEC-2 adversarial hold** ("Vad är vår officiella semesterpolicy?" against a DRAFT-only topic → agent refused honestly, zero `[Källa:]` for the DRAFT). **The compliance-sensitive contract held under the highest-stakes prompt.** QA caught + fixed an autosave→archive cron-sweep race in-review.*
- [x] **17.11** — Agent tool: `update_document` (section edits via approval card) — ✅ **DONE 2026-06-06** (`docs/stories/completed/17.11.agent-tool-update-document.md`; gate PASS quality 100)
  *Re-scoped 2026-05-22: `create_document` dropped (redundant with 14.24 `draft_styrdokument`); markdown↔Tiptap converters dropped; recast onto the `UPDATE_DOCUMENT` `PendingAgentAction` approval pattern. The 12th `PendingAgentActionType` on the established inline-approval pattern. Dispatch calls `updateSection()` to produce the full updated `contentJson`, `saveDocumentVersion` appends a new `WorkspaceDocumentVersion`, auto-reindex via 17.10b's `after()` hook picks up DRAFT/IN_REVIEW changes transparently. Owner live smoke 2026-06-03 confirmed the diff-card → approve → version-append flow end-to-end. Forward-aligned to 17.16's dual-pointer model during the sub-epic.*
- [x] **17.11b** — Agent tool: `add_document_section` (insert NEW section into existing styrdokument via approval card) — ✅ **DONE 2026-06-06** (`docs/stories/completed/17.11b.agent-tool-add-document-section.md`; gate PASS quality 95)
  *Brownfield-additive sibling of 17.11 surfaced by the 17.11 live smoke (the "add section" UX cliff). Reuses 17.11's section-utility, dispatch pattern, renderer chrome, and chat-detail panel **1:1** — purely additive. The 13th `PendingAgentActionType`. AC 10's `operation: 'add_section'` activity-log discriminator landed (supersedes 17.11's REL-001 future-hardening trade-off note — atomic-stamp half remains as a low-severity inherited concern, recommended follow-up). **133 story-affected unit tests + registry harness bumps 33→34 (in 3 places) + baseline 32→33** — all green at QA review. Owner live smoke 2026-06-03 against Nordviken's Arbetsmiljöpolicy: clean A-grade pass on propose card + v2 lands correctly. **This story's smoke surfaced the dual-version-visibility gap that motivated the 17.16/17.17/17.18 sub-epic (now closed).***

### Dual-Version Document Visibility — Brownfield sub-epic (CLOSED 2026-06-04)

> **Rationale:** During 17.11b's live smoke (2026-06-03), the architectural finding surfaced that `createDraftFromApproved` flips `status: APPROVED → DRAFT` on the same row + NULLs `approved_by`/`approved_at` + deindexes the doc — causing the previously-effective approved policy to disappear from the table, doc page, search results, **and the agent's `[Källa:]` citation grounding** for the entire revision window. Five compounding gaps (visibility, search blackout, audit metadata wipe, citation grade collapse, cross-reference semantics). **Compliance-domain framing:** Swedish auditors (Arbetsmiljöverket, IMY, ISO 9001/14001/45001) all ask "vad är gällande just nu?" — Model A's status-flip undermines the textbook ISO "control of documents" criterion. Architecture decision: Model B (dual-pointer schema) — see `docs/prd/epic-17-addendum-dual-version-visibility.md`. **Trilogy shipped in 2 days; compliance contract restored end-to-end; DEC-2 invariant holds under Model B.**

- [x] **17.16** — Dual-version data model + dispatch refactor (foundation) — ✅ **DONE 2026-06-03** (`docs/stories/completed/17.16.dual-version-document-model.md`; gate PASS quality 92)
  *Schema: dual pointers `current_approved_version_id` + `current_draft_version_id` + `draft_status` (DraftStatus enum) on `WorkspaceDocument`; per-version audit timestamps `approved_at` / `approved_by` / `superseded_at` on `WorkspaceDocumentVersion`. Two-pass timestamp-driven backfill (handles multi-save draft histories correctly via ActivityLog correlation, NOT `version_number - 1` arithmetic). Refactor of `createDraftFromApproved` preserves approved metadata + freezes deprecated alias on approved version + no deindex. `saveDocumentVersion` three-path routing. New `promoteDraftToApproved` + `discardDraft` server actions. Agent write-tool guard reframe in 17.11/17.11b (observationally equivalent for cases existing tests cover). **CRIT-1 alias-freeze (load-bearing):** approved-tier alias holds during draft windows so 17.10b auto-reindex keeps grounding `[Källa:]` in approved content; editor route migrates to `current_draft_version` explicitly. Owner live smoke confirmed alias-freeze invariant via SQL.*
- [x] **17.17** — Styrdokument table + doc page dual-version UX — ✅ **DONE 2026-06-04** (`docs/stories/completed/17.17.dual-version-document-ux.md`; gate PASS quality 96)
  *Single-row composite status badge for the dual state (`Godkänd v3 · Utkast v4 pågår`); filter chip semantics; doc page header preserving approved metadata throughout draft windows; editor banner clarifying draft-replaces-approved; discard-draft button + Skicka/Godkänn/Neka/Förkasta flow wired to 17.16's new server actions. Owner live smoke validated full composite badge + lifecycle flow.*
- [x] **17.18** — Agent reads + citation routing under the dual-version model — ✅ **DONE 2026-06-04** (`docs/stories/completed/17.18.dual-version-agent-reads-citations.md`; gate PASS quality 95)
  *Refactored `indexWorkspaceDocument` to maintain per-tier (APPROVED/DRAFT) chunks with self-healing legacy migration (`OR metadata->>'tier' IS NULL` clause — zero flag day); `search_workspace_documents` returns one hit per tier per doc with `dualState` flag; `get_workspace_document` returns both snapshots when present (nested `approved` + `draft` + `dualState` + backward-compat top-level `content`); `list_workspace_documents` exposes dual state + `dual_state_only` Zod-visible filter; citation grammar extended with `[Utkast: title (utkast vN)]` shape (`data-tier="draft"`); rehype pill renderer + Källa-pairing test landed. **17.10b DEC-2 contract preserved and explicitly adversarially tested under the new dual state — owner real-LLM smoke held across 3 adversarial prompt phrasings.** Architectural side-effect: 2× embedding cost win via `$queryRaw` with `embedding IS NULL` filter. Sweep cron at `* * * * *` (60s debounce) drives autosave→reindex; manual trigger validated end-to-end against Supabase production data.*
- [x] **17.11c** — Agent auto-branch on APPROVED — ✅ **DONE 2026-06-06** (`docs/stories/completed/17.11c.agent-auto-branch-on-approved.md`; gate PASS quality 95)
  *Closes the authoring triad. When the agent calls `update_document` / `add_document_section` against an APPROVED doc with no draft pending, the new `createDraftFromApprovedWithEdit` server action runs an atomic single-`$transaction` branch + write (ONE version row with the edit applied directly — solves the Two-Version Problem). Card shows "Skapar nytt utkast v{N+1} av X" header. Race-on-fell-through (user manually branched between propose and approve) gracefully falls through to plain `saveDocumentVersion`. AC 8 + AC 14 dual-stamp (`{by:'agent', pendingActionId, operation: 'auto_branch_then_<update|add>_section'}`) lands on BOTH `document_version_saved` AND `document_draft_created` rows — lets audit consumers distinguish agent-initiated branches from user-initiated ones. 24 new tests across 6 suites; full 861-test sweep clean. Owner live smoke 2026-06-06 against Nordviken: probes 1 (conceptual), 2 (update_document auto-branch card), 3 (add_document_section auto-branch card), 5 (DEC-2 stress under auto-branch) all PASS — DEC-2 contract held end-to-end ("Den godkända versionen (v11) innehåller ännu inget avsnitt om åldersgräns — det tillkommer först när ni godkänner utkastet"). Smoke surfaced two follow-ups: AGENT-001 (agent hallucinates content on empty-approved docs — separate finding) + UX-prose-leak (agent says `update_document`/`APPROVED` when explaining capabilities — small system-prompt guardrail follow-up).*

### Epic 14 — Agent approval-card primitives (Approved)

- [x] **14.22** — `AgentActionCard` foundation + `CREATE_TASK` pilot ✅ **DONE** (`completed/`)
  *`PendingAgentAction` model + inline card replaces sidebar write-preview*
- [x] **14.23** — Extended approval types + batch card ✅ **DONE** (`completed/`)
  *LINK_TASK_TO_DOC, LINK_DOC_TO_TASK, ADD_OBLIGATION, ASSIGN_TASK + multi-action batching + sidebar decommission*
- [x] **14.24** — `DRAFT_DOCUMENT` approval ✅ **DONE** (`completed/`)
  *Agent drafts full styrdokument with Tiptap preview + "open in editor" path*

---

## 🔌 Sibling write-tool additions to Epic 14 (new — coordinated with Epic 19)

> **Numbering note (2026-05-20):** renumbered from 14.26–14.29 to **14.28–14.31** because Epic 14 shipped 14.26 (Anthropic Prompt Caching v1) and 14.27 (Chat Usage Telemetry) under its Phase 6. These are owned in Epic 14's "Phase 7: Agent Action Card Extensions" section.

- [x] **14.28** — `update_requirement` approval ✅ **DONE 2026-05-26** (`completed/`; gate PASS 95)
  *text / is_fulfilled / comment / bevis_required; new `UPDATE_REQUIREMENT` action type + diff renderer. The 8th `PendingAgentAction` type. Owner live smoke verified the inline diff card → editable → approve flow; two FE polishes fixed in the loop. Additive enum migration applied. Closes Phase 3.*
- [x] **14.29** — `add_task_comment` approval ✅ **DONE 2026-05-28** (`completed/`; gate PASS 92)
  *New `ADD_TASK_COMMENT` action type — the 10th `PendingAgentActionType` on the 14.28 / 14.23 inline-approval pattern. Append-only (no diff, no editor path). Owner smoke A/B/C/D all PASS — including the AC 5 mentions-hazard probe (steering held cleanly; agent explicitly refused `@`-mention syntax and cited its instructions). **First exercise of 19.7c's registry tripwire** — harness failed on first run as designed (27→28 / []→27) and was bumped in 5 surgical lines. Surfaced ATC-001 (cosmetic Textarea focus-ring asymmetry, cross-cutting).*
- [x] **14.30** — `transition_document_status` approval ✅ **DONE 2026-05-28** (`completed/`; gate PASS 93)
  *Ladder guard DRAFT→IN_REVIEW→APPROVED→SUPERSEDED→ARCHIVED; agent cannot APPROVE (separation of duties). The 11th `PendingAgentActionType`. **Three-layer separation-of-duties defence on APPROVED** (Zod schema enum exclusion + tool runtime guard + dispatch authoritative gate — all three tested). Owner smoke A/C/D/E all PASS — Smoke C the load-bearing check: agent refused "Sätt den nu som godkänd" with explicit separation-of-duties reasoning, no card created, first defence layer held alone. Mid-smoke UX refactor moved `<DocumentStatusBadge>` pills into the lead summary. Surfaced WDS-001 (closed by 17.10) + TC-001 + ATC-001 (inherited from 14.29).*
- [ ] **14.31** — Proposal staleness protection
  *entity_version snapshot + re-read check + Swedish error toast; retrofit across all approval types. **Approved, not built** — batches with 14.28/14.30 per its own deps. 14.28 + 14.30 already populate `entity_version` in their `params` so the retrofit is dispatch-side only.*

---

## 🚀 Epic 19 — Agent Partner (15 new stories)

### Foundation track (unblocks everything else)

- [x] **19.1** — Chat attachment upload + Claude content-block conversion ✅ **DONE** (2026-05-24, `completed/`; QA PASS 92)
  *Drag-drop UI in chat-input-modern; remove `.filter(p => p.type === 'text')` stripping; `lib/agent/attachments-to-content.ts` routes PDFs → document blocks, images → image blocks, DOCX/XLSX → extracted text*
- [x] **19.2** — `read_file` unified evidence reader ✅ **DONE** (2026-05-24, `completed/`; QA PASS 94)
  *New `read_file(fileId)` reading any WorkspaceFile in full (PDF/image/extracted text) via the shared `lib/agent/file-content.ts` core + AI-SDK `toModelOutput`; live-verified read vs snippet (agent self-corrected a snippet-only gap analysis by reading 4 docs). Follow-ups: READ-001 (base64 persists across loop steps → folds into 19.9), READ-004 (image path live-unverified until 19.4)*
  *New agent tool reading any WorkspaceFile (chat attachment OR bevis) via shared conversion logic; extracts 19.1's routing into `lib/agent/file-content.ts`; native PDF/image via the AI-SDK `tool.toModelOutput` hook; `'read'`-tier (kept for AUDITOR)*
- [x] **19.3** — Diagnostic tools ✅ **DONE 2026-05-26** (`completed/`; gate PASS 95)
  *`list_bevis_gaps`, `list_unassessed_changes`, `list_overdue`, `list_stale_documents` — pure reads, workspace-scoped. Same-day SM→PO→Dev→QA cycle + owner smoke (all four fired in a real GLOBAL chat; count-as-work-items + empty-state framing confirmed). QA's `changeType`-label fix consolidated all four reader enum-fields through `reader-utils`. Surfaced SA-001 (`save_assessment` is the lone write tool NOT on the inline approval-card pattern — candidate sibling 14.32, secondary symptom neutralised by 19.7c's gate, core auto-save bug stays 14.32).*
- [x] **19.4a** — Agent id-resolution + entity discovery *(foundational; added 2026-05-24)* ✅ **DONE** (2026-05-24, `completed/`; QA PASS 91; both smoke paths verified, no migration)
  *Surfaces the active `lawListItemId` (LAW prompt + tool-context default — hardens add_obligation/add_context_note/update_compliance_status), threads CHANGE-context id, adds `search_law_list_items` (Swedish definite-form match fix) + `search_tasks`. Follow-ups: 419A-001..004 (low/fail-safe), SLI-001 (pg_trgm robust matching). Unblocks 19.4.*
- [x] **19.4** — Entity-read tools (lazy traversal) ✅ **DONE 2026-05-26** (`completed/`; gate PASS 95)
  *`get_law_list_item`, `get_task`, `list_linked_artifacts` — node state + typed `ContextHandle` neighbour handles (not full hydration); one consolidated reader per entity; hard caps (Prisma `take`-level); names-not-IDs; ships with read-before-propose steering. `list_linked_artifacts` wraps `getLinkedArtifactsForListItem` (isolation verified at `:175`); feeds bevis file-ids to `read_file`. Full cycle in one day: review → CONCERNS (doc/traceability hygiene, not code) → dev-fixed → re-review → owner live smoke PASS → gate PASS. **Tracked-low follow-ups (non-blocking):** 194-003 (`use-list-item-details.ts` modal-refresh, owner-accepted) + 194-004 (uncapped `loadLinkedArtifacts` union, future/telemetry-gated). **Deps:** 19.4a. No caching v1.*
- [ ] **19.4b** — Cycle/finding entity-readers *(added 2026-05-24; sequence with next Epic 21 work)*
  *`get_cycle`, `get_finding` over Epic 21 models, same lazy/`ContextHandle` shape. AUDITOR-persona traversal (cycle → items → kravpunkter → findings → tasks). **Deps:** 19.4. Not on the foundation critical path. Stays deferred to next Epic 21 work.*
- [x] **19.5** — Role-based tool registry filter + `AgentDecisionLog` ✅ **DONE** (2026-05-24, `completed/`; QA PASS 93)
  *`createAgentTools(workspaceId, userId, role)` — AUDITOR gets read-only; `AgentDecisionLog` model tracks every tool call. Follow-ups: WS-001 (web_search logging), AUD-001 (live AUDITOR check)*

### Skills track

- [x] **19.6** — Skill loader + directory convention + context activation ✅ **DONE 2026-05-26** (`completed/`; gate PASS 95)
  *Pure `skill-loader.ts` + `_template`/README + 10 fixture tests; zero integration / zero prod surface (AC-6 verified — no files modified). Loader-only per the v0.3 re-scope; agent wiring → 19.7a (integration) + 19.7c (narrowing).*
- [x] **19.7** — Ship `assess_change` + `gap_analysis` skills ✅ **DONE — SPLIT into 19.7a/b/c, all in `completed/`**
  - [x] **19.7a** — Skills integration + `assess_change` ✅ **DONE 2026-05-26** (`completed/`; gate PASS 95, re-verified)
    *Wired the loader into the agent: `buildSystemPrompt` injects the context-primary skill via `getPrimarySkillForContext` (change chat → `assess_change`) at the slot the old `ASSESSMENT_WORKFLOW` literal occupied + `<available_skills>` catalogue + `'read'`-tier `activate_skill` meta-tool (registry factory 26→27, AUDITOR-kept). **Behaviour-preserving migration** — QA reconstructed the deleted literal from `git HEAD` and `diff -u`'d it against `PROCEDURE.md`: byte-identical. **First real skill live.** One low finding (197A-001: stale base-prompt cross-reference) fixed in-review.*
  - [x] **19.7b** — `gap_analysis` skill + KP-001 framing + `assess_change` enrichment ✅ **DONE 2026-05-26** (`completed/`; gate PASS 93)
    *Orchestrates the four 19.3 diagnostics + prompt-reasoned risk tiers + structured Swedish report w/ capped Tier-2 proposals + KP-001 kravpunkt-framing rule (verifiable obligations in påstående-presens, NOT imperative to-dos). `assess_change` current-state enrichment folded in 2026-05-26 per owner: `get_law_list_item` → conditional `list_linked_artifacts` to the assessment prep phase (both readers auto-resolve from context). Owner live-smoked both flows. **PO rulings:** gap_analysis = activation-only (`contextTypes: []`); PROCEDURE = Swedish; CI bilingual-lint DROPPED. Surfaced 197B-S1 (fixed standalone) + GR-001 (tracked → 19.13).*
  - [x] **19.7c** — Per-skill tool-registry narrowing + no-regression harness ✅ **DONE 2026-05-27** (`completed/`; gate PASS 95)
    *`createAgentTools` gained `activeSkills?` → narrows the registry to `ALWAYS_AVAILABLE ∪ (active skills' whitelists)`, composed with the role filter as one predicate; the route passes `[primarySkill]`/`[]`. **Fail-open by construction** (a new tool is always-available unless explicitly gated). Un-deferred now that ≥2 skills exist (PO precondition met). At 27 tools the narrowing gates exactly ONE tool (`save_assessment`, the lone genuinely-skill-specific tool); every other tool is universal → `ALWAYS_AVAILABLE`. **The durable deliverable is the `activeSkills` mechanism + no-regression harness** (forward-safety for 19.8+), not today's 1-tool reduction. The 19.7 skills track is COMPLETE.*

### Authoring track

- [ ] **19.8** — `draft_styrdokument` skill (type-aware) + Swedish template library seed *(**now unblocked** — dual-version Model B foundation closed 2026-06-04; PO can scope against the corrected dual-pointer schema)*
  *Re-scoped 2026-05-28 from `draft_policy` → `draft_styrdokument` (one skill, not per-type — see PRD 19.8 + plan addendum). `draft_styrdokument/` with PROCEDURE + cross-cutting STYLE (KP-001) + cross-cutting CRITERIA (GR-001) + `types/<docType>.md` modules (one per `WorkspaceDocumentType`: policy, risk_assessment, action_plan, procedure, instruction, checklist, report, other) holding the per-type STRUCTURE + STYLE + CRITERIA; type-aware quality gate in `lib/agent/tools/draft-styrdokument.ts`; seed ≥1 template per type — minimum: Dataskyddspolicy, Arbetsmiljöpolicy, Incidenthanteringsrutin, Riskbedömning arbetsmiljö, Handlingsplan arbetsmiljö, SBA-checklista, Leverantörspolicy*

### Subagent track

- [ ] **19.9** — Subagent runner + `LegalReasoner` + `DocumentReader`
  *`lib/agent/subagents/run-subagent.ts`; `consult_legal_reasoner(question, context)` + `read_and_answer(fileId, question)` tools*
- [ ] **19.10** — `ParallelAssessor` + `bulk_assess_changes`
  *Fan-out helper for 5+ pending ChangeEvents; 10-concurrent cap; reuses 14.23 batch card*

### Continuous governance track

- [ ] **19.11** — Reminders + scheduling tools + cron jobs
  *`Reminder` model; `schedule_review`, `schedule_bevis_recheck` tools; `fire-reminders` daily cron; `weekly-pulse` cron running `gap_analysis` per workspace*
- [ ] **19.12** — `AgentFeedback` + proactive hem-chat cards
  *Thumbs UI on assistant messages + tool results; hem-chat renders "N bevisluckor, M obedömda ändringar, P överfallna uppgifter" cards feeding into skill activation*
- [ ] **19.13** — Agent answer-grounding eval & quality observability
  *Per-turn grounding capture + v1 citation/overlap scorer + admin grounding-rate dashboard (<5% target) + 50-question eval harness. Residual of archived Story 3.9 (grounding mechanism already shipped via 14.16 + 14.9). Distinct from 19.5 AgentDecisionLog + 19.12 thumbs. NFR2/NFR3/NFR24*

---

## 📊 Totals & sequencing

| Bucket | Count | Gate |
|---|---|---|
| Prerequisites (Epic 14 + 17) | 9 | Must ship first or in parallel — blocks most of 19. **Updated:** added 17.10b (DRAFT indexing) + 17.11b (`add_document_section`) post the 2026-05-24 snapshot. |
| Sibling Epic 14 additions | 4 | 14.28/14.29/14.30 all shipped; 14.31 Approved-not-built (batches with the others) |
| Epic 19 | 17 | Foundation track + skills track COMPLETE. 19.7 split into 19.7a/b/c (all Done). 19.13 added 2026-05-26 (legal-citation grounding eval, residual of archived Story 3.9). 19.4b sequences with next Epic 21 work |
| **Dual-Version Document Visibility sub-epic** | 3 | ✅ **CLOSED 2026-06-04** — 17.16 Done (gate PASS q92) + 17.17 Done (gate PASS q96) + 17.18 Done (gate PASS q95). Compliance contract restored end-to-end; DEC-2 invariant holds under Model B. Unblocks 19.8. |
| Future follow-up | 0 | **17.11c shipped 2026-06-06** — triad closed |
| **Total** | **34 stories** | Original ~26 + 11 surface items (split 19.7 a/b/c, new 19.13, new 17.10b, new 17.11b, new dual-version epic 17.16/17.17/17.18, new 17.11c follow-up). Realistic timeline now ~10–12 weeks with 2 devs given the scope expansion. |

**Progress snapshot (2026-06-06 — authoring triad closed): 26 shipped · 0 Ready for Review · 0 Approved-ready-for-dev · 2 drafted-not-built · 6 remaining.**

- ✅ **Shipped (26, in `completed/`):**
  - Prereqs: 17.8 · 17.9 · 17.9b · 17.9c · 17.10 · 17.10b · 14.22 · 14.23 · 14.24
  - Siblings: 14.28 · 14.29 · 14.30
  - Epic 19 foundation: 19.1 · 19.2 · 19.3 · 19.4 · 19.4a · 19.5
  - Epic 19 skills: 19.6 · 19.7a · 19.7b · 19.7c
  - **Authoring triad: 17.11 · 17.11b · 17.11c** (full agent read/write/branch authority over styrdokument)
  - **Dual-version sub-epic: 17.16 · 17.17 · 17.18** (shipped 2026-06-03 → 2026-06-04)
- 📝 **Drafted, not built (2):** 17.9d (file-aware citation pill) · 19.1b (promote chat attachment → Filer)
- ⬜ **Remaining (6):** 14.31 (staleness retrofit, Approved-not-built) · 19.4b (cycle/finding readers, sequences with Epic 21) · 19.8 (`draft_styrdokument` type-aware) · 19.9 (subagent runner) · 19.10 (ParallelAssessor) · 19.11 (reminders + cron) · 19.12 (AgentFeedback) · 19.13 (legal-citation grounding eval)
- ⬜ **Next to build:**
  1. **PO scopes 19.8** (`draft_styrdokument` type-aware + Swedish template library seed) against the corrected dual-pointer schema — the next major authoring-track story. Larger scope (one skill + 8 type modules + ≥7 seed templates) so worth treating as a multi-cycle effort.
  2. **PO triages the 17.11c smoke follow-ups:** AGENT-001 (agent hallucinates content on empty-approved docs) + UX-prose-leak (agent leaks internal identifiers in capability explanations). Likely candidates to roll into 19.8's prompt sweep OR as a standalone agent-prose-hygiene hardening story.
  3. **Then continue Epic 19 governance/eval tracks** (19.11/19.12/19.13) as time allows.

**Phases 1–4 fully shipped. Phase 5 (Authoring) authoring triad fully closed — agent now has full read/write/branch authority over styrdokument across all 4 dual-version states (DRAFT, IN_REVIEW, APPROVED-no-draft, APPROVED-with-draft). 19.8 is the next major authoring deliverable; the type-aware skill + template seed sits on top of the now-complete read/write/branch foundation.**

---

## 🎯 Critical paths

### ✅ Shortest route to a usable "agent that does work" — DELIVERED 2026-05-26

```
17.8 ✅ → 17.9 ✅ → 14.22 ✅ → 19.1 ✅ → 19.2 ✅ → 19.5 ✅ → 19.6 ✅ → 19.7a/b/c ✅ → 14.28 ✅ → 19.3 ✅
```

This entire critical-path sequence is now shipped. The core agent-partner loop is LIVE in production: agent reads attachments + bevis, diagnoses gaps, proposes fixes via approval cards, runs `assess_change` / `gap_analysis` skills per context.

### ✅ MVP gap-analysis flow — DELIVERED 2026-05-26

```
17.8 ✅ → 19.1 ✅ → 19.2 ✅ → 19.5 ✅ → 19.3 ✅ → 19.6 ✅ → 19.7b ✅
```

"Hur står vi till?" is live with the `gap_analysis` skill producing tiered Swedish reports. Owner live-smoked end-to-end against Nordviken Hotell & Konferens AB.

### Authoring proof-point (triad closed 2026-06-06 — only 19.8 remains)

```
17.10 ✅ → 17.10b ✅ → 17.11 ✅ → 17.11b ✅ → 17.16 ✅ → 17.17 ✅ → 17.18 ✅ → 17.11c ✅ → 19.8
```

**Material shift since the original plan — RESOLVED:** 17.11b's live smoke surfaced the dual-version-visibility gap, which sequenced a new 3-story sub-epic (17.16/17.17/17.18) before 19.8. Trilogy shipped 2026-06-03 → 2026-06-04 with owner live smoke validation. 17.11c shipped same-day 2026-06-06 on top of the closed foundation as designed (~150 lines including tests; close to the ~50-line estimate when measuring production code only). The auto-branch path runs an atomic single-`$transaction` branch + write via the new `createDraftFromApprovedWithEdit` server action — solves the Two-Version Problem (ONE version row per agent edit, not a clone-then-edit double-write).

After 17.11c shipped, the agent has full read/write/branch authority over styrdokument: (a) [pending 19.8] draft a brand-new styrdokument from a type-aware template; (b) ✅ propose section edits to a DRAFT/IN_REVIEW; (c) ✅ propose adding sections; (d) ✅ transparently branch + edit when targeting an APPROVED — all while preserving the `[Källa:]` vs `[Utkast:]` compliance signal grammar throughout. Owner live smoke 2026-06-06 confirmed the DEC-2 contract holds under the auto-branch path (probe 5: agent correctly cited approved v11 as canonical and framed auto-branched draft v12 as "ett pågående utkast föreslår").

### Remaining tracks (post-Phase-5)

- **Subagent track (19.9 + 19.10):** kept deferred until the single-agent loop is fully dogfooded — they multiply behavior and are easier to tune once the core flow is stable.
- **Continuous governance (19.11 + 19.12):** Reminders/scheduling + AgentFeedback thumbs + proactive hem-chat cards. Schedule after 19.8 lands.
- **19.13 grounding eval:** legal-citation grounding/precision (top accuracy risk for a legal product). Added 2026-05-26 to track the GR-001 surfacing (the agent mislabelled SFS 2019:503 "Lex Laval" during the 19.7b smoke). Pairs cleanly with 19.12's feedback loop.

---

## 🔒 Definition of Done for the full vision

- [x] All **9** prerequisite stories shipped (17.8 ✅, 17.9 ✅, 17.10 ✅, 17.10b ✅, 17.11 ✅, 17.11b ✅, 14.22 ✅, 14.23 ✅, 14.24 ✅) — *9 of 9 Done as of 2026-06-06*
- [x] All **3** dual-version sub-epic stories shipped (17.16 ✅ Done gate PASS 92; 17.17 ✅ Done gate PASS 96; 17.18 ✅ Done gate PASS 95 — **sub-epic CLOSED 2026-06-04**)
- [x] Follow-up 17.11c shipped (agent auto-branch on APPROVED) — ✅ Done 2026-06-06 (gate PASS quality 95); closes the authoring triad
- [~] All **4** sibling stories shipped (14.28 ✅, 14.29 ✅, 14.30 ✅, 14.31 Approved-not-built) — *3 of 4 Done*
- [~] All **17** Epic 19 stories shipped (incl. 19.4a id-resolution ✅, 19.4b cycle/finding readers deferred, 19.7 split into a/b/c all ✅, 19.13 grounding eval added 2026-05-26) — *10 of 17 Done*
- [ ] Composite feature flag `agent_partner_v2` enabled in ≥1 customer workspace for ≥2 weeks with no regressions
- [ ] AUDITOR role verified read-only end-to-end (19.5's `tasks:edit` gate threads through every approval dispatch + 19.7c's narrowing) — *infra ✅; live AUDITOR walk-through pending per 19.5 AUD-001*
- [ ] `AgentDecisionLog` populated for every tool call in production (19.5 ✅; one open follow-up — WS-001 `web_search` not wrapped, injected at route)
- [~] Three skills live: `assess_change` ✅, `gap_analysis` ✅, `draft_styrdokument` (type-aware, `types/*.md` module per `WorkspaceDocumentType`) — *2 of 3 live; 19.8 **now unblocked** (dual-version foundation closed 2026-06-04)*
- [ ] Three subagents live: `LegalReasoner`, `DocumentReader`, `ParallelAssessor` (19.9 + 19.10 deferred until single-agent loop is dogfooded)
- [ ] Two cron jobs live: `fire-reminders` (daily 03:00), `weekly-pulse` (weekly) — 19.11
- [x] **17.10b DEC-2 contract holds under the dual-version routing** — adversarial test (per 17.18 AC 10): a prompt asking *"Vad är vår officiella <X>-policy?"* against a dual-state doc elicits a response that cites the APPROVED tier with `[Källa:]` and frames any draft mention as *"ett pågående utkast"* with `[Utkast:]`, NEVER conflating the two. **Verified 2026-06-04** via owner real-LLM live smoke against Supabase production data across 3 adversarial prompt phrasings (Phase 6.1/6.2/6.3 of the 17.18 smoke plan) + 4 deterministic tool-level unit tests in `tests/unit/agent/dec-2-dual-state-hold.test.ts`.
- [ ] **Auditor scenario verified live:** during a revision window on an APPROVED policy, the styrdokument list / doc page / search / agent citations all continue to show the effective approved version as the answer to "what's in force"; the in-progress draft is visible as a secondary signal without obscuring the live policy.
- [ ] E2E smoke test passes: fresh workspace → attach DOCX → "är vi GDPR-compliant?" → agent reads attachment, runs gap_analysis, proposes 3 tasks + 1 policy draft + 2 evidence links, user accepts → all artifacts visible with `via_agent = true`

---

## 📝 Notes

- **Status legend:** `[ ]` pending, `[x]` done, `[~]` in progress. Update inline as stories move.
- **This is a living document** — revise sequencing as real story estimates come in. The "8–10 weeks with 2 devs" estimate is a rough order-of-magnitude; not a commitment.
- **External dependency note:** The lint rule enforcing English-PROCEDURE/Swedish-STYLE discipline (from Epic 19 cross-cutting concerns) can ship independently — not tracked as its own story but bundled into 19.6.
- **Out of scope — tracked for follow-up epics:**
  - Audit package export (PDF/xlsx render) — needs Anthropic managed Skills + code execution tool
  - Peer benchmarking / anonymized cross-workspace comparison
  - Third-party legal data sources (riksdagen propositions, domstol.se, myndighetsguidance)
  - Artifact streaming channel (tokens streaming into preview pane during drafting)
  - Extended agent memory beyond CompanyProfile + ChatMessage (`WorkspaceKnowledgeNote` idea)
