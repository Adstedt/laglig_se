'use client'

/**
 * Story 20.3: Four-preset filter chip row for the /krav page.
 * Pure component — receives state via props, fires callbacks back.
 * Visual tokens lifted verbatim from `content-type-filter.tsx` so the
 * chip family is consistent with the document-list surface.
 */

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
    <div className="flex flex-wrap items-center gap-2">
      {CHIPS.map((chip) => {
        const isActive = chip.value === active
        const count = counts?.[chip.value]
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => {
              // Clicking the already-active chip is a no-op (AC 13).
              if (!isActive) onChange(chip.value)
            }}
            className={cn(
              'px-3 py-1.5 text-sm rounded-full border transition-colors inline-flex items-center gap-2',
              isActive
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-muted border-border text-foreground'
            )}
          >
            <span>{chip.label}</span>
            {count !== undefined && (
              <span
                className={cn(
                  'inline-flex items-center justify-center rounded-full text-[10px] font-medium px-1.5 min-w-[1.25rem] h-5',
                  isActive
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
                aria-label={`${count} kravpunkter`}
              >
                {count}
              </span>
            )}
          </button>
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
    </div>
  )
}
