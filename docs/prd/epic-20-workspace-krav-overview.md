# Epic 20: Workspace Krav Overview & Per-Krav Assignment — Brownfield Enhancement

**Goal:** Surface every kravpunkt across the workspace in a single, filterable table so compliance managers and responsible owners can triage gaps, missing bevis, and personal assignments without drilling into 40+ law item modals — and let individual kravpunkter carry their own assignee when responsibility needs to be delegated below the law-item level.

**Value Delivered:** Turns krav from modal-only detail rows into a first-class operational surface. Closes two concrete jobs-to-be-done that are painful today: (1) audit/gap triage across the whole workspace, and (2) per-user daily task work where a specific kravpunkt is delegated away from the law's main ansvarig.

**Delivers:**
- Optional per-krav `responsible_user_id` with automatic inheritance from the parent `LawListItem` when unset
- Assignee picker in the existing kravpunkter checklist (legal document modal)
- New server action `getWorkspaceRequirements` returning krav rows joined with parent law + laglista + effective assignee + evidence count
- New route `/krav` inside the `(workspace)` group with filter chips (Alla / Luckor / Mina krav / Saknar bevis), free-text search, sortable columns, row → modal deep-link
- New sidebar entry "Krav" nested under the existing **Efterlevnad** accordion

**Requirements covered:** Extends FR of Epic 6 (Compliance Workspace) — specifically deeper gap visibility — and lays groundwork for export/reporting (deferred to future epic).

**Estimated stories:** 3

**Dependencies:**
- **Epic 6** (Compliance Workspace Kanban) — Done: provides `LawListItem` responsible assignment, kravpunkter model, `LegalDocumentModal`, `KravpunkterChecklist`.
- **Epic 17** (Document Management System) — Partial: provides `RequirementEvidenceLink` which the "Saknar bevis" filter relies on.

**Priority:** Medium-High — highest single-feature unlock for users with ≥10 laglistor preparing for external audits. Unblocks "audit export" follow-ups.

---

## Epic Goal

