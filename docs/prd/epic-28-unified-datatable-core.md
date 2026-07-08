# Epic 28: Unified DataTable Core — Brownfield Consolidation

**Status: Done (2026-07-08).** All 12 stories complete; per-story records with
documented deviations live in `docs/stories/completed/28.*.md`, the Tier-1/Tier-0
conventions in `docs/architecture/table-conventions.md`, and the CI grep-gate
in `scripts/check-table-conventions.sh`.

**Goal:** Collapse ~6,400 lines of bespoke table code across 9+ implementations into one shared, headless `DataTable` core with **two renderers over one column definition** — a semantic `<table>` for wide containers and a virtualized card list for narrow containers — switched by **container width** (not viewport), so mobile and desktop-with-AI-chat-maximized get the same coherent card experience. Every record table in the app gains uniform sorting, selection, column management, virtualization, load-more, empty states, and narrow-mode behavior from a single implementation.

**Value Delivered:** Today five heavyweight tables (laglistor, krav, tasks, personalregister, styrdokument) each independently "mirror" `document-list-table.tsx`, re-deriving the same scaffolding — the resize-clamp subsystem exists in 3 copies, `SortableHeader` in 4, inline virtualizer setup in 3, while the purpose-built shared `virtual-table-body.tsx` sits unused. Users get inconsistent interaction (client sort here, URL sort there; sticky headers on some tables; three different load-more patterns), **no table has any mobile treatment**, and the AI chat sidebar squeezes desktop content to ~400–430px with tables horizontal-scrolling into unusability. Grouped-mode selection in laglistor is silently broken (dead plumbing). After this epic: one core, thin per-table configs, coherent narrow-mode cards everywhere, and one place to improve tables forever.

**Delivers:**
- New `components/ui/data-table/` — headless core (`useDataTable`), semantic table renderer, card-list renderer, `useContainerWidth` (ResizeObserver, rAF-coalesced, 24px hysteresis), column-meta-driven chrome (`meta.dt`: pinning/sticky/numeric/bounds/card slots), pluggable state adapters (local/URL/Zustand/localStorage), load-more strategies (button/infinite/numbered pagination), dnd modes (self/external), expansion-under-virtualization via render-item flattening, `GroupedDataTable` sections composition, generic `BulkActionBar` shell, skeleton/empty/error slots
- Migration of all heavy tables: krav (pilot) → styrdokument → admin trio → tasks → personalregister → laglistor (flat twins → grouped → cards), each shipping its narrow-mode card view at migration time
- A parameterized Playwright conformance suite + Vitest persistence-payload suite every migrated table enrolls in
- Fixes shipped en route: grouped-mode selection (laglistor), inverted resize bounds (tasks), `_columnOrderKey` memo bug, card/table field divergence (`status` vs `complianceStatus`)
- Deletion of ~4,100 lines of legacy laglistor table code plus duplicated primitives (4× SortableHeader, 3× clamp modules, orphaned `virtual-table-body.tsx`)

**Requirements covered:** Cross-cutting UX consistency + mobile/narrow-container support for all tabular surfaces. Extends Epic 22 (UI Primitives Alignment) philosophy from badges/chips/toolbars to the table layer itself. Enables Epic 18 (Mobile UX Optimization) for every table surface.

**Estimated stories:** 12

