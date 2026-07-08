'use client'

/**
 * Headless DataTable core. Owns the TanStack instance, adapter wiring,
 * selection Set↔RowSelectionState conversion, sizing clamp, expansion
 * flattening and the container-width view resolution. Renderers are dumb:
 * they read this via DataTableContext and draw.
 *
 * State lives HERE, above the renderers — swapping table↔card cannot lose
 * sorting/selection/expansion/column state.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnOrderState,
  type ColumnSizingState,
  type ExpandedState,
  type RowSelectionState,
  type SortingState,
  type Updater,
  type VisibilityState,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { boundsFromColumnDefs, clampColumnSizing } from './column-sizing'
import { createDragHandleColumn, createSelectColumn } from './chrome-columns'
import { buildRenderItems } from './features/expansion'
import type { DataTableProps, DataTableView, UseDataTableResult } from './types'
import { useContainerWidth } from './use-container-width'
import { resolveView } from './view-resolution'

function resolveUpdater<T>(updater: Updater<T>, current: T): T {
  return typeof updater === 'function'
    ? (updater as (_old: T) => T)(current)
    : updater
}

export function useDataTable<TData>(
  props: DataTableProps<TData>
): UseDataTableResult<TData> {
  const {
    data,
    columns,
    getRowId,
    sorting,
    selection,
    columnState,
    expansion,
    dnd,
    view,
    className,
  } = props

  // ---- container-width → view resolution (with hysteresis) ----
  const { ref: containerRef, width } = useContainerWidth<HTMLDivElement>()
  const prevViewRef = useRef<DataTableView | null>(null)
  const resolvedView = resolveView(width, view, prevViewRef.current)
  prevViewRef.current = resolvedView

  // ---- chrome column injection ----
  // Depends on feature PRESENCE, not identity: consumers idiomatically
  // pass inline adapter literals, and rebuilding columns each render
  // invalidates TanStack's whole row model.
  const selectionEnabled = Boolean(selection)
  const dndMode = dnd?.mode ?? 'off'
  const allColumns = useMemo<ColumnDef<TData, unknown>[]>(() => {
    const injected: ColumnDef<TData, unknown>[] = []
    if (selectionEnabled) injected.push(createSelectColumn<TData>())
    if (dndMode !== 'off') injected.push(createDragHandleColumn<TData>())
    return injected.length > 0 ? [...injected, ...columns] : columns
  }, [columns, selectionEnabled, dndMode])

  // ---- optimistic row order (dnd 'self') ----
  // On drop the consumer persists asynchronously; this overlay keeps the
  // visual order stable until fresh data arrives (identity change resets).
  const [orderOverlay, setOrderOverlay] = useState<string[] | null>(null)
  const dataRef = useRef(data)
  if (dataRef.current !== data) {
    dataRef.current = data
    if (orderOverlay !== null) setOrderOverlay(null)
  }
  const orderedData = useMemo(() => {
    if (!orderOverlay) return data
    const byId = new Map(data.map((row) => [getRowId(row), row]))
    const ordered: TData[] = []
    for (const id of orderOverlay) {
      const row = byId.get(id)
      if (row) {
        ordered.push(row)
        byId.delete(id)
      }
    }
    // Anything not in the overlay (fresh rows) appends in data order.
    for (const row of byId.values()) ordered.push(row)
    return ordered
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, orderOverlay])

  const sizingBounds = useMemo(
    () => boundsFromColumnDefs(allColumns),
    [allColumns]
  )

  // ---- column shedding (meta.dt.hideBelow) ----
  // Mid-regime responsiveness: below a column's hideBelow container width,
  // hide it — the table keeps its scannable shape without horizontal
  // scroll; the card flip is the last resort. Table view only (cards derive
  // their face from visible cells and must see all columns). Two-step memo:
  // the string key recomputes per width change (cheap), the object identity
  // only changes when a threshold is actually crossed.
  const shedKey = useMemo(() => {
    if (width === null || resolvedView !== 'table') return ''
    return allColumns
      .filter((col) => {
        const hideBelow = col.meta?.dt?.hideBelow
        return hideBelow !== undefined && width < hideBelow
      })
      .map(
        (col) => col.id ?? (col as { accessorKey?: string }).accessorKey ?? ''
      )
      .filter(Boolean)
      .join(',')
  }, [width, resolvedView, allColumns])

  const effectiveVisibility = useMemo(() => {
    const base = columnState?.visibility
    if (!shedKey) return base
    const shed: VisibilityState = { ...(base ?? {}) }
    for (const id of shedKey.split(',')) shed[id] = false
    return shed
  }, [columnState?.visibility, shedKey])

  // ---- selection: controlled Set<string> ↔ TanStack RowSelectionState ----
  const rowSelection = useMemo<RowSelectionState>(() => {
    if (!selection) return {}
    const state: RowSelectionState = {}
    for (const id of selection.selected) state[id] = true
    return state
  }, [selection])

  const handleRowSelectionChange = useCallback(
    (updater: Updater<RowSelectionState>) => {
      if (!selection) return
      const next = resolveUpdater(updater, rowSelection)
      const nextSet = new Set<string>()
      for (const [id, selected] of Object.entries(next)) {
        if (selected) nextSet.add(id)
      }
      selection.onSelectedChange(nextSet)
    },
    [selection, rowSelection]
  )

  // ---- expansion: controlled or internal ----
  const [internalExpanded, setInternalExpanded] = useState<ExpandedState>({})
  const expanded = expansion?.expanded ?? internalExpanded
  const handleExpandedChange = useCallback(
    (updater: Updater<ExpandedState>) => {
      if (!expansion) return
      let next = resolveUpdater(updater, expanded)
      if (expansion.single && typeof next === 'object') {
        const openIds = Object.keys(next).filter(
          (id) => (next as Record<string, boolean>)[id]
        )
        const prevOpen =
          typeof expanded === 'object'
            ? Object.keys(expanded).filter(
                (id) => (expanded as Record<string, boolean>)[id]
              )
            : []
        const newlyOpened = openIds.filter((id) => !prevOpen.includes(id))
        if (newlyOpened.length > 0) {
          next = { [newlyOpened[newlyOpened.length - 1]!]: true }
        }
      }
      if (expansion.onExpandedChange) {
        expansion.onExpandedChange(next)
      } else {
        setInternalExpanded(next)
      }
    },
    [expansion, expanded]
  )

  // ---- column state: clamp sizing before emitting ----
  const handleSizingChange = useCallback(
    (updater: Updater<ColumnSizingState>) => {
      if (!columnState?.onSizingChange) return
      const current = columnState.sizing ?? {}
      const next = resolveUpdater(updater, current)
      columnState.onSizingChange(clampColumnSizing(next, sizingBounds))
    },
    [columnState, sizingBounds]
  )

  const handleVisibilityChange = useCallback(
    (updater: Updater<VisibilityState>) => {
      columnState?.onVisibilityChange?.(
        resolveUpdater(updater, columnState.visibility ?? {})
      )
    },
    [columnState]
  )

  const handleOrderChange = useCallback(
    (updater: Updater<ColumnOrderState>) => {
      columnState?.onOrderChange?.(
        resolveUpdater(updater, columnState.order ?? [])
      )
    },
    [columnState]
  )

  const handleSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      sorting?.onSortingChange(updater)
    },
    [sorting]
  )

  // ---- TanStack instance ----
  const table = useReactTable<TData>({
    data: orderedData,
    columns: allColumns,
    state: {
      ...(sorting ? { sorting: sorting.sorting } : {}),
      ...(selection ? { rowSelection } : {}),
      ...(expansion ? { expanded } : {}),
      ...(effectiveVisibility !== undefined
        ? { columnVisibility: effectiveVisibility }
        : {}),
      ...(columnState?.order !== undefined
        ? {
            // Injected chrome columns (select/drag) must stay leftmost even
            // when persisted orders predate them: TanStack appends ids
            // missing from columnOrder at the END otherwise.
            columnOrder: [
              ...allColumns
                .map((c) => c.id ?? '')
                .filter(
                  (id) =>
                    id.startsWith('dt-') && !columnState.order!.includes(id)
                ),
              ...columnState.order,
            ],
          }
        : {}),
      ...(columnState?.sizing !== undefined
        ? { columnSizing: columnState.sizing }
        : {}),
    },
    getRowId: (row) => getRowId(row),
    getCoreRowModel: getCoreRowModel(),
    ...(sorting && !sorting.manual
      ? { getSortedRowModel: getSortedRowModel() }
      : {}),
    ...(sorting?.manual ? { manualSorting: true } : {}),
    ...(sorting ? { onSortingChange: handleSortingChange } : {}),
    enableSorting: Boolean(sorting),
    ...(selection
      ? {
          enableRowSelection: selection.enableRow
            ? (row) => selection.enableRow!(row.original)
            : true,
          onRowSelectionChange: handleRowSelectionChange,
        }
      : { enableRowSelection: false }),
    ...(expansion
      ? {
          getExpandedRowModel: getExpandedRowModel(),
          getRowCanExpand: expansion.getRowCanExpand ?? (() => true),
          onExpandedChange: handleExpandedChange,
        }
      : {}),
    ...(columnState?.onVisibilityChange
      ? { onColumnVisibilityChange: handleVisibilityChange }
      : {}),
    ...(columnState?.onOrderChange
      ? { onColumnOrderChange: handleOrderChange }
      : {}),
    ...(columnState?.sizing !== undefined
      ? {
          enableColumnResizing: true,
          columnResizeMode: 'onEnd' as const,
          onColumnSizingChange: handleSizingChange,
        }
      : { enableColumnResizing: false }),
  })

  // ---- flattened render list (expansion × virtualization) ----
  const rows = table.getRowModel().rows
  const expansionEnabled = Boolean(expansion)
  const renderItems = useMemo(
    () => buildRenderItems(rows, expansionEnabled),
    // `expanded` is a dependency because row.getIsExpanded() reads it but
    // the rows array identity doesn't change on expand/collapse. Presence
    // flag (not the expansion object) keeps inline consumer literals from
    // rebuilding the list every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, expansionEnabled, expanded]
  )

  const applyReorder = useCallback(
    (activeId: string, overId: string) => {
      if (dnd?.mode !== 'self') return
      const ids = orderedData.map((row) => getRowId(row))
      const from = ids.indexOf(activeId)
      const to = ids.indexOf(overId)
      if (from === -1 || to === -1 || from === to) return
      ids.splice(to, 0, ids.splice(from, 1)[0]!)
      setOrderOverlay(ids)
      void dnd.onReorder(ids.map((id, index) => ({ id, position: index })))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dnd, orderedData, getRowId]
  )

  return {
    table,
    applyReorder,
    containerProps: {
      ref: containerRef,
      className: cn('w-full', className),
    },
    view: resolvedView,
    renderItems,
    containerWidth: width,
  }
}
