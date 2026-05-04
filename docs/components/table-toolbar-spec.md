# `<TableToolbar>` — Component Specification

**Version:** 1.1 (evolved in Story 22.7 with `tabs` slot)
**Last Updated:** 2026-05-04
**Author:** Sarah (PO) — as-built from Story 22.3 (creation) + Story 22.7 (`tabs` slot evolution)
**File:** `components/ui/table-toolbar.tsx`
**Stories of origin:** [22.3](../stories/completed/22.3.pageheader-tabletoolbar-primitives.md) (created), [22.7](../stories/completed/22.7.tasks-tabs-atom-alignment.md) (`tabs` slot added; Tasks adopts it)

---

## 1. Purpose

Workspace tabular surface toolbar with named slots. Two render modes:

1. **Single-row** (default) — for surfaces where a small view switcher (chips, 2-3 tabs) and a filter cluster fit comfortably on one row. Used by Kontroller, Styrdokument.
2. **Two-row** — for surfaces with a heavier tab strip (5+ tabs) where putting tabs on the same row as filters causes layout fragility. Used by Tasks.

The slot order is enforced by the render tree; devs cannot accidentally reorder by re-arranging props (mirrors `<PageHeader>`'s enforcement model).

This primitive is the canonical replacement for the older `<UnifiedToolbar>` (`components/ui/unified-toolbar.tsx`). UnifiedToolbar remains in the codebase for Laglistor's complex toolbar; eventual consolidation onto `<TableToolbar>` is a future cleanup.

---

## 2. API

```tsx
export interface TableToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional Row-1 above the main toolbar. Mutually exclusive with `views`. */
  tabs?: React.ReactNode
  views?: React.ReactNode
  search?: React.ReactNode
  filters?: React.ReactNode
  rightSlot?: React.ReactNode
}
```

**Slot semantics:**

| Slot | Mode | Purpose |
|---|---|---|
| `tabs` | Two-row only | Full-width tab strip (Row 1). Mutually exclusive with `views`. |
| `views` | Single-row only | In-row left-aligned view switcher (chips OR small Tabs). Mutually exclusive with `tabs`. |
| `search` | Both | Typically a `<SearchInput>` or shadcn `<Input>` |
| `filters` | Both | Typically a `<FilterChipGroup>` OR a row of `<FilterPopover>`s |
| `rightSlot` | Both | Right-pinned action — e.g., `<ColumnSettings>`, `<Button>+ Lägg till X</Button>` |

---

## 3. Render shapes

### 3.1 Single-row mode (when `tabs` is omitted)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  views (left)                  │  search │ filters │ rightSlot (right) │
└─────────────────────────────────────────────────────────────────────────┘
```

- Outer: `flex flex-wrap items-center justify-between gap-3`
- Left group: `views` wrapped in `min-w-0`
- Right group: `flex flex-wrap items-center gap-3` containing `search`, `filters`, `rightSlot` each in their own `flex flex-wrap items-center gap-2` wrapper (so React Fragments returned by the slot's children — e.g., `DocumentFilterControls` rendering `<search/>` + `<Popover/>` as siblings — line up horizontally, not stacking)
- When `views` is omitted: right group left-aligns (`!views && 'ml-0'`)

### 3.2 Two-row mode (when `tabs` is provided)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  tabs (Row 1, full width)                                               │
├─────────────────────────────────────────────────────────────────────────┤
│  search │ filters (left)                            │ rightSlot (right) │
└─────────────────────────────────────────────────────────────────────────┘
```

- Outer: `flex flex-col gap-3`
- Row 1: `<div className="min-w-0">{tabs}</div>`
- Row 2 (rendered only when `search || filters || rightSlot`): `flex flex-wrap items-center justify-between gap-3` with `[search + filters]` as the left cluster and `rightSlot` pinned right
- Filter cluster wraps onto its own line on narrow viewports; `rightSlot` follows the wrap (no orphan `rightSlot` stranded on a separate visual line, which was the failure mode of `<UnifiedToolbar layout="standard">` on Tasks Lista before this evolution)

---

## 4. Usage

### 4.1 Single-row (Kontroller pattern)

```tsx
<TableToolbar
  views={
    <FilterChipGroup aria-label="Filtrera kontroller">
      <FilterChip pressed={...}>Aktiva</FilterChip>
      <FilterChip pressed={...}>Slutförda</FilterChip>
    </FilterChipGroup>
  }
/>
```

### 4.2 Single-row with search + filters + right action (Styrdokument pattern)

```tsx
<TableToolbar
  views={<TabsList>...</TabsList>}
  search={<SearchInput placeholder="Sök dokument..." />}
  filters={<DocumentFilterControls />}
  rightSlot={<Button>+ Nytt dokument</Button>}
/>
```

### 4.3 Two-row mode (Tasks pattern, post Story 22.7)

```tsx
<TableToolbar
  tabs={<TabNavigation currentTab={currentTab} />}
  search={
    showFilters ? (
      <SearchInput
        initialValue={searchQuery}
        onSearch={handleSearchChange}
        placeholder="Sök uppgifter..."
        className="h-9"
      />
    ) : undefined
  }
  filters={
    showFilters ? (
      <TaskFilterBar
        filters={filterState}
        onFiltersChange={handleFiltersChange}
        columns={columns}
        workspaceMembers={workspaceMembers}
      />
    ) : undefined
  }
  rightSlot={
    showFilters && isListTab ? (
      <ColumnSettings
        columnOptions={TASK_COLUMN_OPTIONS}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
      />
    ) : undefined
  }
/>
```

When `showFilters` is false (Sammanfattning tab), the entire Row 2 collapses gracefully — only the tabs row renders.

---

## 5. Call sites

As of PR #60:

- **Single-row mode**:
  - `components/features/compliance-audit/cycle-list/cycle-list-table.tsx` — `views` = FilterChipGroup
  - `components/features/documents/document-browser-page.tsx` — `views` = Tabs, `search`, `filters`
- **Two-row mode**:
  - `components/features/tasks/task-workspace/index.tsx` — `tabs` = TabNavigation, conditional `search` + `filters` + `rightSlot`

---

## 6. When NOT to use

- **Surfaces with a complex two-zone toolbar** (e.g., Laglistor with bulk-action bar + filter bar + view dropdowns + per-column settings + ...) — `<UnifiedToolbar>` (`components/ui/unified-toolbar.tsx`) has a richer Zone A/B/C/D model designed for that case. As of PR #60, only Laglistor uses it.
- **A single button row above content** (e.g., a detail-page action bar) — overkill. Use a plain `<div className="flex items-center justify-between">`.

---

## 7. Companion primitives

- `<PageHeader>` — sits ABOVE the toolbar (title chrome + primary CTA). The pair `<PageHeader> + <TableToolbar>` is the canonical workspace surface header. See `docs/components/unified-toolbar-spec.md` (older — written before TableToolbar) for the broader zone model.
- `<FilterChipGroup>` + `<FilterChip>` — typically populates `views` (single-row) or `filters`. See `docs/components/filter-chip-spec.md`.
- `<WorkspaceViewTabs>` (`components/ui/workspace-view-tabs.tsx`) — typically populates `tabs` (two-row) or `views` (single-row).
- `<ToolbarItemCount>` — exported from `components/ui/unified-toolbar.tsx` (didn't get re-homed when Tasks dropped UnifiedToolbar). Renders "Visar X av Y" item-count text. Render below `<TableToolbar>` on Tasks; was previously the `betweenRows` slot in UnifiedToolbar.

---

## 8. Test surface

`tests/unit/components/ui/table-toolbar.test.tsx` covers single-row layout. Two-row mode (post-22.7) needs additional coverage in a follow-up; for now visually verified via `/tasks?tab=lista` smoke.
