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
4. **Phase 3:** Agent sight + diagnostics (19.1–19.5 + 14.28).
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

**Epic 19 (19.1–19.12):** PRD-defined only; full story docs to be drafted via `*create-story` per phase.

---

## Phase 0 — Housekeeping (½ day, no code)

The numbering rename is **already done** in the checklist. Remaining:

- [x] Draft the four sibling stories **14.28 / 14.29 / 14.30 / 14.31** via `*create-story` — drafted 2026-05-21 (Bob/SM), PO-validated (Sarah), fixes applied, all four status → **Approved** (blocked-for-implementation until 14.22 + 14.23 reach Done). Files: `docs/stories/14.28.update-requirement-approval.md`, `14.29.add-task-comment-approval.md`, `14.30.transition-document-status-approval.md`, `14.31.proposal-staleness-protection.md`.
- [x] Update **14.17** status note → *"Superseded-pending — concept absorbed by 19.7 `gap_analysis` + 19.12 proactive cards; the sidebar-inline-form mechanism is obsoleted by 14.23. Revisit (archive vs. salvage) after 19.12 ships."* Done 2026-05-21. **NOT archived** — it's the only written spec for the severity-aware multi-step-suggestion UX, and 19.12 may borrow from it.

---

## TRACK A — Agent Partner (the main sequence)

### Phase 1 — Close the inline-card stack (~1–2 wk) — *mostly built*

1. **14.22** AgentActionCard + `CREATE_TASK` pilot
2. **14.23** Extended types + batch card + write-preview decommission
3. **14.24** `DRAFT_DOCUMENT` approval (Tiptap preview)
4. Ship behind `agent_partner_v2`; dogfood internally.

### Phase 2 — DMS foundation (~2–3 wk)

5. **17.8** text extraction (PDF/DOCX/XLSX → `WorkspaceFile.extracted_text`) ← **single biggest blocker; start Day 1**
6. **17.9** workspace-doc RAG pipeline (`ContentChunk` source `WORKSPACE_DOCUMENT`) — needs 17.8
7. **14.31** proposal staleness protection — *parallel track*; retrofit onto the Phase-1 cards

### Phase 3 — Agent sight + diagnostics (~3 wk)

8. **19.1** chat attachment upload + Claude content-block conversion — needs 17.8
9. **19.2** `read_file` unified evidence reader — needs 19.1
10. **19.5** role-based tool registry filter + `AgentDecisionLog` ← **do early; cheap to add to a few tools now, a refactor across 20+ later**
11. **19.3** diagnostic tools (`list_bevis_gaps`, `list_unassessed_changes`, `list_overdue`, `list_stale_documents`)
12. **19.4** entity-read tools (`get_law_list_item`, `get_task`, `list_linked_artifacts`) — *parallel with 19.3*
13. **14.28** `update_requirement` approval + diff renderer

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
- [ ] All 12 Epic 19 stories shipped
- [ ] `agent_partner_v2` enabled in ≥1 customer workspace ≥2 weeks, no regressions
- [ ] AUDITOR role verified read-only end-to-end; `AgentDecisionLog` populated for every tool call
- [ ] Three skills live (`assess_change`, `gap_analysis`, `draft_policy`); three subagents live; two crons live
- [ ] E2E smoke: fresh workspace → attach DOCX → "är vi GDPR-compliant?" → agent reads attachment, runs `gap_analysis`, proposes 3 tasks + 1 policy draft + 2 evidence links → user accepts → all artifacts visible with `via_agent = true`
- [ ] (Phase 7) 14.19 branching shipped without regressing the card or thumbs surfaces in `chat-message.tsx`
