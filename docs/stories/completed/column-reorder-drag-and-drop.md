# Story: Drag-to-Reorder Table Columns

## Goal
Let users rearrange table columns via drag-and-drop in all main table views, persisted to localStorage.

## Affected Views
1. **Tasks — Lista** (`list-tab.tsx`)
2. **Tasks — Alla uppgifter** (`all-work-tab.tsx`)
3. **Laglistor** (`document-list-table.tsx`, `compliance-detail-table.tsx`)

## Why It's Simple
- TanStack Table v8 has native `columnOrder` state — just wire it up
- @dnd-kit already integrated project-wide (row reorder, kanban, column-manager)
- Column resizing + visibility already working in these tables
- Zustand persist store (`layout-store.ts`) ready to extend

## Implementation

### 1. Extend layout store with column order state
**File**: `lib/stores/layout-store.ts`

Add per-view `columnOrder: string[]` maps (keyed by view name) with getter/setter. Persisted automatically via existing Zustand `persist` middleware.

### 2. Make table headers draggable
Create a `DraggableColumnHeader` wrapper component (reuse @dnd-kit `useSortable`). Wrap each `<TableHead>` so users can drag columns left/right.

- Use `restrictToHorizontalAxis` modifier (from @dnd-kit, same pattern as `restrictToVerticalAxis` used for rows)
- Show grab cursor on hover, subtle visual feedback on drag
- Skip non-reorderable columns (select checkbox, drag handle, actions)

### 3. Wire columnOrder into each table
Pass `columnOrder` + `onColumnOrderChange` to `useReactTable()`. TanStack handles the rest — columns render in the specified order.

**Tables to update:**
- `list-tab.tsx` — receive columnOrder from parent workspace
- `all-work-tab.tsx` — local state or from parent
- `document-list-table.tsx` — receive via props (same pattern as columnSizing)
- `compliance-detail-table.tsx` — same

### 4. Add reorder to column settings dropdown (optional)
Extend existing `ColumnSettings` component with drag-to-reorder list (similar to existing `column-manager.tsx` pattern for task workspace columns). This gives a secondary, non-header way to reorder.

## Acceptance Criteria
- [x] Columns can be reordered by dragging header cells left/right
- [x] Order persists across page navigations and browser refresh
- [x] Select, drag-handle, and actions columns are pinned (not draggable)
- [x] Works alongside existing column resizing and visibility
- [x] No regressions in sorting, filtering, or row DnD

## Key Files
| File | Change |
|------|--------|
| `lib/stores/layout-store.ts` | Add columnOrder state per view |
| `components/ui/draggable-column-header.tsx` | New — shared DnD wrapper |
| `components/features/tasks/task-workspace/list-tab.tsx` | Wire columnOrder |
| `components/features/tasks/task-workspace/all-work-tab.tsx` | Wire columnOrder |
| `components/features/document-list/document-list-table.tsx` | Wire columnOrder |
| `components/features/document-list/compliance-detail-table.tsx` | Wire columnOrder |
| `components/ui/column-settings.tsx` | Optional: add reorder UI |

## Estimate
Small — all infrastructure exists. Mainly wiring + one new small component.

---

## Dev Agent Record

### Tasks
- [x] Task 1: Create `DraggableColumnHeader` component
- [x] Task 2: Add `columnOrder` state to Zustand stores
- [x] Task 3: Wire column DnD into `list-tab.tsx`
- [x] Task 4: Wire column DnD into `all-work-tab.tsx`
- [x] Task 5: Wire column DnD into `document-list-table.tsx`
- [x] Task 6: Wire column DnD into `compliance-detail-table.tsx`
- [x] Task 7: Update parent components to pass columnOrder props
- [x] Task 8: Type-check and lint validation

### Agent Model Used
claude-opus-4-6

### Debug Log
- Fixed circular reference in `all-work-tab.tsx`: `handleColumnDragEnd` referenced `columns` useMemo defined later. Used `columns.map()` from the useMemo ColumnDef array available at declaration.
- Fixed same circular reference in `document-list-table.tsx` and `compliance-detail-table.tsx`: moved `handleColumnDragEnd` and `reorderableColumnIds` to after the `columns` useMemo definition.
- Removed unused `TableHead` import from `all-work-tab.tsx` (replaced by `DraggableColumnHeader`).
- Fixed memo-busting: `React.memo()` on row components prevented re-render when `columnOrder` changed. Added `columnOrderKey` string prop to all 6 memoized row components.
- Fixed `<div>` inside `<table>` HTML validation error: @dnd-kit `DndContext` renders hidden accessibility `<div>` elements inside `<table>`. Replaced column DnD with native HTML5 drag-and-drop (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) on `<th>` elements.

### Completion Notes
- Implementation adds drag-to-reorder columns across all 4 table views
- Column order persisted to localStorage via existing Zustand persist middleware in `task-list-store.ts` and `document-list-store.ts` (not `layout-store.ts` as story suggested — followed existing pattern)
- Pinned columns (select, dragHandle, actions, highRiskWarning, expand) are rendered as plain `<TableHead>` while reorderable columns use `<DraggableColumnHeader>`
- Column DnD uses native HTML5 drag-and-drop (not @dnd-kit) to avoid invalid DOM nesting (`<div>` inside `<table>`). Row DnD still uses @dnd-kit.
- Resize handle conflict prevention via `document.elementFromPoint` check for `[role="separator"]` in dragStart handler
- `all-work-tab.tsx` uses local state (not persisted) since it doesn't have a Zustand store
- Grouped table views (`GroupedDocumentListTable`, `GroupedComplianceTable`) thread `columnOrder` through intermediate section components
- `columnOrderKey` prop added to 6 memoized row components to bust React.memo cache on column reorder
- Task 4 (optional column settings dropdown reorder) was skipped as non-essential
- Type-check clean, lint clean, 292 related tests passing (0 new errors/warnings)

### File List
| File | Status |
|------|--------|
| `components/ui/draggable-column-header.tsx` | New |
| `lib/stores/task-list-store.ts` | Modified |
| `lib/stores/document-list-store.ts` | Modified |
| `components/features/tasks/task-workspace/list-tab.tsx` | Modified |
| `components/features/tasks/task-workspace/all-work-tab.tsx` | Modified |
| `components/features/tasks/task-workspace/index.tsx` | Modified |
| `components/features/document-list/document-list-table.tsx` | Modified |
| `components/features/document-list/compliance-detail-table.tsx` | Modified |
| `components/features/document-list/document-list-page-content.tsx` | Modified |
| `components/features/document-list/grouped-document-list-table.tsx` | Modified |
| `components/features/document-list/grouped-compliance-table.tsx` | Modified |
| `components/features/document-list/group-table-section.tsx` | Modified |
| `components/features/document-list/compliance-group-section.tsx` | Modified |

### Change Log
- Created `DraggableColumnHeader` shared component using native HTML5 drag-and-drop
- Added `columnOrder`/`setColumnOrder` to `task-list-store.ts` (persisted)
- Added `columnOrder`/`complianceColumnOrder` to `document-list-store.ts` (persisted)
- Wired column DnD into all 4 table views with pinned column support
- Threaded `columnOrder`/`onColumnOrderChange` props through 5 parent/wrapper components
- Fixed 3 circular reference bugs (columns used before declaration)
- Added `columnOrderKey` memo-busting prop to 6 memoized row components
- Rewrote column DnD from @dnd-kit to native HTML5 drag-and-drop to fix invalid DOM nesting
