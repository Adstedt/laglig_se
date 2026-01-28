'use client'

/**
 * Unified Toolbar Component
 * Spec: docs/components/unified-toolbar-spec.md
 *
 * A consistent toolbar layout component that enforces the zone-based
 * positioning pattern across all pages.
 *
 * Zone A (Left):   Context - Selectors, breadcrumbs, tabs
 * Zone B (Left):   Filters - Search, chips, dropdowns
 * Zone C (Right):  View Controls - Toggle, sort, columns
 * Zone D (Right):  Actions - Primary CTA, secondary actions, settings
 */

import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

type ToolbarLayout = 'simple' | 'standard' | 'complex'

interface UnifiedToolbarProps {
  /** Layout type determines row structure */
  layout?: ToolbarLayout

  // Zone A: Context (far left)
  /** Primary context selector (e.g., list dropdown, workspace selector) */
  contextSelector?: React.ReactNode
  /** Tab navigation (alternative to contextSelector) */
  tabs?: React.ReactNode

  // Zone B: Filters (left-center)
  /** Search input */
  search?: React.ReactNode
  /** Filter chips/pills for quick filtering */
  filterChips?: React.ReactNode
  /** Filter dropdowns for advanced filtering */
  filterDropdowns?: React.ReactNode
  /** Active filter indicators (e.g., group filter chip) */
  activeFilters?: React.ReactNode

  // Zone C: View Controls (right-center)
  /** View mode toggle (grid/table/etc) */
  viewToggle?: React.ReactNode
  /** Sort control */
  sortControl?: React.ReactNode
  /** Column visibility settings */
  columnSettings?: React.ReactNode
  /** Expand/collapse controls for grouped views */
  expandCollapseControls?: React.ReactNode

  // Zone D: Actions (far right)
  /** Primary action button - ALWAYS rightmost */
  primaryAction?: React.ReactNode
  /** Secondary action buttons */
  secondaryActions?: React.ReactNode
  /** Settings/gear button */
  settingsAction?: React.ReactNode

  // Additional options
  /** Additional CSS classes for the container */
  className?: string
  /** Content to show between rows (e.g., item count) */
  betweenRows?: React.ReactNode
}

// ============================================================================
// Component
// ============================================================================

export function UnifiedToolbar({
  layout = 'standard',
  // Zone A
  contextSelector,
  tabs,
  // Zone B
  search,
  filterChips,
  filterDropdowns,
  activeFilters,
  // Zone C
  viewToggle,
  sortControl,
  columnSettings,
  expandCollapseControls,
  // Zone D
  primaryAction,
  secondaryActions,
  settingsAction,
  // Options
  className,
  betweenRows,
}: UnifiedToolbarProps) {
  // Determine if we have content for Zone B (used for complex layout second row)
  const hasZoneB = search || filterChips || filterDropdowns || activeFilters

  // Simple layout: Single row with context + actions
  if (layout === 'simple') {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Context + Search */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {contextSelector}
            {tabs}
            {search}
          </div>

          {/* Right: View + Actions */}
          <div className="flex items-center gap-2">
            {viewToggle}
            {sortControl}
            {secondaryActions}
            {settingsAction}
            {primaryAction}
          </div>
        </div>
        {betweenRows}
      </div>
    )
  }

  // Standard layout: Single row with all zones
  if (layout === 'standard') {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left side: Context + Tabs + Filters */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {contextSelector}
            {tabs}
            {filterChips}
            {activeFilters}
            {search}
            {filterDropdowns}
          </div>

          {/* Right side: View Controls + Actions */}
          <div className="flex items-center gap-2">
            {viewToggle}
            {sortControl}
            {columnSettings}
            {expandCollapseControls}
            {secondaryActions}
            {settingsAction}
            {primaryAction}
          </div>
        </div>
        {betweenRows}
      </div>
    )
  }

  // Complex layout: Two rows
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Row 1: Context + View Controls + Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Context selector */}
        <div className="flex items-center gap-2">{contextSelector}</div>

        {/* Right: View controls + Actions */}
        <div className="flex items-center gap-2">
          {viewToggle}
          {secondaryActions}
          {primaryAction}
          {settingsAction}
        </div>
      </div>

      {/* Row 2: Filters + Column Settings */}
      {(hasZoneB || columnSettings || expandCollapseControls) && (
        <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
          {/* Left: Filter chips + Active filters */}
          <div className="flex flex-wrap items-center gap-2">
            {filterChips}
            {activeFilters}
          </div>

          {/* Right: Search + Dropdowns + Column settings */}
          <div className="flex flex-wrap items-center gap-2">
            {search}
            {filterDropdowns}
            {columnSettings}
            {expandCollapseControls}
          </div>
        </div>
      )}

      {betweenRows}
    </div>
  )
}

// ============================================================================
// Sub-components for common patterns
// ============================================================================

/** Wrapper for toolbar zone with consistent styling */
export function ToolbarZone({
  children,
  className,
  align = 'left',
}: {
  children: React.ReactNode
  className?: string
  align?: 'left' | 'right'
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2',
        align === 'right' && 'justify-end',
        className
      )}
    >
      {children}
    </div>
  )
}

/** Divider between toolbar sections */
export function ToolbarDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn('hidden sm:block h-6 w-px bg-border mx-1', className)}
      role="separator"
    />
  )
}

/** Item count display */
export function ToolbarItemCount({
  showing,
  total,
  label = 'dokument',
  className,
}: {
  showing: number
  total: number
  label?: string
  className?: string
}) {
  if (showing === total) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        {total} {label}
      </p>
    )
  }

  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      Visar {showing} av {total} {label}
    </p>
  )
}
