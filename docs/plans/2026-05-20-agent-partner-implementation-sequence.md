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
- **CP-001** — agent leaked an internal identifier into user-facing copy (*"sätta `bevisRequired = true`"*) during the 19.4 smoke. **Fixed** via a `system-prompt.md` Formateringsregler guardrail (never expose internal field/param names or code-syntax — `bevisRequired`, `lawListItemId`, status enums like `PAGAENDE`; translate to natural Swedish). Reinforce in the 19.7 gap_analysis/draft STYLE.md exemplars (pairs with KP-001). Surfaced 2026-05-24. **Code companion (confirmed in the 19.4 QA review 2026-05-26):** the guardrail's source-side fix also landed in the 19.4 readers — `reader-utils.ts` gained `complianceStatusLabel`/`priorityLabel`/`impactLevelLabel`, now applied in `get_law_list_item`/`get_task` **and** `search_law_list_items` so the readers emit canonical Swedish labels instead of raw enums. Formalized (tests + File List) via the 19.4 QA-fix pass; **currently uncommitted** — flows in with the 19.4 commit.
- **SA-001** — `save_assessment` is the **lone agent write tool never migrated to the 14.22–24 inline `PendingAgentAction`/`AgentActionCard` pattern**: its factory takes `(workspaceId, userId)` (not `writeContext`), and on `execute:true` it **upserts the `ChangeAssessment` straight to the DB with no approval gate** — so the agent can persist an assessment (marks a lagändring REVIEWED + sets impact) silently, showing a "Sparade bedömning" chip instead of a Godkänn/Avvisa card. Violates the "AI proposes, you approve" principle. Surfaced 2026-05-26 during the 19.3 smoke. **Fix = migrate it exactly as Story 14.28 did for `update_requirement`** (new `PendingAgentActionType` value + writeContext + drop `execute:true` + renderer + dispatch branch doing the upsert). **Open scheduling call:** standalone sibling **14.32**, OR fold into **19.7** (`assess_change` skill — already owns the assessment workflow). Standalone if the silent-save bug needs fixing before Phase 4; otherwise fold into 19.7. Deferred by owner 2026-05-26 ("fix later"). Also fixes the secondary symptom (the assessment sidebar's "Kunde inte spara" in a GLOBAL chat — the legacy flow was only hardened for the dedicated change-modal).
- **GR-001** — **legal-citation grounding / precision** (top accuracy risk for the product). Surfaced 2026-05-26 during the 19.7b assess_change-enrichment smoke: the agent labelled **SFS 2019:503** the "Lex Laval-reformen" (Lex Laval = the *2010* posted-workers reform, SFS 2010:228; 2019:503 is the domestic *utökad fredsplikt* reform) and cited §§ (41 a/b/e) that need source-verification against the retrieved amendment. The enrichment itself worked (read current state); this is the **orthogonal law-data citation layer**. Already noted in the Epic-19 PRD KP-001 entry as "a separate 19.13/grounding concern." **Fix → a grounding/citation-verification story (19.13):** confirm whether cited §-pills derive from retrieved `SectionChange`/amendment text or are model-generated (fabrication check); ground change-summary claims in the published författningstext, not training data. Captured in gate `docs/qa/gates/19.7b-gap-analysis-skill.yml`.
- **197B-S1** — *(RESOLVED 2026-05-26)* write-tool results auto-opened a useless detail sidebar (raw `{pendingActionId}` envelope) because `wrapWriteToolResponse` hardcoded `sidebarHint: 'open'` (pre-existing since commit 82a1415f). Surfaced by the 19.7b gap_analysis smoke (create_task). **Fixed standalone** (`lib/agent/tools/utils.ts` → `'none'` + `tests/unit/agent/tools/utils.test.ts`); `draft_styrdokument`'s editor canvas is a separate renderer button, unaffected. Improves every approval-card flow.
- **WSS-001** — **chat (and view) not re-scoped on workspace swap.** Surfaced 2026-05-27 during the 19.7c smoke. The chat route re-resolves the workspace **per request** via `getWorkspaceContext()` (`app/api/chat/route.ts:92`), but the chat panel does not reset when the active workspace changes. So a thread started in workspace A keeps its messages visible while the *next* turn silently re-scopes to workspace B (tools, company context, and new `ChatMessage` rows all bind to B) → split-brain thread + `ChatMessage` rows spanning two `workspace_id`s. Confirmed live (Almåsa gap-analysis thread persisted after swapping to Nordviken; a fresh query then returned Nordviken's data). **Not a security issue** (own workspaces via `getWorkspaceContext`); UX + data-integrity, medium severity. **Preferred fix (owner, 2026-05-27): on workspace swap, navigate to the new workspace's dashboard** — a full context switch that naturally resets the chat (and everything else) to the new workspace. Out of Epic-19 scope (chat-shell / workspace concern, predates the agent work) → candidate standalone story.

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

### Completion notes — addendum 2026-05-26 (19.4 QA cycle → DONE)

**19.4 shipped.** Full cycle in one day: review → **CONCERNS** → dev-fixed → re-review → **owner live smoke PASS** → **gate PASS (quality 95)** → Status **Done**, moved to `completed/`. **Now 12 in `completed/`; Phase 3 is 5 of 7 built** (remaining: **19.3** diagnostics, **14.28** `update_requirement` approval). *The working-tree commit is the one pending mechanical step (manual-commit workflow).*

- **QA gate (Quinn, `docs/qa/gates/19.4-entity-read-tools.yml`): CONCERNS, quality 90.** All 13 ACs implemented, workspace-isolation solid + unit-tested on all three readers, caps at the Prisma `take` level (SF-1), names-not-IDs enforced, SF-A delegation correct, `tsc` 0 errors branch-wide. CONCERNS was **doc/traceability hygiene**, not functional defect: the story's File List/Change Log understated the working tree (the CP-001 enum-label fix + a `use-list-item-details.ts` modal-refresh tweak were uncommitted + undocumented), plus two minor test-coverage gaps.
- **Dev fixes (James) applied + QA-verified green:** 194-001 (File List/Change Log reconciled), 194-002 (`reader-utils.test.ts`), 194-005 (`get_task` not-found + SF-A delegation tests). 27/27 targeted vitest, tsc 0 errors. **Not committed** (left to the human per the apply-qa-fixes protocol).
- **Open before 19.4 can ship (none are code/dev):** (a) commit the working tree; (b) **194-003** — PO ruling on the `use-list-item-details.ts` scope (it's outside 19.4's read-only AC); (c) the **live traversal smoke** (LAW "är vi compliant?" → `get_law_list_item` → `list_linked_artifacts` → `read_file`; confirm read-before-propose fires). **194-004** (uncapped linked-artifacts union) is future/telemetry-gated.
- **Sequence unchanged:** 19.4 + 19.3 still close Phase 3 alongside 14.28; 19.4b stays deferred to the next Epic 21 work.

### Completion notes — addendum 2026-05-26 (19.3 DONE)

**19.3 shipped** (same-day SM→PO→Dev→QA cycle + owner smoke; gate PASS 95). **Now 13 in `completed/`; Phase 3 is 6 of 7 built — only 14.28 (`update_requirement` approval) remains to close it**, after which Phase 4 (Skills: 19.6/19.7 + 14.29/14.30) opens. QA's `changeType`-label fix consolidated all four reader enum-fields through `reader-utils`. **Surfaced during 19.3 smoke (separate bug, not 19.3 scope):** `save_assessment` is the lone write tool never migrated to the inline `PendingAgentAction`/AgentActionCard approval pattern — it auto-saves via `execute:true` with no gate; candidate sibling story (e.g. "14.32 — migrate save_assessment to the approval card"). Working-tree commit still pending (manual-commit workflow); the batch also carries the chat-table styling + the landing change-assessment dialogue.

### Completion notes — addendum 2026-05-26 (14.28 DONE → Phase 3 COMPLETE)

**14.28 (`update_requirement` approval) shipped** (gate PASS 95; owner live smoke verified the diff card + approve flow). **Phase 3 is now COMPLETE — 7 of 7: 19.1, 19.2, 19.4a, 19.4, 19.5, 19.3, 14.28.** **Now 14 in `completed/`.** The 8th `PendingAgentAction` type; the additive enum migration was applied by the owner.

**➡️ Phase 4 — Skills (in progress, updated 2026-05-26).** **19.6** skill-loader library ✅ **DONE** (gate PASS 95). **19.7 split → a/b/c** (it ballooned once 19.6 went loader-only): **19.7a** (integration: buildSystemPrompt injection + `<available_skills>` + `activate_skill` + the `assess_change` migration) — **Approved, next to build**; **19.7b** (`gap_analysis` + KP-001 framing); **19.7c** (per-skill registry narrowing — PO-deferred until ≥2 skills + ~30 tools). Siblings **14.29** (`add_task_comment`) + **14.30** (`transition_document_status`) batch into Phase 4; **14.31** (staleness) retrofits the approval types (14.28 already populates `entity_version`). See the Phase 4 list below for detail.

**Process findings surfaced this run (carry into Phase 4 stories):** (a) **new-tool story checklist must include a `TOOL_CONFIG` chip-label AC** — 14.28 shipped a raw chip name until the smoke caught it (1428-001); (b) **`save_assessment` is the lone write tool NOT on the inline approval-card pattern** (auto-saves via `execute:true`) — candidate sibling **14.32**, surfaced during the 19.3 smoke. Still uncommitted: the full session batch (19.3 + 14.28 + QA `changeType` fix + chat-table CSS + landing dialogue + the migration).

### Completion notes — addendum 2026-05-26 (19.7a DONE → first real skill live)

**19.7a (skills integration + `assess_change`) shipped** (gate PASS, quality 95). The skill loader (19.6) is now wired into the live agent: `buildSystemPrompt` injects the context-primary skill via `getPrimarySkillForContext` (a change chat → `assess_change`) at the slot the old `ASSESSMENT_WORKFLOW` literal occupied, plus an `<available_skills>` catalogue and a `'read'`-tier **`activate_skill`** meta-tool (registry factory **26→27**, AUDITOR-kept). **Behaviour-preserving migration** — QA reconstructed the deleted literal from `git HEAD` and `diff -u`'d it against `PROCEDURE.md`: **byte-identical**. The four tool-call steps + four recommendation states carried over unchanged. Suites green: agent **229/229**, ai-chat **107/107**, `tsc` 0, `eslint` clean. One low finding (197A-001 — stale `assessment_workflow` cross-reference in the base prompt) fixed in-review.

- **Now 17 in `completed/`.** **Phase 4 — Skills: 19.6 ✅, 19.7a ✅, 19.7b ✅** (3-way 19.7 split — only **19.7c** registry narrowing remains, PO-deferred) + siblings **14.29/14.30** + retrofit **14.31**.
- **Domain playbooks are now file-edited, not deploy-locked** — the core payoff of the skills track. `assess_change`'s PROCEDURE/STYLE/CRITERIA are editable markdown.
- **19.7b (gap_analysis + KP-001 + assess_change enrichment) shipped** (gate PASS, quality 93; owner-smoked both flows). Two pre-existing items surfaced & handled: **197B-S1** write-tool sidebar auto-open **fixed standalone** (`utils.ts` `sidebarHint 'open'→'none'` — every approval-card flow was popping a raw-envelope sidebar since commit 82a1415f); **GR-001** legal-citation grounding (the agent mislabelled SFS 2019:503 "Lex Laval" + unverified §-cites) **tracked → 19.13** (top accuracy risk for a legal product — verify retrieved-vs-generated citations).
- **➡️ Next in sequence → 14.29** (`add_task_comment`) / **14.30** (`transition_document_status`) batch into Phase 4; **19.7c** (registry narrowing) is now unblocked (≥2 skills exist: assess_change + gap_analysis) — do it with a no-regression harness across both skills.
- Working-tree commit still pending per the manual-commit workflow (this batch carries 19.6 + 19.7a + the session's prior uncommitted work).

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

### Phase 3 — Agent sight + diagnostics (~3 wk) — ✅ **COMPLETE (7 of 7)**

8. **19.1** chat attachment upload + Claude content-block conversion — needs 17.8 — ✅ **DONE** (2026-05-24, `completed/`)
9. **19.2** `read_file` unified evidence reader — needs 19.1 — ✅ **DONE** (2026-05-24, `completed/`; QA PASS 94; read-vs-snippet live-verified — agent self-corrected a snippet-only analysis by reading 4 docs)
10. **19.5** role-based tool registry filter + `AgentDecisionLog` ← **do early; cheap to add to a few tools now, a refactor across 20+ later** — ✅ **DONE** (2026-05-24, `completed/`)
11. **19.3** diagnostic tools (`list_bevis_gaps`, `list_unassessed_changes`, `list_overdue`, `list_stale_documents`) — ✅ **DONE 2026-05-26** (`docs/stories/completed/19.3.agent-diagnostic-tools.md`; gate `docs/qa/gates/19.3-agent-diagnostic-tools.yml` = **PASS, quality 95**). Full SM→PO→Dev→QA cycle + owner live smoke (all four fired in a real GLOBAL chat; count-as-work-items + empty-state framing confirmed). QA fixed the one AC-3 gap in review (`changeType` labelled). Two low non-blocking follow-ups tracked (193-002 limit-clamp, 193-003 helper/steering test parity). No migration.
12. **19.4a** id-resolution + entity discovery (thread `lawListItemId` into context; `search_law_list_items`) ← **prerequisite for 19.4; also retro-hardens the shipped law-item write tools** (added 2026-05-24) — ✅ **DONE 2026-05-24** (`docs/stories/completed/19.4a.agent-id-resolution-discovery.md`; QA PASS 91; both smoke paths verified live, no migration). Unblocks 19.4. SM reconciliation (PO-verified): the brief's Finding B is stale — the LAW chat already sends `contextId = listItemId` (`ai-chat-panel.tsx:47`), so scope narrowed to surfacing the id (prompt + tool-context default) + threading the CHANGE-context id + the two discovery tools.
13. **19.4** entity-read tools (`get_law_list_item`, `get_task`, `list_linked_artifacts`) — lazy-traversal/`ContextHandle` model — ✅ **DONE 2026-05-26** (`docs/stories/completed/19.4.entity-read-tools.md`; gate `docs/qa/gates/19.4-entity-read-tools.yml` = **PASS, quality 95**). QA cycle: review → CONCERNS (doc/traceability hygiene, not code) → dev fixes (194-001/002/005 closed + verified) → re-review → **owner ran the full live traversal smoke (PASS)** → gate flipped to PASS. The flagship reader: reads a law-item's state + linked artifacts (closes the "can't see what's linked" gap from the 19.4a smoke) + feeds bevis file-ids to `read_file`. **Tracked-low follow-ups (non-blocking):** 194-003 (`use-list-item-details.ts` modal-refresh — owner-accepted into scope, merge untested) + 194-004 (uncapped `loadLinkedArtifacts` union — future/telemetry-gated). *Commit of the working tree pending per the manual-commit workflow.*
14. **14.28** `update_requirement` approval + diff renderer — ✅ **DONE 2026-05-26** (`docs/stories/completed/14.28.update-requirement-approval.md`; gate `docs/qa/gates/14.28-update-requirement-approval.yml` = **PASS, quality 95**). Full SM→PO(×2 incl. a re-validation against shipped code)→Dev→QA cycle + owner live smoke (inline diff card → editable → approve flow; two FE polishes fixed in the loop). The 8th `PendingAgentAction` type; additive enum migration applied. **Closes Phase 3.**

> **19.4b** (`get_cycle`/`get_finding` readers) is **not** scheduled here — sequence it to ride with the next Epic 21 work (reads the same models). See Epic 19 PRD + `docs/agent-knowledge-traversal-brief.md`.

### Phase 4 — Skills system (~2 wk) — 🟡 **IN PROGRESS** (19.6 ✅, 19.7a ✅, 19.7b ✅; remaining: 19.7c deferred + siblings 14.29/14.30)

14. **19.6** skill loader **library** + directory convention — ✅ **DONE 2026-05-26** (`docs/stories/completed/19.6.skill-loader.md`; gate `docs/qa/gates/19.6-skill-loader.yml` = **PASS, quality 95**). Pure `skill-loader.ts` + `_template`/README + 10 fixture tests; zero integration / zero prod surface (AC-6 verified — no files modified). **15 in `completed/`.** Loader-only per the v0.3 re-scope; agent wiring → **19.7a** (integration) + **19.7c** (narrowing).
15. **19.7 — SPLIT 2026-05-26** (it ballooned after the 19.6 re-scope dumped the integration in; oversized as one story):
    - **19.7a** skills integration + `assess_change` — ✅ **DONE 2026-05-26** (`docs/stories/completed/19.7a.skills-integration-assess-change.md`; gate `docs/qa/gates/19.7a-skills-integration-assess-change.yml` = **PASS, quality 95**, re-verified). Wired the loader into the agent: buildSystemPrompt primary-skill injection + `<available_skills>` + `activate_skill` meta-tool (registry 26→27); shipped `assess_change` (the `ASSESSMENT_WORKFLOW` literal migrated **verbatim** — git-diff byte-identical) as the first real skill. **Behaviour-preserving** — PO deferred registry narrowing out of 19.7a (→ 19.7c). One low QA finding (197A-001: stale base-prompt cross-reference) fixed in-review. **16 in `completed/`.** Deps: 19.6 (loader ✅).
    - **19.7b** `gap_analysis` skill (net-new: orchestrate the four 19.3 diagnostics + prompt-reasoned risk tiers + structured Swedish report w/ capped Tier-2 proposals) + **KP-001** kravpunkt-framing rule (also the `add_obligation` description + a system-prompt line) **+ `assess_change` current-state enrichment** (folded in 2026-05-26 per owner: add `get_law_list_item` → conditional `list_linked_artifacts` to the assessment prep phase so the bedömning references existing kravpunkter / linked styrdokument / prior assessments — both readers auto-resolve the active item from the change-chat context, so no agent-supplied id). ✅ **DONE 2026-05-26** (`docs/stories/completed/19.7b.gap-analysis-skill.md`; gate `docs/qa/gates/19.7b-gap-analysis-skill.yml` = **PASS, quality 93**; owner live-smoked **both** flows — gap_analysis tiered report + the assess_change enrichment's "Läste laglistpost" read). No new integration / schema / migration / tools — pure skill content + one `add_obligation` description line, rides 19.7a's machinery + 19.3/19.4 tools. **PO rulings:** gap_analysis = **activation-only** (`contextTypes: []`) · PROCEDURE = **Swedish** · **CI bilingual-lint DROPPED** → DoD reconciliation action (open). **Two smoke-surfaced items (both pre-existing, out of 19.7b scope):** **197B-S1** (write-tool sidebar auto-open) **fixed standalone** in `utils.ts` (`sidebarHint 'open'→'none'`); **GR-001** (legal-citation grounding — "Lex Laval" mislabel) **tracked → 19.13**. Deps: 19.7a + 19.3 + 19.4 (all ✅).
    - **19.7c** per-skill tool-registry narrowing (`createAgentTools` `activeSkills` + `ALWAYS_AVAILABLE ∪ whitelists` + route wiring) — **Approved v0.2 2026-05-27** (`docs/stories/19.7c.registry-narrowing.md`; PO GO 9/10; option 1 = seam + harness). Un-deferred now that ≥2 skills exist (the PO precondition). **PO ruling:** the `save_assessment` gate is a correction, not a regression (it requires a `changeEventId` → change-bound; cross-links SA-001 secondary symptom, core stays 14.32). **Key finding:** at 27 tools the narrowing gates exactly **one** tool (`save_assessment`, the lone genuinely-skill-specific tool); every other tool is a universal read or ad-hoc write → `ALWAYS_AVAILABLE`. So the durable deliverable is the **`activeSkills` mechanism + no-regression harness** (forward-safety for 19.8+), not today's 1-tool reduction. Behaviour-preserving except the intended `save_assessment` gate (present only in the change context). Cross-links **SA-001** (secondary symptom incidentally neutralised; core still 14.32). Deps: 19.7a + 19.7b (✅).
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
