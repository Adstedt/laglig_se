'use client'

/**
 * Story 6.3: Tasks Tab
 * Task list placeholder (fully implemented in Story 6.6)
 */

import { ListTodo, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TasksTabProps {
  listItemId: string
}

export function TasksTab({ listItemId: _listItemId }: TasksTabProps) {
  // Placeholder - will be fully implemented in Story 6.6
  return (
    <div className="space-y-4">
      {/* Create task button */}
      <Button variant="outline" size="sm" disabled className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Skapa uppgift
      </Button>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="rounded-full bg-muted p-3 mb-3">
          <ListTodo className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Inga uppgifter ännu</p>
        <p className="text-xs text-muted-foreground mt-1">
          Uppgifter aktiveras i en kommande version
        </p>
      </div>
    </div>
  )
}
