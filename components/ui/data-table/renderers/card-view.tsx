'use client'

/**
 * Card-list renderer for narrow containers. Owns the behavior translations:
 * header sorting becomes a dropdown (same onSortingChange — works identically
 * for client, URL and server sorting), selection becomes a visible checkbox
 * per card. Virtualizes with measureElement (variable card heights).
 */
import { useCallback, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'
import { useDataTableContext } from '../context'
import { getDtMeta } from '../meta'
import { DataTableSortMenu } from '../sort-menu'
import { CardItem } from './card-item'

const CARD_ESTIMATE_PX = 120
const DEFAULT_VIRTUALIZATION_THRESHOLD = 100
const DEFAULT_OVERSCAN = 5
const DEFAULT_MAX_HEIGHT = 600

function CardSortDropdown<TData>() {
  const { table, props } = useDataTableContext<TData>()
  if (!props.sorting) return null
  if (props.view?.showCardSortMenu === false) return null

  // getCanSort() requires an accessorFn, which display columns (id-only,
  // common with manualSorting servers) don't have — there the explicit
  // enableSorting flag is the source of truth.
  const options = table
    .getAllLeafColumns()
    .filter((col) =>
      props.sorting?.manual
        ? col.columnDef.enableSorting === true
        : col.getCanSort()
    )
    .map((col) => ({ id: col.id, label: getDtMeta(col).label }))
  if (options.length === 0) return null

  return (
    <div className="flex justify-end pb-2">
      <DataTableSortMenu
        options={options}
        sorting={props.sorting.sorting}
        onSortingChange={props.sorting.onSortingChange}
        className="h-8"
      />
    </div>
  )
}

export function CardView<TData>() {
  const { renderItems, props, view } = useDataTableContext<TData>()
  const { virtualization, selection, rowInteraction, slots, expansion } = props

  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizationOff = virtualization === false
  const threshold = virtualizationOff
    ? Number.POSITIVE_INFINITY
    : (virtualization?.threshold ?? DEFAULT_VIRTUALIZATION_THRESHOLD)
  const shouldVirtualize = renderItems.length > threshold
  const maxHeight = virtualizationOff
    ? DEFAULT_MAX_HEIGHT
    : (virtualization?.maxHeight ?? DEFAULT_MAX_HEIGHT)

  // Identity-stable callbacks — see TableView for why this is load-bearing
  // (virtual-core notify()s during render when getItemKey identity changes).
  const renderItemsRef = useRef(renderItems)
  renderItemsRef.current = renderItems
  const getItemKey = useCallback(
    (index: number) => renderItemsRef.current[index]?.key ?? index,
    []
  )
  const estimateSize = useCallback(() => CARD_ESTIMATE_PX, [])

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

  return (
    <div>
      <CardSortDropdown<TData> />
      <div
        ref={scrollRef}
        role="list"
        className={cn(shouldVirtualize && 'overflow-y-auto')}
        style={
          shouldVirtualize && maxHeight !== 'fill' ? { maxHeight } : undefined
        }
      >
        {renderItems.length === 0 ? (
          <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
            {props.status?.isLoading ? 'Laddar…' : 'Inga resultat.'}
          </div>
        ) : shouldVirtualize ? (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const item = renderItems[virtualItem.index]
              if (!item) return null
              if (item.kind === 'detail' && expansion) {
                return (
                  <div
                    key={item.key}
                    ref={virtualizer.measureElement}
                    data-index={virtualItem.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    className="rounded-lg border bg-muted/30 p-3"
                  >
                    {expansion.renderExpanded(item.row)}
                  </div>
                )
              }
              return (
                <CardItem
                  key={item.key}
                  row={item.row}
                  selectionEnabled={Boolean(selection)}
                  rowInteraction={rowInteraction}
                  cardActions={slots?.cardActions}
                  view={view}
                  measureRef={virtualizer.measureElement}
                  dataIndex={virtualItem.index}
                  virtualStart={virtualItem.start}
                />
              )
            })}
          </div>
        ) : (
          renderItems.map((item) =>
            item.kind === 'detail' && expansion ? (
              <div
                key={item.key}
                className="mb-2 rounded-lg border bg-muted/30 p-3"
              >
                {expansion.renderExpanded(item.row)}
              </div>
            ) : (
              <CardItem
                key={item.key}
                row={item.row}
                selectionEnabled={Boolean(selection)}
                rowInteraction={rowInteraction}
                cardActions={slots?.cardActions}
                view={view}
              />
            )
          )
        )}
      </div>
    </div>
  )
}
