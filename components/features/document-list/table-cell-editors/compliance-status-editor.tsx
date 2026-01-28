'use client'

/**
 * Story 6.2: Inline Compliance Status Editor for Table View
 * Story 6.16: Added tooltips for each status option
 * Swedish labels with color-coded badges
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
import type { ComplianceStatus } from '@prisma/client'
import { cn } from '@/lib/utils'

export const COMPLIANCE_STATUS_OPTIONS: {
  value: ComplianceStatus
  label: string
  color: string
  tooltip: string
  strikethrough?: boolean
}[] = [
  {
    value: 'EJ_PABORJAD',
    label: 'Ej påbörjad',
    color: 'bg-gray-100 text-gray-700',
    tooltip: 'Inga rutiner eller dokumentation finns på plats',
  },
  {
    value: 'PAGAENDE',
    label: 'Delvis uppfylld',
    color: 'bg-blue-100 text-blue-700',
    tooltip: 'Vissa krav är uppfyllda, men åtgärder eller underlag saknas',
  },
  {
    value: 'UPPFYLLD',
    label: 'Uppfylld',
    color: 'bg-green-100 text-green-700',
    tooltip: 'Kraven bedöms vara uppfyllda i nuläget',
  },
  {
    value: 'EJ_UPPFYLLD',
    label: 'Ej uppfylld',
    color: 'bg-red-100 text-red-700',
    tooltip: 'Kraven är kända men inte uppfyllda',
  },
  {
    value: 'EJ_TILLAMPLIG',
    label: 'Ej tillämplig',
    color: 'bg-gray-100 text-gray-500',
    tooltip: 'Kravet bedöms inte vara tillämpligt för verksamheten',
    strikethrough: true,
  },
]

interface ComplianceStatusEditorProps {
  value: ComplianceStatus
  onChange: (_value: ComplianceStatus) => Promise<void>
  className?: string
}

export function ComplianceStatusEditor({
  value,
  onChange,
  className,
}: ComplianceStatusEditorProps) {
  const [isLoading, setIsLoading] = useState(false)
  const currentOption = COMPLIANCE_STATUS_OPTIONS.find(
    (opt) => opt.value === value
  )

  const handleChange = async (newValue: ComplianceStatus) => {
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
          'h-8 w-[140px] border-0 bg-transparent hover:bg-muted/50 focus:ring-0',
          isLoading && 'opacity-50',
          className
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              currentOption?.color,
              currentOption?.strikethrough && 'line-through'
            )}
          >
            {currentOption?.label}
          </span>
        )}
      </SelectTrigger>
      <SelectContent>
        <TooltipProvider delayDuration={300}>
          {COMPLIANCE_STATUS_OPTIONS.map((option) => (
            <Tooltip key={option.value}>
              <TooltipTrigger asChild>
                <SelectItem value={option.value}>
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      option.color,
                      option.strikethrough && 'line-through'
                    )}
                  >
                    {option.label}
                  </span>
                </SelectItem>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[220px]">
                <p>{option.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </SelectContent>
    </Select>
  )
}

/**
 * Helper function to get label and color for a compliance status
 */
export function getComplianceStatusDisplay(status: ComplianceStatus) {
  return (
    COMPLIANCE_STATUS_OPTIONS.find((opt) => opt.value === status) ?? {
      value: status,
      label: status,
      color: 'bg-gray-100 text-gray-700',
    }
  )
}
