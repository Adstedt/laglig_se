# Brief: Avvikelser as a first-class entity + ISO-grade audit cycles

**Status:** ✅ **Absorbed into Epic 23 (re-scoped 2026-07-23)** — this brief is now Epic 23's
authoritative design source; build per the §9 phasing. See
`docs/sprint-change-proposal-avvikelser-capa-2026-07-23.md` and
`docs/prd/epic-23-anmarkningar-first-class.md`. *(Was: Concept checkpoint, 2026-07-22.)*
**Date:** 2026-07-22
**Related epics:** Epic 21 (Lagefterlevnadskontroll — cycle upgrades), Epic 23 (**this brief = its scope**), Epic 29 (ISO audit companion / agent — the skills layer on top)

---

## 0. TL;DR

Make the **finding (avvikelse)** a first-class, standalone entity instead of a child that
only exists inside an audit cycle. Give it its own top-level **Avvikelser** register page,
optional typed links to cycles / kravpunkter / styrdokument, and a set of audit-cycle
upgrades (cross-cycle carry-forward, effectiveness verification, recurrence detection,
management-review export) that make the tedious ISO nonconformity loop demonstrable to a
certification auditor.

The codebase already leans this way: the Story 29.1 agent read tier contains explicit
"Epic 23 tolerance for future ad-hoc findings" — a runtime null-guard on the finding→cycle
relation, a note that findings gain their own `workspace_id` in Epic 23, and corrective-task
dispatch that only writes a `ComplianceCycleTaskLink` when a `cycle_id` exists. Standalone
findings are a planned direction, not a pivot.

---

## 1. Where things stand in the code

- **`ComplianceFinding`** (`prisma/schema.prisma:2343`) is the avvikelse. Today `cycle_id`
  is **required, non-nullable, `onDelete: Cascade`** — a finding cannot exist without a cycle
  and dies with it. It already has the right optional edges: `law_list_item_id`,
  `requirement_id` (kravpunkt), `corrective_action_task_id`. It has **no direct styrdokument
  link**. Types: `FindingType` = `AVVIKELSE` / `OBSERVATION` / `FORBATTRING`;
  `FindingSeverity` = `MAJOR` / `MINOR`.
- **`ComplianceAuditCycle`** (`:2276`): status `PLANERAD → PAGAENDE → AVSLUTAD`; `audit_type`
  `INTERN`/`EXTERN`; `scope_definition` JSON; `law_change_cutoff_date`; one-to-many `findings`,
  `items`, `reports`, plus M:N `task_links`. (Legacy-naming caveat: `sealed_at`/`sealed_by`
  now just mean "completed" after the SEAL/ARKIVERAD lifecycle was collapsed into `AVSLUTAD`.)
- **`ComplianceAuditItem`** (`:2318`): one row per in-scope law-list item; carries
  `efterlevnadsbedomning` (`UPPFYLLD`/`DELVIS`/`EJ_UPPFYLLD`/`EJ_TILLAMPLIG`), review/sign-off
  metadata, and a `kravpunkter_snapshot` JSON frozen at materialisation.
- **`Task`** (`:1179`) is the generic Kanban task reused as the corrective åtgärd, linked via
  the nullable `compliance_finding_id` back-reference (1:1 by convention with the finding's
  `corrective_action_task_id`). No dedicated corrective-action model. M:N to cycles via
  `ComplianceCycleTaskLink`.
- **`LawListItemRequirement`** (`:464`) is the kravpunkt; `RequirementEvidenceLink` (`:491`) is
  the only place a kravpunkt attaches to a **styrdokument** (`WorkspaceDocument`) as bevis.
- **Findings have no standalone surface.** They render only inside the cycle detail page's
  Findings tab as expandable `FindingCard`s (`cycle-findings-tab.tsx` — the deliberately
  non-tabular workspace surface). The list action `listFindingsForCycle` is cycle-scoped only.
- **Agent read tier** (Story 29.1): `list_cycles`, `get_cycle`, `get_finding` — but **no
  `list_findings`**. `get_finding` already exposes four typed edges (cycle, law_item,
  requirement, correctiveTask) via the `ContextHandle` 1-hop grammar. `create_task` can link a
  task back to a finding as its corrective åtgärd.
- **Nav**: `left-sidebar.tsx` → `platformItems`, where **Kontroller** was already promoted to
  top-level. Gold-standard table is the unified **`DataTable` core**; **`CycleListTable`** is
  the closest read/filter/navigate consumer to copy.

