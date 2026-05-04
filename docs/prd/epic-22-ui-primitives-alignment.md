# Epic 22: UI Primitives Alignment — Brownfield Enhancement

**Goal:** Eliminate cross-surface drift in the workspace's six tabular surfaces by consolidating four primitives — Badge, FilterChip, PageHeader/TableToolbar, and the table primitive itself — so that the same domain value (priority, status, severity, finding type) renders identically everywhere and new features cannot reintroduce variants.

**Value Delivered:** Today the same priority enum renders as `Hög` in rose on Mina laglistor and `Hög` in orange on Uppgifter; "Medium" priority renders blue, which collides visually with "in progress" status. Three different filter-chip patterns are in use, all marked `role="tab"`. Page headers have no shared slot order. This epic resolves those inconsistencies in a way that *prevents recurrence* — each primitive becomes the single mandated import path for its concern.

**Delivers:**
- Extended `components/ui/badge.tsx` with semantic `tone` (`neutral` / `info` / `success` / `warning` / `danger`) × `variant` (`soft` / `solid` / `outline`) matrix, backed by a single token map at `lib/ui/badge-tones.ts`
- Aligned priority enum: `Hög` / `Medel` / `Låg` rendered with `tone="danger" | "warning" | "neutral"` (rose / amber / slate ramp), single `PriorityEditor` shared by Laglistor and Uppgifter
- New `components/ui/filter-chip.tsx` with `pressed` / `count` / `icon` props and `aria-pressed` semantics; replaces the two hand-rolled chip implementations in `cycle-list-table.tsx` and `cycle-findings-tab.tsx`
- New `components/ui/page-header.tsx` and `components/ui/table-toolbar.tsx` with named slots (`breadcrumbs`, `title`, `badge`, `meta`, `stats`, `primaryAction`, `views`, `search`, `filters`, `rightSlot`); migration of all six surfaces to use them
- Migration of `cycle-items-tab.tsx` and `document-table.tsx` (Styrdokument) from custom div-grids to the shadcn `<Table>` primitive — unlocks uniform sort, selection, virtualization, and accessibility

**Requirements covered:** Cross-cutting UX consistency. Not tied to a specific FR; reduces tech debt accumulated across Epic 6 (Compliance Workspace), Epic 17 (Document Management), and Epic 21 (Lagefterlevnadskontroll).

**Estimated stories:** 4

**Dependencies:**
- **Epic 6** (Compliance Workspace) — Done: source of `compliance-detail-table.tsx`, `PriorityEditor`, `ComplianceStatusEditor`.
- **Epic 17** (Document Management) — Done: source of `document-table.tsx`, `DocumentStatusBadge` (currently the only consumer of shadcn `Badge` in this domain).
- **Epic 21** (Lagefterlevnadskontroll) — Active: source of `cycle-list-table.tsx`, `cycle-items-tab.tsx`, `cycle-findings-tab.tsx`, `cycle-status-badge.tsx`. **Coordination required:** if 21.x stories ship new chip/badge code while this epic is in flight, they should target the new primitives (or be flagged for migration in a follow-up).

**Priority:** Medium — no new user-facing features, but the cumulative friction (priority colour collisions, screen-reader confusion on chip-tabs, inconsistent action button placement) is a concrete reason new design work re-litigates the same questions in PR review. Compounds in value as the workspace gains more surfaces.

**Source artefacts:**
- `docs/ui-consistency-audit-2026-04-23.md` — full live-DOM inspection with class strings per surface
- `_prototypes/ui-alignment-prototype.html` — visual prototype of each primitive's "after" state, including the `tone × variant` matrix and JSX API stubs

---

## Epic Goal

Replace four different ad-hoc patterns (pills, filter chips, page headers, tables) with four shared primitives, then migrate every existing call site so the workspace renders consistently across surfaces and new features compose from a single set of building blocks.

## Epic Description

### Existing System Context

