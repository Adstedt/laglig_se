'use client'

/**
 * Story 4.13 Task 11: Group Filter Chip
 * Shows active group filter with ability to clear
 */

import { X, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface GroupFilterChipProps {
  groupName: string
  onClear: () => void
}

export function GroupFilterChip({ groupName, onClear }: GroupFilterChipProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5">
      <Filter className="h-3.5 w-3.5 text-primary" />
      <span className="text-sm text-muted-foreground">Visar:</span>
      <Badge variant="secondary" className="font-medium">
        {groupName}
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0 hover:bg-destructive/10 hover:text-destructive"
        onClick={onClear}
        title="Rensa filter"
      >
        <X className="h-3.5 w-3.5" />
        <span className="sr-only">Rensa gruppfilter</span>
      </Button>
    </div>
  )
}
