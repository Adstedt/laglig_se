'use client'

/**
 * Story 6.3: History Tab
 * Audit log placeholder (fully implemented in Story 6.10)
 */

import { History } from 'lucide-react'

interface HistoryTabProps {
  listItemId: string
}

export function HistoryTab({ listItemId: _listItemId }: HistoryTabProps) {
  // Placeholder - will be fully implemented in Story 6.10
  return (
    <div className="space-y-4">
      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="rounded-full bg-muted p-3 mb-3">
          <History className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Ingen historik ännu</p>
        <p className="text-xs text-muted-foreground mt-1">
          Ändringshistorik aktiveras i en kommande version
        </p>
      </div>
    </div>
  )
}