- **Current relevant functionality:** Six tabular surfaces — Mina laglistor (`/laglistor`), Kontroller list (`/laglistor/kontroller`), Cycle detail Items (`/laglistor/kontroller/[cycleId]#items`), Cycle detail Findings (`#findings`), Uppgifter Lista (`/tasks?tab=lista`), Styrdokument (`/workspace/styrdokument`) — each independently render status pills, priority pills, filter chips, page headers and toolbars. Shared primitives exist (`components/ui/badge.tsx`, `components/ui/table.tsx`, `components/ui/tabs.tsx`) but adoption is uneven: only Styrdokument and Findings use the shared `Badge`; only 4 of 6 surfaces use the shared `Table`; no shared `PageHeader` or `FilterChip` exists at all today.
- **Technology stack (this area):** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, shadcn/ui (Radix primitives), `lucide-react` icons. Hard-coded Swedish UI copy. Dark theme via Tailwind tokens (`bg-background`, `text-foreground`, etc.).
- **Integration points:**
  - `components/ui/badge.tsx` (lines 1–30) — extend `cva` config; add `tone` axis
  - `components/features/document-list/table-cell-editors/compliance-status-editor.tsx` — replace inline pill render
  - `components/features/document-list/table-cell-editors/priority-editor.tsx` — replace inline pill render; **verify** whether Uppgifter actually imports this file or has a parallel copy
  - `components/features/compliance-audit/cycle-detail/cycle-status-badge.tsx` — replace `STATUS_VARIANTS` inline map
  - `components/features/documents/document-status-badge.tsx` — already wraps `Badge`; update to use `tone` prop
  - `components/features/compliance-audit/cycle-list/cycle-list-table.tsx` — replace inline chip render with `FilterChip`
  - `components/features/compliance-audit/cycle-detail/cycle-findings-tab.tsx` — replace inline chip render with `FilterChip`
  - All six surface page files — wrap header/toolbar regions with `PageHeader` + `TableToolbar`
  - `components/features/compliance-audit/cycle-detail/cycle-items-tab.tsx` — convert custom div-grid to `<Table>` primitive
  - `components/features/documents/document-table.tsx` — convert custom div-grid to `<Table>` primitive

### Enhancement Details

- **What's being added/changed:**
  1. Extended `Badge` primitive + colour-token module + migration of all hand-rolled pill renders. Priority enum aligned (label + colour) across Laglistor and Uppgifter.
  2. New `FilterChip` primitive + replacement of the two reinvented chip implementations.
  3. New `PageHeader` + `TableToolbar` primitives + migration of all six surface page files to use the canonical slot order.
  4. Two custom div-grids migrated to shadcn `<Table>` so all tabular surfaces share the same primitive (and therefore the same future affordances).
- **How it integrates:**
  - All four primitive additions are **purely additive at the primitive layer** — existing call sites continue to compile until they're explicitly migrated.
  - Migration of call sites is **per-PR mechanical** — each replaces one inline pattern with one primitive import.
  - **Zero behaviour changes.** No new actions, no new data, no API changes. Snapshot tests on touched components should change visually only where the audit identified drift.
  - **Token module** (`lib/ui/badge-tones.ts`) is the single source of truth for tone → Tailwind class mapping. Future colour tweaks (e.g., dark-theme polish) happen in one file.
- **Success criteria (measurable):**
  - Grepping the codebase for `inline-flex items-center.*rounded-full.*bg-(blue|rose|amber|emerald|gray|slate)-100` returns **zero matches** outside `components/ui/badge.tsx` and `lib/ui/badge-tones.ts`.
  - "Hög" priority renders identically (same colour, same label) on Mina laglistor and Uppgifter when displayed side-by-side at the same zoom.
  - "Medium" / "Medel" priority no longer collides visually with "Pågående" / "Delvis uppfylld" status (i.e., the priority pill is amber, not blue).
  - The two `role="tab"` filter-chip groups (`cycle-list-table`, `cycle-findings-tab`) are replaced with `aria-pressed` toggle buttons. Screen reader announces "toggle button Avvikelse, not pressed" rather than "tab Avvikelse, selected".
  - All six surface page headers render in the same slot order: breadcrumb → title (+badge) → subtitle/meta → (stats | primary action) → divider → views | (search + filters + right slot).
  - `cycle-items-tab.tsx` and `document-table.tsx` use `<Table><TableHeader><TableHead/>` etc. from `components/ui/table.tsx`.
  - **Zero regressions** in existing functionality on each migrated surface (tests pass; manual smoke of expand/collapse, sort, drawer, sign-off button, action menu).

---

## Stories

### Story 22.1 — Badge `tone` primitive + Priority enum alignment

**Scope:** Extend `Badge`; introduce token module; migrate all hand-rolled pill renders; align Priority enum.

