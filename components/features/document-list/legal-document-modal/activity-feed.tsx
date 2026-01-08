'use client'

/**
 * Story 6.3: Activity Feed
 * Combined feed of all activity types (placeholder for Story 6.10)
 */

import { MessageSquare, CheckCircle, FileText, History } from 'lucide-react'

interface ActivityFeedProps {
  listItemId: string
}

export function ActivityFeed({ listItemId: _listItemId }: ActivityFeedProps) {
  // Placeholder - will be fully implemented in Story 6.10
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="rounded-full bg-muted p-3 mb-3">
          <History className="h-6 w-6 text-muted-foreground/80" />
        </div>
        <p className="text-sm text-foreground/70">Ingen aktivitet ännu</p>
        <p className="text-xs text-foreground/60 mt-1">
          Kommentarer, uppgifter och bevis visas här
        </p>
      </div>

      {/* Example activity items (placeholder) */}
      <div className="hidden space-y-3">
        <ActivityItem
          icon={<MessageSquare className="h-4 w-4" />}
          type="comment"
          text="Kommentar tillagd"
          time="2 timmar sedan"
        />
        <ActivityItem
          icon={<CheckCircle className="h-4 w-4" />}
          type="task"
          text="Uppgift slutförd"
          time="igår"
        />
        <ActivityItem
          icon={<FileText className="h-4 w-4" />}
          type="evidence"
          text="Bevis uppladdat"
          time="för 3 dagar sedan"
        />
      </div>
    </div>
  )
}

function ActivityItem({
  icon,
  type: _type,
  text,
  time,
}: {
  icon: React.ReactNode
  type: string
  text: string
  time: string
}) {
  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <div className="rounded-full bg-muted p-2 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{text}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  )
}
