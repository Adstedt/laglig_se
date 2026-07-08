'use client'

/**
 * One card in the narrow-container renderer. The face is DERIVED from the
 * same column defs as the table via meta.dt.card roles — no per-table card
 * component. Visibility state is respected: a column hidden in the table
 * is hidden on the card.
 *
 * Interactive cells default to a non-interactive presentation (editing
 * lives in the detail surface); columns opt in via card.interactive.
 */
import { memo, useCallback, useMemo } from 'react'
import { flexRender, type Cell, type Row } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { SELECT_COLUMN_ID } from '../chrome-columns'
import { isInteractiveTarget } from '../interactive-guard'
import { getCardSlot, getDtMeta } from '../meta'
import type { DataTableSlots, DataTableView, RowInteraction } from '../types'

const MAX_VISIBLE_BADGES = 3

interface CardFace<TData> {
  title: Cell<TData, unknown> | null
  badges: Array<{
    cell: Cell<TData, unknown>
    interactive: boolean
    renderCard?: ((_row: Row<TData>) => React.ReactNode) | undefined
  }>
  metas: Array<{
    cell: Cell<TData, unknown>
    label: string | null
    interactive: boolean
    renderCard?: ((_row: Row<TData>) => React.ReactNode) | undefined
  }>
  footers: Array<{
    cell: Cell<TData, unknown>
    interactive: boolean
    renderCard?: ((_row: Row<TData>) => React.ReactNode) | undefined
  }>
}

function partitionCells<TData>(row: Row<TData>): CardFace<TData> {
  const face: CardFace<TData> = {
    title: null,
    badges: [],
    metas: [],
    footers: [],
  }
  const cells = row.getVisibleCells()
  const slotted: Array<{
    cell: Cell<TData, unknown>
    slot: ReturnType<typeof getCardSlot<TData>>
    index: number
  }> = []

  cells.forEach((cell, index) => {
    if (cell.column.id === SELECT_COLUMN_ID) return
    const slot = getCardSlot(cell.column, index)
    if (slot.role === 'hidden') return
    if (slot.role === 'title') {
      face.title = face.title ?? cell
      return
    }
    slotted.push({ cell, slot, index })
  })

  slotted.sort((a, b) => {
    const pa = 'priority' in a.slot ? (a.slot.priority ?? a.index) : a.index
    const pb = 'priority' in b.slot ? (b.slot.priority ?? b.index) : b.index
    return pa - pb
  })

  for (const { cell, slot } of slotted) {
    if (slot.role === 'badge') {
      face.badges.push({
        cell,
        interactive: 'interactive' in slot && slot.interactive === true,
        renderCard: 'renderCard' in slot ? slot.renderCard : undefined,
      })
    } else if (slot.role === 'meta') {
      const dt = getDtMeta(cell.column)
      face.metas.push({
        cell,
        label:
          'cardLabel' in slot && slot.cardLabel !== undefined
            ? slot.cardLabel
            : dt.label,
        interactive: 'interactive' in slot && slot.interactive === true,
        renderCard: 'renderCard' in slot ? slot.renderCard : undefined,
      })
    } else if (slot.role === 'footer') {
      face.footers.push({
        cell,
        interactive: 'interactive' in slot && slot.interactive === true,
        renderCard: 'renderCard' in slot ? slot.renderCard : undefined,
      })
    }
  }
  return face
}

function CellValue<TData>({
  cell,
  row,
  interactive,
  renderCard,
}: {
  cell: Cell<TData, unknown>
  row: Row<TData>
  interactive: boolean
  renderCard?: ((_row: Row<TData>) => React.ReactNode) | undefined
}) {
  if (renderCard) return <>{renderCard(row)}</>
  const rendered = flexRender(cell.column.columnDef.cell, cell.getContext())
  if (interactive) return <>{rendered}</>
  // Static presentation: the table cell renderer output, inert.
  return (
    <span className="pointer-events-none [&_button]:cursor-default">
      {rendered}
    </span>
  )
}

interface CardItemProps<TData> {
  row: Row<TData>
  selectionEnabled: boolean
  rowInteraction?: RowInteraction<TData> | undefined
  cardActions?: DataTableSlots<TData>['cardActions'] | undefined
  view: DataTableView
  measureRef?: ((_el: HTMLDivElement | null) => void) | undefined
  dataIndex?: number | undefined
  virtualStart?: number | undefined
}

