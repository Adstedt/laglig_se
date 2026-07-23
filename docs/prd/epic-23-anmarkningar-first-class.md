# Epic 23: Avvikelser som förstklassiga objekt + ISO-grade audit cycles — Brownfield Enhancement

> **⚠️ SCOPE RE-BASED 2026-07-23 (Sprint Change Proposal).** This epic was re-scoped
> to absorb `docs/briefs/avvikelser-standalone-and-iso-audit-cycles-brief.md` (2026-07-22),
> which is now its **authoritative design source** (the sections below are the PRD-level
> projection; the brief carries the detailed model, phasing, and code references — same
> relationship Epic 28 has with its refactor plan). See
> `docs/sprint-change-proposal-avvikelser-capa-2026-07-23.md` for the full analysis.
>
> **What changed vs the original (pre-brief) epic, now superseded below:**
> - The finding becomes a **hub**: schema adds `source` (not just `cycle_id`-nullable + `workspace_id`); typed edges to **styrdokument**, **cross-cycle review**, and **recurrence**.
> - Surface: the register mirrors **Laglistor** (the `DataTable` core + item modal), **not** a `SplitPanelModal` `<FindingModal>`. Route is **`/avvikelser`**; nav is a **flat top-level item after Kontroller** (not "under Efterlevnad").
> - Adds **ISO cycle upgrades** (carry-forward, effectiveness verification, recurrence detection, management-review export) and the **agent read tools** (`list_findings`, `get_finding` edge readers) that Epic 29's skills consume.
> - Grows from 5 stories to a **3-phase program (~9 stories)**; see the revised Stories section.
> - The original prototype refs (`_prototypes/anmarkningar-*.html`, SplitPanelModal shell) and the `/anmärkningar` naming are **superseded**; the pre-brief body is retained below for context only where it still holds (schema-additivity approach, activity-log/comment reuse).

**Goal:** Make the **avvikelse (`ComplianceFinding`)** a first-class, standalone entity — its own top-level **Avvikelser** register (`/avvikelser`, Laglistor-mirrored list + item modal), optional typed links to cycles / kravpunkter / styrdokument / prior findings, a CAPA lifecycle, and a set of audit-cycle upgrades — so the tedious ISO nonconformity loop (raise → root-cause → correct → verify effective → detect recurrence → report to ledningen) is demonstrable to a certification auditor, and the Epic 29 agent can traverse it as a clean graph.

**Value Delivered:** Today findings can only be raised inside a `ComplianceAuditCycle` and are buried under cycle-detail tabs once the cycle closes. Customers in regulated industries (ISO 9001 §10.2, ISO 14001 §10.2, ISO 45001 §10.2) need a continuous-improvement register: any team member should be able to file an observation or improvement suggestion on a Tuesday afternoon without scheduling an audit cycle, and prior-cycle findings still open should remain visible during day-to-day work — not just when the next cycle opens. This epic delivers the register without diluting the audit primitive (findings remain anchored to a `LawListItem` or `Requirement`; the cycle context is preserved when present).

**Delivers:**
- Schema migration: `ComplianceFinding.cycle_id` becomes nullable; new `workspace_id`, `created_by_user_id`, `assignee_id` columns; `Comment` polymorphic parent extended with `finding_id`; CHECK constraint on at least one anchor (`law_list_item_id OR requirement_id`) for ad-hoc findings
- New top-level route `app/(workspace)/anmarkningar/page.tsx` with `PageHeader` + `TableToolbar` + shadcn `<Table>` mirroring `/uppgifter` architecture; URL-synced filters (type / source / status / assignee / anchor); tab segments (Alla / Öppna / Tilldelade mig / Återkommande / Stängda)
- New shared `<FindingModal>` on the `SplitPanelModal` shell (the same shell used by `TaskModal` and `LegalDocumentModal`): scrollable left panel (title editor → description / grundorsak / föreslagen åtgärd → activity feed) + sticky right rail (status & action box → details → linked artifacts → snabblänkar)
- Activity feed on findings (Alla / Kommentarer / Historik) — comments via the existing polymorphic `Comment` model; history via the existing `ActivityLog` action stream
- Three entry-point rewires: cycle-detail Findings tab opens the shared modal (was inline `FindingEditor`/`FindingCard`); law-list-item modal "Skapa anmärkning" + "Saknar bevis" pill open the shared modal in create-mode with anchor prefilled; `/anmärkningar` registry's "+ Ny anmärkning" opens it in unanchored create-mode
- Cross-cycle visibility: cycle creation wizard surfaces existing open findings on the cycle's scoped `LawListItem`s as "kända vid start"; cycle-detail Findings tab gains "Visa öppna från tidigare kontroller" toggle
- Sidebar nav entry under Efterlevnad with red-pip count for open findings

