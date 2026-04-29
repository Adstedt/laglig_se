import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Story 22.3 — `TableToolbar` primitive.
 *
 * Workspace tabular surface toolbar with named slots:
 *
 *   ┌────────── views (tabs) ──────────┐  ┌─ search ─ filters ─ rightSlot ─┐
 *
 *   `views` left-aligned (typically shadcn `<Tabs>` for view-switching).
 *   `search + filters + rightSlot` right-aligned. When `views` omitted, the
 *   right-side group left-aligns (no empty left slot taking flex space).
 *
 * Responsive: wraps onto multiple rows on narrow viewports.
 *
 * Slot positioning is enforced by the render tree; devs cannot accidentally
 * reorder by re-arranging props (mirrors PageHeader's enforcement).
 */

export interface TableToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  views?: React.ReactNode
  search?: React.ReactNode
  filters?: React.ReactNode
  rightSlot?: React.ReactNode
}

const TableToolbar = React.forwardRef<HTMLDivElement, TableToolbarProps>(
  function TableToolbar(
    { views, search, filters, rightSlot, className, ...rest },
    ref
  ) {
    const hasRightContent =
      Boolean(search) || Boolean(filters) || Boolean(rightSlot)
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-wrap items-center justify-between gap-3',
          className
        )}
        {...rest}
      >
        {views ? <div className="min-w-0">{views}</div> : null}
        {hasRightContent ? (
          <div
            className={cn(
              'flex flex-wrap items-center gap-3',
              !views && 'ml-0'
            )}
          >
            {/* Each slot's wrapper is itself a flex container so children
                returned as React Fragments (e.g. `DocumentFilterControls`
                renders <search/> + <Popover/>... as siblings) line up
                horizontally instead of stacking via default block layout. */}
            {search ? (
              <div className="flex flex-wrap items-center gap-2">{search}</div>
            ) : null}
            {filters ? (
              <div className="flex flex-wrap items-center gap-2">{filters}</div>
            ) : null}
            {rightSlot ? (
              <div className="flex flex-wrap items-center gap-2">
                {rightSlot}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }
)

export { TableToolbar }