function CardItemInner<TData>({
  row,
  selectionEnabled,
  rowInteraction,
  cardActions,
  view,
  measureRef,
  dataIndex,
  virtualStart,
}: CardItemProps<TData>) {
  const face = useMemo(() => partitionCells(row), [row])
  const onRowClick = rowInteraction?.onRowClick

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onRowClick) return
      if (isInteractiveTarget(e)) return
      onRowClick(row.original, { event: e, view })
    },
    [onRowClick, row.original, view]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!onRowClick) return
      if (e.key !== 'Enter' && e.key !== ' ') return
      if (isInteractiveTarget(e)) return
      e.preventDefault()
      onRowClick(row.original, {
        event: e as unknown as React.MouseEvent,
        view,
      })
    },
    [onRowClick, row.original, view]
  )

  const isVirtual = virtualStart !== undefined
  const style: React.CSSProperties | undefined = isVirtual
    ? {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${virtualStart}px)`,
      }
    : undefined

  const visibleBadges = face.badges.slice(0, MAX_VISIBLE_BADGES)
  const overflowCount = face.badges.length - visibleBadges.length

  return (
    <div ref={measureRef} data-index={dataIndex} style={style}>
      <div
        role={onRowClick ? 'button' : 'listitem'}
        tabIndex={onRowClick ? 0 : undefined}
        data-state={row.getIsSelected() ? 'selected' : undefined}
        onClick={handleClick}
        onKeyDown={onRowClick ? handleKeyDown : undefined}
        className={cn(
          'group rounded-lg border bg-card p-3 transition-colors',
          'data-[state=selected]:bg-muted',
          onRowClick && 'cursor-pointer hover:bg-muted/50',
          !isVirtual && 'mb-2',
          rowInteraction?.getRowClassName?.(row.original)
        )}
      >
        {/* Title row */}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 text-sm font-medium leading-snug">
            {face.title
              ? flexRender(
                  face.title.column.columnDef.cell,
                  face.title.getContext()
                )
              : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {cardActions?.(row)}
            {selectionEnabled && (
              <Checkbox
                checked={row.getIsSelected()}
                disabled={!row.getCanSelect()}
                onCheckedChange={(checked) =>
                  row.toggleSelected(checked === true)
                }
                aria-label="Markera rad"
              />
            )}
          </div>
        </div>

        {/* Badge row */}
        {visibleBadges.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {visibleBadges.map(({ cell, interactive, renderCard }) => {
              const custom = renderCard ? renderCard(row) : undefined
              if (renderCard && (custom === null || custom === undefined)) {
                return null
              }
              return renderCard ? (
                <span key={cell.id}>{custom}</span>
              ) : (
                <CellValue
                  key={cell.id}
                  cell={cell}
                  row={row}
                  interactive={interactive}
                />
              )
            })}
            {overflowCount > 0 && (
              <span className="text-xs text-muted-foreground">
                +{overflowCount}
              </span>
            )}
          </div>
        )}

        {/* Meta rows — a renderCard returning null skips the whole row
            (conditional fields stay off the card instead of rendering
            label + em-dash noise) */}
        {face.metas.length > 0 && (
          <dl className="mt-2.5 space-y-1.5">
            {face.metas.map(({ cell, label, interactive, renderCard }) => {
              const custom = renderCard ? renderCard(row) : undefined
              if (renderCard && (custom === null || custom === undefined)) {
                return null
              }
              return (
                <div key={cell.id} className="flex items-center gap-3 text-sm">
                  {label !== null && (
                    <dt className="w-20 shrink-0 truncate text-xs text-muted-foreground">
                      {label}
                    </dt>
                  )}
                  <dd className="min-w-0 flex-1 truncate">
                    {renderCard ? (
                      custom
                    ) : (
                      <CellValue
                        cell={cell}
                        row={row}
                        interactive={interactive}
                      />
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        )}

        {/* Footer row */}
        {face.footers.length > 0 && (
          <div className="mt-2 flex items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
            {face.footers.map(({ cell, interactive, renderCard }, i) => (
              <span key={cell.id} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden="true">·</span>}
                <CellValue
                  cell={cell}
                  row={row}
                  interactive={interactive}
                  renderCard={renderCard}
                />
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export const CardItem = memo(
  CardItemInner,
  (prev, next) =>
    prev.row === next.row &&
    prev.row.getIsSelected() === next.row.getIsSelected() &&
    prev.selectionEnabled === next.selectionEnabled &&
    prev.virtualStart === next.virtualStart &&
    prev.rowInteraction === next.rowInteraction &&
    prev.cardActions === next.cardActions
) as typeof CardItemInner
