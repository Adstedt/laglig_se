'use client'

/** Story 21.5 — inline bedömning select for ComplianceAuditItem rows. */

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { EfterlevnadsBedomning } from '@prisma/client'
import {
  BEDOMNING_OPTIONS,
  BEDOMNING_NULL_LABEL,
  BEDOMNING_NULL_COLOR,
  getBedomningOption,
} from '../bedomning-copy'

const NULL_SENTINEL = '__NULL__'

interface ItemBedomningSelectProps {
  value: EfterlevnadsBedomning | null
  onChange: (_next: EfterlevnadsBedomning | null) => Promise<void>
  disabled?: boolean
  readOnly?: boolean
  className?: string
}

export function ItemBedomningSelect({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  className,
}: ItemBedomningSelectProps) {
  const [isSaving, setIsSaving] = useState(false)
  const current = getBedomningOption(value)

  // Read-only: render a plain badge, not a select.
  if (readOnly) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          current ? current.color : BEDOMNING_NULL_COLOR,
          current?.strikethrough && 'line-through',
          className
        )}
      >
        {current ? current.label : BEDOMNING_NULL_LABEL}
      </span>
    )
  }

  const handleChange = async (raw: string) => {
    const next = raw === NULL_SENTINEL ? null : (raw as EfterlevnadsBedomning)
    if (next === value) return
    setIsSaving(true)
    try {
      await onChange(next)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Select
        value={value ?? NULL_SENTINEL}
        onValueChange={handleChange}
        disabled={disabled || isSaving}
      >
        <SelectTrigger
          className={cn(
            'h-8 w-[140px] text-xs font-medium',
            current ? current.color : BEDOMNING_NULL_COLOR,
            current?.strikethrough && 'line-through'
          )}
          aria-label="Bedömning"
        >
          {current ? current.label : BEDOMNING_NULL_LABEL}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NULL_SENTINEL}>{BEDOMNING_NULL_LABEL}</SelectItem>
          {BEDOMNING_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <span
                className={cn(
                  'inline-flex items-center rounded px-1.5 text-xs font-medium',
                  opt.color,
                  opt.strikethrough && 'line-through'
                )}
              >
                {opt.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isSaving ? (
        <Loader2
          className="h-3.5 w-3.5 animate-spin text-muted-foreground"
          aria-label="Sparar"
        />
      ) : null}
    </div>
  )
}
