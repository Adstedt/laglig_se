'use client'

/**
 * Story 4.12: Bulk Action Bar for Table View
 * Floating bar that appears when items are selected
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Loader2 } from 'lucide-react'
import type { LawListItemStatus, LawListItemPriority } from '@prisma/client'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS: { value: LawListItemStatus; label: string }[] = [
  { value: 'NOT_STARTED', label: 'Ej påbörjad' },
  { value: 'IN_PROGRESS', label: 'Pågår' },
  { value: 'BLOCKED', label: 'Blockerad' },
  { value: 'REVIEW', label: 'Granskning' },
  { value: 'COMPLIANT', label: 'Uppfylld' },
]

const PRIORITY_OPTIONS: { value: LawListItemPriority; label: string }[] = [
  { value: 'LOW', label: 'Låg' },
  { value: 'MEDIUM', label: 'Medel' },
  { value: 'HIGH', label: 'Hög' },
]

interface BulkActionBarProps {
  selectedCount: number
  onClearSelection: () => void
  onBulkUpdate: (updates: {
    status?: LawListItemStatus
    priority?: LawListItemPriority
  }) => Promise<void>
}

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onBulkUpdate,
}: BulkActionBarProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleStatusChange = async (status: LawListItemStatus) => {
    setIsLoading(true)
    try {
      await onBulkUpdate({ status })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePriorityChange = async (priority: LawListItemPriority) => {
    setIsLoading(true)
    try {
      await onBulkUpdate({ priority })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-3 rounded-lg border bg-muted/50',
        'animate-in slide-in-from-top-2 duration-200'
      )}
      role="toolbar"
      aria-label="Massåtgärder"
    >
      {/* Selection count */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {selectedCount} {selectedCount === 1 ? 'vald' : 'valda'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-7 px-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Rensa markering</span>
        </Button>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Status change */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Ändra status:</span>
        <Select onValueChange={handleStatusChange} disabled={isLoading}>
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Välj..." />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Priority change */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Ändra prioritet:</span>
        <Select onValueChange={handlePriorityChange} disabled={isLoading}>
          <SelectTrigger className="h-8 w-[120px]">
            <SelectValue placeholder="Välj..." />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}
