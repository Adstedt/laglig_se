# Plan: Agent Partner — Implementation Sequence

**Created:** 2026-05-20
**Scope:** The full agent-partner vision across Epic 14 (approval cards), Epic 17 (DMS), Epic 19 (skills/subagents/governance), plus the chat-UX-parity story 14.19.
**Linked docs:** [`docs/stories/EPIC-19-AGENT-PARTNER-CHECKLIST.md`](../stories/EPIC-19-AGENT-PARTNER-CHECKLIST.md), [`docs/prd/epic-19-agent-partner-skills-subagents.md`](../prd/epic-19-agent-partner-skills-subagents.md)

---

## TL;DR

One ordered critical path (Track A) delivers the agent-partner loop. Two independent tracks (B = RAG quality, C = a superseded-pending story) run on their own clocks.

1. **Phase 0:** Draft the four renumbered sibling stories; fix one status note. (No code.)
2. **Phase 1:** Close the inline-card stack (14.22–24) — mostly built.
3. **Phase 2:** DMS foundation — 17.8 text extraction is the single biggest blocker.
4. **Phase 3:** Agent sight + diagnostics (19.1–19.5, incl. 19.4a id-resolution, + 14.28).
5. **Phase 4:** Skills system (19.6–19.7 + 14.29/14.30). ← read-and-diagnose loop hits its smoke-test DoD.
6. **Phase 5:** Authoring (17.10–17.11 + 19.8).
7. **Phase 6:** Scale + governance (19.9–19.12).
8. **Phase 7:** Chat-UX parity (14.19) — standalone, scheduled last to avoid a 3-way conflict in `chat-message.tsx`.

**The one rule that prevents pain:** `components/features/ai-chat/chat-message.tsx` is touched by the card stack (14.22–24), the feedback thumbs (19.12), and message branching (14.19). Keep those three strictly **linear** — never two in flight at once. Everything else parallelizes along track boundaries.

Rough total: **~12–14 weeks (1 dev) / ~8–10 weeks (2 devs)**.

---

## Current state (verified 2026-05-20)

**Done / in `completed/`:** 14.7a–c (tools), 14.9 (system prompt), 14.15a/b (agent shell + interactive surfaces), 14.16 (citation grounding), 14.18 (collapsed tool calls), 14.20 (extended thinking), 14.21 (web search), 14.25–27 (chat sidebar, prompt caching, usage telemetry), 17.1/12/13/16/17/18 (DMS data models, linking, browser, kravpunkter, linked artifacts).

**Approved, mostly built:** 14.22, 14.23, 14.24.

**Draft (blocker work):** 17.8, 17.9, 17.10, 17.11.

**Renumbered siblings — undrafted (story files do not exist yet):**

| Sibling story | Old # | **Canonical #** |
|---|---|---|
| `update_requirement` approval + diff renderer | 14.26 | **14.28** |
| `add_task_comment` approval | 14.27 | **14.29** |
| `transition_document_status` approval | 14.28 | **14.30** |
| Proposal staleness protection | 14.29 | **14.31** |

*(Renumbered in the checklist on 2026-05-20 because Epic 14 shipped 14.26 = Prompt Caching, 14.27 = Usage Telemetry.)*

**Epic 19 (19.1–19.13 + 19.4a/19.4b):** PRD-defined only; full story docs to be drafted via `*create-story` per phase. 19.4a (id-resolution + discovery) and 19.4b (cycle/finding readers) added 2026-05-24 from the architect-reviewed knowledge-traversal brief; 19.4 refined to a lazy-traversal model.

---

## Progress update — 2026-05-24

**Shipped since the 2026-05-20 snapshot (Done → `completed/`):**
- **Phase 1 — DONE:** 14.22, 14.23, 14.24 (inline-card stack).
- **Phase 2 — DONE.** 17.8 (text extraction) + the RAG pipeline, which **split** into: **17.9** (`USER_FILE` chunks) ✅, **17.9b** (`WORKSPACE_DOCUMENT`/styrdokument chunks) ✅, **17.9c** (`search_workspace_files` USER_FILE search tool) ✅. 14.31 (staleness) still Approved-not-built (batches with 14.28+14.30 per its deps).
- **Phase 3 — in progress:** **19.1** (chat attachments) ✅ · **19.5** (role registry + `AgentDecisionLog`, the "do-early" seam) ✅.

**Drafted, not built:** **17.9d** (file-aware citation pill — snippet sidebar + open-in-preview), **19.1b** (promote chat attachment → Filer). 17.10 Approved / 17.11 Draft (Phase 5).

