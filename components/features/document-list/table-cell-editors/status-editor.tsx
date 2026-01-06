'use client'

/**
 * Story 4.12: Inline Status Editor for Table View
 */

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import type { LawListItemStatus } from '@prisma/client'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS: { value: LawListItemStatus; label: string; color: string }[] = [
  { value: 'NOT_STARTED', label: 'Ej påbörjad', color: 'bg-gray-100 text-gray-700' },
  { value: 'IN_PROGRESS', label: 'Pågår', color: 'bg-blue-100 text-blue-700' },
  { value: 'BLOCKED', label: 'Blockerad', color: 'bg-red-100 text-red-700' },
  { value: 'REVIEW', label: 'Granskning', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'COMPLIANT', label: 'Uppfylld', color: 'bg-green-100 text-green-700' },
]

interface StatusEditorProps {
  value: LawListItemStatus
  onChange: (value: LawListItemStatus) => Promise<void>
}

export function StatusEditor({ value, onChange }: StatusEditorProps) {
  const [isLoading, setIsLoading] = useState(false)
  const currentOption = STATUS_OPTIONS.find((opt) => opt.value === value)

  const handleChange = async (newValue: LawListItemStatus) => {
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
          'h-8 w-[130px] border-0 bg-transparent hover:bg-muted/50 focus:ring-0',
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
        {STATUS_OPTIONS.map((option) => (
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
