'use client'

/**
 * Story 4.12: Inline Priority Editor for Table View
 * Story 6.16: Tooltips for each priority option
 * Story 22.1: Pill rendering migrated to tone-aware `<Badge>`. The single
 *   `PriorityEditor` is now consumed by both Laglistor (LOW/MEDIUM/HIGH)
 *   and Uppgifter (LOW/MEDIUM/HIGH/CRITICAL) — Uppgifter passes its 4-value
 *   option list via the `options` prop. Closes the audit-found drift where
 *   "Hög" rendered rose on Laglistor and orange on Uppgifter.
 */

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPriorityBadgeProps, type PriorityValue } from '@/lib/ui/badge-tones'

export interface PriorityOption {
  value: string
  label: string
  tooltip?: string
}

export const PRIORITY_OPTIONS: PriorityOption[] = [
  {
    value: 'LOW',
    label: 'Låg',
    tooltip: 'Begränsad risk eller låg påverkan vid bristande efterlevnad',
  },
  {
    value: 'MEDIUM',
    label: 'Medel',
    tooltip: 'Måttlig risk som kan påverka verksamheten eller kräva åtgärder',
  },
  {
    value: 'HIGH',
    label: 'Hög',
    tooltip:
      'Hög risk med allvarliga konsekvenser, till exempel sanktioner, vite eller personansvar',
  },
]

interface PriorityEditorProps {
  value: string
  onChange: (_value: string) => Promise<void>
  /**
   * Custom priority options. Defaults to the 3-value Laglistor list above.
   * Pass a 4-value list (incl. CRITICAL) for Uppgifter.
   */
  options?: PriorityOption[]
}

export function PriorityEditor({
  value,
  onChange,
  options,
}: PriorityEditorProps) {
  const [isLoading, setIsLoading] = useState(false)
  const activeOptions = options ?? PRIORITY_OPTIONS
  const currentBadge = isPriorityValue(value)
    ? getPriorityBadgeProps(value)
    : null

  const handleChange = async (newValue: string) => {
    if (newValue === value) return
    setIsLoading(true)
    try {
      await onChange(newValue)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={isLoading}>
      <SelectTrigger
        className={cn(
          'h-8 w-[100px] border-0 bg-transparent hover:bg-muted/50 focus:ring-0',
          isLoading && 'opacity-50'
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : currentBadge ? (
          <Badge tone={currentBadge.tone} variant={currentBadge.variant}>
            {currentBadge.label}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </SelectTrigger>
      <SelectContent>
        <TooltipProvider delayDuration={300}>
          {activeOptions.map((option) => {
            const props = isPriorityValue(option.value)
              ? getPriorityBadgeProps(option.value)
              : null
            return (
              <Tooltip key={option.value}>
                <TooltipTrigger asChild>
                  <SelectItem value={option.value}>
                    {props ? (
                      <Badge tone={props.tone} variant={props.variant}>
                        {props.label}
                      </Badge>
                    ) : (
                      <span className="text-sm">{option.label}</span>
                    )}
                  </SelectItem>
                </TooltipTrigger>
                {option.tooltip ? (
                  <TooltipContent side="right" className="max-w-[250px]">
                    <p>{option.tooltip}</p>
                  </TooltipContent>
                ) : null}
              </Tooltip>
            )
          })}
        </TooltipProvider>
      </SelectContent>
    </Select>
  )
}

function isPriorityValue(value: string): value is PriorityValue {
  return (
    value === 'CRITICAL' ||
    value === 'HIGH' ||
    value === 'MEDIUM' ||
    value === 'LOW'
  )
}