**Follow-ups surfaced (tracked in QA gates, not yet stories):**
- **STO-001** — chat-attachment storage retention (sent `CHAT_ATTACHMENT` files accumulate, hidden from Filer, no cleanup).
- **WS-001** — `web_search` isn't wrapped by 19.5's decision-log (injected at the route, not the factory).
- **KP-001** — agent-proposed kravpunkter are phrased as **imperative to-dos** (*"Genomför…", "Säkerställ…"*) instead of **verifiable obligations/criteria** (*"…genomförs och dokumenteras (11 §)"*), mismatching the template house style and conflating requirement with action. Fix: framing rule in **19.7 gap_analysis STYLE.md** + the shipped **`add_obligation`** tool guidance. Surfaced 2026-05-24 during the 19.4a smoke; captured in the Epic 19 PRD 19.7 entry.
- **SLI-001** — `search_law_list_items` name matching: the lightweight Swedish definite-form fix (token + suffix-strip, shipped in 19.4a v0.5) handles definite forms + the common cases, but is still substring-based — brittle to typos, word order, and inflection beyond definite suffixes. **Robust follow-up:** PostgreSQL `pg_trgm` trigram similarity (fuzzy match) — needs the extension + a GIN index on `document.title` (a migration) + a similarity threshold to tune. Promote if name-resolution misses recur. Surfaced 2026-05-24 during the 19.4a smoke.

**Next in sequence → 19.2 (`read_file`):** only dep (19.1) is Done; pairs with 19.1's `attachments-to-content.ts` converter and unblocks 19.9's `DocumentReader`. Then 19.3 / 19.4a → 19.4 / 14.28 to close Phase 3.

### Completion notes — addendum 2026-05-24 (later)

**Done → `completed/` (verified against the folder):** 14.22, 14.23, 14.24 · 17.8, 17.9, 17.9b, 17.9c · 19.1, 19.5. **= 9 stories shipped.**

**19.2 (`read_file`) APPROVED** (`docs/stories/19.2.read-file-evidence-reader.md`, v0.2, status Approved — PO `validate-next-story` GO 9/10) — ready for `*develop-story`. Design pins: extracts 19.1's converter routing into a shared `lib/agent/file-content.ts` core; delivers native PDF/image to the model via the AI-SDK `tool.toModelOutput` hook (Task-1 spike confirms the shape on `ai@6.0.50` + `@ai-sdk/anthropic@3.0.23`; text-only fallback noted); lean `execute` envelope keeps base64 out of `AgentDecisionLog`; registers as a `'read'` tool (kept for AUDITOR, auto-wrapped by 19.5's decision-log loop). Immediate id-source = `search_workspace_files.fileId` (19.4 widens it later).

**Phase 3 status:** 2 built (19.1, 19.5) + 1 drafted (19.2); remaining to build = 19.2, 19.3, 19.4a, 19.4, 14.28. **Phases 1–2 fully shipped.** 14.31 remains Approved-not-built (Phase-1 retrofit, batches with 14.28/14.30).

### Completion notes — addendum 2026-05-24 (post-19.4a)

**Shipped (Done → `completed/`): 11 stories.** Adds **19.2** (`read_file`, QA PASS 95) + **19.4a** (id-resolution + discovery, QA PASS 91) to the prior 9. Both smoke-verified live; pushed in `ce19cf96`.

**Phase 3: 4 of 7 built** — 19.1, 19.5, 19.2, 19.4a ✅. **Remaining: 19.3, 19.4, 14.28.**

**➡️ Next in sequence → 19.4 (entity-readers `get_law_list_item` / `list_linked_artifacts`).** Now unblocked by 19.4a (consumes the threaded `lawListItemId` + the `search_law_list_items` entry point). Highest-leverage: it's the flagship reader that lets the agent actually read a law-item's state + its linked artifacts — directly closing the *"agent can't see what's linked to this law"* gap observed during the 19.4a smoke (today it falls back to semantic search and guesses). It also surfaces bevis file-ids to 19.2's `read_file`, completing the "read the evidence on a kravpunkt" loop.
- **Alternative / parallel:** **19.3** (diagnostics — `list_bevis_gaps` / `list_unassessed_changes` / `list_overdue` / `list_stale_documents`); no deps, powers the gap-analysis flow + fixes the "saknas helt from a search miss" reliability gap. 19.3 and 19.4 both close Phase 3 — either order works.
- **Sibling:** **14.28** (`update_requirement` approval) — schedule alongside per its deps.

---

## Phase 0 — Housekeeping (½ day, no code)

