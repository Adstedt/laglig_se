'use client'

/**
 * Story 6.6: History Tab
 * Task change log displaying all changes
 */

import { useEffect, useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { History, ArrowRight } from 'lucide-react'
import { getTaskActivity, type TaskActivity } from '@/app/actions/task-modal'

interface HistoryTabProps {
  taskId: string
}

const ACTION_LABELS: Record<string, string> = {
  title_updated: 'ändrade titel',
  description_updated: 'uppdaterade beskrivning',
  status_updated: 'ändrade status',
  assignee_updated: 'ändrade ansvarig',
  due_date_updated: 'ändrade förfallodatum',
  priority_updated: 'ändrade prioritet',
  labels_updated: 'uppdaterade etiketter',
  comment_added: 'lade till en kommentar',
  law_linked: 'länkade en lag',
  law_unlinked: 'tog bort en lag-länk',
  evidence_uploaded: 'laddade upp bevis',
  evidence_deleted: 'raderade bevis',
  created: 'skapade uppgiften',
  deleted: 'raderade uppgiften',
}

export function HistoryTab({ taskId }: HistoryTabProps) {
  const [activities, setActivities] = useState<TaskActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchActivity() {
      setIsLoading(true)
      setError(null)

      const result = await getTaskActivity(taskId)

      if (result.success && result.data) {
        setActivities(result.data)
      } else {
        setError(result.error ?? 'Kunde inte hämta historik')
      }

      setIsLoading(false)
    }

    fetchActivity()
  }, [taskId])

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="rounded-full bg-muted p-3 mb-3">
          <History className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Ingen historik ännu</p>
        <p className="text-xs text-muted-foreground mt-1">
          Ändringar i uppgiften kommer att visas här
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <HistoryItem key={activity.id} activity={activity} />
      ))}
    </div>
  )
}

function HistoryItem({ activity }: { activity: TaskActivity }) {
  const initials = (activity.user.name ?? activity.user.email)
    .slice(0, 2)
    .toUpperCase()

  const actionLabel = ACTION_LABELS[activity.action] ?? activity.action

  // Parse old/new values for display
  const oldValue = activity.old_value as Record<string, unknown> | null
  const newValue = activity.new_value as Record<string, unknown> | null

  const renderValueChange = () => {
    if (!oldValue && !newValue) return null

    // Get the first key from either object to determine what changed
    const key = Object.keys(oldValue ?? newValue ?? {})[0]
    if (!key) return null

    const oldVal = oldValue?.[key]
    const newVal = newValue?.[key]

    // Don't show content for long text fields
    if (key === 'description') return null

    if (oldVal && newVal) {
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="font-medium">{String(oldVal)}</span>
          <ArrowRight className="h-3 w-3" />
          <span className="font-medium">{String(newVal)}</span>
        </span>
      )
    }

    if (newVal) {
      return (
        <span className="text-xs text-muted-foreground">
          till <span className="font-medium">{String(newVal)}</span>
        </span>
      )
    }

    return null
  }

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        {activity.user.avatar_url && (
          <AvatarImage
            src={activity.user.avatar_url}
            alt={activity.user.name ?? ''}
          />
        )}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">
            {activity.user.name ?? activity.user.email}
          </span>{' '}
          <span className="text-muted-foreground">{actionLabel}</span>{' '}
          {renderValueChange()}
        </p>
        <p
          className="text-xs text-muted-foreground"
          title={format(new Date(activity.created_at), 'PPpp', { locale: sv })}
        >
          {formatDistanceToNow(new Date(activity.created_at), {
            addSuffix: true,
            locale: sv,
          })}
        </p>
      </div>
    </div>
  )
}