**Dependencies:**
- **Epic 22** (UI Primitives Alignment) — `badge-tones.ts`, `TableToolbar`, `PageHeader`, `FilterChip` are consumed as-is.
- **Epic 7** (HR Module) — merged (PR #92) but checklist not formally closed. **Story 28.7 is gated on formal Epic 7 closure**; any residual HR story touching `employee-list-table.tsx` lands first.
- **Epic 26** (Marketing) — `landing-v3` imports the live `document-table.tsx` for hero screenshots; Story 28.4 freezes a presentational copy **before** migrating it.

**Priority:** High — laglistor/krav/tasks are the core product surfaces; the chat-maximized squeeze and mobile unusability are daily-felt friction, and every new feature that adds a table today re-derives the pattern and deepens the debt.

**Source artefacts:**
- Approved refactor plan (2026-07-07): full architecture + API + migration design (this doc is its BMAD projection)
- Investigation: table inventory + divergence matrix + layout/infra survey (three-agent deep-dive, 2026-07-07)

---

## Epic Goal

One `DataTable` core, two renderers, one column definition per table. Migrate risk-ascending — **laglistor is the spec, krav is the pilot, laglistor migrates last** — deleting each bespoke predecessor as its replacement lands.

## Epic Description

### Existing System Context

- **Heavy TanStack tables:** `document-list-table.tsx` (1,478L) + `compliance-detail-table.tsx` (1,661L) are ~90% copy-paste twins; grouped wrappers (534L + 491L) are a ~95% identical pair rendering one full nested table per group with a parent-owned `DndContext` (`disableDndContext`). `tasks/list-tab.tsx` (1,211L), `employee-list-table.tsx` (1,178L, one TanStack instance per group section), `krav-table.tsx` (488L, manualSorting + URL + cursor load-more + raw `<table>`), `document-table.tsx` (479L), `all-work-tab.tsx` (466L), admin trio (~1,086L, ~90% mutually identical).
- **Known defects to fix (not preserve):** grouped-mode selection dead plumbing (child sections ignore lifted selection props); tasks inverted resize bounds (`dueDate` size 140 / minSize 160); row `memo` comparators ignore `_columnOrderKey`; compliance expandable rows render outside the virtualizer's estimate; laglistor card view shows legacy `status` while tables show `complianceStatus`.
- **Layout mechanics:** `main.flex-1.min-w-0` in `workspace-shell.tsx` is a sibling flex item of the chat `RightSidebar` (`w-[480px]` open, `w-[min(768px,55vw)]` maximized, 300ms transition; local `useState`, not store-readable). Container width is the only reliable narrow-mode signal. Below `lg` the chat is a fullscreen modal (container ≈ viewport).
- **Infra:** `@tailwindcss/container-queries` installed + registered, unused. No ResizeObserver hook exists. `ui/sheet.tsx`, `useMediaQuery`/`useIsMobile`, `EmptyState`, `TableToolbar`, `badge-tones.ts` all exist. Persistence: laglistor Zustand store persist `version: 4` with a v0→v4 `migrate` chain; personalregister per-workspace localStorage with sanitize-on-read (`employee-column-state.ts`).

### Enhancement Details

- **Location & purity:** `components/ui/data-table/` — design-system tier. **Hard rule: no domain types (Prisma, `DocumentListItem`, …) anywhere under this directory.** Domain cells/editors/column defs stay in `components/features/*`.
- **Column meta (TanStack module augmentation, namespaced `meta.dt`):** `label` (required), `pinned`, `stickyLeft`, `align`, `numeric`, `padding`, `mandatory`, `bounds`, `headerTooltip`, `hideBelow` (reserved), and `card` slot mapping (`role: 'hidden' | 'title' | 'badge' | 'meta' | 'footer'` + `priority` / `cardLabel` / `renderCard` / `interactive`). Default when omitted: `{ role: 'meta', priority: columnIndex }`. Replaces all magic-string column-ID branches.
- **Core props, all opt-in (absent = zero mounted cost):** `sorting` adapter (home-agnostic: local/URL/Zustand; `manual` flag for server sort), `selection` adapter (**controlled `Set<string>`, core keeps NO local selection state** — grouped cross-section selection correct by construction), `columnState` adapter (visibility/order/sizing, each optional; core clamps sizing before emitting), `expansion`, `dnd` (`off`/`self`/`external`), `loadMore` (`none`/`button`/`infinite`/`pagination`), `rowInteraction` (core applies the shared interactive-element guard), `virtualization` (auto >100 rows), `view` (`cardBelow` default 640 / `force` / `ssrDefault`), `rowHeight` (`compact` 44 / `default` 52 / `tall` 72), `status`, `slots`. Headless escape hatch: `useDataTable(props)`. Shipped helpers: `useLocalSorting()`, `useLocalStorageColumnState({ key, defaults })`.
- **Renderer switch:** `useContainerWidth` (ResizeObserver, rAF-coalesced, callback-ref, SSR-safe `null`). Resolution: `force` wins → `cardBelow: false` = table → `null` width = `ssrDefault` → hysteresis (flip to card below `bp`, back to table only at `bp + 24` — the flip can toggle a ~17px scrollbar and would otherwise oscillate). Renders ONE renderer at a time. All state lives above the renderers; scroll preserved via last-visible-index → `scrollToIndex`.
- **Expansion × virtualization:** virtualizer iterates a **flattened render list** — each expanded detail is its own virtual item (`${row.id}::detail`) with `measureElement`. Below threshold, plain two-`<tr>` rendering.
- **GroupedDataTable:** `sections` prop (id/items/header-render/per-section `sorting`); one `<DataTable dnd={{mode:'external'}}>` per section; parent owns the single DndContext with header-prioritizing collision; same `SelectionAdapter` passed to every section; `dnd: { mode: 'across-sections', onMoveToSection, onReorderWithinSection? }`.
- **CardList renderer:** face partitioned from `row.getVisibleCells()` by `card.role`; variable height, `measureElement` virtualization (~120px estimate); behavior translations owned once — sort → DropdownMenu toolbar; selection → visible checkbox + same BulkActionBar shell; row click → same `onRowClick` (`ctx.view: 'card'`); inline editors OFF on card face by default (edit in detail modal; per-column `interactive` opt-in); row DnD disabled in card view. No new Sheet surface in v1 (existing modals sit behind the same seam).
- **laglistor viewMode × width (orthogonal):** persisted `viewMode` picks a configuration (`table`/`compliance` = column sets; `card` = `force: 'card'`); container width then only affects table-configured modes (`cardBelow` 640 / compliance 768). Narrow container forces cards regardless of persisted viewMode; wide respects the user's choice.
- **Simple-table tier = conventions, NOT a component:** plain `ui/table` + shared primitives + header convention (`text-xs font-medium text-muted-foreground`, `tabular-nums`, GSF not Safiro), documented in a short conventions note. Tier-0 tables: team, billing, changes, cycle-list, import-review, admin inline tables.

### Governing principles

1. **Capability accretion** — the core gains a feature only in the same story as its first consumer. Primary god-component defense.
2. **Characterize before touching** — Playwright specs recorded against CURRENT behavior for laglistor/tasks before their migrations start.
3. **Legacy survives until parity** — laglistor's old components stay behind a flag until the parity suite is green; deletion is explicit.
4. **Core API freeze before laglistor** — stories 28.8+ may add config, never new core surface; gaps discovered late are fixed in core as their own mini-story first.

### Success criteria (measurable)

- Zero bespoke `useReactTable` calls outside `components/ui/data-table/` when 28.12 closes (CI grep-gate).
- With the AI chat maximized on a 1280–1440px desktop, every migrated table renders usable cards — no horizontal scroll.
- laglistor: Vitest fixtures of captured v0/v2/v3/v4 persisted payloads migrate cleanly through the appended v5 step; persist key unchanged; dual column-state slots survive.
- personalregister: existing per-workspace localStorage payloads render identically post-migration; corrupt payloads degrade to defaults.
- Grouped laglistor cross-section select-all + bulk bar count are correct (today: broken).
- 10× rapid chat-sidebar toggles: no `ResizeObserver loop` console errors, no renderer flapping, final renderer matches final width.
- Cleanup checklist at zero: `shared/virtual-table-body.tsx`, 4× SortableHeader copies, 3× clamp modules, `compliance-detail-table.tsx` + grouped twin + `document-list-card.tsx` (~4,100L) all deleted.

---

## Stories

### Story 28.1 — Core foundation + expansion-virtualization spike (L)

**Scope:** Build the `components/ui/data-table/` skeleton: `types.ts` (meta schema, adapters, module augmentation), `use-data-table.ts` headless core, table renderer (header/body/row with FIXED memo comparator), `use-container-width.ts`, minimal card renderer, `column-sizing.ts` (bounds-from-defs + clamp + live widths), `interactive-guard.ts`, `chrome-columns.tsx`, load-more (`button` + `pagination`), skeleton/empty components. Local + URL sorting adapters + `useLocalStorageColumnState`.

**Time-boxed spike (in-story, before the API settles):** prove expansion-rows-as-virtual-items against compliance-detail-shaped data — 72px rows, arbitrary expanded heights, expand/collapse at top/middle/bottom of a 1,000-row virtual window. If absolutely-positioned `<tr>` measurement is brittle, decide the div-row-body fallback NOW.

**Also:** delete orphaned `components/shared/virtual-table-body.tsx`; record the `ui/table-toolbar` decision (kept as the consumer-side toolbar convention; DataTable renders no toolbar except the card-view sort dropdown).

**Definition of Done:**
- [ ] `useDataTable` + `<DataTable>` render a sortable, virtualized, load-more table from a plain column-def array in a demo/test harness
- [ ] Card renderer derives a face from `meta.dt.card` roles; container switch flips renderers with 24px hysteresis; state + scroll survive the swap
- [ ] Spike outcome documented in the story file (pattern proven OR fallback decided)
- [ ] Unit tests: view resolution (force/ssrDefault/hysteresis), clamp, flattened render list
- [ ] `virtual-table-body.tsx` deleted; typecheck/lint green

### Story 28.2 — Pilot: krav (M)

**Scope:** Migrate `krav-table.tsx` + the cursor load-more plumbing in `krav-page-content.tsx` onto the core. Card slots authored; first narrow-mode surface in the app. Exercises: manualSorting + URL sort adapter, cursor `button` load-more, `measureElement` virtualization, 2 inline editors (FulfilledToggle, AssigneeEditor) inside virtualized rows, SWR data flow.

**Definition of Done:**
- [ ] `krav-table.tsx` is a column-def file + thin wrapper; bespoke table markup deleted
- [ ] URL sort survives reload/back-button; cursor append without scroll jump; editors commit/cancel in virtualized rows
- [ ] Chat sidebar maximized → cards engage; restore → table returns, selection/sort intact
- [ ] Deep-link row click (`focusRequirementId`) unchanged

### Story 28.3 — Conformance harness (M)

**Scope:** Parameterized Playwright "table conformance" suite (sort, load-more, persistence round-trip, card switch, keyboard nav, 10×-sidebar-toggle thrash test asserting no observer-loop errors and no renderer flapping) + Vitest persistence-payload suite. krav enrolled. Every subsequent story adds its table to the matrix.

**Definition of Done:**
- [ ] Suite runs green against krav; adding a table = one config entry
- [ ] Thrash test red/green demonstrated (fails without hysteresis, passes with)

### Story 28.4 — styrdokument (S)

**Scope:** FIRST freeze a presentational snapshot copy of the current table under `components/features/landing-v3/` (marketing needs pixels, not features — it never imports the live table again). Then migrate `document-table.tsx`: manualSorting URL adapter, navigation row-click, actions dropdown column, card slots.

**Definition of Done:**
- [ ] landing-v3 renders pixel-identical from the frozen copy
- [ ] `document-table.tsx` collapses to column defs + wrapper; its SortableHeader usage routes through the core
- [ ] Row click navigates; actions dropdown does not trigger row nav (guard)

### Story 28.5 — Admin trio (M)

**Scope:** Add the `pagination` load-more strategy UI to the core (numbered prev/next). One config factory replaces `template-table.tsx` / `workspace-table.tsx` / `user-table.tsx` (~1,086L → ~300L). URL page+sort adapters. Internal-only soak surface. Deletes the three local SortableHeader copies.

**Definition of Done:**
- [ ] Three admin list pages render from one factory; URL page/sort/filter state survives reload
- [ ] Page-boundary behavior correct (exactly N, N+1 rows)

### Story 28.6 — tasks (L)

**Scope:** Adds to core: selection (`Set`-adapter) + extracted `BulkActionBar` shell (actions as consumer children, stays-open behavior preserved), Zustand adapter pattern, column reorder (`DraggableColumnHeader`) + resize with clamp — **fixes the inverted min/max bounds bug (intended change, note in AC)**. Migrate `list-tab.tsx` (56px rows, virtualized) and `all-work-tab.tsx` (read-only + CSV export util; deletes its private SortableHeader). **Remove** the non-functional drag-handle placeholder (dnd: off).

**Prerequisite:** record Playwright characterization specs of current tasks behavior before migrating.

**Definition of Done:**
- [ ] Select-all vs page-select semantics unchanged; bulk actions work from both renderers
- [ ] Column reorder/visibility persist via `task-list-store` (captured payload reads back post-migration)
- [ ] Resize clamps at both bounds; 1,000-task virtualization smooth
- [ ] Placeholder drag handle gone; CSV export intact

### Story 28.7 — personalregister (L) — GATED on Epic 7 formal closure

**Scope:** Adds to core: `GroupedDataTable` sections mode (per-section independent sort, collapsible headers with rollup slots for completeness badges), external-dnd drag-row-INTO-group-header with header-prioritizing collision. localStorage adapter reads the existing per-workspace key/shape (`laglig:personalregister:columns:v1:{workspaceId}`) **verbatim**, sanitizer contract from `employee-column-state.ts` ported as-is; `EMPLOYEE_COLUMN_SIZE_BOUNDS` folds into column `meta.dt.bounds`.

**Definition of Done:**
- [ ] Per-section sort independence; drag into another group commits; completeness rollups render
- [ ] Seeded current-format localStorage payload renders identically; corrupt/out-of-bounds payloads degrade to defaults
- [ ] Personnummer masking by permission unchanged

### — CORE API FREEZE CHECKPOINT —

Everything laglistor needs now exists and has soaked on a lower-stakes surface. From here, stories may add config, never core surface area. Gaps = mini-story in core first.

### Story 28.8 — laglistor flat twins (XL)

**Scope:** Unify `document-list-table.tsx` + `compliance-detail-table.tsx` into ONE variant config on the core: two column sets, `rowHeight` default/tall, expansion (compliance), 6 inline editors, row reorder (dnd: self, debounced persist), sticky-left title, column visibility/order/sizing via Zustand adapters. Zustand persist **bumps to v5 with an appended migrate step — never rename the key, never wipe**; Vitest fixtures of captured v0/v2/v3/v4 payloads asserted through the full chain. Legacy components stay behind a flag until the parity suite is green.

**Prerequisite:** Playwright characterization specs of current laglistor behavior recorded before work starts.

**Definition of Done:**
- [ ] All 6 editors; expand/collapse mid-scroll under virtualization with 1,000 rows; row reorder persists server-side
- [ ] v0–v4 payload fixtures migrate to v5; persist key unchanged; dual column-state slots survive
- [ ] Parity suite green → flag flipped; legacy twins deleted (~3,100L)

### Story 28.9 — laglistor grouped (L)

**Scope:** Grouped pair → `GroupedDataTable` + cross-group drag (`across-sections`). **Selection semantics written as ACs before code:** parent-owned controlled `Set`; cross-section select-all and bulk bar count correct; the dead child plumbing is **deleted deliberately** (named here so review doesn't "restore" it).

**Definition of Done:**
- [ ] Cross-group drag commits to the correct group; per-group expand/collapse-all
- [ ] Cross-section selection + bulk bar correct (new behavior — was broken)
- [ ] Grouped wrapper twins deleted (~1,000L)

### Story 28.10 — laglistor cards (M)

**Scope:** Core CardList replaces `document-list-card.tsx`/`document-list-grid.tsx`. Product decisions recorded: (a) cards show `complianceStatus` (match the table — retires the legacy-status divergence); (b) narrow container forces cards regardless of persisted `viewMode`, wide container respects the user's choice. Delete legacy card components + the 28.8 flag.

**Definition of Done:**
- [ ] `viewMode: 'card'` renders via the core with the document-list column set
- [ ] Card status field = table status field; ViewMenu untouched
- [ ] Narrow-force + wide-respect verified with chat maximized

### Story 28.11 — Simple-table sweep (M)

**Scope:** `file-list-view.tsx` → DataTable (gains real selection/resize/clamp — it hand-rolls all three + its own SortableHeader today; hover image preview is just cell content); `cycle-list-table.tsx` → DataTable; `activity-log-table.tsx` → DataTable with sections (day grouping) + expansion; `cycle-items-tab.tsx` div-grid → DataTable table renderer (inline editors are first-class there); team-tab/changes-tab confirmed Tier-0 + conventions note written (`docs/architecture/table-conventions.md` or similar).

**Definition of Done:**
- [ ] Each migrated table enrolled in the conformance matrix; bespoke implementations deleted
- [ ] Tier-0 conventions note exists and names its tables

### Story 28.12 — Demolition + grep-gate (S)

**Scope:** Cleanup checklist to zero: `ui/draggable-column-header.tsx` + `ui/column-settings.tsx` absorbed/deleted, `ui/sortable-header.tsx` absorbed into data-table or deleted once grep-clean, remaining clamp modules gone, `epic-list.md`/`index.md` status updates. CI grep-gate: build fails on imports of deleted primitives and on `useReactTable` outside `components/ui/data-table/`.

**Definition of Done:**
- [ ] Grep-gate in CI, green
- [ ] Cleanup checklist zeroed; epic docs updated

---

## Explicitly NOT migrated

- **Billing invoices, import-review, misc admin inline tables** — trivial/one-shot; Tier-0 conventions only.
- **landing-v3 document-table reuse** — permanently frozen presentational copy (28.4).
- **template-sections-accordion** — a formatting device inside an accordion, not a data table.

## Risk register

| # | Risk | Mitigation |
|---|---|---|
| 1 | Core becomes a god-component | Capability accretion; headless core + dumb renderers; features = optional config with zero mounted cost; API freeze before 28.8; no-domain-types review rule |
| 2 | laglistor regression | Last in sequence; characterization specs first; legacy behind flag until parity; twin-unification reviewed against a written behavior checklist |
| 3 | Expansion × virtualization brittleness | 28.1 spike (not discovered at 28.8); div-row fallback decided before consumers exist; escape hatch: disable virtualization below threshold |
| 4 | Persisted-state loss | laglistor: append-only v5 + payload fixtures; personalregister: verbatim key/shape + sanitizer + corrupt-payload test |
| 5 | ResizeObserver thrash (300ms sidebar animation) | rAF coalescing + 24px hysteresis + scroll-index restore; 10×-toggle Playwright test |
| 6 | Card face derivation fails (>~40% of columns need `renderCard`) | Meta schema supports retreat to per-table `renderCard(row)` slot without touching the table renderer; validate on krav before rolling wide |
| 7 | Parallel work collides with 28.7 | Gated on Epic 7 formal closure; residual HR stories land first |
