'use client'

/**
 * Story 8.1 Task 5: Priority Filter
 * Client-side filter using URL search params for change priority.
 */

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { ChangePriority } from '@/lib/changes/change-utils'

const FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'Alla' },
  { value: 'HIGH', label: 'Hög' },
  { value: 'MEDIUM', label: 'Medel' },
  { value: 'LOW', label: 'Låg' },
]

interface PriorityFilterProps {
  value?: ChangePriority | 'ALL'
}

export function PriorityFilter({ value }: PriorityFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentValue = value ?? searchParams.get('priority') ?? 'ALL'

  const handleChange = useCallback(
    (newValue: string) => {
      if (!newValue) return // ToggleGroup can fire empty on deselect
      const params = new URLSearchParams(searchParams.toString())
      if (newValue === 'ALL') {
        params.delete('priority')
      } else {
        params.set('priority', newValue)
      }
      // Preserve existing params (tab, document, etc.)
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [searchParams, router]
  )

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Visa:</span>
      <ToggleGroup
        type="single"
        value={currentValue}
        onValueChange={handleChange}
        variant="outline"
        size="sm"
      >
        {FILTER_OPTIONS.map((opt) => (
          <ToggleGroupItem
            key={opt.value}
            value={opt.value}
            aria-label={`Filtrera på ${opt.label} prioritet`}
          >
            {opt.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
