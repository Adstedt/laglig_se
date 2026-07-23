# Build Sequence — Epic 23 (Avvikelser) + Epic 29 (ISO Audit Skills)

**Owner:** Sarah (PO) · **Created:** 2026-07-23 · **Branch:** `feat/epic-29-iso-audit-companion`
**Governing record:** `docs/sprint-change-proposal-avvikelser-capa-2026-07-23.md`
**Source epics:** `docs/prd/epic-23-anmarkningar-first-class.md` · `docs/prd/epic-29-iso-audit-companion-agent-skills.md`

> One domain, two layers. **Epic 23** builds the finding-as-hub *foundation* (data model,
> `/avvikelser` register, ISO cycle upgrades, mechanical agent read tools). **Epic 29** layers
> the *ISO agent skills* on top. Every story runs the same four-stage BMAD pipeline.
> ~14 stories to full completion.

---

## The unit of work — repeats per story

Proven on Story 29.1 (gate PASS, 6,438 unit tests green). Each stage is a fresh sub-agent; the story file is the hand-off artifact between them.

| # | Stage | Agent | Produces |
|---|-------|-------|----------|
| 1 | **Draft** | SM (Bob) | Self-contained story file from the epic — ACs, pinned line anchors, Dev Notes |
| 2 | **Validate** | PO (Sarah) | Anti-hallucination sweep + fixes → status **Approved** |
| 3 | **Implement** | Dev (James) | Code + tests, typecheck/lint green → **Ready for Review** |
| 4 | **Review** | QA (Quinn) | Diff review, gate file, PASS → **Done** |
| ✓ | **Commit** | — | Land on branch; next story |

**Status legend:** ✅ Done · 🟠 Ready to draft · ⚪ Queued · 🔵 Blocked on dependency

---

## The sequence

### ★ Recommended critical path (to first user-facing payoff)

```
23.1 ──► 23.2 ──► 23.3 ──►  ◆fork  ──► 29.2a ──► 29.2 (prepare_audit)
(schema) (register) (list_findings)              (chips)  ★ flagship
```

Get the foundation in, then jump straight to the flagship skill for real feedback **before** investing in Epic 23's deeper CAPA machinery (Phase 2/3). Everything else is demand-driven after that.

---

### Foundation layer — Epic 23

#### Phase 1 — Model + register (read) → *ships a cross-cycle avvikelseregister where none exists*

- [ ] **23.1 — Finding-as-hub schema** · 🟠 Ready · ★ *next to draft*
  `cycle_id` nullable + `SetNull` · `workspace_id` · `FindingSource` enum (8-value) · **no anchor CHECK** · `listFindingsForWorkspace`. One manual migration.
  *Binding: PO amendments C1 (no CHECK) + C2 (source enum) already pinned in the story.*
  **Deps:** none (buildable now)

- [ ] **23.2 — `/avvikelser` register page** · ⚪ Queued · ★
  DataTable core, **Laglistor-cloned** list+modal, `?avvikelse=<id>` deep-link, flat top-level nav after Kontroller. Work modal ← law-list-item modal (`legal-document-modal/`).
  *Binding: UI parity mandate in the epic.*
  **Deps:** 23.1

- [ ] **23.3 — `list_findings` agent tool** · ⚪ Queued · ★
  Workspace-wide read: open-only / by-source / overdue. Mirrors the 29.1 reader conventions.
  **Deps:** 23.1

#### ◆ Decision point (after Phase 1)

**Recommended:** jump to the Epic 29 flagship (`29.2a → 29.2`) for the first user-facing payoff and real feedback, then return to Epic 23 Phase 2/3 on validated demand.

---

### Skills layer — Epic 29

#### Shipped

- [x] **29.1 — Cycle read tier** · ✅ Done
  `list_cycles` · `get_cycle` · `get_finding` + `create_task` finding-linkage. Gate PASS. Closes Epic 19 Story 19.4b.

#### The ISO workflows → *the auditor-channel + retention payoff*

- [ ] **29.2a — `ask_user` chips** · 🟠 Ready · ★
  Agent-asks clarification primitive (inverse of `suggest_followups`). Shared UI primitive.
  **Deps:** none (buildable now)

