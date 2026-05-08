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
    <div className="border-b border-border/60">
      <div className="flex items-center gap-2 py-2 flex-wrap">
        {tabsSlot && (
          <>
            <div className="shrink-0">{tabsSlot}</div>
            <div
              className="h-6 w-px bg-border shrink-0 mx-1"
              aria-hidden="true"
            />
          </>
        )}

        {/* Left: List selector */}
        <div className="shrink-0">{listSwitcher}</div>

        {/* Center: Search (grows to fill) */}
        <div className="flex-1 min-w-[200px] max-w-[360px]">{search}</div>

        {/* Filter toggle */}
        <Button
          variant={isFilterBarOpen ? 'secondary' : 'outline'}
          size="sm"
          onClick={onToggleFilterBar}
          className={cn('gap-1.5 shrink-0', isFilterBarOpen && 'bg-secondary')}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filter</span>
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

      {/* Item count (subtle, below toolbar row) */}
      {itemCount && <div className="pb-1.5">{itemCount}</div>}
    </div>
  )
}
