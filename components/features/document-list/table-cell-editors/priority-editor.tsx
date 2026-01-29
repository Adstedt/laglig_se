'use client'

/**
 * Story 4.12: Inline Priority Editor for Table View
 * Story 6.16: Added tooltips for each priority option
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
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PriorityOption {
  value: string
  label: string
  color: string
  tooltip?: string
}

export const PRIORITY_OPTIONS: PriorityOption[] = [
  {
    value: 'LOW',
    label: 'Låg',
    color: 'bg-slate-100 text-slate-700',
    tooltip: 'Begränsad risk eller låg påverkan vid bristande efterlevnad',
  },
  {
    value: 'MEDIUM',
    label: 'Medel',
    color: 'bg-amber-100 text-amber-700',
    tooltip: 'Måttlig risk som kan påverka verksamheten eller kräva åtgärder',
  },
  {
    value: 'HIGH',
    label: 'Hög',
    color: 'bg-rose-100 text-rose-700',
    tooltip:
      'Hög risk med allvarliga konsekvenser, till exempel sanktioner, vite eller personansvar',
  },
]

interface PriorityEditorProps {
  value: string
  onChange: (_value: string) => Promise<void>
  /** Custom priority options (defaults to law list LOW/MEDIUM/HIGH) */
  options?: PriorityOption[]
}

export function PriorityEditor({
  value,
  onChange,
  options,
}: PriorityEditorProps) {
  const [isLoading, setIsLoading] = useState(false)
  const activeOptions = options ?? PRIORITY_OPTIONS
  const currentOption = activeOptions.find((opt) => opt.value === value)

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
        ) : (
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              currentOption?.color
            )}
          >
            {currentOption?.label}
          </span>
        )}
      </SelectTrigger>
      <SelectContent>
        <TooltipProvider delayDuration={300}>
          {activeOptions.map((option) => (
            <Tooltip key={option.value}>
              <TooltipTrigger asChild>
                <SelectItem value={option.value}>
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      option.color
                    )}
                  >
                    {option.label}
                  </span>
                </SelectItem>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[250px]">
                <p>{option.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </SelectContent>
    </Select>
  )
}
