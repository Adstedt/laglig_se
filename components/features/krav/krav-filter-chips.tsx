'use client'

/**
 * Story 20.3: Four-preset filter row for the /krav page.
 * Pure component — receives state via props, fires callbacks back.
 *
 * Story 28.2 polish: two presentations, switched by CONTAINER width
 * (the toolbar wrapper is a @container):
 *   - ≥50rem: the classic chip row (counts hide below 56rem).
 *   - <50rem (card regime — chat maximized / mobile): the presets collapse
 *     into a dropdown showing the active one, so filters + facets + search
 *     + sort share a single row.
 */

import { Check, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FilterChip, FilterChipGroup } from '@/components/ui/filter-chip'
import type { WorkspaceRequirementsFilter } from '@/app/actions/workspace-requirements'

interface ChipDescriptor {
  value: WorkspaceRequirementsFilter
  label: string
}

const CHIPS: readonly ChipDescriptor[] = [
  { value: 'all', label: 'Alla' },
  { value: 'gaps', label: 'Luckor' },
  { value: 'mine', label: 'Mina krav' },
  { value: 'needs_evidence', label: 'Saknar bevis' },
] as const

export interface KravFilterChipsProps {
  active: WorkspaceRequirementsFilter
  counts:
    | { all: number; gaps: number; mine: number; needs_evidence: number }
    | undefined
  hasSearch: boolean
  onChange: (_next: WorkspaceRequirementsFilter) => void
  onClear: () => void
}

export function KravFilterChips({
  active,
  counts,
  hasSearch,
  onChange,
  onClear,
}: KravFilterChipsProps) {
  // "Rensa (N)" — visible when the active state differs from the default
  // (filter=gaps, no search). N counts the distinct non-default adjustments.
  const filterDiffers = active !== 'gaps'
  const adjustments = (filterDiffers ? 1 : 0) + (hasSearch ? 1 : 0)
  const showClear = adjustments > 0

  const activeChip = CHIPS.find((chip) => chip.value === active) ?? CHIPS[1]!

  return (
    <>
      {/* Wide presentation: chip row */}
      <FilterChipGroup
        aria-label="Filtrera kravpunkter"
        className="hidden items-center @[50rem]:flex"
      >
        {CHIPS.map((chip) => {
          const isActive = chip.value === active
          return (
            <FilterChip
              key={chip.value}
              pressed={isActive}
              count={counts?.[chip.value]}
              onPressedChange={() => {
                // Clicking the already-active chip is a no-op (AC 13).
                if (!isActive) onChange(chip.value)
              }}
            >
              {chip.label}
            </FilterChip>
          )
        })}
        {showClear && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            aria-label={`Rensa filter (${adjustments})`}
            // Icon-only under container squeeze; label returns at 56rem+.
            className="h-9 text-xs text-muted-foreground hover:text-foreground gap-1 px-2 @[56rem]:px-3"
          >
            <X className="h-3 w-3" />
            <span className="hidden @[56rem]:inline">
              Rensa ({adjustments})
            </span>
          </Button>
        )}
      </FilterChipGroup>

      {/* Narrow presentation (card regime): preset dropdown */}
      <div className="flex items-center gap-1 @[50rem]:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-sm"
              aria-label="Filtrera kravpunkter"
            >
              {activeChip.label}
              {counts !== undefined && (
                <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {counts[activeChip.value]}
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {CHIPS.map((chip) => (
              <DropdownMenuItem
                key={chip.value}
                onClick={() => {
                  if (chip.value !== active) onChange(chip.value)
                }}
                className="gap-2"
              >
                <span className="flex-1">{chip.label}</span>
                {counts !== undefined && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {counts[chip.value]}
                  </span>
                )}
                {chip.value === active && <Check className="h-3.5 w-3.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {showClear && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            aria-label={`Rensa filter (${adjustments})`}
            className="h-9 px-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </>
  )
}
