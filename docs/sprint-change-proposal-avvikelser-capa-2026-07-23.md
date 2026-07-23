# Sprint Change Proposal — Avvikelser as a First-Class Entity + ISO-Grade Audit Cycles

**Author:** Sarah (PO) · **Date:** 2026-07-23 · **Process:** `correct-course` (batch mode)
**Trigger artefact:** `docs/briefs/avvikelser-standalone-and-iso-audit-cycles-brief.md` (2026-07-22)
**Affected artefacts:** Epic 23, Epic 29, Story 23.1, `epic-list.md`, the brief itself

---

## 1. Identified Issue Summary

A new brief (2026-07-22) re-scopes the compliance-finding (avvikelse) domain substantially beyond what **Epic 23** currently documents, and it explicitly reaches into **Epic 29** (the agent) and **Epic 21** (audit cycles). Three artefacts now describe overlapping slices of one domain with drifted detail, creating "three competing things" fog:

- **Epic 23 (as written)** — a narrower "findings registry" epic: a `SplitPanelModal`-based `<FindingModal>`, an `/anmärkningar` route, nav "under Efterlevnad", 5 stories. It **predates** the brief.
- **The brief** — the finding becomes a **hub**: standalone (`cycle_id` nullable + `workspace_id` + `source`), a Laglistor-mirrored `/avvikelser` register (DataTable core + item modal, *not* SplitPanelModal), typed edges to styrdokument/cross-cycle-review/recurrence, a 5-state CAPA lifecycle, ISO cycle upgrades, and agent implications (`list_findings` + edge readers). 3 phases.
- **Epic 29** — its skills (`prepare_audit`, `ledningens_genomgang`, `periodic_review`) consume findings; they are materially stronger on the richer model.

**This is not a pivot.** Story 29.1 (shipped) already built forward-compatibility for it — the null-guard on the finding→cycle relation, the note that findings gain `workspace_id`, and cycle-conditional link-row dispatch. The brief is the planned direction made concrete.

**Two genuine conflicts** (beyond naming drift) were found during analysis:
- **C1 — anchor CHECK blocks the core use case.** Story 23.1's `CHECK (cycle_id OR law_list_item_id OR requirement_id)` would **reject** a pure ad-hoc avvikelse raised with zero links — the exact "raiseable in seconds, links optional" flow the brief (§4) makes central. With `workspace_id` as real tenancy, the anchor requirement is both unnecessary and actively harmful.
- **C2 — `source` enum missing from the keystone.** The brief treats `source` as one of the three foundational schema moves (§2), but Story 23.1 omits it. Adding it later means a second migration to a table the register already reads.

## 2. Epic Impact Summary

- **Epic 23** — *modified & expanded*, not abandoned. Its premise (finding as first-class) is correct; the brief deepens scope (hub model, cycle upgrades, agent tools) and corrects surface decisions (DataTable+modal over SplitPanelModal; `/avvikelser` + flat top-level nav over `/anmärkningar` under Efterlevnad). Grows from 5 stories to a 3-phase program (~9 stories). **The brief becomes Epic 23's authoritative design source** (same pattern as Epic 28 ↔ its refactor plan).
- **Epic 29** — *unblocked and re-based, not changed in intent.* 29.1 (done) and the infra stories (29.2a `ask_user`, 29.3 `create_cycle`, 29.5 `CYCLE` context) are unaffected. The **skill** stories (29.2, 29.4, 29.6) get re-pointed to consume the richer finding model and gain a hard dependency on Epic 23 Phase 1. The `list_findings` tool + `get_finding` edge extensions move **into Epic 23's foundation phase** (they need the schema), matching how 29.1 delivered the cycle readers.
- **Epic 21** — *additive upgrades only* (carry-forward, effectiveness step, recurrence detection, management-review export). No rework of sealed-cycle immutability.
- **No other epic affected.** The public-law-DB/SEO thread is orthogonal and untouched.

## 3. Artifact Adjustment Needs

