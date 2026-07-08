'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Story 22.2 — `FilterChip` primitive.
 *
 * In-view filter toggles. Renders as `<button type="button" aria-pressed>`,
 * NOT `role="tab"`. Reserve shadcn `<Tabs>` for view-switching only — the
 * semantic split is the whole point of this primitive.
 *
 * Group chips inside `<FilterChipGroup>` for screen-reader scoping (the
 * `aria-label` on the group wrapper tells the user what's being filtered).
 *
 * Class strings sourced from `_prototypes/ui-alignment-prototype.html` §3.
 */

const filterChipVariants = cva(
  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      pressed: {
        true: 'border-primary bg-primary text-primary-foreground',
        false: 'border-border bg-background text-foreground hover:bg-muted',
      },
    },
    defaultVariants: {
      pressed: false,
    },
  }
)

export interface FilterChipProps
  extends Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      'onChange' | 'children'
    >,
    VariantProps<typeof filterChipVariants> {
  /** Required toggle state — parent owns it. */
  pressed: boolean
  onPressedChange?: (_pressed: boolean) => void
  /** Inline count badge (renders only when defined). */
  count?: number | undefined
  /** Optional leading icon slot (rendered before the label). */
  icon?: React.ReactNode
  children: React.ReactNode
}

const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(
  function FilterChip(
    {
      pressed,
      onPressedChange,
      count,
      icon,
      children,
      className,
      onClick,
      disabled,
      ...rest
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={pressed}
        disabled={disabled}
        onClick={(event) => {
          onClick?.(event)
          if (event.defaultPrevented) return
          onPressedChange?.(!pressed)
        }}
        className={cn(filterChipVariants({ pressed }), className)}
        {...rest}
      >
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span>{children}</span>
        {count !== undefined ? (
          <span
            data-chip-count=""
            className={cn(
              'inline-flex items-center justify-center rounded-full text-[10px] font-medium px-1.5 min-w-[1.25rem] h-5 tabular-nums',
              pressed
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
            aria-hidden="true"
          >
            {count}
          </span>
        ) : null}
      </button>
    )
  }
)

export interface FilterChipGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'aria-label'> {
  /**
   * REQUIRED. Describes what's being filtered (e.g.,
   * "Filtrera kontroller efter status"). Read by screen readers when
   * navigating into the group.
   */
  'aria-label': string
}

/**
 * Wrapper for a row of `<FilterChip>` toggles. Renders `<div role="group">`
 * — explicitly NOT `role="tablist"` (the whole point of Story 22.2's
 * semantic split between filters and view tabs).
 */
const FilterChipGroup = React.forwardRef<HTMLDivElement, FilterChipGroupProps>(
  function FilterChipGroup({ className, children, ...rest }, ref) {
    return (
      <div
        ref={ref}
        role="group"
        className={cn('flex flex-wrap gap-2', className)}
        {...rest}
      >
        {children}
      </div>
    )
  }
)

export { FilterChip, FilterChipGroup, filterChipVariants }
