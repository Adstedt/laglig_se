import { Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ActivityItem } from './ActivityItem'

interface ActivityData {
  id: string
  user: {
    name: string | null
    avatar_url: string | null
  }
  action: string
  entity_type: string
  created_at: Date
}

interface RecentActivityFeedProps {
  activities: ActivityData[] | null
}

export function RecentActivityFeed({ activities }: RecentActivityFeedProps) {
  // Show placeholder if ActivityLog not yet implemented
  if (activities === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Senaste aktivitet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Activity className="h-8 w-8 mb-2" />
          <p className="text-center text-sm">Kommer snart</p>
        </CardContent>
      </Card>
    )
  }

  // Show empty state if no activities
  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Senaste aktivitet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Activity className="h-8 w-8 mb-2" />
          <p className="text-center font-medium">Ingen aktivitet ännu</p>
          <p className="text-center text-sm mt-1">
            Aktiviteter visas här när du och ditt team arbetar med efterlevnad
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Senaste aktivitet</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-1">
            {activities.map((activity) => (
              <ActivityItem
                key={activity.id}
                user={activity.user}
                action={activity.action}
                entityType={activity.entity_type}
                createdAt={activity.created_at}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
