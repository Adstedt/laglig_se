# Agent Partner — Full Completion Checklist

**Purpose:** Master checklist tracking every story required to deliver the full agent-partner vision (reads attachments + existing bevis, diagnoses gaps, proposes concrete actions, drafts styrdokument, continuously nudges users toward compliant state).

**Scope:** Spans 3 epics — prerequisite work in Epic 14 (Compliance Agent) and Epic 17 (DMS), sibling additions to Epic 14, and the new Epic 19 (Agent Partner).

**Linked epic:** [`docs/prd/epic-19-agent-partner-skills-subagents.md`](../prd/epic-19-agent-partner-skills-subagents.md)

**Created:** 2026-04-19
**Last updated:** 2026-05-22
**Owner:** Sarah (PO)

---

## 🧱 Prerequisite foundations (already in flight — not new work)

### Epic 17 — DMS + agent integration (Draft)

- [ ] **17.8** — Text extraction pipeline for uploaded files
  *PDF/DOCX/XLSX → `WorkspaceFile.extracted_text`; pdf-parse, mammoth, exceljs*
- [ ] **17.9** — Chunk & embed workspace documents into RAG pipeline
  *`ContentChunk` with `WORKSPACE_DOCUMENT` source; retrieveContext filter*
- [ ] **17.10** — Agent tools: `search_workspace_documents`, `get_workspace_document`, `list_workspace_documents`
  *Semantic search + read + list of workspace styrdokument*
- [ ] **17.11** — Agent tool: `update_document` (section edits via approval card)
  *Re-scoped 2026-05-22: `create_document` dropped (redundant with 14.24 `draft_styrdokument`); markdown↔Tiptap converters dropped; recast onto the `UPDATE_DOCUMENT` `PendingAgentAction` approval pattern*

### Epic 14 — Agent approval-card primitives (Approved)

- [ ] **14.22** — `AgentActionCard` foundation + `CREATE_TASK` pilot
  *`PendingAgentAction` model + inline card replaces sidebar write-preview*
- [ ] **14.23** — Extended approval types + batch card
  *LINK_TASK_TO_DOC, LINK_DOC_TO_TASK, ADD_OBLIGATION, ASSIGN_TASK + multi-action batching + sidebar decommission*
- [ ] **14.24** — `DRAFT_DOCUMENT` approval
  *Agent drafts full styrdokument with Tiptap preview + "open in editor" path*

---

## 🔌 Sibling write-tool additions to Epic 14 (new — coordinated with Epic 19)

> **Numbering note (2026-05-20):** renumbered from 14.26–14.29 to **14.28–14.31** because Epic 14 shipped 14.26 (Anthropic Prompt Caching v1) and 14.27 (Chat Usage Telemetry) under its Phase 6. These are owned in Epic 14's "Phase 7: Agent Action Card Extensions" section.

- [ ] **14.28** — `update_requirement` approval
  *text / is_fulfilled / comment / bevis_required; new `UPDATE_REQUIREMENT` action type + diff renderer*
- [ ] **14.29** — `add_task_comment` approval
  *New `ADD_TASK_COMMENT` action type*
- [ ] **14.30** — `transition_document_status` approval
  *Ladder guard DRAFT→IN_REVIEW→APPROVED→SUPERSEDED→ARCHIVED; agent cannot APPROVE (separation of duties)*
- [ ] **14.31** — Proposal staleness protection
  *entity_version snapshot + re-read check + Swedish error toast; retrofit across all approval types*

---

## 🚀 Epic 19 — Agent Partner (12 new stories)

### Foundation track (unblocks everything else)

- [ ] **19.1** — Chat attachment upload + Claude content-block conversion
  *Drag-drop UI in chat-input-modern; remove `.filter(p => p.type === 'text')` stripping; `lib/agent/attachments-to-content.ts` routes PDFs → document blocks, images → image blocks, DOCX/XLSX → extracted text*
- [ ] **19.2** — `read_file` unified evidence reader
  *New agent tool reading any WorkspaceFile (chat attachment OR bevis) via shared conversion logic*
