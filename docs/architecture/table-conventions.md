# Table conventions (Epic 28)

Two tiers. When in doubt, use the core.

## Tier 1 — the unified DataTable core (`components/ui/data-table/`)

Any table with sorting, selection, resize/reorder/visibility, expansion,
row dnd, load-more, virtualization, or that should flip to cards in narrow
containers (mobile AND desktop with the AI chat maximized) uses
`<DataTable>` (or `<GroupedDataTable>` for sections). Consumers own columns,
cells and Swedish copy; the core owns mechanics and visual conventions.

Conventions the core applies for you:

- Header cells: `text-xs font-medium text-muted-foreground`, one line,
  `overflow-hidden`; sortable headers via `@/components/ui/sortable-header`
  (hover-reveal sort icon).
- Body cells: `text-sm`, 52px default row height (`rowHeight` for 44/72).
- First column gets a `pl-6` inset (suppressed by `padding: 'none'`).
- `meta.dt.label` is REQUIRED on every column (drives card labels, sort
  dropdown, column settings).
- `view={{ cardBelow: 800 }}` is the app-wide standard breakpoint — full
  table + horizontal scroll above, cards below. Two tiers only; avoid
  `hideBelow` column shedding (users read hidden columns as lost data).
- Numeric columns: `meta.dt.numeric` (tabular-nums, right align) — never
  hand-rolled `tabular-nums` classes.
- Row-click navigation via `rowInteraction.onRowClick` — the core applies
  the interactive-element guard; never attach `onClick` to `<tr>` yourself.
  Double-click semantics: check `ctx.event.detail >= 2` (see
  `file-list-view.tsx`).
- Persistence via the shipped adapters (`useLocalSorting`,
  `useLocalStorageColumnState({ key: 'laglig:<surface>:columns:v1' })`) or a
  consumer-built adapter over URL/Zustand.

## Tier 0 — plain `ui/table` markup (small, read-only, no card need)

Surfaces where the table is trivial or its DOM is a hard contract stay on
shadcn `<Table>` primitives and follow these conventions by hand:

- `<div className="rounded-md border overflow-x-auto">` wrapper.
- Headers: shadcn `TableHead` defaults (`text-muted-foreground`); sortable
  columns use the shared `@/components/ui/sortable-header` with a tiny
  local adapter — never a bespoke sort-icon button.
- `tabular-nums` on numeric cells; GSF (default font) in content, never
  Safiro.
- Row clicks guarded with `isInteractiveTarget` semantics (stopPropagation
  wrappers around inline controls).
- Empty states through `@/components/ui/empty-state`.

Current Tier-0 surfaces and why they stay:

| Surface | Why not the core |
| --- | --- |
| `activity/activity-log-table.tsx` | Day-separator rows INSIDE one table (Idag/Igår groups) — the core has no in-table group-header rows, and per-day section tables would repeat column headers. |
| `compliance-audit/cycle-detail/cycle-items-tab.tsx` | Production DOM contracts: `data-cycle-item-id` drives the progress-jump `querySelector`, `role="presentation"` stop-propagation zones, plain/virtualized testids — pinned by 17 unit tests. Already mirrors core conventions. |
| `settings` team-tab, changes-tab, billing invoices, import-review | Trivial read-only lists; touch cost > value. |
| `landing-v3/marketing-document-table.tsx` | Permanently frozen presentational copy (Story 28.4) — marketing never imports the live table. |

If a Tier-0 surface later needs selection, resize, cards, or persistence,
migrate it to the core instead of hand-rolling the feature — that is the
whole point of Epic 28.
