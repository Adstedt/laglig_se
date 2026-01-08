'use client'

/**
 * Story 6.3: Comments Tab
 * Threaded comments placeholder (fully implemented in Story 6.9)
 */

import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface CommentsTabProps {
  listItemId: string
}

export function CommentsTab({ listItemId: _listItemId }: CommentsTabProps) {
  // Placeholder - will be fully implemented in Story 6.9
  return (
    <div className="space-y-4">
      {/* Comment input */}
      <div className="space-y-2">
        <Textarea
          placeholder="Skriv en kommentar..."
          className="min-h-[80px] resize-y"
          disabled
        />
        <div className="flex justify-end">
          <Button size="sm" disabled>
            Skicka
          </Button>
        </div>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="rounded-full bg-muted p-3 mb-3">
          <MessageSquare className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Inga kommentarer ännu</p>
        <p className="text-xs text-muted-foreground mt-1">
          Kommentarer aktiveras i en kommande version
        </p>
      </div>
    </div>
  )
}