The numbering rename is **already done** in the checklist. Remaining:

- [x] Draft the four sibling stories **14.28 / 14.29 / 14.30 / 14.31** via `*create-story` — drafted 2026-05-21 (Bob/SM), PO-validated (Sarah), fixes applied, all four status → **Approved** (blocked-for-implementation until 14.22 + 14.23 reach Done). Files: `docs/stories/14.28.update-requirement-approval.md`, `14.29.add-task-comment-approval.md`, `14.30.transition-document-status-approval.md`, `14.31.proposal-staleness-protection.md`.
- [x] Update **14.17** status note → *"Superseded-pending — concept absorbed by 19.7 `gap_analysis` + 19.12 proactive cards; the sidebar-inline-form mechanism is obsoleted by 14.23. Revisit (archive vs. salvage) after 19.12 ships."* Done 2026-05-21. **NOT archived** — it's the only written spec for the severity-aware multi-step-suggestion UX, and 19.12 may borrow from it.

---

## TRACK A — Agent Partner (the main sequence)

### Phase 1 — Close the inline-card stack (~1–2 wk) — ✅ **DONE**

1. **14.22** AgentActionCard + `CREATE_TASK` pilot — ✅ **DONE** (`completed/`)
2. **14.23** Extended types + batch card + write-preview decommission — ✅ **DONE** (`completed/`)
3. **14.24** `DRAFT_DOCUMENT` approval (Tiptap preview) — ✅ **DONE** (`completed/`)
4. Ship behind `agent_partner_v2`; dogfood internally.

### Phase 2 — DMS foundation (~2–3 wk) — ✅ **DONE** (RAG split 17.9 → 17.9/b/c)

5. **17.8** text extraction (PDF/DOCX/XLSX → `WorkspaceFile.extracted_text`) — ✅ **DONE** (`completed/`) ← *was the single biggest blocker*
6. **17.9** workspace-doc RAG pipeline — **split + all DONE:** **17.9** (`USER_FILE` chunks) ✅ · **17.9b** (`WORKSPACE_DOCUMENT`/styrdokument chunks) ✅ · **17.9c** (`search_workspace_files` USER_FILE tool) ✅ — all in `completed/`. *(Drafted, not built: **17.9d** file-aware citation pill.)*
7. **14.31** proposal staleness protection — *parallel track*; **Approved, not built** (batches with 14.28+14.30 per its deps)

### Phase 3 — Agent sight + diagnostics (~3 wk) — *in progress (4 of 7 done)*

8. **19.1** chat attachment upload + Claude content-block conversion — needs 17.8 — ✅ **DONE** (2026-05-24, `completed/`)
9. **19.2** `read_file` unified evidence reader — needs 19.1 — ✅ **DONE** (2026-05-24, `completed/`; QA PASS 94; read-vs-snippet live-verified — agent self-corrected a snippet-only analysis by reading 4 docs)
10. **19.5** role-based tool registry filter + `AgentDecisionLog` ← **do early; cheap to add to a few tools now, a refactor across 20+ later** — ✅ **DONE** (2026-05-24, `completed/`)
11. **19.3** diagnostic tools (`list_bevis_gaps`, `list_unassessed_changes`, `list_overdue`, `list_stale_documents`) — ⬜ pending
12. **19.4a** id-resolution + entity discovery (thread `lawListItemId` into context; `search_law_list_items`) ← **prerequisite for 19.4; also retro-hardens the shipped law-item write tools** (added 2026-05-24) — ✅ **DONE 2026-05-24** (`docs/stories/completed/19.4a.agent-id-resolution-discovery.md`; QA PASS 91; both smoke paths verified live, no migration). Unblocks 19.4. SM reconciliation (PO-verified): the brief's Finding B is stale — the LAW chat already sends `contextId = listItemId` (`ai-chat-panel.tsx:47`), so scope narrowed to surfacing the id (prompt + tool-context default) + threading the CHANGE-context id + the two discovery tools.
13. **19.4** entity-read tools (`get_law_list_item`, `get_task`, `list_linked_artifacts`) — lazy-traversal/`ContextHandle` model — 🔬 **READY FOR REVIEW 2026-05-24** (`docs/stories/19.4.entity-read-tools.md`, v0.4; implemented, +15 tests, full unit suite green, no migration; pending review/smoke). The flagship reader: reads a law-item's state + linked artifacts (closes the "can't see what's linked" gap from the 19.4a smoke) + feeds bevis file-ids to `read_file`. *(Parallel with 19.3.)*
14. **14.28** `update_requirement` approval + diff renderer — ⬜ pending (Draft exists)