- [ ] **19.3** — Diagnostic tools
  *`list_bevis_gaps`, `list_unassessed_changes`, `list_overdue`, `list_stale_documents` — pure reads, workspace-scoped*
- [ ] **19.4** — Entity-read tools
  *`get_law_list_item`, `get_task`, `list_linked_artifacts` — fills retrieval gap between 17.10 (docs) and compliance entity graph*
- [ ] **19.5** — Role-based tool registry filter + `AgentDecisionLog`
  *`createAgentTools(workspaceId, userId, role)` — AUDITOR gets read-only; `AgentDecisionLog` model tracks every tool call*

### Skills track

- [ ] **19.6** — Skill loader + directory convention + context activation
  *`lib/agent/skills/<name>/SKILL.md + PROCEDURE.md + STYLE.md + CRITERIA.md + examples/`; skill-loader.ts; context-bound primary + `activate_skill` meta-tool; tool-registry filtering by skill whitelist*
- [ ] **19.7** — Ship `assess_change` + `gap_analysis` skills
  *Migrate existing `ASSESSMENT_WORKFLOW` string literal to `assess_change/`; new `gap_analysis/` runs 19.3 diagnostics + risk scoring*

### Authoring track

- [ ] **19.8** — `draft_policy` skill + Swedish template library seed
  *`draft_policy/` with PROCEDURE/STRUCTURE/CITATION/examples; seed 3–5 canonical templates (Dataskyddspolicy, Arbetsmiljöpolicy, Incidenthanteringsrutin, Riskbedömning, Leverantörspolicy)*

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
| Prerequisites (Epic 14 + 17) | 7 | Must ship first or in parallel — blocks most of 19 |
| Sibling Epic 14 additions | 4 | Schedule 14.28 + 14.31 alongside 19.7 |
| Epic 19 | 13 | Foundation track (19.1–19.5) unblocks all other tracks |
| **Total** | **24 stories** | ~8–10 weeks with 2 devs |

---

## 🎯 Critical paths

### Shortest route to a usable "agent that does work" (10 stories, ~5 weeks)

```
17.8 → 17.9 → 14.22 → 19.1 → 19.2 → 19.5 → 19.6 → 19.7 → 14.28 → 19.3
```

After this sequence, the core loop is live: agent reads attachments + bevis, diagnoses gaps, proposes fixes via approval cards, runs skills per context. Every remaining story adds capability but the product value is established.

### Fastest "agent reads attachments" demo (3 stories, ~1 week)

```
17.8 → 19.1 → 19.2
```

Ships the "drop a PDF, ask about it" experience only. No skills, no writes, no diagnostics — just sight.

### MVP gap-analysis flow (adds to attachment demo, ~3 weeks total)

```
17.8 → 19.1 → 19.2 → 19.5 → 19.3 → 19.6 → 19.7
```

"Hur står vi till?" lands with proactive gap surfacing + the `gap_analysis` skill producing structured reports.

### Authoring proof-point (adds to MVP, ~5 weeks total)

Prereqs + 17.10, 17.11, 14.22, 14.24 must be done first; then:

```
...MVP chain... → 17.11 → 14.24 → 19.8
```

Agent drafts styrdokument from templates, user reviews in Tiptap preview, approves or edits.

---

## 🔒 Definition of Done for the full vision

- [ ] All 7 prerequisite stories shipped (17.8, 17.9, 17.10, 17.11, 14.22, 14.23, 14.24)
- [ ] All 4 sibling stories shipped (14.28, 14.29, 14.30, 14.31)
- [ ] All 13 Epic 19 stories shipped
- [ ] Composite feature flag `agent_partner_v2` enabled in ≥1 customer workspace for ≥2 weeks with no regressions
- [ ] AUDITOR role verified read-only end-to-end
- [ ] `AgentDecisionLog` populated for every tool call in production
- [ ] Three skills live: `assess_change`, `gap_analysis`, `draft_policy`
- [ ] Three subagents live: `LegalReasoner`, `DocumentReader`, `ParallelAssessor`
- [ ] Two cron jobs live: `fire-reminders` (daily 03:00), `weekly-pulse` (weekly)
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
