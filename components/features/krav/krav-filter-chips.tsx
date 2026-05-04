'use client'

/**
 * Story 20.3: Four-preset filter chip row for the /krav page.
 * Pure component — receives state via props, fires callbacks back.
 */

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

  return (
    <FilterChipGroup aria-label="Filtrera kravpunkter" className="items-center">
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
          className="h-9 text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          <X className="h-3 w-3" />
          Rensa ({adjustments})
        </Button>
      )}
    </FilterChipGroup>
  )
}