---

## 2. Core model shift — the finding becomes the hub

Three schema moves, in order of necessity:

1. **`cycle_id` → nullable**, and `onDelete: Cascade` → `SetNull`. A finding survives without a
   cycle and survives its cycle's deletion. This is the whole premise.
2. **Add `workspace_id` to `ComplianceFinding`** (direct tenancy). Today the finding is scoped
   *through* its cycle (`cycle: { workspace_id }`); a standalone finding has no cycle to borrow
   scoping from. The 29.1 code already forecasts this.
3. **Add a `source` enum** — makes the register meaningful and powers management-review
   reporting:
   `INTERNREVISION · LAGREVISION · DRIFT` (operational/day-to-day) `· TILLBUD · KLAGOMAL ·
   EXTERNREVISION · LEDNINGENS_GENOMGANG · MYNDIGHET`. Cycle-created findings default their
   source from the cycle's `audit_type`; ad-hoc findings pick it at raise time.

Everything in §3–§5 builds on these three.

---

## 3. Relationship model (typed edges)

Findings gain optional, typed links. The two that need **new** structure:

- **Finding → styrdokument** (the gap today). New M:N join
  `ComplianceFindingDocumentLink(finding_id, workspace_document_id, relation_type)` with
  `relation_type` = `GOVERNED_BY` (the procedure that should have prevented this) or
  `RESULTED_IN_UPDATE` (the doc this finding forced a revision to). That second value is the
  closed-loop 10.2 "changes to the management system" evidence, made queryable.
- **Finding ↔ cycle, with roles.** A finding lives across cycles in different capacities. Keep
  `cycle_id` as the **origin** (raised-in) cycle, and add a lightweight join
  `ComplianceFindingCycleReview(finding_id, cycle_id, outcome, reviewed_at, reviewed_by)` where
  `outcome` = `VERIFIED_CLOSED · STILL_OPEN · RECURRED`. This is how "was this gap closed since
  last audit?" gets recorded — verification lands in cycle N+1, not at closure in cycle N.
- **Finding → finding recurrence.** Self-FK `recurs_from_finding_id` (nullable). Powers the
  red-flag: same nonconformity resurfacing = ineffective corrective action = a minor escalating
  to systemic.

Existing edges (`requirement_id` kravpunkt, `law_list_item_id`, corrective task) stay as-is.

**Why typed, not flat:** each edge maps to something ISO actually wants traced (requirement
violated / document to update / cross-cycle status / recurrence), and the agent traverses them
as clean graph queries instead of guessing — curated, high-signal context.

---

## 4. Deliverable A — the standalone Avvikelser page

