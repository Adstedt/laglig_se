'use client'

/**
 * Law List Toolbar — single-row toolbar for the document list page.
 * Layout: [List selector] [Search] [Filter toggle] [View menu] [Settings]
 *
 * Note: The primary "Lägg till dokument" CTA used to live here but was
 * lifted to the page header (LawListPrimaryAction) to align with the
 * Tasks / Styrdokument pattern.
 */

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LawListToolbarProps {
  tabsSlot?: React.ReactNode
  listSwitcher: React.ReactNode
  search: React.ReactNode
  filterCount: number
  isFilterBarOpen: boolean
  onToggleFilterBar: () => void
  viewMenu: React.ReactNode
  settingsAction: React.ReactNode
  itemCount?: React.ReactNode
}

export function LawListToolbar({
  tabsSlot,
  listSwitcher,
  search,
  filterCount,
  isFilterBarOpen,
  onToggleFilterBar,
  viewMenu,
  settingsAction,
  itemCount,
}: LawListToolbarProps) {
  return (
    // Container-width-responsive (Epic 28 follow-up): the toolbar reacts to
    // its CONTAINER, not the viewport, so it also compacts when the AI chat
    // sidebar squeezes the page. Wide (≥64rem): one row with full labels.
    // Mid: one row, icon-only triggers. Narrow: two rows — [tabs | list]
    // over [search | filter | view | settings].
    <div className="@container border-b border-border/60">
      <div className="flex items-center gap-2 py-2 flex-wrap">
        <div className="flex min-w-0 items-center gap-2">
          {tabsSlot && (
            <>
              <div className="shrink-0">{tabsSlot}</div>
              <div
                className="h-6 w-px bg-border shrink-0 mx-1"
                aria-hidden="true"
              />
            </>
          )}

          {/* List selector */}
          <div className="shrink-0">{listSwitcher}</div>
        </div>

        <div className="flex min-w-[280px] flex-1 items-center gap-2">
          {/* Search (grows to fill) */}
          <div className="min-w-[120px] flex-1 @[64rem]:max-w-[360px]">
            {search}
          </div>

          {/* Filter toggle */}
          <Button
            variant={isFilterBarOpen ? 'secondary' : 'outline'}
            size="sm"
            onClick={onToggleFilterBar}
            aria-label="Filter"
            title="Filter"
            className={cn(
              'gap-1.5 shrink-0',
              isFilterBarOpen && 'bg-secondary'
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden @[64rem]:inline">Filter</span>
            {filterCount > 0 && (
              <Badge
                variant="default"
                className="h-4 min-w-4 px-1 text-[10px] leading-none rounded-full"
              >
                {filterCount}
              </Badge>
            )}
          </Button>

          {/* View menu */}
          <div className="shrink-0">{viewMenu}</div>

          {/* Settings */}
          <div className="shrink-0">{settingsAction}</div>
        </div>
      </div>

      {/* Item count (subtle, below toolbar row) */}
      {itemCount && <div className="pb-1.5">{itemCount}</div>}
    </div>
  )
}