| Artefact | Change |
|---|---|
| `docs/prd/epic-23-anmarkningar-first-class.md` | Superseding-scope header + revised Goal/Delivers/Stories/phasing/deps; brief named as design source; Change Log row |
| `docs/stories/23.1.*.md` | **C1:** drop the anchor CHECK (require only `workspace_id`); **C2:** add `source` enum; naming → `/avvikelser`; Change Log row |
| `docs/prd/epic-29-*.md` | Replace the Epic 23 "coordination" note with the layered-stack model + Phase-1 hard-dep; note `list_findings`/edge readers now ship with Epic 23 |
| `docs/prd/epic-list.md` | Rewrite Epic 23 entry (new scope, 3 phases); update Epic 29 dependency line; refresh "Last updated" |
| `docs/briefs/avvikelser-...-brief.md` | Status → "Absorbed into Epic 23 (re-scoped 2026-07-23); build per §9 phasing" |

## 4. Recommended Path Forward

**Option 1 — Direct Adjustment / Integration (SELECTED).** Reconcile the docs so the brief becomes Epic 23's authoritative scope, re-base Epic 29's skill stories on top, and fix the two Story 23.1 conflicts in place (23.1 is still `Draft` — zero built work is lost). No rollback needed (Option 2 N/A — 29.1 is forward-compatible and stays). No MVP re-scope needed (Option 3 N/A — this deepens an existing epic, no new PRD).

**Rationale:** the finding-as-hub schema move (`cycle_id` nullable + `workspace_id` + `source`) is a single keystone that unblocks the register, the agent's `list_findings`, and the cross-cycle cycle upgrades simultaneously. Building the Epic 29 skills *before* it means building them twice; building the foundation first ships standalone value (a cross-cycle avvikelseregister where none exists) and makes every downstream skill better.

**The mental model to carry forward — one domain, two layers:**

```
  Skills layer   →  Epic 29: prepare_audit · ledningens_genomgang · periodic_review
   (workflows)       orchestrate the tools below into ISO conversations
  ─────────────────────────────────────────────────────────────────────
  Foundation     →  Epic 23 (re-scoped): finding-as-hub model + /avvikelser
   (data+tools)      register + ISO cycle upgrades + mechanical agent tools
                     (list_findings, get_finding edge readers)
```

Story 29.1 (cycle readers) straddles both by design and remains the correct first brick.

## 5. PRD MVP Impact

None. No change to MVP goals or the core PRD. This is a brownfield deepening of the post-MVP compliance-audit surface (Epic 21 lineage). Migrations remain additive and are applied manually per the standing rule.

## 6. High-Level Action Plan

**Sequencing (foundation-first):**
1. **Epic 23 Phase 1** — `23.1` (schema: nullable `cycle_id` + `SetNull`, `workspace_id`, `source`; **no anchor CHECK**) → `listFindingsForWorkspace` → `/avvikelser` register (DataTable+modal, Laglistor mirror) → `list_findings` agent tool. *Ships the cross-cycle register.*
2. **Epic 23 Phase 2** — standalone raise flow + typed links (`ComplianceFindingDocumentLink`), `get_finding` edge extensions, CAPA status enum.
3. **Epic 23 Phase 3** — cycle-review join, kickoff carry-forward, effectiveness step, recurrence + `recurs_from_finding_id`, management-review export, agent kickoff-agenda + triage.
4. **Epic 29 skills** — resume `29.2a → 29.2 → 29.3`, then `29.4`, then `29.5 → 29.6`, each consuming the richer model. `29.6`'s `create_finding` targets the standalone `createFinding`.

**Open decisions carried from brief §10** (resolve at each phase's story-draft time, not now): source taxonomy breadth; 5-state CAPA vs bolt-on verification; reporter role; link-relation typing depth.

## 7. Agent Handoff Plan

- **PO (Sarah) — now:** apply the artefact edits in §3 (this proposal is that work). No PM/Architect re-plan required — scope deepens an existing epic without new architecture.
- **SM — next:** when Epic 23 Phase 1 is greenlit, draft the *revised* `23.1` further into `23.2`/`23.3` via `create-next-story`, one at a time.
- **Dev/QA — per story:** the established SM→PO→Dev→QA pipeline, unchanged.

## 8. Success Criteria for the Change

- A single authoritative scope for the avvikelse domain (Epic 23 = brief), with Epic 29 layered cleanly on top and no contradictory surface/schema decisions across docs.
- Story 23.1 raises a zero-link ad-hoc avvikelse without a CHECK violation and carries `source`.
- `epic-list.md` reflects reality; the "three competing things" fog is gone.

---

*Approved for application 2026-07-23. Edits applied in the same pass — see each artefact's Change Log.*