- [ ] **29.2 — `prepare_audit` skill** · 🔵 Blocked · ★ *flagship*
  Extern-revision prep: cycle-history anchor, cutoff diff, sweep, triage, re-run, post-audit capture (A10).
  **Deps:** 23.1 (richer finding model) · 23.3 (`list_findings`) · 29.2a

- [ ] **29.3 — `create_cycle` proposal** · ⚪ Queued
  Agent offers "ska vi planera en kontroll?" as an approval card. One additive enum (manual migration).
  **Deps:** 29.2

- [ ] **29.4 — `ledningens_genomgang` skill** · 🔵 Blocked
  Assembles the ISO 9.3.2 underlag from workspace data; drafts the protokoll as a `REPORT` styrdokument.
  **Deps:** 23.1 · 23.3

- [ ] **29.5 — `CYCLE` chat context** · ⚪ Queued
  Additive `ChatContextType.CYCLE` + page wiring (mirrors `CHANGE`). One additive migration.
  **Deps:** none (buildable now)

- [ ] **29.6 — `periodic_review` + `create_finding`** · 🔵 Blocked
  In-cycle assistant; proposes avvikelser. Targets Epic 23's standalone `createFinding`.
  **Deps:** 29.5 · **21.10** (deferred cycle-editable guard — must land first, or implement equivalent) · Epic 23 finding model

---

### Foundation layer — Epic 23, deeper (demand-driven)

#### Phase 2 — Standalone raise + typed links

- [ ] **23.4 — Raise flow + creation modal** · ⚪ Queued
  "Ny avvikelse" **reusing the cycle-audit `finding-editor`**; `source` + optional link pickers; zero-link raise in seconds.
  *Binding: UI parity mandate (creation modal reuse).*
  **Deps:** 23.2

- [ ] **23.5 — Typed styrdokument edges + CAPA status** · ⚪ Queued
  `ComplianceFindingDocumentLink` (`GOVERNED_BY` / `RESULTED_IN_UPDATE`) · `get_finding` edge readers · 5-state CAPA status enum.
  **Deps:** 23.4

#### Phase 3 — ISO cycle loop → *the certification-auditor demonstrable loop*

- [ ] **23.6 — Cross-cycle review + carry-forward** · ⚪ Queued
  `ComplianceFindingCycleReview` join · cycle-kickoff "kända vid start". Shares the "open finding in scope X" query with Epic 29's A3 anchor.
  **Deps:** 23.5

- [ ] **23.7 — Effectiveness + recurrence** · ⚪ Queued
  Verify-effective-next-review step · recurrence detection + `recurs_from_finding_id`.
  **Deps:** 23.6

- [ ] **23.8 — Mgmt-review export + agent triage** · ⚪ Queued
  Cross-cycle rollup (open/closed by source, recurrence rate) for ledningens genomgång; agent kickoff-agenda + on-raise triage.
  **Deps:** 23.7 · 29.4

---

## Completion — closing out both epics

1. **PO epic closure** — per-story records archived to `docs/stories/completed/`, gate files retained, epic docs marked **Done** with deviation notes (the Epic 7 / Epic 28 pattern).
2. **Merge to main** — PR from `feat/epic-29-iso-audit-companion` (carries both 23 + 29). Push hooks run typecheck + full build + sitemaps (as on PR #94).
3. **Verify in-app** — seed a workspace with cycles + findings; drive `prepare_audit` and the `/avvikelser` register end-to-end; confirm `AgentDecisionLog` shows real tool calls (not model prose).

---

## Dependency notes (easy to miss)

- **Foundation-first is not optional for the skills.** 29.2 / 29.4 / 29.6 are blocked specifically on Epic 23's finding model — building them on today's cycle-only findings means building them twice.
- **Two independent stories** (29.2a, 29.5) can slot in anytime as filler while other work is drafting.
- **21.10** (deferred cycle-editable guard) is a hard prerequisite for **29.6** — schedule it before the last skill.
- **Migrations are applied manually** by Alexander (standing rule): 23.1, 29.3, 29.5, 29.6 each carry one; the story hands over the `prisma migrate deploy` command.

---

## Immediate next action

**SM drafts the revised 23.1** (`create-next-story`) — the two conflict fixes (C1/C2) and the `source` taxonomy are already pinned, so the draft mainly finalizes the DDL. Then run it through PO → Dev → QA, same as 29.1.
