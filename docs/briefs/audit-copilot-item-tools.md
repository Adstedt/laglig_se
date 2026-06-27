# Brief: Audit co-pilot tools in the cycle item modal

**Status:** Concept / thinking — not yet a story
**Date:** 2026-06-26
**Related:** Epic 21 (compliance findings), Story 19.14 (adaptive thinking / global chat reasoning)

## Idea in one line

Give the chat agent a small set of **item-scoped tools** when it's invoked from a cycle item modal, so it shifts from "ask me about this" to an **audit co-pilot with hands** — reasoning about a single item's compliance, surfacing gaps in its kravpunkter, and pre-filling findings the auditor commits.

## Why it's mostly assembly, not invention

The infrastructure already exists:

- **24-tool registry** with read/write tiers, `PendingAgentAction` approval cards, `AgentDecisionLog` audit trail, role filtering, and skill-gating — `lib/agent/tools/index.ts`.
- **Context system** (`contextType: GLOBAL | TASK | LAW | CHANGE` + `contextId`) that injects the active entity into the agent — `app/api/chat/route.ts`.
- **`createFinding` server action** already shaped exactly how an agent tool would call it (type, severity, title, description, rootCause, `lawListItemId`, `requirementId`, `spawnTask`) — `app/actions/compliance-finding.ts`.

The gap is narrow: **no audit-item context type, and no audit-scoped tools.**

## The two missing pieces

### 1. New `contextType: 'AUDIT_ITEM'` (or `CYCLE_ITEM`)

When the modal is open, inject the item payload into the agent: the frozen `kravpunkter_snapshot`, `businessContext`, `complianceNarrative`, linked underlag, and existing findings. Highest-leverage piece — without it, every tool call must be told the item ID; with it, the agent just knows which item the auditor is on.

### 2. A handful of item-scoped tools (reuse what exists)

- **`assess_item_kravpunkter`** (read / reason, commits nothing) — walk the snapshot, compare each krav against narrative + underlag, return per-krav verdict (uppfylld / gap / saknar bevis) with rationale + confidence.
- **`draft_finding`** (write → approval card) — thin wrapper over `createFinding`, pre-filling type / severity / title / description / `requirementId`. The existing `PendingAgentAction` card *is* the confirm step. Maps directly onto the modal's existing `onSuggestFindingForRequirement(requirementId)` quick-win — an automated, reasoned version of clicking "Saknar bevis."

Read needs like existing findings / evidence are partly covered already by `list_linked_artifacts` and `list_bevis_gaps`.

## The real decision: auditor write access + provenance

The registry **filters AUDITOR role down to read-only** and excludes them from write tools. The person in the modal during an *extern* audit may be exactly that blocked role. So the crux isn't "advisory vs. agentic" in the abstract — it's **does an auditor get write-drafting tools, or only assessment?**

- **Option A — Auditor = read + assess only.** Agent reasons and points at gaps; the *team* (non-auditor roles) commits findings. Cleanest provenance — AI never authors an audit record; existing role filter enforces it for free.
- **Option B — Auditor = read + assess + `draft_finding` (approval-gated).** More useful in-flow; approval card + `AgentDecisionLog` give the "human committed it" trail. But deliberately punches a write hole in the AUDITOR filter.

**Lean:** Option B, but **only** `draft_finding` — the one write that accelerates the item-by-item grind, with the auditor still the signer. Keep status changes (`efterlevnadsbedomning`, closing findings) human-only — those are the accountable judgments.

## Two sharp edges

- **Kravpunkter snapshot is frozen.** `assess_item_kravpunkter` must read `kravpunkter_snapshot`, **not** the live `LawListItemRequirement`. Getting this wrong silently corrupts audit integrity.
- **`save_assessment` is already skill-gated** — precedent. Gate the audit tools behind an `audit-cockpit` skill that only activates inside the modal, so they never pollute the global chat's tool list.

## Effort shape

~90% the context type + role/provenance policy, ~10% the tools themselves (they wrap existing actions).

## Open questions

- Context type name: `AUDIT_ITEM` vs `CYCLE_ITEM`.
- Skill-gate (`audit-cockpit`) or always-on inside the modal?
- Does `assess_item_kravpunkter` return free-form reasoning or structured per-krav output the UI can render inline?
