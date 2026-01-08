'use client'

/**
 * Story 6.3: Evidence Tab
 * Evidence gallery placeholder (fully implemented in Story 6.8)
 */

import { FileText, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EvidenceTabProps {
  listItemId: string
}

export function EvidenceTab({ listItemId: _listItemId }: EvidenceTabProps) {
  // Placeholder - will be fully implemented in Story 6.8
  return (
    <div className="space-y-4">
      {/* Upload button */}
      <Button variant="outline" size="sm" disabled className="w-full">
        <Upload className="h-4 w-4 mr-2" />
        Ladda upp bevis
      </Button>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="rounded-full bg-muted p-3 mb-3">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Inga bevis ännu</p>
        <p className="text-xs text-muted-foreground mt-1">
          Bevishantering aktiveras i en kommande version
        </p>
      </div>
    </div>
  )
}