- Extend `components/ui/badge.tsx` with `tone` (`neutral` | `info` | `success` | `warning` | `danger`) × `variant` (`soft` | `solid` | `outline`) via `cva`. Default `tone="neutral"`, `variant="soft"`. Preserve existing `default`/`secondary`/`destructive`/`outline` shadcn variants for non-status uses.
- Create `lib/ui/badge-tones.ts` exporting the canonical class strings per tone × variant + a `getStatusBadgeProps(domain, value)` helper that maps domain enums (compliance status, cycle status, document status, finding severity, finding type) to `{ tone, variant, label }`.
- Migrate `compliance-status-editor.tsx` (Laglistor), `cycle-status-badge.tsx` (Cycle), `document-status-badge.tsx` (Styrdokument), and the inline `Pågående` pill in cycle headers to use `<Badge tone={…} variant={…}>{label}</Badge>`.
- Migrate `priority-editor.tsx` to use `<Badge tone>` with the rose/amber/slate ramp from the prototype.
- **Verify and unify the Priority editor**: confirm whether `components/features/document-list/table-cell-editors/priority-editor.tsx` is the actual source for Uppgifter, or whether Uppgifter has its own copy that needs deleting/redirecting. Acceptance: a single `PriorityEditor` is imported by both Laglistor and Uppgifter.
- Pick one Priority label set: **Swedish** (`Hög` / `Medel` / `Låg`) — replaces "Medium" wherever it appears.
- Snapshot tests for each badge usage; visual regression check on each migrated surface.

**Definition of Done:**
- [ ] Badge primitive accepts `tone` + `variant`
- [ ] All five hand-rolled pill renders identified in the audit are migrated
- [ ] Priority renders identically on Laglistor and Uppgifter (verified with side-by-side screenshots)
- [ ] No `bg-X-100 text-X-700` strings remain outside the primitive layer
- [ ] Existing tests pass; new snapshot tests cover each tone × variant combination

---

### Story 22.2 — `FilterChip` primitive + chip migration

**Scope:** New primitive; migrate two existing chip groups; preserve `Tabs` for view-switching only.

- Create `components/ui/filter-chip.tsx` exporting `<FilterChip pressed count icon disabled onPressedChange>`. Renders as a `<button aria-pressed>` with the prototype's class strings: `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors`. Active = `border-foreground bg-foreground text-background`, inactive = `border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground`. Count badge inline as `<span class="rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums">`.
- Export an optional `<FilterChipGroup>` wrapper for `flex flex-wrap gap-2` + `role="group" aria-label`.
- Refactor `cycle-list-table.tsx` (`Aktiva` / `Slutförda` / `Förseglade` / `Arkiverade` / `Alla`) to use `FilterChip` with counts.
- Refactor `cycle-findings-tab.tsx` — both chip rows (type filter and status filter) — to use `FilterChip` (counts optional but recommended).
- **Do not touch** existing `TabsTrigger` usages on Laglistor / Tasks / Styrdokument / Cycle detail — those remain semantic tabs.
- Update screen-reader copy: chips announce as toggle buttons; tab-list confusion gone.
- Snapshot tests for `FilterChip` (pressed / unpressed / with count / with icon).

**Definition of Done:**
- [ ] `FilterChip` primitive created with documented props
- [ ] Both chip groups migrated; visual regression check passes
- [ ] No remaining `role="tab"` markup that isn't inside an actual `<Tabs>` group
- [ ] axe-core or equivalent a11y check confirms toggle-button semantics

---

### Story 22.3 — `PageHeader` + `TableToolbar` primitives + 6-surface migration

**Scope:** New primitives; migrate all six surface page files to use them.

