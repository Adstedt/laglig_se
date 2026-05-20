# Epic 19: Agent Partner — Attachments, Skills, Subagents & Continuous Governance

**Goal:** Evolve the Laglig compliance agent from "informs users" to "helps users *complete compliance work*" by adding the architectural primitives required for autonomous, context-aware assistance: user-attached file reading, a self-hosted skills layer (domain playbooks), subagents (isolated specialists), diagnostic gap-detection tools, and continuous-governance loops.

**Value Delivered:** Moves the agent up the value-creation ladder from Tier A (awareness) to Tier D/E (execution + continuous governance). Today the agent tells users *what* changed; after this epic it reads their attachments, diagnoses gaps in their compliance posture, proposes concrete fixes, drafts styrdokument with domain-appropriate Swedish legal tone, and nudges users back when reviews or bevis go stale. This is the defensible product layer — the thing that separates Laglig from a generic chat wrapper.

**Delivers:**
- Chat file attachments (PDF/DOCX/XLSX/images) with server-side extraction and Claude-native content-block wiring
- Five new retrieval tools and four new diagnostic tools giving the agent full sight into workspace compliance state
- Role-based tool registry filter (AUDITOR → read-only) and an `AgentDecisionLog` audit trail
- A self-hosted Skills layer: file-based SKILL.md/PROCEDURE.md/STYLE.md convention, skill loader, context-bound activation, meta-tool override
- Two shipped skills: `assess_change` (migrating the existing monolithic ASSESSMENT_WORKFLOW) and `gap_analysis` (new)
- A third skill (`draft_policy`) plus a seeded library of 3–5 canonical Swedish styrdokument templates
- Three subagents: `LegalReasoner` (conservative interpretation), `DocumentReader` (heavy-PDF isolation), `ParallelAssessor` (bulk change triage)
- Continuous governance: reminders, weekly pulse cron, agent feedback loop, proactive hem-chat cards

**Requirements covered:** FR4 (enhanced), FR5 (enhanced), FR7 (enhanced), FR25 (audit trail — agent decisions), NFR2 (accuracy), NFR3 (hallucination prevention), NFR24 (cite-first answers)

**Estimated stories:** 12 (plus 4 sibling stories added to Epic 14 — see Sibling Work below)

**Dependencies:**
- **Epic 14** (Compliance Agent) — Done: provides tool registry, system-prompt assembly, streaming chat, context-type model. **Stories 14.22, 14.23, 14.24** (Approved, pre-req): the `PendingAgentAction` model + `AgentActionCard` inline approval pattern that every new write tool plugs into.
- **Epic 17** (Document Management System) — Partial. **Stories 17.8, 17.9, 17.10, 17.11** (Draft, pre-req): text extraction, RAG embedding for workspace docs, `search/get/list_workspace_documents` tools, `create/update_document` tools. This epic explicitly does NOT duplicate that work — it builds on top.
- **Epic 11** (Admin Backoffice) — Done: provides admin surfaces that can render `AgentDecisionLog` and `AgentFeedback` as monitoring views (later).
- **Epic 6** (Compliance Workspace Kanban) — Done: provides Task model, `TaskListItemLink`, kravpunkter.

**Priority:** High — the largest remaining blocker for full agent usefulness once Epic 17's DMS-side tools ship. Delivers the step-change from "compliance dashboard with chat" to "compliance partner that does work."

---

## Conceptual Model