- **Route & nav.** `app/(workspace)/avvikelser/page.tsx` — `force-dynamic` async server
  component, gated `hasPermission(ctx.role, 'activity:view')` (mirrors cycle pages).
  **Decided (2026-07-22):** the nav label is **"Avvikelser"** (the Swedish QMS umbrella term
  for the whole avvikelsehanteringsprocess), placed as a **flat top-level `NavItem` in
  `platformItems` immediately after Kontroller** — a paired-loop sibling, *not* nested under
  Kontroller (nesting would re-subordinate the exact entity we're lifting out). The three
  `FindingType` values (`Avvikelse` / `Observation` / `Förbättringsförslag`) live as the in-page
  **type facet**, which resolves the module-vs-type name collision at the filter level. Route
  stays a clean top-level `/avvikelser` even though Kontroller sits under `/laglistor/kontroller`
  (nav position and URL nesting are independent).
- **Data.** New `listFindingsForWorkspace()` in `app/actions/compliance-finding.ts` —
  workspace-scoped, cross-cycle. Extend `FindingRow` with `cycleName`/`cycleId` (nullable now)
  and `source`. Once `workspace_id` is a real column it's a one-line `where`.
- **Structure — mirror Laglistor exactly (decided 2026-07-22): filterable list + item modal,
  one mental model.** The page is *not* a read/navigate table with a separate detail route; it
  reproduces the Laglistor "browse the list, work in the modal" pattern so findings feel like
  the same kind of object as law-list items. Concretely, mirror
  `components/features/document-list/document-list-page-content.tsx`:
  - A `findings-page-content` client component owns `selectedFindingId` state; the table's
    `onRowClick` opens the finding modal (no route change), exactly like `handleOpenModal` /
    `selectedListItemId` in the laglista page-content.
  - **Deep-link, not a detail page.** Support a URL param (e.g. `/avvikelser?avvikelse=<id>`)
    that opens the modal on load — same mechanism as `documentIdFromUrl` (line 630) in the
    laglista page-content — so an individual finding stays shareable/linkable without a
    dedicated `[findingId]` route.
- **Table.** Build on the gold-standard **`DataTable` core** and follow the **`DocumentListTable`**
  consumer (the canonical laglista grid — *not* migrated to shadcn), so inline-edit affordances
  (status, severity, owner, due date) match how users already edit law-list items. Columns:
  type icon · title · severity · source · linked-to (cycle / kravpunkt / styrdokument chips) ·
  owner · due date (overdue emphasis) · status · created. `FilterChipGroup` on **type · severity ·
  source · status · overdue**. One register, links as a facet — audit-sourced and ad-hoc findings
  are the same list, filtered.
- **Item modal — the primary workspace.** Adapt/extend the existing `finding-editor` into the
  full modal experience, structured like `legal-document-modal/` (header + details box +
  sections). Everything happens in the modal: description → root cause → corrective task →
  verification → evidence, plus the relationship panel (cycle / kravpunkt / styrdokument /
  recurrence) and cross-cycle review history. This is where the CAPA loop is worked, mirroring
  how the law-list-item modal is where compliance work happens.
- **Raise flow.** A "Ny avvikelse" action from the register (and later from any linked entity's
  page) opens the same modal in create mode, with a `source` picker and optional link pickers
  (cycle / kravpunkt / styrdokument). **Linking is optional and cheap** — a finding must be
  raiseable in seconds with zero links, enriched later. If linking feels mandatory, the
  operational path dies.

---

## 5. Deliverable B — ISO-grade audit cycle upgrades

Five upgrades where the tedious ISO work becomes real value:

1. **Cycle kickoff carry-forward.** When you open cycle N+1 over the same law list, the wizard
   pre-populates a **follow-up section**: open + recently-closed findings from the prior
   cycle(s), each requiring a `ComplianceFindingCycleReview` outcome.
   *"Last cycle: 6 findings — 4 verified closed, 1 open (overdue 23 d), 1 confirm still
   effective."* This is literally the certification auditor's opening move, done before they
   arrive. Directly answers "have the gaps closed since last audit?"
2. **Effectiveness verification as its own step.** Today closure is `closed_at` +
   `verification_note`. Split "corrective action done" from "verified effective at a later
   review," recorded via the cycle-review join. This is the 10.2 effectiveness check that can't
   honestly happen at closure time.
3. **Recurrence detection.** When a finding is raised that matches a previously-closed one
   (same kravpunkt/law item, agent-assisted match), offer to set `recurs_from_finding_id`.
   Surfaces the single most scrutinised signal in a follow-up audit.
4. **Classification discipline.** Keep `FORBATTRING` (improvement opportunities) out of the
   avvikelse KPIs so good ideas don't inflate the nonconformity count. Enforce severity on
   `AVVIKELSE`.
5. **Management-review export.** A cross-cycle rollup for ledningens genomgång: open vs closed
   by source, overdue carryover, and **recurrence rate** — the one metric that says whether the
   system is actually improving. `ComplianceAuditReport.manifest` already carries findings JSON;
   extend for the cross-cycle view.

---

## 6. Agent implications (Epic 29 fit)

- **Add `list_findings`** — workspace-wide, cross-cycle, open-only / by-source / overdue. The
  one discovery gap in the current tool surface; everything else (`get_finding` edges,
  `create_task` linkage) already exists.
- **New edge readers**: teach `get_finding` the styrdokument and recurrence edges; the
  `ContextHandle.type` union already reserves `audit_item`/`report` for `get_audit_item` /
  `get_report`.
- **Kickoff agenda generation**: the agent traverses `raised-in` edges from the prior cycle,
  checks current status, flags overdue + recurrences, drafts the follow-up agenda — a clean
  graph query, not a heuristic.
- **Triage on raise**: for a rough operational avvikelse, the agent classifies severity,
  suggests the kravpunkt/clause, drafts a root-cause hypothesis and corrective action, and flags
  likely duplicates. Highest value exactly on the low-quality ad-hoc path.
- **Bound the traversal** — cap depth and rank edges, or relational retrieval gets noisy and
  expensive.

---

## 7. Lifecycle / status model

Move from the current open/closed binary to an explicit status that reflects CAPA:

`ÖPPEN → UTREDS (root cause) → ÅTGÄRD_PÅGÅR → INVÄNTAR_VERIFIERING → STÄNGD`

with `STÄNGD` carrying an effectiveness outcome, and a `RECURRED` transition that spawns a
linked new finding rather than silently reopening. Overdue is derived from `due_date` +
not-`STÄNGD`.

---

## 8. ISO clause mapping (why each piece is defensible)

| Feature | Clause |
|---|---|
| Standalone raise, any source | 10.2 (nonconformity from any origin) |
| Finding → kravpunkt | 10.2 nonconformity-to-requirement trace |
| Finding → styrdokument (`RESULTED_IN_UPDATE`) | 10.2 "changes to the management system" + 7.5 |
| Cross-cycle carry-forward | 9.2 ("results of previous audits") |
| Effectiveness verification next cycle | 10.2 effectiveness review |
| Recurrence detection | 10.2 (ineffective corrective action) |
| Management-review rollup | 9.3 ("nonconformities and corrective actions") |

(Clause numbering is the Annex SL / High Level Structure shared by ISO 9001, 14001, 45001,
27001, 50001.)

---

## 9. Suggested phasing

- **Phase 1 — model + register (read).** Nullable `cycle_id` + `SetNull`, add `workspace_id` +
  `source`, `listFindingsForWorkspace`, the Avvikelser page + nav, `list_findings` agent tool.
  *Ships value immediately: a cross-cycle avvikelseregister where none exists.*
- **Phase 2 — standalone raise + typed links.** Raise flow with source/link pickers,
  `ComplianceFindingDocumentLink`, `get_finding` edge extensions, status enum.
- **Phase 3 — ISO cycle loop.** Cycle-review join, kickoff carry-forward, effectiveness step,
  recurrence + `recurs_from_finding_id`, management-review export, agent kickoff-agenda +
  triage.

---

## 10. Open decisions

1. **Source taxonomy** — ~~the 8 sources above, or a leaner starting set?~~ **RESOLVED 2026-07-23 (PO):
   the full 8-value set** (`INTERNREVISION · LAGREVISION · DRIFT · TILLBUD · KLAGOMAL ·
   EXTERNREVISION · LEDNINGENS_GENOMGANG · MYNDIGHET`). Baked into Story 23.1's keystone migration.
2. **Status enum** — the 5-state CAPA model in §7, or keep closer to today's open/closed with
   the verification step bolted on?
3. **Reporter role** — a lightweight "can raise, can't manage/close" role in Phase 2, or
   restrict raising to existing member roles at first?
4. **Link semantics scope** — `relation_type` on the styrdokument and cycle edges
   (recommended), or flat links to start?

---

## Appendix — key code references

| Concept | Location |
|---|---|
| `ComplianceFinding` model | `prisma/schema.prisma:2343` |
| `ComplianceAuditCycle` model | `prisma/schema.prisma:2276` |
| `ComplianceAuditItem` model | `prisma/schema.prisma:2318` |
| `Task` (corrective action) | `prisma/schema.prisma:1179` |
| `LawListItemRequirement` (kravpunkt) | `prisma/schema.prisma:464` |
| `RequirementEvidenceLink` (bevis) | `prisma/schema.prisma:491` |
| `WorkspaceDocument` (styrdokument) | `prisma/schema.prisma:2056` |
| Findings tab (card UI) | `components/features/compliance-audit/cycle-detail/cycle-findings-tab.tsx` |
| Finding editor modal | `components/features/compliance-audit/finding-editor/finding-editor.tsx` |
| Cycle-scoped list action | `app/actions/compliance-finding.ts` (`listFindingsForCycle`) |
| Nav items | `components/layout/left-sidebar.tsx` (`platformItems`) |
| Table core | `components/ui/data-table/` |
| Reference consumer to mirror (list + modal) | `components/features/document-list/document-list-page-content.tsx` (list/modal state + `?item` deep-link), `document-list-table.tsx` (grid), `legal-document-modal/` (item modal) |
| Agent cycle/finding readers | `lib/agent/tools/{list-cycles,get-cycle,get-finding}.ts` |
| Agent tool registry | `lib/agent/tools/index.ts` |
| Corrective-task linkage (dispatch) | `app/actions/pending-agent-actions.ts` (`CREATE_TASK` branch) |
