'use client'

/**
 * Semantic <table> renderer. Dumb: reads everything from DataTableContext.
 *
 * Layout contract (inherited from the canonical laglistor table):
 * `table-fixed` + minWidth = live column-width sum + a trailing spacer
 * cell per row, so fixed-width chrome columns hold their declared widths
 * instead of inflating proportionally under a wide container.
 */
import { useCallback, useMemo, useRef } from 'react'
import { flexRender } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DraggableColumnHeader } from '@/components/ui/draggable-column-header'
import { cn } from '@/lib/utils'
import { getColumnWidth, getLiveTotalWidth } from '../column-sizing'
import { useDataTableContext } from '../context'
import { cellClassesFromMeta } from '../meta'
import { ROW_HEIGHT_PX } from '../types'
import { DataTableDetailRow, DataTableRow } from './table-row'

const DEFAULT_VIRTUALIZATION_THRESHOLD = 100
const DEFAULT_OVERSCAN = 5
const DEFAULT_MAX_HEIGHT = 600
const DETAIL_ESTIMATE_PX = 200

export function TableView<TData>() {
  const { table, renderItems, props, view, containerWidth, applyReorder } =
    useDataTableContext<TData>()
  const {
    virtualization,
    rowHeight = 'default',
    stickyHeader,
    expansion,
    rowInteraction,
    status,
    dnd,
  } = props

  const dndMode = dnd?.mode ?? 'off'
  const rowsSortable =
    dndMode === 'self'
      ? !(dnd?.mode === 'self' && dnd.disabled)
      : dndMode === 'external'

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      applyReorder(String(active.id), String(over.id))
    },
    [applyReorder]
  )

  const scrollRef = useRef<HTMLDivElement>(null)

  // ---- virtualization ----
  const virtualizationOff = virtualization === false
  const threshold = virtualizationOff
    ? Number.POSITIVE_INFINITY
    : (virtualization?.threshold ?? DEFAULT_VIRTUALIZATION_THRESHOLD)
  const shouldVirtualize = renderItems.length > threshold
  const rowHeightPx =
    (virtualizationOff ? undefined : virtualization?.estimateRowHeight) ??
    ROW_HEIGHT_PX[rowHeight]
  const maxHeight = virtualizationOff
    ? DEFAULT_MAX_HEIGHT
    : (virtualization?.maxHeight ?? DEFAULT_MAX_HEIGHT)

  // CRITICAL: estimateSize/getItemKey must be identity-stable. virtual-core
  // keeps options.getItemKey in a memo whose onChange calls notify() —
  // a setState — synchronously DURING render (via getVirtualItems →
  // getMeasurements → getMeasurementOptions). A fresh closure per render
  // (renderItems is routinely a new array: inline consumer props are
  // idiomatic React) therefore loops straight into "Too many re-renders".
  // Reading through a ref keeps the closures stable forever.
  const renderItemsRef = useRef(renderItems)
  renderItemsRef.current = renderItems
  const rowHeightRef = useRef(rowHeightPx)
  rowHeightRef.current = rowHeightPx

  const estimateSize = useCallback(
    (index: number) =>
      renderItemsRef.current[index]?.kind === 'detail'
        ? DETAIL_ESTIMATE_PX
        : rowHeightRef.current,
    []
  )
  const getItemKey = useCallback(
    (index: number) => renderItemsRef.current[index]?.key ?? index,
    []
  )

  const virtualizer = useVirtualizer({
    count: renderItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan: virtualizationOff
      ? DEFAULT_OVERSCAN
      : (virtualization?.overscan ?? DEFAULT_OVERSCAN),
    getItemKey,
    enabled: shouldVirtualize,
  })

  const isSticky = stickyHeader ?? shouldVirtualize
  const baseTotalWidth = getLiveTotalWidth(table)
  const visibleColumns = table.getVisibleLeafColumns()
  const visibleColumnCount = visibleColumns.length

  // Fill column: leftover container width goes to the meta.dt.fill column
  // (its declared size = minimum) instead of the trailing spacer, so the
  // primary column breathes at every width. Border ~2px reserved.
  const fillColumn = visibleColumns.find(
    (col) => col.columnDef.meta?.dt?.fill === true
  )
  const fillExtra =
    fillColumn && containerWidth !== null
      ? Math.max(0, containerWidth - baseTotalWidth - 2)
      : 0
  const liveTotalWidth = baseTotalWidth + fillExtra
  const getRenderWidth = (columnId: string, defaultSize: number) => {
    const base = getColumnWidth(table, columnId, defaultSize)
    return fillColumn && columnId === fillColumn.id ? base + fillExtra : base
  }

  // Memo-busting key for rows: order + visibility + sizing in one string.
  const state = table.getState()
  const columnStateKey = useMemo(
    () =>
      [
        state.columnOrder.join(','),
        Object.entries(state.columnVisibility)
          .map(([id, v]) => `${id}:${v ? 1 : 0}`)
          .join(','),
        Object.entries(state.columnSizing)
          .map(([id, s]) => `${id}:${s}`)
          .join(','),
        `fill:${fillExtra}`,
      ].join('|'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.columnOrder, state.columnVisibility, state.columnSizing, fillExtra]
  )

  const canResize = Boolean(props.columnState?.sizing !== undefined)
  const rowIds = useMemo(
    () => renderItems.filter((i) => i.kind === 'row').map((i) => i.row.id),
    [renderItems]
  )
  const canReorder = Boolean(
    props.columnState?.order !== undefined && props.columnState?.onOrderChange
  )

  const handleColumnReorder = useCallback(
    (activeId: string, overId: string) => {
      const current =
        state.columnOrder.length > 0
          ? [...state.columnOrder]
          : table.getAllLeafColumns().map((c) => c.id)
      const from = current.indexOf(activeId)
      const to = current.indexOf(overId)
      if (from === -1 || to === -1) return
      current.splice(to, 0, current.splice(from, 1)[0]!)
      table.setColumnOrder(current)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.columnOrder, table]
  )

  const tableContent = (
    <div
      ref={scrollRef}
      className={cn(
        'rounded-md border overflow-x-auto',
        shouldVirtualize && 'overflow-y-auto'
      )}
      style={
        shouldVirtualize && maxHeight !== 'fill' ? { maxHeight } : undefined
      }
    >
      <Table className="table-fixed" style={{ minWidth: liveTotalWidth }}>
        <TableHeader
          className={cn(isSticky && 'sticky top-0 z-20 bg-background')}
        >
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header, headerIndex) => {
                const isPinned = Boolean(
                  header.column.columnDef.meta?.dt?.pinned
                )
                const headClassName = cn(
                  // overflow-hidden: a header whose content outgrows its
                  // declared width must clip, never bleed into the next
                  // column (table-fixed doesn't protect against this).
                  // [&_button]:text-xs: SortableHeader renders a ghost
                  // Button whose own text-sm would beat the inherited
                  // header size — force all header buttons to match.
                  'group/head relative overflow-hidden whitespace-nowrap text-xs [&_button]:text-xs',
                  cellClassesFromMeta(header.column, headerIndex === 0)
                )
                const headStyle = {
                  width: getRenderWidth(header.id, header.getSize()),
                }
                const headContent = (
                  <>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {canResize && header.column.getCanResize() && (
                      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className="absolute right-0 top-0 h-full w-4 cursor-col-resize select-none touch-none group/resize flex items-center justify-center"
                      >
                        <div
                          className={cn(
                            'h-4 w-0.5 rounded-full bg-border transition-colors',
                            'group-hover/resize:bg-primary group-hover/resize:h-6',
                            header.column.getIsResizing() && 'bg-primary h-6'
                          )}
                        />
                      </div>
                    )}
                  </>
                )
                return canReorder && !isPinned ? (
                  <DraggableColumnHeader
                    key={header.id}
                    id={header.id}
                    onReorder={handleColumnReorder}
                    style={headStyle}
                    className={headClassName}
                  >
                    {headContent}
                  </DraggableColumnHeader>
                ) : (
                  <TableHead
                    key={header.id}
                    style={headStyle}
                    className={headClassName}
                  >
                    {headContent}
                  </TableHead>
                )
              })}
              {/* Spacer absorbs leftover width */}
              <TableHead aria-hidden="true" className="p-0" />
            </TableRow>
          ))}
        </TableHeader>
        <TableBody
          style={
            shouldVirtualize
              ? {
                  // display:block frees the body from table-row-group
                  // layout so absolutely-positioned measured rows work
                  // (see DataTableRow for the full rationale).
                  display: 'block',
                  height: `${virtualizer.getTotalSize()}px`,
                  position: 'relative',
                }
              : undefined
          }
        >
          <SortableContext
            items={rowIds}
            strategy={verticalListSortingStrategy}
            disabled={!rowsSortable}
          >
            {renderItems.length > 0 ? (
              shouldVirtualize ? (
                virtualizer.getVirtualItems().map((virtualItem) => {
                  const item = renderItems[virtualItem.index]
                  if (!item) return null
                  if (item.kind === 'detail' && expansion) {
                    return (
                      <DataTableDetailRow
                        key={item.key}
                        row={item.row}
                        colSpan={visibleColumnCount + 1}
                        renderExpanded={expansion.renderExpanded}
                        virtualStart={virtualItem.start}
                        measureRef={virtualizer.measureElement}
                        dataIndex={virtualItem.index}
                        rowWidth={liveTotalWidth}
                      />
                    )
                  }
                  return (
                    <DataTableRow
                      key={item.key}
                      row={item.row}
                      rowInteraction={rowInteraction}
                      view={view}
                      columnStateKey={columnStateKey}
                      virtualStart={virtualItem.start}
                      measureRef={virtualizer.measureElement}
                      dataIndex={virtualItem.index}
                      rowWidth={liveTotalWidth}
                      fillColumnId={fillColumn?.id}
                      fillExtra={fillExtra}
                      sortable={rowsSortable}
                    />
                  )
                })
              ) : (
                renderItems.map((item) =>
                  item.kind === 'detail' && expansion ? (
                    <DataTableDetailRow
                      key={item.key}
                      row={item.row}
                      colSpan={visibleColumnCount + 1}
                      renderExpanded={expansion.renderExpanded}
                    />
                  ) : (
                    <DataTableRow
                      key={item.key}
                      row={item.row}
                      rowInteraction={rowInteraction}
                      view={view}
                      columnStateKey={columnStateKey}
                      sortable={rowsSortable}
                    />
                  )
                )
              )
            ) : (
              <TableRow>
                <td
                  colSpan={visibleColumnCount + 1}
                  className="h-24 p-4 text-center align-middle text-sm text-muted-foreground"
                >
                  {status?.isLoading ? 'Laddar…' : 'Inga resultat.'}
                </td>
              </TableRow>
            )}
          </SortableContext>
        </TableBody>
      </Table>
    </div>
  )

  // 'self': the table owns its DndContext. 'external': a parent
  // (GroupedDataTable or a domain wrapper) provides it.
  if (dndMode === 'self') {
    return (
      <DndContext
        sensors={dndSensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        {tableContent}
      </DndContext>
    )
  }
  return tableContent
}