### The three-layer agent architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Skills  (self-hosted domain playbooks, loaded per context)  │
│  • assess_change    • gap_analysis    • draft_policy        │
│  • (future) find_or_create_evidence, onboarding, audit_prep │
│                                                             │
│ Each skill bundles: SKILL.md (frontmatter) + PROCEDURE.md   │
│ + STYLE.md (Swedish exemplars) + CRITERIA.md + examples/    │
└───────────────────────────┬─────────────────────────────────┘
                            │ uses
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Tools   (atomic verbs — the palette)                        │
│  Retrieval: read_file, get_law_list_item, get_task,         │
│             list_linked_artifacts, search_workspace…        │
│  Diagnostics: list_bevis_gaps, list_unassessed_changes,     │
│               list_overdue, list_stale_documents            │
│  Writes: update_requirement, add_task_comment,              │
│          transition_document_status (Epic 14 siblings)      │
│  Sub-agent bridges: consult_legal_reasoner, read_and_answer,│
│                      bulk_assess_changes                     │
│                                                             │
│ Existing Epic 14/17 tools remain unchanged.                 │
└───────────────────────────┬─────────────────────────────────┘
                            │ some delegate to
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Subagents  (isolated specialist Claude calls)               │
│  • LegalReasoner — cite everything, conservative            │
│  • DocumentReader — heavy PDF isolation                     │
│  • ParallelAssessor — fan-out for 5+ pending changes        │
└─────────────────────────────────────────────────────────────┘
```

### Key principles

1. **Self-hosted over managed.** No Anthropic Files API, no managed Skills beta, no code execution tool. All file handling, all skill loading, all subagent orchestration stays in Laglig's stack. Keeps the product ZDR-clean and provider-neutral.
2. **Skills are files, not code.** A skill is a folder with markdown + YAML. Compliance consultants and PMs can edit PROCEDURE.md without a deploy. This externalises domain knowledge that today sits in a system-prompt literal.
3. **Tools stay flat and composable.** Prefer one `update_requirement(patch)` over four single-field tools. Every new write tool plugs into the `PendingAgentAction` approval pattern from Stories 14.22–14.24 — no new sidebar panels, no parallel proposal UX.
4. **Agent as audited actor.** Every tool invocation writes to `AgentDecisionLog` with turn id + workspace id + model version. Every write carries `via_agent = true` so auditors can separate agent-mediated from user-direct actions.
5. **Bilingual discipline.** User-facing output is Swedish. System prompts, SKILL.md, PROCEDURE.md, and tool descriptions are English with Swedish domain terms quoted (`kravpunkter`, `bevis`, `styrdokument`). STYLE.md files are bilingual — English rules, Swedish exemplars. Lint rule in CI to enforce.
6. **Permission gating at the action layer, with tool-registry filtering as defense in depth.** Every write tool calls existing `withWorkspace(fn, perm)`-wrapped server actions. The tool registry is filtered by role before being passed to `streamText` — AUDITOR never sees write tools, eliminating 403-retry loops.

### Relationship to Epic 14's AgentActionCard work

Stories 14.22–14.24 ship the `PendingAgentAction` + `AgentActionCard` inline approval pattern covering `CREATE_TASK`, `LINK_TASK_TO_DOCUMENT`, `LINK_DOCUMENT_TO_TASK`, `ADD_OBLIGATION`, `ASSIGN_TASK`, `DRAFT_DOCUMENT`. Epic 19 does NOT revisit this pattern — it **reuses** it. Any new write tool added in Epic 19 extends `PendingAgentActionType`, adds a per-type renderer under `components/features/ai-chat/agent-action-renderers/`, and extends `approvePendingAction`'s dispatch table. No parallel approval paths.

### Relationship to Epic 17's DMS work

Stories 17.8–17.11 ship the foundational DMS-side agent capabilities:
- 17.8 extracts text from uploaded files → `WorkspaceFile.extracted_text`
- 17.9 chunks + embeds workspace documents into `ContentChunk` with `source_type: 'WORKSPACE_DOCUMENT'`
- 17.10 adds `search_workspace_documents`, `get_workspace_document`, `list_workspace_documents`
- 17.11 adds `create_document`, `update_document`

Epic 19 depends on all four. The genuinely new scope here is (a) **consumer-side plumbing** for attachments in chat, (b) **entity-read tools** (kravpunkter, tasks, linked artifacts) that 17.10 doesn't cover, (c) **diagnostic tools** that surface gaps, (d) the **skills layer** that orchestrates these tools into named workflows, (e) **subagents** for isolation/parallelism, and (f) **continuous governance** closing the loop.

---

## Stories

Each story is sized to be completable in 1–3 dev days with appropriate testing. Full story documents will be drafted via `*create-story` in follow-up sessions, each consulting the current codebase to pin exact file paths and server action signatures.

### Foundation track (unblocks everything else)

**19.1 — Chat attachment upload + Claude content-block conversion**
User can drag-drop or pick files in `chat-input-modern.tsx`. Files upload via existing `uploadFile` server action with new `FileCategory: 'CHAT_ATTACHMENT'`. `app/api/chat/route.ts` removes the `.filter((p) => p.type === 'text')` stripping at line ~202 and routes file parts through a new `lib/agent/attachments-to-content.ts` that converts to Claude `type: 'document' | 'image'` blocks (PDFs ≤10 MB as base64, larger use extracted text only; DOCX/XLSX always use extracted text from Story 17.8). 32 MB request cap enforced with Swedish error toast. Message history renders file chips with MIME-aware icons. **Deps:** 17.8 (Draft).

**19.2 — `read_file` unified evidence reader**
New agent tool `read_file(fileId)` that reads any WorkspaceFile (uploaded bevis, chat attachments, styrdokument attachments) and returns Claude content blocks + structured citation stub. Shares the conversion logic with 19.1 (`attachments-to-content.ts`). This is the tool that answers "can the agent read evidence linked to a kravpunkt?" — yes, via the same code path whether the file arrived as a chat attachment or was uploaded to bevis months ago. **Deps:** 19.1.

**19.3 — Agent diagnostic tools (bevis gaps, overdue, stale docs, unassessed changes)**
Four new read-only tools: `list_bevis_gaps`, `list_unassessed_changes`, `list_overdue`, `list_stale_documents`. All are thin Prisma queries workspace-scoped through existing relations. These power the "what should I do today?" global-context flow and the proactive hem-chat cards in 19.12. No approval flow — these are pure reads. **Deps:** none.

**19.4 — Agent entity-read tools (law list item, task, linked artifacts)**
Three new read-only tools: `get_law_list_item(id)` (full state: requirements, evidence counts, status, assignment, business_context), `get_task(id)` (details + comments + links + attachments), `list_linked_artifacts(listItemId)` (thin wrapper over existing `getLinkedArtifactsForListItem`). Fills the retrieval gap — Story 17.10 covers workspace *documents* but not the broader compliance entity graph. **Deps:** none; coexists with 17.10.

**19.5 — Role-based tool registry filter + `AgentDecisionLog`**
Extends `createAgentTools(workspaceId, userId, role)` signature with `role` parameter. Tool registry is filtered: AUDITOR receives only read + diagnostic tools; MEMBER receives read + write; HR_MANAGER/ADMIN/OWNER receive all. New Prisma model `AgentDecisionLog` (id, workspace_id, user_id, chat_message_id?, tool_name, input_json, output_json, proposed_at, accepted_at?, accepted_by?, outcome, model_version). Every tool's `execute` wraps in a try/finally that writes a log row. **Note:** complements `PendingAgentAction` (which tracks proposal *lifecycle*) — `AgentDecisionLog` tracks every tool *call*, including pure reads and rejected-before-proposal states. **Deps:** none.

### Skills track

**19.6 — Skill loader + directory convention + context-bound activation**
New directory `lib/agent/skills/` with the convention `<skill-name>/SKILL.md + PROCEDURE.md + STYLE.md + CRITERIA.md + examples/*.md`. New `lib/agent/skill-loader.ts` exports `listSkills()`, `loadSkill(name)`, `getSkillToolWhitelist(name)`. `buildSystemPrompt` in `lib/agent/system-prompt.ts` extended to (a) inject primary skill body for the active `contextType` — `change → assess_change`, `global → gap_analysis`, others default to retrieval-only — and (b) always include skill descriptions metadata so the agent knows what's available. New meta-tool `activate_skill(name)` returns skill body for mid-conversation switches. `createAgentTools` accepts `activeSkills: string[]` and filters the registry to `(always-available tools) ∪ (active skill whitelists)`. **Deps:** 19.5 (tool factory signature change coordinated).

**19.7 — Ship `assess_change` and `gap_analysis` skills**
Migrate the existing `ASSESSMENT_WORKFLOW` string literal in `lib/agent/system-prompt.ts` to `lib/agent/skills/assess_change/`. PROCEDURE.md captures the existing 9-step workflow verbatim; STYLE.md defines Swedish citation format (`SFS 2018:218 3 kap. 2 §`) + tone rules + two worked examples (material change, clarifying change). New skill `lib/agent/skills/gap_analysis/`: PROCEDURE.md runs the four diagnostic tools from 19.3 in parallel, scores risk (impact × evidence gap × overdue × change frequency heuristic), produces a structured Swedish report where every line item has a Tier-2 proposal attached. Remove the inline `ASSESSMENT_WORKFLOW` constant once the skill file is live. **Deps:** 19.3, 19.6.

### Authoring track

**19.8 — `draft_policy` skill + Swedish template library seed**
New skill `lib/agent/skills/draft_policy/`: PROCEDURE.md (12 steps: search for existing → company context → select template → pull law requirements → draft sections → propose review task → propose link to kravpunkter), STRUCTURE.md (canonical Swedish styrdokument structure: Syfte / Omfattning / Ansvar / Genomförande / Uppföljning / Referenser), CITATION.md (Swedish legal citation rules), examples/ (2 good Swedish policies). Seed script `scripts/seed-document-templates.ts` populates `WorkspaceDocumentTemplate` with 3–5 canonical templates: Dataskyddspolicy (GDPR), Arbetsmiljöpolicy (AFS), Incidenthanteringsrutin, Riskbedömning, Leverantörs-/personuppgiftsbiträdespolicy. Each template includes `metadata.applicable_law_ids[]`. **Deps:** 17.11 (create_document tool), 14.24 (DRAFT_DOCUMENT approval card), 19.6 (skill loader).

### Subagent track

**19.9 — Subagent runner + `LegalReasoner` + `DocumentReader`**
New module `lib/agent/subagents/run-subagent.ts` — generic helper wrapping `generateText` from the `ai` package. Isolated system prompt, restricted tool set, result capped at 2,000 tokens returned as structured summary. Two specialists: `legal-reasoner.ts` (conservative interpretation, cite everything, flag uncertainty; tools: search_laws, get_document_details) exposed via `consult_legal_reasoner(question, context)`; and `document-reader.ts` (read-heavy-PDF specialist; tools: read_file only) exposed via `read_and_answer(fileId, question)` — lets the main agent ask focused questions of a 150-page PDF without polluting its own context. **Deps:** 19.2, 19.5.

**19.10 — `ParallelAssessor` + bulk change triage**
Third subagent `parallel-assessor.ts` — fan-out helper invoked by the `assess_change` skill when 5+ ChangeEvents are pending. Exposed via new tool `bulk_assess_changes(changeEventIds[])` — spawns one subagent per change event (capped at 10 concurrent), each produces a draft ChangeAssessment proposal, main agent consolidates into a single batch approval card (reusing 14.23's `AgentActionBatchCard`). **Deps:** 19.7 (assess_change skill), 19.9 (subagent runner), 14.23 (batch card).

### Continuous governance track

**19.11 — Reminders + scheduling tools + weekly pulse cron**
New Prisma model `Reminder` (id, workspace_id, subject, trigger_at, kind: DOCUMENT_REVIEW | BEVIS_RECHECK | CUSTOM, entity_id, status: PENDING | FIRED | DISMISSED, created_by, via_agent). Two new scheduling tools: `schedule_review(documentId, cadence)` (sets `WorkspaceDocument.review_date` + Reminder row), `schedule_bevis_recheck(requirementId, cadence)` (Reminder row only). New cron endpoint `app/api/cron/fire-reminders/route.ts` (follows existing `sync-sfs-updates/route.ts` pattern) scans PENDING reminders past `trigger_at` and posts workspace notifications. New cron `app/api/cron/weekly-pulse/route.ts` runs `gap_analysis` skill per workspace weekly via a non-interactive subagent; result posted as a `Notification` row surfaced in hem-chat on next open. **Deps:** 19.7 (gap_analysis skill), 19.9 (subagent runner).

**19.12 — `AgentFeedback` model + thumbs UI + proactive hem-chat cards**
New Prisma model `AgentFeedback` (turn_id, tool_call_id?, rating: UP | DOWN, comment, created_by, workspace_id, created_at). Thumbs-up/down UI added to assistant messages and tool result rows in `chat-message.tsx`. `components/features/dashboard/hem-chat.tsx` extended: on mount, server component calls the four diagnostic tools from 19.3 and renders "du har N bevisluckor, M obedömda ändringar, P överfallna uppgifter, Q styrdokument att granska" as clickable cards. Each card pre-fills a chat prompt that activates the relevant skill (gap_analysis → full report; assess_change → jump into first unassessed). **Supersedes** the archived Story 14.12 (Smart Context Cards) — this story owns the Hem context-card behavior via diagnostic tools rather than static prompt rewrites; any still-wanted scope from 14.12 (e.g. upgrading the existing four 14.11 cards to structured tool-backed output) is folded in here. **Deps:** 19.3, 19.6, 19.7.

---

## Sibling Work (Epic 14 additions, tracked separately)

These stories are tactical write-tool additions that slot into Epic 14's `PendingAgentAction` pattern. They don't belong in Epic 19 because they're straightforward extensions of the 14.22–14.24 approval-card system. Listed here for traceability.

> **Numbering note (2026-05-20):** These sibling stories were originally drafted as 14.26–14.29, but Epic 14 has since shipped 14.26 (Anthropic Prompt Caching v1) and 14.27 (Chat Usage Telemetry) under its Phase 6. The sibling work is therefore renumbered to **14.28–14.31** and owned in Epic 14's new "Phase 7: Agent Action Card Extensions" section.

- **14.28** — `update_requirement` approval (text / is_fulfilled / comment / bevis_required). Adds `UPDATE_REQUIREMENT` to `PendingAgentActionType`. New renderer `update-requirement-renderer.tsx` with old→new diff.
- **14.29** — `add_task_comment` approval. Adds `ADD_TASK_COMMENT` type.
- **14.30** — `transition_document_status` approval (DRAFT→IN_REVIEW→APPROVED→SUPERSEDED→ARCHIVED). Adds `TRANSITION_DOCUMENT_STATUS` type. Server-side guard rejects agent-initiated APPROVED transitions (separation of duties — agent can draft but not approve).
- **14.31** — Proposal staleness protection. Every `PendingAgentAction` accept path re-reads the target entity, compares a `params.entity_version` snapshot against current `updated_at`, fails with Swedish error ("datan har ändrats sedan förslaget gjordes") + re-propose button if drifted. Retroactively applied to all approval types.

These can be drafted and scheduled independently of Epic 19. Recommend scheduling 14.28 (`update_requirement`) and 14.31 (staleness protection) alongside 19.7 so `assess_change` skill has the full write-tool palette available.

---

## Compatibility Requirements

- [x] Existing 9 agent tools (Epic 14) remain unchanged
- [x] Existing `buildSystemPrompt` structure preserved — skills are an additive fragment
- [x] Existing `AgentActionCard` / `PendingAgentAction` pattern (14.22–14.24) is the only approval path — no new sidebar panels
- [x] Existing `WorkspaceFile` and `WorkspaceDocument` models untouched — extensions via additive fields only (already planned in 17.8, 17.9)
- [x] Existing chat streaming, reasoning blocks, tool-call collapse, citation pills continue to work
- [x] `search-laws` citation format (`[Källa: ...]`) unchanged; new tools mirror the format
- [x] Permission enforcement via existing `withWorkspace(fn, perm)` — no new permission primitives
- [x] Vercel AI SDK 6.0 only — no direct `@anthropic-ai/sdk` imports, no beta headers, no Anthropic Files API, no managed Skills, no code execution tool
- [x] ZDR-eligible on the Anthropic side (no managed-skill or Files API data retention)

---

## Risk Mitigation

**Primary Risk 1 — Hallucinated legal interpretation.** The agent could confidently assert "kravpunkt X is fulfilled by policy Y" when it isn't, the user accepts, and the auditor disagrees. This is the existential failure mode for a compliance product.

- **Mitigation:** `is_fulfilled = true` transitions are always Tier-2 proposals (sibling Story 14.28), never auto-applied. Every legal claim in agent output must carry a structured `[Källa: SFS ...]` citation that the model copies verbatim from tool output, not paraphrases. System prompt guardrails forbid "I believe this covers…" phrasings in favor of "this references §X which requires Y — you may want to verify Z." `LegalReasoner` subagent (19.9) is consulted for any interpretation question with meaningful stakes.
- **Rollback:** All agent writes carry `via_agent = true` and `AgentDecisionLog` rows. Bulk query can list every agent-mediated state change in a workspace and roll them back if systematic issue discovered.

**Primary Risk 2 — Skill procedures go stale.** PROCEDURE.md files encode how to do compliance work well, but Swedish law evolves. If a PROCEDURE.md references a repealed SFS or outdated methodology, the agent follows it anyway.

- **Mitigation:** Skill files versioned in git — every change has PR review. Quarterly review cadence added to the compliance team's calendar (tracked outside this epic). `CRITERIA.md` forces the agent to check currency ("before citing an SFS, confirm it's still in force via get_document_details").
- **Rollback:** Git revert on any skill file; no code deploy needed.

**Primary Risk 3 — Subagent cost explosion.** `bulk_assess_changes` on a workspace with 50 pending ChangeEvents could spawn 50 subagents, each consuming significant Claude tokens.

- **Mitigation:** Hard cap of 10 concurrent subagents per parent turn; soft cap of 20 total per workspace per day (configurable). Subagent result serialized at ≤2,000 tokens to prevent context bloat on the main agent. `weekly-pulse` cron uses a single subagent per workspace, not fan-out.
- **Rollback:** Feature flag per subagent type; disable `ParallelAssessor` entirely and fall back to sequential processing.

**Primary Risk 4 — Tool registry bloat.** Epic 19 adds ~12 tools on top of Epic 14/17's existing ~15. At 30+ tools, the system prompt bloats and tool routing accuracy degrades.

- **Mitigation:** Tool registry is filtered per active skill (19.6) — skills whitelist their required tools, so the agent only sees the subset relevant to the current procedure. Atomic always-available tools capped at ~15. If total exceeds 30, introduce `discover_tools(intent)` meta-tool in a follow-up.
- **Rollback:** Skill-layer filtering is opt-in — disabling the skill layer returns to flat registry.

**Primary Risk 5 — Per-workspace feature-flag fragmentation.** Rolling 12 stories behind per-workspace flags could produce combinatorial test matrices.

- **Mitigation:** Single composite flag `agent_partner_v2` per workspace gates the entire epic. Individual stories don't get their own flags — they ship behind the epic flag together. Internal dog-fooding on Laglig's own workspace before flipping for any customer.
- **Rollback:** Flip `agent_partner_v2 = false` on any workspace — all Epic 19 surfaces revert to pre-epic behavior.

---

## Definition of Done

- [ ] All 12 stories completed with their ACs met
- [ ] Sibling Stories 14.28–14.31 completed (coordinated with Epic 14)
- [ ] Prisma migrations merged: `AgentDecisionLog`, `Reminder`, `AgentFeedback`, `FileCategory` enum extension, `via_agent` columns on affected tables
- [ ] Three skills live: `assess_change` (migrated), `gap_analysis` (new), `draft_policy` (new)
- [ ] Three subagents live: `LegalReasoner`, `DocumentReader`, `ParallelAssessor`
- [ ] Two cron endpoints live: `fire-reminders` (daily), `weekly-pulse` (weekly)
- [ ] Template library seeded with ≥3 Swedish styrdokument templates
- [ ] CI lint rule enforces English PROCEDURE.md + Swedish STYLE.md exemplars
- [ ] `AgentDecisionLog` populated for every tool call in internal dog-fooding
- [ ] End-to-end smoke test passes: fresh workspace → onboard → attach policy DOCX → "är vi GDPR-compliant?" → agent reads attachment, runs gap_analysis, proposes 3 tasks + 1 policy draft + 2 evidence links, user accepts → all artifacts visible with `via_agent = true`
- [ ] Internal workspace runs for ≥2 weeks on `agent_partner_v2 = true` with no regressions
- [ ] AUDITOR role verified read-only (no write tools in registry)
- [ ] Documentation updated: `CLAUDE.md` memory files, architecture doc skill layer section, tool registry reference

---

## Story Manager Handoff

**For SM (Bob) when decomposing stories via `*create-story`:**

Epic 19 is a brownfield enhancement to a Next.js 15 + Prisma + Vercel AI SDK stack running on Supabase. Integration points:

- **Agent tools** — register in `lib/agent/tools/index.ts` via `createAgentTools(workspaceId, userId, role, activeSkills?)` factory. Follow existing closure pattern from `lib/agent/tools/create-task.ts`. Input schemas use `zodSchema(z.object(...))` with `z` imported from `'zod/v4'`. Responses wrapped via `wrapToolResponse` / `wrapToolError` / `wrapWriteToolResponse` from `lib/agent/tools/utils.ts`.
- **Server actions** — all writes go through `withWorkspace(async (ctx) => {...}, 'perm:name')` from `lib/auth/workspace-context.ts`. Standard return shape `{ success, data?, error? }` — never throw.
- **PendingAgentAction approval pattern** — every Tier-2 write tool follows the `execute: false → PendingAgentAction row` pattern from Story 14.22. New action types extend the enum; new renderers go under `components/features/ai-chat/agent-action-renderers/`; dispatch branch added to `approvePendingAction` in `app/actions/pending-agent-actions.ts`.
- **Chat UI** — single mount via `useChatInterface` hook from `lib/hooks/use-chat-interface.ts`. `TOOL_CONFIG` in `components/features/ai-chat/chat-message.tsx` needs a Swedish-label entry per new tool.
- **Existing patterns** — Swedish user-facing copy, English internal prompts with Swedish domain terms quoted, shadcn/ui primitives only (no bespoke styling), `snake_case` Prisma fields + `@@map` conventions, indexes on workspace-isolated queries.

Each story must include:
- Verification that existing functionality remains intact (Epic 14/17 tools + approval cards keep working)
- Workspace-isolation checks in every new server action
- Unit tests mirroring `tests/unit/agent/tools/*.test.ts` patterns
- Swedish copy review for any user-facing strings
- `AgentDecisionLog` population for the new tool (where relevant, post-19.5)

Epic goal: **deliver a compliance agent that can read, reason, and act across the full workspace under audited controls — so users stop "tracking" compliance and start "completing" it with the agent.**

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-04-19 | v0.1 | Initial epic outline — 12 stories, 4 sibling Epic 14 additions, full conceptual model + risk analysis | Sarah (PO) |
