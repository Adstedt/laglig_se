# Project Brief: Agent Knowledge-Traversal / Read-Context Tier

**Status:** v3 — PM-reconciled into **Epic 19** (no standalone epic). Architect-reviewed (GO).
**Author:** Mary (Analyst) — 2026-05-24 · **Architect review:** Winston — 2026-05-24 · **PM reconciliation:** John — 2026-05-24
**Target product:** Laglig.se — Compliance Partner Agent (Epic 14 / Epic 19)
**Positioning:** Horizontal capability enabling the existing agent (brownfield; additive, non-breaking)

> **Roadmap home (PM reconciliation, 2026-05-24):** This brief is the architectural backing for Epic 19's **retrieval track** — it does *not* spawn a new epic. The read-tier already had a home in Epic 19's Story 19.4 (entity-readers); this brief deepened it and surfaced a missing prerequisite. Story mapping:
> - **19.4a** — id-resolution + entity discovery (this brief's "Finding B" + discovery). *Foundational; also hardens already-shipped write tools.*
> - **19.4** — entity-readers, refined to the lazy-traversal / `ContextHandle` model below (was scoped as eager "full state" with an incorrect "Deps: none").
> - **19.4b** — `get_cycle` / `get_finding` readers (Epic 21 models; sequence with next Epic 21 work).
>
> **Canonical tool names** are Epic 19's existing convention — `get_law_list_item`, `get_task`, `get_cycle`, `get_finding`, `list_linked_artifacts`, `search_law_list_items` (no `_context` suffix). Where this brief writes `get_X_context`, read it as the *concept* (the lazy context bundle that tool returns), not the literal name.

---

## Executive Summary

The compliance-partner agent can already **act** on the workspace — it creates tasks, assigns owners, adds kravpunkter, updates compliance status, drafts styrdokument, and (pending 14.29) comments on tasks. But it is almost entirely **blind to the company's own state**. Its only company-specific read tools cover the *generic legal corpus* (`get_document_details`, `get_change_details`, `search_laws`) — the law text, which is identical for every customer. It has **zero** read capability over the proprietary compliance graph that hangs off each law-list item: the company's compliance status, kravpunkter and their bevis, business context, past amendment assessments, linked tasks and documents, and audit history.

This brief proposes a **read/traversal tier**: a family of read-only `get_X_context` tools that expose each high-value entity's own state plus *typed handles to its neighbours*, letting the agent **traverse the company's knowledge graph** on demand — shallow-but-complete at each node, following only the edges a given question needs.

The key realisation: **the graph already exists.** Laglig's ~90-model Postgres schema, with its join tables and FK relations, *is* a knowledge graph. No new schema, no graph database, nothing to model. The work is building the agent's *eyes* onto edges that are already there. This is the capability that makes the "an agent that knows your company" positioning literally true rather than decorative — and it is the difference between a generic legal chatbot (reads the statute) and a compliance partner (reasons over *your situation*).

---

## Problem Statement

### Current state

The agent's surface is lopsided — write-rich, read-poor on company state:

- **Write tools (act on company state):** `create_task`, `assign_task`, `add_obligation`, `add_context_note`, `update_compliance_status`, `link_task_to_document`, `link_document_to_task`, `draft_styrdokument`, `save_assessment`, and `add_task_comment` (Story 14.29, in flight).
- **Read tools (company-specific):** none. The read tools that exist — `get_document_details`, `get_change_details`, `search_laws`, `get_template_laws`, `search_workspace_files`, `get_company_context` — read the **generic** legal corpus or the scalar company profile. None read the relational compliance state of a law-list item, a task, or an audit cycle.
- **Context injection is thin.** `buildSystemPrompt` injects only title + description for a task (`lib/agent/system-prompt.ts:254`) and only `{law name} ({sfsNumber})` for a law — it does not even pass the `listItemId` (`:261`). So even when the chat is scoped to a specific law, the agent cannot key off the item to read its state.

### Why this is the core problem, not a polish item

1. **It blocks the product thesis.** The law *text* is public and commoditised; every competitor can quote AFS 2020:1. The defensible value — "knows *your* company" — lives entirely in the company-unique subgraph the agent currently cannot see (compliance_narrative, kravpunkter/bevis, assessment history, status logs). The agent is structurally prevented from doing the one thing the product promises.

2. **It makes every write action semi-blind.** The agent can already change a compliance status or add a kravpunkt without reading the item's current posture (gap signals, existing kravpunkter, past assessments). Each new write action shipped before the read-tier *widens* this blind surface. `update_compliance_status` and `add_obligation` are the most exposed.

3. **It wastes a graph that is already built and already paid for.** Consolidated readers for parts of this graph already exist — `getLinkedArtifactsForListItem` (the 5-way UNION from Story 17.18), the kravpunkter reader (17.16) — but are not exposed to the agent. The marginal cost of the read-tier is assembly + tool-wrapping, not new data engineering.

### What the agent cannot answer today (but the data supports)

- *"Är vi compliant med den nya AFS-ändringen?"* — requires reading the item's status, kravpunkter/bevis gaps, the prior `change_assessment`, and the linked task.
- *"Vilka punkter i den här kontrollen saknar bevis?"* — requires walking `cycle → items → law-items → kravpunkter → evidence`.
- *"Täcker det här styrdokumentet de krav det är kopplat till?"* — requires walking `document → linked law-items → kravpunkter`.

---

## The Insight: the schema is already a knowledge graph

A walk of `prisma/schema.prisma` confirms the plumbing is ~95% in place:

- **Join tables for every M:N edge** — `TaskListItemLink`, `FileTaskLink`, `FileListItemLink`, `WorkspaceDocumentTaskLink`, `WorkspaceDocumentListItemLink`, `RequirementEvidenceLink`, `ComplianceCycleTaskLink`. Polymorphic `Comment` (task XOR law-item).
- **History is captured, not just current state** — `compliance_status_logs`, `change_assessments` (how the company judged each past amendment), `kravpunkter_snapshot` on audit items, `WorkspaceDocumentVersion`.
- **Partial consolidated readers already exist** — `getLinkedArtifactsForListItem` (`app/actions/linked-artifacts.ts`), kravpunkter readers (17.16).

What is **not** there, and is the entire scope of this initiative:

1. **Agent read tools** (`get_X_context`) — none exist.
2. **ID resolution into chat context** — see Finding B below; this is bigger than "thread an id."
3. **Discovery** — no `search_law_list_items` / `search_tasks`, so in a GLOBAL chat the agent cannot find the entry node.
4. **Traversal discipline** — depth caps, summarisation, cycle handling.

No graph DB. No schema migration. The "knowledge graph" already shown on the landing page *is* the relational model; this initiative operationalises it.

### Finding B (Architect review) — the ID-resolution gap is foundational, not incidental

The codebase walk surfaced that ID-resolution is a dependency the **already-shipped write tools share**, which elevates it from "enabler" to the first thing built:

- The law-item write tools (`add_obligation`, `add_context_note`, `update_compliance_status`) take **`lawListItemId` as an explicit tool argument** — the agent must already know it (`lib/agent/tools/add-obligation.ts:20`).
- The tool-context closure carries `contextId` (`lib/agent/tools/pending-action.ts:24`, `app/api/chat/route.ts:250`), **but `contextId` ≠ `lawListItemId`** — in `components/features/ai-chat/chat-panel.tsx` they are distinct props; for a LAW context `contextId` is the document id/slug.
- The LAW system-prompt block injects only `{lawName} ({sfsNumber})` (`system-prompt.ts:261`) — not the `lawListItemId`.

⇒ There is **no clean surfaced path for the agent to obtain `lawListItemId` today**, so the existing write tools likely only work when the id leaks in via conversation text. Fixing id-resolution (thread `lawListItemId` into both the tool closure **and** the system-prompt text) therefore **hardens shipped write tools as well as enabling the reader** — shared infrastructure, sequenced first.

**Validated cleanly:** composition is cheap (`getLinkedArtifactsForListItem` returns `LinkedArtifact[]` + counts, `app/actions/linked-artifacts.ts:40-65`); no company-side search exists (`app/actions/search.ts` is corpus-only).

---

## Proposed Solution

### Core concept: lazy traversal via `get_X_context`

Each high-value entity exposes a read-only tool that returns:

- **its own state, fully hydrated** (the node's company-specific scalar fields, summarised where large), and
- **typed handles to its neighbours** — `{ id, type, label, count }` — *not* the fully-hydrated neighbours.

The agent then decides which edges to follow with further reads. This is "shallow-but-complete at the node, summarised pointers one hop out." Example shape:

```
get_law_list_item_context(itemId) →
  // fully hydrated — this node's company state
  compliance_status, business_context, compliance_narrative, status_log_summary
  // neighbour handles — edges to traverse on demand
  requirements:        [{ id, text, bevis_count, bevis_required }]
  change_assessments:  [{ id, amendment_sfs, conclusion, date }]
  linked_tasks:        [{ id, title, status }]
  linked_artifacts:    [{ id, type, title }]
  document:            { id, sfs, title }          // → get_document_details (generic, exists)
```

### Eager vs. lazy — the decision

- **Eager** (return the whole one-hop neighbourhood fully hydrated) is rejected: it dumps a novel into context, most of it irrelevant, and the graph's cycles make "load everything" unbounded.
- **Lazy** (node fields + neighbour handles, agent follows edges) is the chosen model. The agent's loop budget (`stepCountIs(10)`, `app/api/chat/route.ts`) becomes its **traversal budget** — hops are spent intentionally instead of pre-paid every call.

### Worked example (the payoff)

> *"Är vi compliant med den nya AFS-ändringen?"*
> 1. RAG locates the law → agent resolves `listItemId`.
> 2. `get_law_list_item_context` → status `PÅGÅENDE`, kravpunkt 3 `bevis_required` with `bevis_count: 0`, one prior `change_assessment` (March), one open linked task.
> 3. Agent follows edges: reads the March assessment ("non-impacting because X"), reads the open task, notes the bevis gap.
> 4. Answers: *"Delvis. Ni bedömde en tidigare ändring i mars som icke-påverkande pga X — men den här skärper skyltkraven, så det håller inte. Kravpunkt 3 saknar bevis och uppgiften 'Översyn' är inte påbörjad."*

No single field produces that sentence; the **traversal** does, and every node it touched is company-unique.

---

## Entity Hub Map

High-degree hubs from the schema walk, split by whether they are **company-unique** (the moat) or **generic** (commoditisable):

| Entity | Approx. degree | Company-unique? | Why it's a hub |
|---|---|---|---|
| **LawListItem** (`:358`) | ~12 | ✅ **flagship** | Joins document + kravpunkter + bevis + comments + tasks + docs + assessments + status logs + audit items |
| **ComplianceFinding / AuditCycle / Item** (`:2122`+) | ~6 each | ✅ | Finding links law-item ↔ requirement ↔ corrective task; cycle → items → findings is a full audit-trail spine |
| **Task** (`:1157`) | ~8 | ✅ | Links the "doing" layer back to obligations, docs, findings, cycles |
| **WorkspaceDocument** (`:1948`) | ~6 | ✅ | versions + template + task/item links + kravpunkt evidence — the policy/proof layer |
| **LawListItemRequirement** (kravpunkt, `:450`) | ~3 | ✅ | sub-hub: evidence (file XOR doc) + findings |
| **ChangeAssessment** (`:1864`) | 2 | ✅ | bridges change-event ↔ law-item — assessment history |
| **LegalDocument** (`:503`) | ~14 | ❌ generic | cross-refs (law↔law), amendments, sections, legislative refs (förarbeten), court/EU — rich but *identical for every company*; already covered by `get_document_details` |

**The dividing line:** `LegalDocument` and its neighbours are the shared legal graph (anyone can build it); everything hanging off `LawListItem` is the customer's proprietary compliance graph (the moat). The generic side is already exposed; the company side is uncovered.

---

## Where it delivers value (feature/persona map)

The tier is horizontal, but value concentrates in the **compliance reasoning loop**:

> **obligation** (law item) ↔ **how we comply** (kravpunkter / bevis / narrative) ↔ **what we're doing about gaps** (tasks / findings) ↔ **how we proved it over time** (assessments / audit cycles / status logs)

In priority order:

1. **Compliance-partner chat (Epic 14)** — primary consumer; every write action gets smarter. `get_law_list_item_context` is the flagship.
2. **Lagefterlevnadskontroll / audit cycles (Epic 21)** — second flagship; clean fit for the read-mostly AUDITOR persona. *"Which items lack bevis?"*, *"Summarise the open findings and their corrective tasks."*
3. **Change assessment (`change` context, Story 14.10)** — already the richest agent surface; traversal turns "what the amendment says" into "what it means *for us, given our posture and history*."
4. **Styrdokument (Epic 17)** — *"does this policy cover the obligations it's linked to?"*
5. **Tasks (Epic 6)** — agent triage; downstream of the above.

---

## Scope & Non-Goals

**In scope:**
- Read-only `get_X_context` tools for the company-unique hubs (lazy/handles model).
- ID-threading so chat context carries the entity id (start with LAW → `listItemId`).
- Discovery tools (`search_law_list_items`, `search_tasks`) for GLOBAL-context entry.
- Traversal discipline: depth caps, neighbour handles, summarisation/caps, cycle handling.

**Explicit non-goals:**
- No new schema / no graph database — the relational graph is reused as-is.
- No expansion of the *generic* legal graph (cross-refs, förarbeten) beyond what `get_document_details` already does — separable, lower-leverage.
- No write behaviour — this tier is strictly read; writes stay in the existing approval-card pattern.
- No agent-authored `@`-mentions (per the 14.29 decision): readers expose participant **names** for context but **not raw user IDs**, removing any path for the agent to embed an identity token.

---

## Design Constraints & Guardrails

- **Read-only, no approval** — these are inputs to good proposals, not side effects.
- **Lazy by default** — node fields + typed neighbour handles; the agent follows edges deliberately.
- **Standardised handle shape** *(Architect)* — define a shared `ContextHandle = { id, type, label, count? }` in `lib/agent/tools/types.ts`, used by *every* `get_X_context` so the agent learns one traversal grammar.
- **Depth ≈ 1 hop per call** — no transitive closure; the graph has cycles (item → task → item).
- **Hard caps, not soft** *(Architect)* — the lazy model bounds *neighbours*, but the node's own collections still need explicit caps (≈10 comments, kravpunkt text + bevis-*count* not blobs, assessment *conclusions* truncated, plain-text not raw HTML) so a pathological item (200 comments) cannot blow the context window.
- **Protect the loop budget** *(Architect)* — prefer a *rich enough single reader* that one call suffices for most proposals over raising `stepCountIs(10)`; revisit the cap only if reads routinely chain (item → task).
- **Read-before-propose steering is in-scope** *(Architect)* — a system-prompt guidance block telling the agent to read context before proposing a status change / obligation ships *with* the flagship story, not after; otherwise the reader exists and the agent never calls it.
- **Workspace-scoped, ownership-checked, names not IDs** — same `withWorkspace` + scope pattern as all server actions; never throw, `{ success, data?, error? }` shape; per the no-mentions decision, readers expose participant **names** but **omit raw user IDs** (explicit AC).

---

## Relationship to the existing agent write-plan (Epic 14)

**This tier is additive and non-breaking. It is NOT a blocking dependency for the Phase 5/6/7 write stories.**

- The write tools (`execute:false → PendingAgentAction → approval card → dispatch`) each do their own small denormalisation lookup and do **not** call the read tools. When the read-tier lands, the agent simply gains the ability to read before it proposes — the write tools' code, schema, and interfaces are unchanged.
- **Therefore:** ship in-flight write stories (14.28, 14.29) on their current track; the read-tier can be layered in afterward to "simply improve" them without rework.
- **But prioritise the read-tier high**, immediately after the in-flight writes — every write action shipped while the agent is read-blind is a quality liability the read-tier retires. `get_law_list_item_context` first.
- **Cheap weave-in now:** any *still-unbuilt* write story should add a one-line forward-reference ("consumes `get_X_context` when available") so its prompt-steering and tool-call budget are authored with the tier in mind.

---

## Sequenced Story List *(mapped to Epic 19 — PM reconciliation)*

1. **`19.4a` — Id-resolution + minimal discovery (foundational).** Thread `lawListItemId` into both the tool-context closure **and** the LAW system-prompt text; add a lightweight `search_law_list_items` (title/SFS, workspace-scoped) for GLOBAL-context entry. **Also hardens the already-shipped write tools** (`add_obligation` / `add_context_note` / `update_compliance_status`) per Finding B. Enables everything below.
2. **`19.4` — entity-readers (flagship, consolidated).** `get_law_list_item` / `get_task` / `list_linked_artifacts`. Compose `getLinkedArtifactsForListItem` + kravpunkter reader + change_assessments + status logs + scalar item state into the lazy/handles shape with the shared `ContextHandle` type. Ships with the read-before-propose steering block. Feeds chat + assessment + audit. *(Single reader; granular sub-readers only on telemetry signal — Q2.)*
3. **`19.4b` — `get_cycle` / `get_finding` (Epic 21).** Read-mostly AUDITOR value; audit-trail traversal spine. **Sequence to ride with the next Epic 21 work** (reads the same models) rather than coupling to the flagship — Q5.
4. **`get_task` context depth** is delivered within 19.4; a later `change`-context consolidation (fold the existing change reader into the same shape so the `change` workflow traverses to affected items + their posture) is a candidate follow-up, not yet a numbered story.

> **Out of scope (Q4):** traversing the *generic* legal graph (cross-references, förarbeten on `LegalDocument`) — commoditisable, already covered by `get_document_details`, separable as its own legal-research story if ever wanted.
>
> **No caching in v1 (Q3):** workspace-scoped reads are dwarfed by the LLM round-trip; defer until profiling demands it, and then invalidate at the single write chokepoint (`approvePendingAction` dispatch).

---

## Success Signals

- The agent answers "are we compliant with X / what's missing" with references to *company-specific* state (kravpunkter, bevis gaps, prior assessments) — not generic statute summaries.
- Write proposals visibly reflect current state (e.g., the agent declines or qualifies a status change when bevis is missing).
- Measurable: share of agent turns that call ≥1 read-context tool before a write proposal; reduction in user edits/rejections of proposals (proxy for proposal quality).

---

## Architect Resolutions (was: Open Questions) — Winston, 2026-05-24

All five resolved during the GO review; recorded here as decided positions for the PM:

1. **Discovery vs. context-only v1? → Fold minimal discovery into the foundational story; do not defer.** "Context-only" isn't cleanly achievable because even a scoped LAW chat doesn't surface `lawListItemId` today (Finding B). Story 1 threads the id *and* ships a one-query `search_law_list_items`; without it GLOBAL chats can't reach the reader.
2. **Mega-reader vs. sub-readers? → One consolidated reader.** The lazy/handles model + the `stepCountIs(10)` budget favour a single rich call returning node state + summarised handles. No separate `get_kravpunkter`/`get_assessments` tools in v1; add granular drill-downs only on telemetry signal.
3. **Caching? → None in v1.** Workspace-scoped Prisma reads are dwarfed by the LLM round-trip; caching imports the cross-cache invalidation burden already painful for linked-artifacts. If profiling later demands it, invalidate at the `approvePendingAction` dispatch chokepoint.
4. **Generic legal graph? → Out of scope, separable later story.** Commoditisable; `get_document_details` already covers the document node. Cross-reference/förarbete traversal is a legal-research feature with a different value thesis.
5. **Sequencing vs. Epic 21 polish (21.9 / 21.12)? → Flagship does not jump them; cycle-reader rides with Epic 21.** `get_law_list_item_context` is independent of the deferred seal/PDF work. `get_cycle_context`/`get_finding_context` read the same Epic 21 models — sequence them to ride alongside whenever Epic 21 is next touched.

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-05-24 | v1 | Initial brief — problem, traversal model, hub map, scope, sequencing, coupling stance vs. Epic 14 write-plan. | Mary (Analyst) |
| 2026-05-24 | v2 | Architect review (GO). Added Finding B (id-resolution gap also affects shipped write tools → elevated to foundational story 1, discovery folded in). Resolved all 5 open questions into decided positions. Added constraints: shared `ContextHandle` type, hard caps, loop-budget protection, read-before-propose steering in-scope, names-not-IDs. Revised sequenced story list. | Winston (Architect) |
| 2026-05-24 | v3 | PM reconciliation: **no standalone epic** — folded into Epic 19's retrieval track as 19.4a (id-resolution + discovery), refined 19.4 (lazy/`ContextHandle`), and 19.4b (cycle/finding readers). Added roadmap-home note + canonical tool-name reconciliation (Epic 19's no-`_context` convention). Propagated to `epic-19-…md`, `epic-list.md`, `EPIC-19-AGENT-PARTNER-CHECKLIST.md`, and the implementation-sequence plan. | John (PM) |
