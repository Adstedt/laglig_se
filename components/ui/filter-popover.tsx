'use client'

/**
 * Story 6.19: Generic Filter Popover Component
 * Reusable Popover + Checkbox + Badge pattern for filter dropdowns.
 *
 * Story 22.1: option pills migrated from hand-rolled `bg-X-100/text-X-700`
 * spans to the tone-aware `<Badge tone variant>` primitive. Callers populate
 * `tone` / `variant` (typically by spreading `getStatusBadgeProps()` output);
 * options without a tone fall back to plain text.
 */

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { ChevronDown } from 'lucide-react'
import type { Tone, Variant } from '@/lib/ui/badge-tones'

export interface FilterOption {
  value: string
  label: string
  /**
   * Tone-aware Badge props. When set, the default renderer wraps the option
   * label in `<Badge tone variant>`. Populate via `getStatusBadgeProps()` /
   * `getPriorityBadgeProps()` from `@/lib/ui/badge-tones`.
   */
  tone?: Tone
  variant?: Variant
  /**
   * Free-form pass-through for callers that supply their own `renderOption`.
   * Typical use: hex colors from user-customized Task columns where the
   * Tone enum doesn't fit. Ignored by the default renderer.
   */
  color?: string
  icon?: ReactNode
}

export interface FilterPopoverProps {
  label: string
  options: FilterOption[]
  selected: string[]
  onToggle: (_value: string) => void
  /** Custom option rendering (overrides default badge/text rendering) */
  renderOption?: (_option: FilterOption) => ReactNode
}

export function FilterPopover({
  label,
  options,
  selected,
  onToggle,
  renderOption,
}: FilterPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8" aria-label={label}>
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1 max-h-60 overflow-auto">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
            >
              <Checkbox
                checked={selected.includes(option.value)}
                onCheckedChange={() => onToggle(option.value)}
              />
              {renderOption ? (
                renderOption(option)
              ) : option.tone ? (
                <Badge tone={option.tone} variant={option.variant}>
                  {option.label}
                </Badge>
              ) : (
                <span className="text-sm">{option.label}</span>
              )}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
