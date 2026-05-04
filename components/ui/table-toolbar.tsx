import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Story 22.3 — `TableToolbar` primitive.
 *
 * Two render modes:
 *
 * 1. Single-row (default — when `tabs` is omitted):
 *      ┌─ views ─┐  ┌─ search ─ filters ─ rightSlot ─┐
 *
 *    `views` left-aligned (typically shadcn `<Tabs>` for view-switching or a
 *    `<FilterChipGroup>`). `search + filters + rightSlot` right-aligned. When
 *    `views` omitted, the right-side group left-aligns.
 *
 * 2. Two-row (when `tabs` is provided — Wave 3):
 *      ┌──────────────── tabs ────────────────┐
 *      ┌─ search ─ filters ─┐    ┌ rightSlot ─┐
 *
 *    `tabs` is a full-width Row 1. The remaining slots render on Row 2 with
 *    the filter cluster (`search + filters`) left-aligned and `rightSlot`
 *    pinned right via `justify-between` — so an action like a column-settings
 *    button stays grouped with the filter row when it wraps.
 *
 *    `tabs` and `views` are mutually exclusive.
 *
 * Responsive: wraps onto multiple rows on narrow viewports.
 */

export interface TableToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional Row-1 above the main toolbar. Mutually exclusive with `views`. */
  tabs?: React.ReactNode
  views?: React.ReactNode
  search?: React.ReactNode
  filters?: React.ReactNode
  rightSlot?: React.ReactNode
}

const TableToolbar = React.forwardRef<HTMLDivElement, TableToolbarProps>(
  function TableToolbar(
    { tabs, views, search, filters, rightSlot, className, ...rest },
    ref
  ) {
    const hasMainRowContent =
      Boolean(search) || Boolean(filters) || Boolean(rightSlot)

    // Two-row mode — tabs row above, filter row below.
    if (tabs) {
      return (
        <div
          ref={ref}
          className={cn('flex flex-col gap-3', className)}
          {...rest}
        >
          <div className="min-w-0">{tabs}</div>
          {hasMainRowContent ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {search ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {search}
                  </div>
                ) : null}
                {filters ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {filters}
                  </div>
                ) : null}
              </div>
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

    // Single-row mode (existing behavior).
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
        {hasMainRowContent ? (
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
