'use client'

/**
 * Story 6.2: Inline Compliance Status Editor for Table View
 * Story 6.16: Tooltips for each status option
 * Story 22.1: Pill rendering migrated from hand-rolled `bg-X-100` spans to
 *   the tone-aware `<Badge>` primitive backed by `lib/ui/badge-tones.ts`.
 *   The exported `COMPLIANCE_STATUS_OPTIONS` is the canonical
 *   {value, label, tooltip} catalog consumed across the workspace; tone /
 *   variant are derived per-render via `getStatusBadgeProps`.
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
import type { ComplianceStatus } from '@prisma/client'
import { cn } from '@/lib/utils'
import { getStatusBadgeProps } from '@/lib/ui/badge-tones'

export const COMPLIANCE_STATUS_OPTIONS: {
  value: ComplianceStatus
  label: string
  tooltip: string
}[] = [
  {
    value: 'EJ_PABORJAD',
    label: 'Ej påbörjad',
    tooltip: 'Inga rutiner eller dokumentation finns på plats',
  },
  {
    value: 'PAGAENDE',
    label: 'Delvis uppfylld',
    tooltip: 'Vissa krav är uppfyllda, men åtgärder eller underlag saknas',
  },
  {
    value: 'UPPFYLLD',
    label: 'Uppfylld',
    tooltip: 'Kraven bedöms vara uppfyllda i nuläget',
  },
  {
    value: 'EJ_UPPFYLLD',
    label: 'Ej uppfylld',
    tooltip: 'Kraven är kända men inte uppfyllda',
  },
  {
    value: 'EJ_TILLAMPLIG',
    label: 'Ej tillämplig',
    tooltip: 'Kravet bedöms inte vara tillämpligt för verksamheten',
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
  const currentProps = getStatusBadgeProps('compliance-status', value)

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
          'h-8 w-auto border-0 bg-transparent hover:bg-muted/50 focus:ring-0',
          isLoading && 'opacity-50',
          className
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Badge
            tone={currentProps.tone}
            variant={currentProps.variant}
            className="whitespace-nowrap"
          >
            {currentProps.label}
          </Badge>
        )}
      </SelectTrigger>
      <SelectContent>
        <TooltipProvider delayDuration={300}>
          {COMPLIANCE_STATUS_OPTIONS.map((option) => {
            const props = getStatusBadgeProps('compliance-status', option.value)
            return (
              <Tooltip key={option.value}>
                <TooltipTrigger asChild>
                  <SelectItem value={option.value}>
                    <Badge tone={props.tone} variant={props.variant}>
                      {props.label}
                    </Badge>
                  </SelectItem>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[220px]">
                  <p>{option.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </TooltipProvider>
      </SelectContent>
    </Select>
  )
}

/**
 * Helper: returns `{ value, label }` for a compliance status. Color comes
 * from the badge-tones map at render time — call `getStatusBadgeProps` if
 * you need tone / variant.
 */
export function getComplianceStatusDisplay(status: ComplianceStatus) {
  return (
    COMPLIANCE_STATUS_OPTIONS.find((opt) => opt.value === status) ?? {
      value: status,
      label: status,
    }
  )
}