**Requirements covered:** Brief Q294 ("Should findings be visible outside the cycle in which they were raised?") and Q295 ("How do we represent carried-over avvikelser?") from `docs/lagefterlevnadskontroll-brief.md`. Adjacent: ISO 19011 audit-output taxonomy (avvikelse / observation / förbättringsförslag) — explicitly modelled, not collapsed into "tasks with a tag".

**Estimated stories:** 5

**Dependencies:**
- **Epic 21** (Lagefterlevnadskontroll) — Active/UAT-ready: source of `ComplianceFinding`, `FindingEditor`, `FindingCard`, `cycle-findings-tab.tsx`. Hard dependency — Epic 23 refactors these. **Coordinate so 21.x stories don't add new finding mutations between now and 23.x landing.**
- **Epic 22** (UI Primitives Alignment) — Done (PR #60 merged): consumes `<PageHeader>`, `<TableToolbar>`, `<FilterChip>`, `<Badge tone>`, `<EmptyState>`. All five Epic 23 stories build on these primitives.
- **Epic 6** (Compliance Workspace) — Done: source of `Comment` model, `ActivityLog`, `LawListItem`, threaded comments UX (`threaded-comments.tsx`).
- **Epic 17** (Document Management) — Done: source of `LinkedArtifactsPanel` (`linked-artifacts:${listItemId}` SWR pattern). Story 23.2 reuses this for the modal's right rail.

**Priority:** High — unblocks continuous-improvement use cases that are core to ISO management-system audits, and resolves the long-standing post-MVP question from the lagefterlevnadskontroll brief. Sequenced after Epic 22 (now done) so the new surfaces use canonical primitives from day one.

**Source artefacts:**
- `_prototypes/anmarkningar-page-and-modal.html` — visual prototype: workspace-shell page with PageHeader/TableToolbar/Table + the SplitPanelModal-shaped FindingModal + entry-point matrix
- `_prototypes/findings-as-first-class.html` — earlier "architecture explainer" prototype (cycles identify, registry resolves) — kept as conceptual reference, superseded for visuals by the new prototype
- `docs/lagefterlevnadskontroll-brief.md` — Q294 and Q295 are the textual basis for this epic

---

## Epic Goal

Decouple `ComplianceFinding` from `ComplianceAuditCycle` lifecycle, ship a workspace-level registry page, and consolidate every finding-mutation surface onto a single shared `<FindingModal>` — without breaking existing cycle-scoped flows.

## Epic Description

### Existing System Context

- **Current relevant functionality:** Findings can only exist inside an audit cycle. They are created via `<FindingEditor>` (a Dialog form) launched from `cycle-findings-tab.tsx` or from the saknar-bevis pill on cycle-item modals; rendered as expandable `<FindingCard>` rows; closed/reopened via `closeFinding` / `reopenFinding` server actions in `app/actions/compliance-finding.ts`. Comments and activity history exist on `Task` and `LawListItem` but **not** on `ComplianceFinding` today.
- **Technology stack (this area):** Next.js 14 App Router, React 18, TypeScript, Tailwind, shadcn/ui (Radix primitives + `cva`), TanStack Table v8, TanStack Virtual, Prisma 5 + PostgreSQL (Supabase), SWR for client cache, `Comment` polymorphic over `task_id | law_list_item_id`, `ActivityLog` polymorphic with entity-type label maps (`lib/activity/action-constants.ts`).
- **Integration points:**
  - `prisma/schema.prisma` lines 2025–2063 (`ComplianceFinding`) — add columns + relax `cycle_id`
  - `prisma/schema.prisma` lines 1200–1234 (`Comment`) — add `finding_id` + relation
  - `app/actions/compliance-finding.ts` — loosen `createFinding` cycle requirement; add `listFindingsForWorkspace`, `getFindingById`, `assignFinding`
  - `lib/activity/action-constants.ts` — extend `compliance_finding` entity with `_ad_hoc` action variants and assign/unassign
  - `lib/auth/permissions.ts` — confirm or add `findings:create` scope (see open decision)
  - `components/features/compliance-audit/finding-editor.tsx` — refactored / absorbed into `<FindingModal>`
  - `components/features/compliance-audit/finding-card.tsx` — its expanded-detail content migrates into the modal's left panel; the row presentation stays for the cycle-detail tab list view
  - `components/features/compliance-audit/cycle-detail/cycle-findings-tab.tsx` — opens shared modal instead of inline editor; gains "Visa öppna från tidigare kontroller" toggle
  - `components/features/document-list/legal-document-modal/` — anmärkningar section + saknar-bevis pill rewired to open shared modal
  - `components/shared/split-panel-modal.tsx` — the existing shell (already used by TaskModal); no changes required, just a new consumer
  - `components/layout/left-sidebar.tsx` + `mobile-sidebar.tsx` — new "Anmärkningar" nav entry under Efterlevnad

### Enhancement Details

- **What's being added/changed:**
  1. **Schema layer** — `cycle_id` nullable; new `workspace_id` (denormalised; required), `created_by_user_id` (required), `assignee_id` (nullable); `Comment.finding_id` polymorphic addition; CHECK constraint on anchor; data backfill for existing cycle-scoped findings (workspace_id + created_by from cycle's lead auditor as documented historical default)
  2. **Server-action layer** — loosened `createFinding`, new `listFindingsForWorkspace`/`getFindingById`/`assignFinding`/`addFindingComment`; activity-log actions `finding_created_ad_hoc`, `finding_assigned`, `finding_anchor_changed`, `finding_commented`
  3. **Shared `<FindingModal>` component** — built on `<SplitPanelModal>`, feature-parity with `<TaskModal>`'s structure: scrollable left + sticky right rail + activity feed at bottom of left. Cycle-detail Findings tab migrates to it first as a refactor (no behaviour change), proving the shell before new surfaces consume it.
  4. **`/anmärkningar` registry page** — `app/(workspace)/anmarkningar/page.tsx` mirroring `/tasks/page.tsx` architecture. URL-synced filters via the existing patterns (`task-filter-params.ts` is the reference). Sidebar nav entry.
  5. **Ad-hoc creation surfaces** — law-list-item modal entry points, registry "+ Ny anmärkning" CTA. All open the shared modal in create-mode with appropriate prefill.
  6. **Cross-cycle visibility** — cycle wizard "kända vid start" panel; cycle-detail Findings tab toggle to surface ad-hoc + prior-cycle findings on the cycle's scoped items.
- **How it integrates:**
  - Schema migration is **additive + backward-compatible** (nullable column, denormalised mirrors backfilled). Existing cycle-scoped reads (`cycle.findings`) keep working unchanged.
  - The `<FindingModal>` is **introduced first as a refactor** of the existing cycle-detail Findings flow — same data, same actions, just unified into the shared shell. New surfaces consume the same component once it's proven.
  - **Zero changes** to existing revisionsrapport rendering, sealed-cycle PDF, activity-log entity types beyond additions.
  - Comments on findings are **purely additive** to the polymorphic `Comment` model — does not affect existing task/law-list-item comment threads.
- **Success criteria (measurable):**
  - A user with `tasks:edit` (or `findings:create` if scoped separately — see open decision) can file a finding on `/laglistor/[lawListItemId]` without first creating an audit cycle.
  - Open findings raised in one cycle are visible on `/anmärkningar` and (toggled) on the next cycle's Findings tab without manual re-entry.
  - A finding's modal opened from `/anmärkningar`, from a cycle's Findings tab, and from the law-list-item modal renders **identically** (same component, different prefill).
  - A finding can be filed, commented on, assigned, marked åtgärdad, verified, and closed entirely from the registry — no cycle required.
  - The cycle-detail Findings tab continues to render correctly with the existing data; users see no regression in cycle-scoped workflows.
  - All Epic 23 server actions emit corresponding `ActivityLog` entries (verifiable via `/workspace/activity`).

---

## Stories

> **Authoritative decomposition (2026-07-23) — the brief's 3-phase program (§9).**
> The detailed 23.1–23.5 breakdown further below is the *original* decomposition, kept
> for its salvageable implementation detail (schema-additivity, activity-log/comment reuse,
> revisionsrapport guard) but **partially superseded** — where it says `SplitPanelModal`,
> `/anmärkningar`, or "nav under Efterlevnad", read the phase table here instead. Draft each
> story just-in-time via `create-next-story` when its phase is greenlit.

**Phase 1 — model + register (read).** *Ships value immediately: a cross-cycle avvikelseregister where none exists.*
- **23.1 (revised)** — Finding-as-hub schema + server actions: `cycle_id` nullable + `onDelete: SetNull`, add `workspace_id` + **`source` enum**, **no anchor CHECK** (a finding needs only `workspace_id`; all links optional per brief §4), `Comment.finding_id`, `listFindingsForWorkspace`. *See the revised 23.1 story file — the two conflict fixes (C1 anchor-CHECK, C2 source) are applied there.*
- **23.2** — `/avvikelser` register page + nav: **Laglistor-mirrored** (DataTable core + `document-list-page-content` list/modal state + `?avvikelse=<id>` deep-link), flat top-level **"Avvikelser"** nav item after Kontroller. Type/severity/source/status/overdue filter facets.
- **23.3** — `list_findings` agent tool (workspace-wide, cross-cycle, open-only/by-source/overdue) — the one discovery gap in the current tool surface; mirrors the 29.1 reader conventions, sequenced after 23.1's schema.

**Phase 2 — standalone raise + typed links.**
- **23.4** — "Ny avvikelse" raise flow (source picker + optional link pickers; zero-link raise in seconds) + finding item modal (mirror `legal-document-modal/`).
- **23.5** — Typed edges: `ComplianceFindingDocumentLink` (styrdokument, `GOVERNED_BY` / `RESULTED_IN_UPDATE`); `get_finding` edge extensions (styrdokument + recurrence); CAPA status enum (`ÖPPEN → UTREDS → ÅTGÄRD_PÅGÅR → INVÄNTAR_VERIFIERING → STÄNGD`).

**Phase 3 — ISO cycle loop.**
- **23.6** — `ComplianceFindingCycleReview` join + kickoff carry-forward (wizard "kända vid start" / cycle-tab "öppna från tidigare kontroller" — the shared "open finding relevant to scope X" query Epic 29's A3 anchor also uses).
- **23.7** — Effectiveness-verification step (split "action done" from "verified effective next review") + recurrence detection + `recurs_from_finding_id`.
- **23.8** — Management-review export (cross-cycle rollup: open/closed by source, overdue carryover, recurrence rate) for ledningens genomgång; agent kickoff-agenda + on-raise triage.

### UI parity mandate (2026-07-23 — binding on stories 23.2 & 23.4)

The register and its modals must **clone the Laglistor experience**, not merely resemble it — a finding should feel like *the same kind of object* as a law-list item, one mental model, so muscle memory transfers. This is a hard constraint, not a stylistic preference:

- **Listing page ← Laglistor page.** Clone the structure of `components/features/document-list/document-list-page-content.tsx`: a `findings-page-content` client component owning `selectedFindingId` state, `onRowClick` → open modal (no route change), `?avvikelse=<id>` deep-link on load (mirror `documentIdFromUrl`). Grid = the **`DataTable` core** following the `DocumentListTable` consumer (the canonical, non-shadcn laglista grid) so inline-edit affordances (status, severity, owner, due date) match how law-list items are already edited.
- **Item / work modal ← law-list-item modal.** The modal where you *work a finding* clones `components/features/document-list/legal-document-modal/` (header + details box + sections + right rail). This is the CAPA workspace — description → root cause → corrective task → verification → evidence, plus the relationship panel and cross-cycle history.
- **Creation modal ← reuse the cycle-audit `finding-editor`.** Do **not** build a new create form. Reuse/extend the existing, proven `components/features/compliance-audit/finding-editor/finding-editor.tsx` (already used for raising findings inside a cycle — its field set, validation, severity/anchor pickers) as the "Ny avvikelse" raise experience, adding the `source` picker and optional link pickers. Whether it opens as the item modal in create-mode or a dedicated lighter create modal is the SM/UX call at 23.4 draft — but the *form logic is inherited from the cycle-audit editor*, so raising an avvikelse from the register and from inside a cycle are the same code path. Zero-link raise in seconds stays the acceptance bar (brief §4).
- **Linkable (as discussed).** Both senses: (1) **typed edges** — cycle / kravpunkt / styrdokument / recurrence, editable from the modal's relationship panel (Phase 2 adds `ComplianceFindingDocumentLink`); (2) **deep-linkable** — every finding addressable via `?avvikelse=<id>` so it's shareable without a dedicated `[findingId]` route, exactly like a law-list item.

**Open decisions (brief §10, resolve at each phase's story-draft time):** ~~source taxonomy breadth~~ (RESOLVED 2026-07-23: full 8-value set) · 5-state CAPA vs bolt-on verification · reporter role · link-relation typing depth.

---

<details>
<summary><strong>Original decomposition (pre-brief, partially superseded — retained for implementation detail)</strong></summary>

### Story 23.1 — Findings schema + server-action layer for ad-hoc

**Scope:** Schema migration + Zod schemas + server actions. **No UI changes.**

- Make `ComplianceFinding.cycle_id` nullable
- Add `workspace_id String` (denormalised, required, indexed) — backfill from `cycle.workspace_id` for existing rows
- Add `created_by_user_id String` (required) — backfill from `cycle.created_by_user_id` for existing rows
- Add `assignee_id String?` (nullable, indexed) — null backfill
- Add CHECK constraint: `cycle_id IS NOT NULL OR law_list_item_id IS NOT NULL OR requirement_id IS NOT NULL` (every finding must have at least one anchor or a cycle context)
- Extend `Comment` model: add `finding_id String?`, `finding ComplianceFinding?` relation, `@@index([finding_id])`
- Update `Comment` polymorphic parent rule to include `finding_id` (one of `task_id | law_list_item_id | finding_id` must be set)
- `app/actions/compliance-finding.ts`:
  - Loosen `createFinding` so `cycleId` is optional; require workspace + at least one anchor
  - New `listFindingsForWorkspace(filters)` returning rows shaped for the registry table
  - New `getFindingById(findingId)` returning the full hydrated row (anchor, comments count, linked tasks, latest activity)
  - New `assignFinding(findingId, userId | null)`
  - New `addFindingComment(findingId, content, mentions, parentId?)` — wraps existing comment creation pattern
- Activity log: extend `lib/activity/action-constants.ts` with `finding_created_ad_hoc`, `finding_assigned`, `finding_unassigned`, `finding_anchor_changed`, `finding_commented`. Update `categories.ts` and `format-activity.ts` label maps.
- Permissions: confirm `tasks:edit` is the gate for finding mutations OR add `findings:create` and `findings:assign` scopes (see open decision).
- Tests: schema migration applies cleanly on a snapshot of production data; `listFindingsForWorkspace` filter shapes; CHECK constraint rejects orphan findings; comment polymorphism enforced.

**Estimate:** 1.5–2 dev-days

**Risk:** Migration on production data with existing cycle-scoped findings — workspace_id + created_by_user_id backfills must be deterministic. Mitigation: dry-run the migration against a Supabase branch before merging.

---

### Story 23.2 — Shared FindingModal on SplitPanelModal shell + cycle-tab refactor

**Scope:** Build the shared modal; migrate the cycle-detail Findings tab to use it. **No new surfaces yet.** This is the "prove the shell" story.

- New component `components/features/compliance-audit/finding-modal/` with files mirroring `task-modal/`'s structure (`index.tsx`, `modal-header.tsx`, `left-panel.tsx`, `right-panel.tsx`, `activity-tabs.tsx`, `details-box.tsx`, `linked-artifacts-box.tsx`, `quick-links-box.tsx`)
- Built on `<SplitPanelModal>`. Header: breadcrumb (workspace › Anmärkningar › ANM-xxx) + type/severity pills + ⋯ menu + close
- Left panel: contenteditable title → status pill row → Beskrivning / Grundorsak / Föreslagen åtgärd (rich-text editors) → activity feed
- Activity feed: Alla / Kommentarer / Historik tabs with composer; reuses `<ThreadedComments>` from `task-modal/`. Comments via `addFindingComment` from 23.1.
- Right rail boxes: Status & åtgärd (Markera åtgärdad / Skapa åtgärdsuppgift / Avskriv) → Detaljer (type, severity, källa, ansvarig, förfaller, skapad) → Länkade objekt (kravpunkt, åtgärdsuppgift, bevis — reuse `<LinkedArtifactsPanel>`) → Snabblänkar
- URL-param wiring: `?finding=ANM-xxx` opens modal anywhere it's mounted
- SWR key convention: `finding:${findingId}` — invalidated by all server actions in 23.1
- **Refactor `cycle-findings-tab.tsx`**: row click opens `<FindingModal>` instead of inline `FindingCard` expansion. The `<FindingCard>` row visual stays (still shows as expandable list), but the editing surface moves to the modal. `<FindingEditor>` is deleted / absorbed.
- Mount the modal at the cycle-detail page level (sibling of `<Tabs>`), driven by URL param.
- Visual + behavioural smoke: every action available in the old `FindingEditor` works identically in the new modal.

**Estimate:** 3.5–4 dev-days

**Risk:** Activity feed on findings is genuinely new code (not in production today); threaded comments need careful SWR cache strategy to avoid double-renders. Mitigation: copy the cache-key shape from `task-modal/threaded-comments.tsx` verbatim where possible.

---

### Story 23.3 — `/anmärkningar` registry page

**Scope:** New top-level workspace route + nav entry + filters. Depends on 23.1 (server actions) and 23.2 (modal).

- Route: `app/(workspace)/anmarkningar/page.tsx`
- Top component `components/features/findings-registry/findings-workspace.tsx` mirroring `task-workspace/index.tsx` architecture
- `<PageHeader>`: title "Anmärkningar" + subtitle + "+ Ny anmärkning" primary action (opens `<FindingModal>` in create-mode, no anchor prefill — user picks one in the modal's anchor selector)
- `<TableToolbar>` two-row mode: tab strip (Alla / Öppna / Tilldelade mig / Återkommande / Stängda) + search + filter chips (type / source / status / assignee / anchor)
- shadcn `<Table>` via TanStack: columns = Anmärkning (title + type/severity pills + meta line) / Status / Lag-kravpunkt / Ansvarig / Källa / Förfaller / chevron. Virtualised at >50 rows.
- URL state via the existing pattern (`task-filter-params.ts` as reference) — filters round-trip
- Empty state via `<EmptyState>` primitive (Epic 22)
- "Återkommande" filter: same anchor (`law_list_item_id` OR `requirement_id`) appears on ≥2 closed findings AND has at least 1 open finding (see open decision)
- Sidebar nav entry: add to `components/layout/left-sidebar.tsx` and `mobile-sidebar.tsx` under Efterlevnad section, with red-pip count from `getOpenFindingsCount()`
- Pagination footer (TanStack-controlled)
- Bulk-select column with bulk close / bulk assign — defer to 23.6 if scope balloons

**Estimate:** 3 dev-days

**Risk:** "Återkommande" detection logic is judgemental. Mitigation: ship with a deliberately simple definition v1 (≥2 findings on same anchor in past 12 months); document the definition in a comment so the next iteration can refine without spelunking.

---

### Story 23.4 — Ad-hoc creation entry points

**Scope:** Wire up the two non-registry creation paths. Depends on 23.2 (modal exists) and 23.3 (registry exists for "Visa i registret" links).

- Law-list-item modal: existing "Skapa anmärkning" button (currently opens `FindingEditor` with anchor prefill) rewired to open `<FindingModal>` in create-mode with `lawListItemId` prefilled. Anmärkningar section in the modal's left panel updates to use the new modal for editing existing findings too.
- Saknar-bevis pill on cycle-item modal: same — opens `<FindingModal>` create-mode with `lawListItemId` + `requirementId` prefilled (this morphing-pill UX already shipped per Epic 21 memory).
- Add "Skapa anmärkning" affordance on `/krav` row hover (optional — see decision).
- Permissions enforcement at server-action level (already in 23.1) — UI gating disables buttons for users without the scope.

**Estimate:** 1.5 dev-days

**Risk:** Two small. (a) The existing morphing-pill width-sentinel logic must continue to work after the modal swap. (b) The law-list-item modal's anmärkningar section currently has its own SWR cache; needs to invalidate `finding:${id}` keys when mutations happen elsewhere.

---

### Story 23.5 — Cross-cycle visibility + carried-over findings

**Scope:** The audit-discipline payoff. Depends on 23.1, 23.2, 23.3.

- Cycle-detail Findings tab: new toggle "Visa öppna från tidigare kontroller" — when on, includes findings where `closed_at IS NULL` AND (`cycle_id != currentCycleId` OR `cycle_id IS NULL`) AND anchor ∈ current cycle's scoped `LawListItem`s. Visually marked with a "Från Q3 2025" / "Löpande" badge.
- Cycle creation wizard step 4 (after scope selection): "Kända anmärkningar vid start" — surfaces existing open findings whose anchors fall in the chosen scope. Read-only list; auditor can't dismiss but can use it as audit-prep input.
- Revisionsrapport renderer (`lib/compliance-audit/revisionsrapport-renderer.ts`) — appendix section: "Anmärkningar öppna vid kontrollens start" (carried-over) and "Anmärkningar identifierade under kontrollen" (cycle-scoped). Closed sealed-cycle PDFs are **not** retroactively re-rendered (point-in-time snapshot — see open decision).
- "Ej kopplad till specifik kontroll" filter chip on registry to find purely ad-hoc findings.

**Estimate:** 2 dev-days

**Risk:** Revisionsrapport renderer change touches sealed-cycle output shape — needs explicit "this only affects future cycles" guard. Mitigation: gate on `cycle.created_at >= migration_date` so historical PDFs remain bit-identical.

</details>

---

## Dependency graph

```
Story 23.1 (Schema + actions)
       │
       ▼
Story 23.2 (FindingModal + cycle-tab refactor)
       │
       ├──► Story 23.3 (Registry page) ──┐
       │                                 │
       └──► Story 23.4 (Ad-hoc surfaces)─┤
                                         ▼
                              Story 23.5 (Cross-cycle visibility)
```

- **23.1 must land first.** UI work is blocked on the server-action loosening.
- **23.2 ships as a refactor first** — cycle-tab migrates to the new modal with zero behaviour change. This proves the shell before new surfaces consume it.
- **23.3 and 23.4 can parallelise** after 23.2 (different files, different reviewers).
- **23.5 lands last** — purely additive; depends on registry existing for cross-linking.

**MVP cut: 23.1 → 23.4** (~9–10 dev-days). Ships ad-hoc findings + registry + unified modal.

**Differentiator: 23.5** (~2 dev-days). Audit-discipline payoff — makes findings genuinely first-class.

---

## Compatibility Requirements

- [x] Existing cycle-scoped read paths (`cycle.findings`, revisionsrapport rendering, activity log) remain unchanged
- [x] Database schema changes are backward compatible (nullable column, additive constraints, denormalised mirror with backfill)
- [x] UI changes follow existing patterns (`<PageHeader>`, `<TableToolbar>`, `<SplitPanelModal>`, `<LinkedArtifactsPanel>`, polymorphic `<Comment>`, activity-log conventions)
- [x] Performance impact minimal — `listFindingsForWorkspace` indexed on `(workspace_id, closed_at, type)`; registry page virtualised at >50 rows
- [x] Sealed-cycle PDFs unaffected (point-in-time guard in 23.5 renderer)

## Risk Mitigation

- **Primary Risk:** Schema migration on production data with existing cycle-scoped findings — workspace_id + created_by backfills must be deterministic and not lose audit attribution.
  - **Mitigation:** Dry-run the migration on a Supabase branch with a snapshot of production data. Backfill via SQL (not application code) so it's atomic with the column add. Backfill `created_by_user_id` from `cycle.created_by_user_id` (the lead auditor — historically accurate as the "filer of record" for cycle-scoped findings before ad-hoc existed). Document the backfill rationale in the migration file.
- **Secondary Risk:** SWR cache key collisions between cycle-scoped and registry views of the same finding — mutations in one surface must invalidate the other.
  - **Mitigation:** Single canonical SWR key per finding (`finding:${findingId}`); list views derive from a separate keyed endpoint that's invalidated on any finding mutation. Mirrors the `linked-artifacts:${listItemId}` pattern from Epic 17.
- **Tertiary Risk:** Activity feed on findings introduces a new `<Comment>` polymorphic branch — easy to introduce mention-notification regressions.
  - **Mitigation:** Reuse the existing `task-modal/threaded-comments.tsx` cache shape verbatim where possible; add a focused integration test for `addFindingComment` mention-notifications.

**Rollback Plan:**
- Stories 23.2–23.5 are individually revertable without schema rollback (UI components only).
- Story 23.1 schema migration is reversible: drop the new columns and the CHECK constraint; existing rows lose nothing because cycle-scoped findings retain `cycle_id`. The `Comment.finding_id` extension is also additive (drop the column to revert).
- A feature flag (`FINDINGS_REGISTRY_ENABLED` workspace-level, default off) is **not** required — the schema change is forward-only and the new route is invisible until linked from sidebar; if 23.3 misbehaves, removing the sidebar link disables discovery.

## Definition of Done

- [ ] All 5 stories completed with acceptance criteria met
- [ ] Existing cycle-scoped finding flows verified through manual smoke (create, edit, close, reopen, spawn task) on the migrated cycle-detail Findings tab
- [ ] `/anmärkningar` registry renders correctly with ≥1 ad-hoc finding, ≥1 cycle-scoped finding, and ≥1 carried-over finding
- [ ] Same finding opens identical UI from registry, cycle-detail tab, and law-list-item modal
- [ ] Comment + activity feed work end-to-end on an ad-hoc finding
- [ ] All five new server actions emit `ActivityLog` entries verifiable on `/workspace/activity`
- [ ] No regression in revisionsrapport rendering for cycles created before the migration date
- [ ] Sidebar nav entry visible on desktop + mobile
- [ ] Documentation: `MEMORY.md` updated with the registry SWR pattern + the schema change; `docs/architecture/epic-21-lagefterlevnadskontroll.md` cross-linked for the cycle-decoupling note
- [ ] Epic registry (`docs/prd/epic-list.md`) entry added/updated to reflect actual delivery

## Pinned decisions (PO 2026-05-05)

All five accepted as recommended, no overrides. Story drafts proceed on these contracts.

1. **`source` field — DERIVED from `cycle_id IS NULL`.** No redundant column. UI label "Källa" reads `cycle.name` when set, else `'Löpande'`. If a third source ever appears (imported / AI-suggested), promote to explicit enum then. *Implication for 23.1:* no `source` column in the migration.
2. **Comments-on-findings — EXTEND POLYMORPHIC `Comment`.** Add `finding_id` + relation + index. Reuses threaded-comments UI, mention-notification pipeline, and existing workspace scoping. *Implication for 23.1:* `Comment` model gets one new field, one new relation, one new index in the migration.
3. **Permissions — REUSE `tasks:edit` for v1.** No new `findings:create` / `findings:assign` scope. Read paths keep the existing OR-gate `activity:view || tasks:edit` so AUDITOR continues to read findings. *Implication for 23.1:* server actions keep the Story 21.7 permission shape verbatim.
4. **"Återkommande" filter v1 — ≥2 findings on same anchor in past 12 months AND ≥1 currently open.** Anchor match = same `law_list_item_id` OR same `requirement_id`. Document the definition as an inline comment on the filter implementation. *Implication for 23.1:* not in scope (filter belongs to Story 23.3); 23.1 just needs the data shape to support the future query (anchor columns + `closed_at` + `created_at` already cover it).
5. **Sealed-cycle PDF retroactivity — NO.** PDFs are point-in-time snapshots. Renderer (Story 23.5) gates on `cycle.created_at >= migration_date`; cycles closed before Epic 23 lands keep their existing rapport content. *Implication for 23.1:* none directly; pinned here so 23.5 doesn't re-litigate.

---

**Story Manager Handoff:**

"Please develop detailed user stories for Epic 23 — Anmärkningar som förstklassiga objekt. Key considerations:

- This is a brownfield enhancement to an existing Next.js 14 / React 18 / TypeScript / Tailwind / shadcn-ui / Prisma 5 codebase
- Integration points: `prisma/schema.prisma` (`ComplianceFinding`, `Comment`), `app/actions/compliance-finding.ts`, `lib/activity/action-constants.ts`, `lib/auth/permissions.ts`, all `components/features/compliance-audit/*` finding code, `components/features/document-list/legal-document-modal/`, `components/layout/left-sidebar.tsx`, `components/shared/split-panel-modal.tsx` (consumer only — shell unchanged)
- Existing patterns to follow: `TaskModal`'s split-panel layout for the new `<FindingModal>` (`components/features/tasks/task-modal/index.tsx`), `task-workspace/index.tsx` for `/anmärkningar` page architecture, `linked-artifacts:${listItemId}` SWR pattern for cache strategy, `task-filter-params.ts` for URL state
- Critical compatibility requirements: zero behaviour change to cycle-scoped flows; revisionsrapport rendering bit-identical for sealed pre-migration cycles; existing `Comment` polymorphism extends additively
- Each story must include verification of cycle-scoped flows (manual smoke + the existing cycle-findings tests) and a rollback note
- Source artefacts: `_prototypes/anmarkningar-page-and-modal.html` (visual reference for page + modal), `docs/lagefterlevnadskontroll-brief.md` Q294/Q295 (problem statement basis)
- Resolve the five Open Decisions above before drafting Story 23.1

The epic should deliver a continuously-tracked compliance-signal register while preserving the audit-discipline integrity of cycle-scoped findings."

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| (pre-2026-07-23) | v1 | Original epic — findings first-class via `SplitPanelModal` FindingModal + `/anmärkningar` registry, 5 stories. Basis: `lagefterlevnadskontroll-brief.md` Q294/Q295. | PM |
| 2026-07-23 | v2 | **Re-scoped** to absorb `avvikelser-standalone-and-iso-audit-cycles-brief.md` (now authoritative design source). Finding-as-hub (adds `source`, styrdokument/cross-cycle/recurrence edges); register mirrors Laglistor (DataTable+modal) at `/avvikelser` with flat top-level nav; adds ISO cycle upgrades + agent read tools (`list_findings`, `get_finding` edges). 5 stories → 3-phase ~8-story program. Original decomposition retained under a collapsed section, partially superseded. Per `sprint-change-proposal-avvikelser-capa-2026-07-23.md`. | Sarah (PO) |
