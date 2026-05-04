'use client'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Calendar, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DueDatePreset } from './task-filters-toolbar'

// ============================================================================
// Preset Options
// ============================================================================

const DUE_DATE_PRESETS: {
  value: NonNullable<DueDatePreset>
  label: string
  color?: string
}[] = [
  { value: 'overdue', label: 'Försenade', color: 'text-destructive' },
  { value: 'today', label: 'Idag' },
  { value: 'thisWeek', label: 'Denna vecka' },
  { value: 'thisMonth', label: 'Denna m\u00e5nad' },
  { value: 'noDueDate', label: 'Inget datum' },
]

// ============================================================================
// Component
// ============================================================================

interface DueDateFilterPopoverProps {
  value: DueDatePreset
  onChange: (_preset: DueDatePreset) => void
}

export function DueDateFilterPopover({
  value,
  onChange,
}: DueDateFilterPopoverProps) {
  const activePreset = DUE_DATE_PRESETS.find((p) => p.value === value)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Förfallodatum">
          <Calendar className="mr-1 h-4 w-4" />
          Förfallodatum
          {activePreset && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              1
            </Badge>
          )}
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-1">
          {DUE_DATE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted cursor-pointer',
                value === preset.value && 'bg-muted font-medium'
              )}
              onClick={() =>
                onChange(value === preset.value ? null : preset.value)
              }
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  value === preset.value
                    ? 'bg-primary'
                    : 'bg-transparent border border-muted-foreground/30'
                )}
              />
              <span className={preset.color}>{preset.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
