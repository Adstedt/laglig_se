'use client'

/**
 * Story 4.12: Inline Priority Editor for Table View
 */

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import type { LawListItemPriority } from '@prisma/client'
import { cn } from '@/lib/utils'

const PRIORITY_OPTIONS: { value: LawListItemPriority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Låg', color: 'bg-slate-100 text-slate-700' },
  { value: 'MEDIUM', label: 'Medel', color: 'bg-amber-100 text-amber-700' },
  { value: 'HIGH', label: 'Hög', color: 'bg-rose-100 text-rose-700' },
]

interface PriorityEditorProps {
  value: LawListItemPriority
  onChange: (value: LawListItemPriority) => Promise<void>
}

export function PriorityEditor({ value, onChange }: PriorityEditorProps) {
  const [isLoading, setIsLoading] = useState(false)
  const currentOption = PRIORITY_OPTIONS.find((opt) => opt.value === value)

  const handleChange = async (newValue: LawListItemPriority) => {
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
        {PRIORITY_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                option.color
              )}
            >
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