- Create `components/ui/page-header.tsx` exporting `<PageHeader>` with named props/slots: `breadcrumbs`, `title`, `badge` (renders inline next to title), `subtitle`, `meta` (a `<PageHeader.Meta items={...}>` subcomponent that renders dot-separated chips with optional avatar), `stats` (array of `{label, value}`), `primaryAction`, `secondaryActions`.
- Create `components/ui/table-toolbar.tsx` exporting `<TableToolbar>` with named slots: `views` (intended for shadcn `Tabs`), `search` (use shared `SearchInput`), `filters` (intended for `FilterChip` group), `rightSlot`. Default layout: `views` left, `search + filters + rightSlot` right; responsive wrap.
- Define canonical slot order via the rendered structure: breadcrumb → title row (title + badge | stats + primaryAction) → meta → divider → toolbar (views | search + filters + rightSlot).
- Migrate the six surface pages:
  1. `app/(workspace)/laglistor/page.tsx` → use `PageHeader` (move `Skapa kontroll` + `Generera om laglista` into a `secondaryActions` overflow menu, keep `Lägg till dokument` as `rightSlot` of `TableToolbar`)
  2. `app/(workspace)/laglistor/kontroller/page.tsx` → `PageHeader` with `Skapa kontroll` as `primaryAction`; `TableToolbar` with `FilterChip` group
  3. `app/(workspace)/laglistor/kontroller/[cycleId]/page.tsx` → `PageHeader` with `badge`, `meta`, `stats`, `primaryAction={Åtgärder menu}`; `TableToolbar` per-tab with FilterChips and per-tab create button as `rightSlot`
  4. `app/(workspace)/tasks/page.tsx` → `PageHeader` with `Ny uppgift` as `primaryAction`; `TableToolbar` with view tabs + collapse the right-side filter dropdowns into a single "Filter (N)" popover or keep as discrete dropdowns inside `filters` slot
  5. `app/(workspace)/workspace/styrdokument/page.tsx` → `PageHeader` with `Importera` as `secondaryActions[0]` and `Nytt dokument` as `primaryAction`; `TableToolbar` with view tabs + filter dropdowns
  6. (Findings tab — handled inside #3 cycle detail)
- Verify each migrated surface against the prototype's "after" mockup.
- **Action verb consistency**: standardise primary creates on `Ny X` / `Nytt X` (descriptive); reserve `Lägg till X` for additive actions inside an existing context (e.g., "Lägg till finding" stays because findings are added inside a cycle).

**Definition of Done:**
- [ ] `PageHeader` and `TableToolbar` primitives created with documented APIs
- [ ] All six surfaces migrated; cross-surface visual comparison shows aligned slot order
- [ ] Cycle detail meta no longer uses raw `·`-separated text — uses `PageHeader.Meta`
- [ ] Primary action button placement is consistent across surfaces
- [ ] Existing tests pass; smoke check on each surface confirms no regressions in navigation, modal opens, filters

---

### Story 22.4 — Cycle Items + Styrdokument → shadcn `<Table>` migration

**Scope:** Convert two custom div-grids to the shared `<Table>` primitive.

- **Task group A — Cycle Items:**
  - Refactor `components/features/compliance-audit/cycle-detail/cycle-items-tab.tsx` to render `<Table><TableHeader><TableHead>...</TableHead></TableHeader><TableBody><TableRow>...</TableRow></TableBody></Table>`.
  - Preserve all inline editors (`ItemBedomningSelect`, `ItemMotiveringEditor`, `ItemSignOffButton`) inside `<TableCell>` — they should not change behaviour.
  - Preserve the expandable drawer pattern (`cycle-item-row-drawer.tsx`) — it already renders separately from the row; just ensure the chevron / row-click trigger is wired correctly inside the new `<TableRow>`.
  - Re-evaluate virtualization: the existing custom impl uses `@tanstack/react-virtual`. Either keep it as a wrapper around `TableBody`, or fall back to a non-virtualized `<Table>` if row count is reliably <100. Document the choice.
- **Task group B — Styrdokument:**
  - Refactor `components/features/documents/document-table.tsx` to render `<Table>` primitives.
  - Preserve sortable headers (Titel / Senast uppdaterad / Granskningsdatum) — wrap in the existing `SortableHeader` primitive at `components/ui/sortable-header.tsx`.
  - Preserve the `…` row overflow menu in the rightmost `<TableCell>`.
  - Confirm row hover, row click (if any), and the active filter dropdown behaviour are unchanged.
- Both task groups: snapshot tests of header + first row; manual smoke of all per-row interactions.

**Definition of Done:**
- [ ] Both files use `<Table>` from `components/ui/table.tsx`
- [ ] All existing per-row interactions still work (verified manually): assessment edit, motivering edit, sign-off, drawer expand (Cycle Items); sort, action menu (Styrdokument)
- [ ] Virtualization decision documented in the story file or as a code comment
- [ ] No regressions in existing tests; new snapshot tests pass

---

## Compatibility Requirements

- [x] Existing APIs remain unchanged — no server actions or routes touched
- [x] Database schema unchanged
- [x] UI changes follow existing patterns — primitives extend rather than replace shadcn
- [x] Performance impact minimal — no new heavy dependencies; virtualization preserved where it exists today

## Risk Mitigation

- **Primary Risk:** Visual regression on a migrated surface that isn't caught by tests (e.g., a one-off colour, a tooltip layout, an empty state).
- **Mitigation:**
  - Snapshot tests for every primitive variant.
  - Each story's DoD includes a manual side-by-side check against the prototype mockup.
  - Migrate one surface per PR for Story 22.3 (the largest blast radius) so issues surface incrementally.
  - Land Story 22.1 first — every later story imports from the new tone tokens, so any token-mapping issue is caught early when it only affects pills.
- **Rollback Plan:** Each primitive lives in its own file; each migration is a discrete commit. Revert the offending commit; pre-migration call sites continue to compile because the old inline classes don't exist anymore but the old commit is intact in git.

## Definition of Done

- [ ] All four stories completed with acceptance criteria met
- [ ] Cross-surface visual audit confirms: priority renders identically across Laglistor and Uppgifter; status pills share font-weight/border/padding; page headers share slot order; all six tabular surfaces use `<Table>`
- [ ] No `inline-flex items-center.*rounded-full.*bg-(blue|rose|amber|emerald|gray|slate)-100` matches outside `components/ui/badge.tsx` + `lib/ui/badge-tones.ts`
- [ ] No `role="tab"` markup outside actual `<Tabs>` groups
- [ ] Existing tests pass; new snapshot/a11y tests for each primitive
- [ ] No regression in any existing user-facing flow (smoke test per surface)
- [ ] Update `CLAUDE.md` with a short note on the new primitives and where to find them

---

## Sequencing & Dependencies

```
Story 22.1 (Badge tones + Priority)      ────┐
                                              ├──► Story 22.3 (PageHeader/TableToolbar) ──► Story 22.4 (Table migration)
Story 22.2 (FilterChip)                  ────┘
```

- 22.1 and 22.2 can ship in parallel (independent files, low blast radius).
- 22.3 depends on both — it composes `Badge` (for inline pills in headers) and `FilterChip` (in toolbar `filters` slot).
- 22.4 should land last — easier to migrate to `<Table>` once the toolbar/header layout is settled and not competing for layout decisions.

## Coordination notes

- **Active Epic 21:** new chip/badge code added between now and 22.x landing should target the new primitives. Coordinate with the Epic 21 dev to avoid stepping on `cycle-findings-tab.tsx` and `cycle-items-tab.tsx`.
- **Future surfaces** (e.g., the "Krav" view from Epic 20) should be built directly on the new primitives — flag as gating during PR review once 22.1–22.3 land.

---

**Story Manager Handoff:**

"Please develop detailed user stories for Epic 22 — UI Primitives Alignment. Key considerations:

- This is a brownfield refactor of an existing Next.js 14 / React 18 / TypeScript / Tailwind / shadcn-ui codebase
- Integration points: every list-view surface in `app/(workspace)/...`, plus the primitive layer in `components/ui/`
- Existing patterns to follow: shadcn `cva`-based variant config; Radix primitives; `lib/ui/` for cross-cutting tokens
- Critical compatibility requirements: zero behaviour change; existing tests must pass; visual changes only where the audit identified drift
- Each story must include verification that existing functionality remains intact via snapshot tests + manual smoke
- Source artefacts: `docs/ui-consistency-audit-2026-04-23.md` (current-state class strings) and `_prototypes/ui-alignment-prototype.html` (target-state visual reference + JSX API stubs)

The epic should deliver a coherent visual language across the workspace's six tabular surfaces while preserving system integrity."

---

## Actual Delivery Scope (Addendum — PR #60)

The original Epic 22 was scoped at four stories (22.1–22.4). In flight, a follow-on audit ran across **every** workspace surface and identified additional drift the four-story plan didn't cover. PR #60 shipped the original four plus five additional waves (22.5–22.9), expanding the epic from "four primitives + six-surface migration" to "primitive layer + total cross-workspace alignment." Stories 22.5–22.9 are documented at `docs/stories/completed/22.5*.md` through `22.9*.md`.

### Completed stories beyond original scope

| Story | Title | Outcome |
|---|---|---|
| 22.5 | PageHeader sweep (Mallar / Krav / Settings / Activity) | Hand-rolled `<h1>+<p>` headers replaced with canonical `<PageHeader>` on the four remaining workspace surfaces the original 22.3 didn't cover. |
| 22.6 | `<DatePicker>` primitive + native-input sweep | New `components/ui/date-picker.tsx` (Popover + Calendar + outline Button trigger). Cycle wizard, search filters, catalogue filters, error filters all migrated off native `<input type="date">`. ISO ↔ Date helpers (`parseISODate`, `toISODate`) co-located on the primitive. |
| 22.7 | Tasks 5-tab atom alignment | New `<ColorTagBadge>` (workspace-color-driven pill), new `<EmptyState>` + `<EmptyState.Icon>`, new `lib/utils/task-utils.ts` with `isTaskOverdue` helper. `TableToolbar` evolved with optional `tabs` slot for two-row layout (Tasks adopts it, drops `<UnifiedToolbar>`). Atom migrations across Lista / Aktiva / Alla; per-card priority badge on Kanban; per-column "Inget i denna kolumn ännu" placeholder; Calendar month-empty `<EmptyState>` early-return; unified overdue treatment (red `border-l-2` + red title + `<AlertCircle>` prefix); "Ny uppgift" → `PageHeader.primaryAction`. |
| 22.8 | Law list table chrome alignment + column-sizing clamps | `DocumentListTable` and `ComplianceDetailTable` brought to 1:1 parity with Tasks Lista: chrome columns 40/40/60 → 56/56/72, pin type column, center icons, padding overrides, `minSize`/`maxSize` on every column, `liveTotalWidth` + spacer cell so chrome holds widths under `table-fixed`, `COLUMN_SIZE_BOUNDS` + `clampColumnSizing` (clamp on commit AND read — fixes "drag to infinite width" because TanStack onEnd commits unclamped). `document-list-store` v3→v4 migration wipes persisted `columnSizing` so existing users pick up new defaults. `group-table-section` outer wrapper drops horizontal padding for 1:1 chrome alignment between flat + grouped law list. |
| 22.9 | Filter-chip canonicalization | `content-type-filter.tsx`, `krav-filter-chips.tsx`, `template-catalog-client.tsx` switched from bespoke chip implementations to canonical `<FilterChip>` + `<FilterChipGroup>`. `FilterChip` re-themed: `bg-primary` active state, `py-1.5 text-sm` density, `text-foreground` on inactive (matches Laglistor's "loose" feel; was canonical-tight before). |

### Cumulative delivery metrics

- **PR**: [#60](https://github.com/Adstedt/laglig_se/pull/60), branch `feat/epic-22-ui-primitives-alignment` → `main`
- **Branch delta**: 176 files changed, +14,740 / −2,877 (across 37 commits)
- **New primitives** (under `components/ui/`): `page-header`, `table-toolbar`, `workspace-view-tabs`, `filter-chip`, `color-tag-badge`, `empty-state`, `date-picker` (7 new files)
- **New utilities**: `lib/utils/task-utils.ts` (`isTaskOverdue`), `lib/ui/badge-tones.ts` (already shipped in 22.1)
- **Component specs added**: `docs/components/{color-tag-badge,empty-state,date-picker,filter-chip,table-toolbar}-spec.md`

### Surfaces touched (post-22.4)

Beyond the original six, PR #60 touched: Mallar (`/laglistor/mallar`), Krav (`/krav`), Settings (`/settings`), Activity (`/workspace/activity`), Tasks all five tabs, Laglistor (compliance + table viewmode + grouped view), Cycle creation wizard, Search results filters, Catalogue filters (`/browse/*`), Admin error filters, Admin tables (User/Workspace/Template overflow-x-auto). Plus `<TableToolbar>` evolution affects Kontroller and Styrdokument (single-row mode unchanged, but they now share the same primitive that Tasks two-row mode uses).

### Audit prototypes (visual references, in repo)

- `_prototypes/epic-22-consistency-audit.html` — six-section audit (filter chips, search, dropdowns, tables, empty states, admin overflow) with current-vs-proposed panels and a decision summary
- `_prototypes/epic-22-tasks-tabs-alignment.html` — five-section Tasks-tabs deep-dive (status, priority, overdue, empty states, toolbar layout) with three scope options (atoms only / +empty states / +toolbar restructure)

### Out-of-scope (deferred follow-ups)

These were considered during the audit and explicitly deferred:

- `<UnifiedToolbar>` retirement — still in use on Laglistor flat + grouped views. Eventual consolidation to `<TableToolbar>` (now that it has the `tabs` slot) is a future cleanup.
- Migrating `KravTable`'s raw `<table>` to shadcn `<Table>` primitives — Krav's TanStack base is intentionally aligned with Laglistor's gold-standard pattern (per memory). Deferred.
- Active sweep of all hand-rolled empty states in the codebase. Four were migrated in 22.7; remaining 8+ adopt `<EmptyState>` next time they're touched.
- `<AssigneeChip>` extraction (Tasks alignment original Scope C item — dropped in favour of toolbar restructure).