Give workspace users a cross-laglista view of every kravpunkt with meaningful filters, and let kravpunkter carry their own assignee when the default (inherited from the law item's ansvarig) is too coarse for how work is actually delegated. The outcome: compliance managers can answer "where are our gaps?" and individual owners can answer "what's on me this week?" without opening any law item modal.

## Epic Description

### Existing System Context

- **Current relevant functionality:**
  - Kravpunkter (`LawListItemRequirement`) are modelled as children of `LawListItem`, rendered only inside `components/features/document-list/legal-document-modal/kravpunkter-checklist.tsx` and inline in `compliance-detail-table.tsx` expanded rows.
  - Law items carry a `responsible_user_id`; kravpunkter do not — they implicitly share whoever is ansvarig for the parent law.
  - No workspace-level listing, filter, or aggregate query over kravpunkter exists.
- **Technology stack (this area):** Next.js 14 App Router (`app/(workspace)/...`), Prisma, SWR, TanStack Table v8, `@tanstack/react-virtual`, Radix UI, `@dnd-kit/*`, hard-coded Swedish copy, `withWorkspace(fn, perm)` action wrapper for auth/tenant scoping, cookie-resolved active workspace (`ACTIVE_WORKSPACE_COOKIE`).
- **Integration points:**
  - `prisma/schema.prisma` → `LawListItemRequirement` model (lines 357–376): add one nullable FK column.
  - `app/actions/law-list-item-requirements.ts` → extend existing CRUD to read/write the new FK.
  - `components/features/document-list/legal-document-modal/kravpunkter-checklist.tsx` → add per-row assignee picker.
  - `components/features/document-list/table-cell-editors/assignee-editor.tsx` → reuse as-is (avatar + Radix Select, members passed as prop).
  - `components/features/document-list/document-list-table.tsx` → reference implementation for column definitions, virtualization, sortable headers, inline editors.
  - `components/features/document-list/filter-bar.tsx` → reference implementation for URL-param-persisted filter chips + "Rensa (N)" clear-all.
  - `components/layout/left-sidebar.tsx` → add `{ title: 'Krav', href: '/krav' }` as a `subItem` under the **Efterlevnad** accordion (next to "Mina listor", "Ändringar", "Mallar").

### Enhancement Details

- **What's being added/changed:**
  1. Optional per-krav assignee (schema + modal UI).
  2. Workspace-scoped krav aggregation API with four filter presets.
  3. New `/krav` route rendering a TanStack table that reuses the document-list-table design language.
- **How it integrates:**
  - Schema change is **purely additive** — `responsible_user_id String?` nullable FK. Null means "inherit from parent law item" and is resolved at read time. Existing records and existing code paths continue working unchanged.
  - Reuses existing `AssigneeEditor` component; no new picker component needed.
  - Reuses existing table patterns (ColumnDef, sortable header, virtualization thresholds) — the new table is composed from the same primitives, not a parallel implementation.
  - Reuses existing filter-bar pattern (URL query params, "Rensa (N)" button) — filter state lives in the URL, shareable/bookmarkable.
  - Row click on the new table opens the existing `LegalDocumentModal` pointed at the parent law item. All krav editing (text, fulfilled, evidence linking, reorder) continues to happen in the modal — the new table adds inline assignee + fulfilled toggle only.
- **Success criteria (measurable):**
  - A user can reach "all unfulfilled krav across all my laglistor" in **one click** from anywhere in the workspace.
  - "Mina krav" returns exactly the kravpunkter where `effective_assignee = current_user_id` (direct assignment OR inherited from parent law item).
  - Changing a krav's assignee in the new table or in the modal persists and is reflected in the opposite surface within one SWR revalidation.
  - Page loads with ≤500 krav render in under 500ms on a baseline workspace (virtualization kicks in above the existing 100-row threshold).
  - Zero regressions in existing kravpunkter CRUD inside the legal document modal.

---

## Stories

### Story 20.1 — Per-krav assignee model & modal picker

**Scope:** Schema change + server-action extension + modal UI.

- Add nullable `responsible_user_id String?` FK (→ `User`) to `LawListItemRequirement`; Prisma migration; add relation + index.
- Extend `createRequirement`, `updateRequirement`, `getRequirementsForListItem` in `app/actions/law-list-item-requirements.ts` to read/write assignee.
- Add an `effective_assignee` resolver (inline helper or Prisma include + post-process): `krav.responsible_user_id ?? list_item.responsible_user_id`.
- Add an inline `<AssigneeEditor />` to each row of `kravpunkter-checklist.tsx`, pre-populated with the effective assignee and visually marked when inherited vs. overridden (e.g., dimmed avatar + tooltip "Ärvd från lagansvarig" when inherited).
- Audit-trail write on assignee change (follow existing `ChangeLog` pattern used by other krav fields).

**Done when:** A user can change the ansvarig on a single kravpunkt inside the legal document modal and see the change persist; unchanged kravpunkter continue to show the inherited (parent law item) assignee; existing CRUD tests on krav still pass.

### Story 20.2 — Workspace krav aggregation server action

**Scope:** Pure backend — the data layer for Story 20.3.

- New server action `getWorkspaceRequirements({ filter, search, sort, page })` in `app/actions/law-list-item-requirements.ts` (or a new `workspace-requirements.ts` sibling).
- Wraps with `withWorkspace(fn, perm)` — workspace scoped via cookie, no slug.
- `filter` enum: `'all' | 'gaps' | 'mine' | 'needs_evidence'`.
  - `all` — every krav in workspace
  - `gaps` — `is_fulfilled = false`
  - `mine` — `effective_assignee = current_user_id`
  - `needs_evidence` — `bevis_required = true AND evidence_count = 0`
- Returns rows shaped for the table: `{ krav_id, text, is_fulfilled, bevis_required, effective_assignee_id, effective_assignee_is_inherited, evidence_count, law_item_id, law_name, laglista_id, laglista_name, updated_at }`.
- Keyset or offset pagination (match existing document-list convention).
- Unit test: filter correctness (esp. `needs_evidence` join on `RequirementEvidenceLink`).

**Done when:** The action returns correctly filtered/paginated krav for each preset on a seeded workspace; unauthorized workspaces return empty/forbidden consistent with other `withWorkspace` actions.

### Story 20.3 — `/krav` route + table UI

**Scope:** Frontend — new page, reuses existing primitives.

- New route `app/(workspace)/krav/page.tsx` + page-content client component.
- Sidebar entry: add `{ title: 'Krav', href: '/krav' }` as a `subItem` under the existing **Efterlevnad** accordion in `components/layout/left-sidebar.tsx` (Lucide icon: `ListChecks` or similar).
- Table built from TanStack + virtualization primitives, mirroring `document-list-table.tsx` column-def conventions. Columns:
  1. Checkbox/status (inline toggle for `is_fulfilled`)
  2. Kravpunkt text (truncate with tooltip)
  3. Lag (name, clickable → opens `LegalDocumentModal` at the parent law item, scrolled to the krav)
  4. Laglista (name)
  5. Ansvarig (reuse `<AssigneeEditor />`, inline-editable, inherited-style when not overridden)
  6. Bevis (icon badge: required vs. linked count)
  7. Uppdaterad (relative date)
- Filter chips: **Alla**, **Luckor** (default), **Mina krav**, **Saknar bevis**. Mirror `filter-bar.tsx` pattern with URL query params + "Rensa (N)" when any non-default chip + search term is active.
- Free-text search on krav text (debounced 300ms, URL-param persisted).
- Empty state: Swedish copy + CTA to open Mina listor.
- Loading skeleton + error boundary matching existing pages.
- Row-click opens existing modal; no duplicate editing surfaces.

**Done when:** Navigating to `/krav` renders the table with the Luckor preset active; switching filters updates the URL; changing assignee or fulfilled state inline persists and the modal reflects the change after revalidation; keyboard and screen-reader behaviour matches the existing document-list table.

---

## Compatibility Requirements

- [x] **Existing APIs remain unchanged.** `createRequirement`, `updateRequirement`, `deleteRequirement`, `reorderRequirements`, `linkEvidenceToRequirement`, `unlinkEvidenceFromRequirement`, `getRequirementsForListItem` keep their current signatures. `responsible_user_id` is an optional add — existing callers that omit it continue to work (null → inherit).
- [x] **Database schema changes are backward compatible.** Additive only: one nullable FK column + one index. No renames, no drops, no not-null constraints on existing rows.
- [x] **UI changes follow existing patterns.** New table composed from the same TanStack / virtualization / `ColumnDef` / `AssigneeEditor` / filter-bar primitives used by the document list. New sidebar entry uses the existing `NavItem` shape under the existing Efterlevnad accordion — no new top-level nav concept.
- [x] **Performance impact is minimal.** New aggregation query is workspace-scoped and paginated; table virtualizes above 100 rows (existing threshold). Modal rendering is unaffected — the new assignee picker is one additional Radix Select per krav row (same as the law-item row already has).

## Risk Mitigation

- **Primary Risk:** `effective_assignee` resolution being inconsistent between the new table and the legal document modal (e.g., modal computes from `list_item.responsible_user_id` while the table's aggregation action computes differently), leading to users seeing different "ansvarig" values on the same krav in different surfaces.
- **Mitigation:** Put the resolution in a single helper (`resolveEffectiveAssignee(krav, listItem)`) exported from the server actions module and used by **both** `getRequirementsForListItem` (modal) and `getWorkspaceRequirements` (table). Cover with a unit test asserting that for a krav with direct assignee A and parent-law assignee B, both surfaces return A; for a krav with null assignee and parent B, both return B with `is_inherited = true`.
- **Secondary Risk:** The new filter preset "Mina krav" depends on effective-assignee logic; bug could cause a user to see krav that aren't theirs or miss krav that are. **Mitigation:** Same shared resolver + explicit test of the `mine` filter against a seeded fixture with both direct-assigned and inherited cases.
- **Rollback Plan:**
  - Story 20.3 is purely additive (new route, new sidebar subitem) — revert the commit; no users depend on `/krav` yet.
  - Story 20.2 is a new action with no existing callers — revert the commit.
  - Story 20.1 schema change is a nullable column. Rollback path: ship a follow-up migration dropping the column + the relation. Safe because null means "inherited", so no data loss for users who never set an override; users who did set overrides lose only the override (falls back to inherited) — document this in the rollback runbook.

## Definition of Done

- [ ] All three stories completed with their acceptance criteria met.
- [ ] `resolveEffectiveAssignee` helper is the single source of truth; unit-tested.
- [ ] Existing kravpunkter CRUD (create, update text, toggle fulfilled, toggle bevis_required, add comment, reorder, link/unlink evidence, delete) verified to work unchanged in the legal document modal.
- [ ] `/krav` route is linked from the sidebar under Efterlevnad and renders on empty, small, and virtualized (>100 krav) workspaces.
- [ ] Filter presets (Alla / Luckor / Mina krav / Saknar bevis) return correct results against a seeded workspace.
- [ ] Assignee changes made in the modal reflect in the table after SWR revalidation, and vice versa.
- [ ] No regressions in `document-list-table`, `compliance-detail-table`, or the legal document modal (smoke-tested).
- [ ] Swedish copy reviewed; follows existing terminology (`Ansvarig`, `Kravpunkt`, `Laglista`, `Saknar bevis`, `Ärvd från lagansvarig`).
- [ ] Prisma migration reviewed and applied to dev; included in the repo.

---

## Out of Scope (candidates for follow-up epic)

- CSV / Excel / PDF export of filtered krav for audit binders.
- Bulk inline edits (bulk-toggle fulfilled, bulk-reassign) — the infra exists in `bulk-action-bar.tsx` but deliberately deferred until real usage signals demand.
- Grouping the new table by laglista or by ansvarig (accordion view) — mirrors `grouped-document-list-table.tsx` but not required for v1.
- Per-krav due dates and priority — would extend the schema further; not part of the JTBDs we validated.
- Change-indicator badges on the new table (the orange "pending changes" pill from `change-indicator.tsx`).

## Story Manager Handoff

Please develop detailed user stories for this brownfield epic. Key considerations:

- **Stack:** Next.js 14 App Router, Prisma, TanStack Table v8 + `@tanstack/react-virtual`, Radix UI, SWR, hard-coded Swedish copy, cookie-resolved workspace scoping via `withWorkspace(fn, perm)`.
- **Integration points (do not re-architect):**
  - `prisma/schema.prisma` → `LawListItemRequirement`
  - `app/actions/law-list-item-requirements.ts` (or a sibling `workspace-requirements.ts` for the new aggregation action)
  - `components/features/document-list/legal-document-modal/kravpunkter-checklist.tsx`
  - `components/features/document-list/table-cell-editors/assignee-editor.tsx` (reuse unchanged)
  - `components/features/document-list/document-list-table.tsx` (reference only — mirror the column-def & virtualization conventions)
  - `components/features/document-list/filter-bar.tsx` (reference only — mirror URL-param filter persistence)
  - `components/layout/left-sidebar.tsx` → add `Krav` subitem under the **Efterlevnad** accordion
  - `app/(workspace)/krav/page.tsx` (new)
- **Existing patterns to follow:**
  - Column definitions in `document-list-table.tsx` — declarative `ColumnDef<T>[]` with inline cell editors.
  - Virtualization auto-threshold at 100 rows.
  - Filter state persisted in URL query params; generic "Rensa (N)" clear-all.
  - Cell-editor error boundaries (`CellErrorBoundary`).
  - Assignee inline edit via `<AssigneeEditor members={...} value={...} onChange={...} />` with workspace members fetched once by the parent page.
  - `withWorkspace(fn, perm)` wrapping all server actions.
- **Critical compatibility requirements:**
  - Additive schema only (nullable FK).
  - No signature changes to existing krav CRUD server actions.
  - `effective_assignee` resolution centralised in ONE helper used by both the modal and the new table — non-negotiable.
  - New route must not introduce a parallel sidebar nav concept — it nests under **Efterlevnad**.
- **Each story must include:** a verification step asserting that existing kravpunkter CRUD in the legal document modal still works after the change.

The epic should maintain system integrity while delivering the goal: a cross-laglista krav overview with filter presets and per-krav assignment, composed from existing design primitives rather than new ones.