> **19.4b** (`get_cycle`/`get_finding` readers) is **not** scheduled here — sequence it to ride with the next Epic 21 work (reads the same models). See Epic 19 PRD + `docs/agent-knowledge-traversal-brief.md`.

### Phase 4 — Skills system (~2 wk)

14. **19.6** skill loader + directory convention + `activate_skill`
15. **19.7** ship `assess_change` (migrate `ASSESSMENT_WORKFLOW` literal) + `gap_analysis`
16. **14.29** `add_task_comment` approval
17. **14.30** `transition_document_status` approval (ladder guard; agent cannot APPROVE)

✅ **Read-and-diagnose loop hits its smoke-test DoD here.**

### Phase 5 — Authoring (~2 wk)

18. **17.10** workspace doc tools (search / read / list)
19. **17.11** `create_document` / `update_document` tools
20. **19.8** `draft_policy` skill + Swedish template seed — needs 17.11 + 14.24 + 19.6

### Phase 6 — Scale + governance (~2 wk; pick by ROI)

21. **19.9** subagent runner + `LegalReasoner` + `DocumentReader`
22. **19.10** `ParallelAssessor` + `bulk_assess_changes` — needs 19.7 + 19.9 + 14.23
23. **19.11** Reminders + scheduling tools + `fire-reminders` / `weekly-pulse` crons
24. **19.12** `AgentFeedback` thumbs + proactive hem-chat cards

### Phase 7 — Chat-UX parity (standalone, ~3–5 days)

25. **14.19** edit & rerun chat messages with branching — **schedule AFTER 19.12.** It rewrites the message-ordering/render path in `chat-message.tsx`, the same file 14.22–24 and 19.12 touch.
    - *Escape hatch if users demand it sooner:* land **14.19a** (schema + backfill + server actions — pure backend, zero collision) early; defer **14.19b/c** (the `chat-message.tsx` UI) to here.

---

## TRACK B — RAG quality / data backend (independent; no agent deps)

Run any time; nothing in Track A blocks on these.

- **14.2b** amendment full re-ingestion (~34k docs, canonical prompt) — *believed done via a manual batch run; verify and flip status to Done, else ~$1,400 Batch-API run.*
- **14.13** retrieval ground-truth labeling + accuracy harness (status: Approved, not done) — do **before** any retrieval-tuning / BM25 decision; it's the measurement tool.
- **14.16** incremental chunk sync with content hashing (status: Draft) — schedule when the chunk-pipeline cost becomes a real bill.

---

## TRACK C — Superseded-pending

- **14.17** Agent action plans (multi-step suggestions) — **not archived.** Mechanism obsoleted by 14.23; concept absorbed by 19.7 + 19.12. Decide archive-vs-salvage *after* 19.12 ships.

---

## Critical-path callouts

- **17.8 is the single biggest blocker** — it sits at the head of every Epic 19 path. With two devs, start it Day 1 of Phase 2 in parallel with closing Phase 1.
- **19.5 before 19.3/19.4** — adding the role filter + audit log to a handful of tools is cheap; retrofitting it across the full registry later is not.
- **Defer 19.9/19.10 subagents** until the single-agent loop is dogfooded — they multiply behavior and are easier to tune once the core flow is stable.
- **17.10/17.11 stay in Phase 5**, not Phase 2 — they only matter for authoring; pushing them late keeps the DMS-foundation phase narrow.

---

## Definition of Done (full vision)

Mirrors `EPIC-19-AGENT-PARTNER-CHECKLIST.md`:

- [ ] Prerequisites shipped: 17.8, 17.9, 17.10, 17.11, 14.22, 14.23, 14.24
- [ ] Siblings shipped: 14.28, 14.29, 14.30, 14.31
- [ ] All 15 Epic 19 stories shipped (incl. 19.4a id-resolution, 19.4b cycle/finding readers)
- [ ] `agent_partner_v2` enabled in ≥1 customer workspace ≥2 weeks, no regressions
- [ ] AUDITOR role verified read-only end-to-end; `AgentDecisionLog` populated for every tool call
- [ ] Three skills live (`assess_change`, `gap_analysis`, `draft_policy`); three subagents live; two crons live
- [ ] E2E smoke: fresh workspace → attach DOCX → "är vi GDPR-compliant?" → agent reads attachment, runs `gap_analysis`, proposes 3 tasks + 1 policy draft + 2 evidence links → user accepts → all artifacts visible with `via_agent = true`
- [ ] (Phase 7) 14.19 branching shipped without regressing the card or thumbs surfaces in `chat-message.tsx`
