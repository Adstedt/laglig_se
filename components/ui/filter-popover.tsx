'use client'

/**
 * Story 6.19: Generic Filter Popover Component
 * Reusable Popover + Checkbox + Badge pattern for filter dropdowns
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
import { cn } from '@/lib/utils'

export interface FilterOption {
  value: string
  label: string
  color?: string
  icon?: ReactNode
  strikethrough?: boolean
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
              ) : option.color ? (
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                    option.color,
                    option.strikethrough && 'line-through'
                  )}
                >
                  {option.label}
                </span>
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
