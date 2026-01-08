import { formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface ActivityItemProps {
  user: {
    name: string | null
    avatar_url: string | null
  }
  action: string
  entityType: string
  createdAt: Date
}

function getActionText(action: string, entityType: string): string {
  const actionMap: Record<string, Record<string, string>> = {
    list_item: {
      created: 'lade till en lag i listan',
      updated: 'uppdaterade en lag',
      status_changed: 'ändrade status',
      deleted: 'tog bort en lag från listan',
    },
    task: {
      created: 'skapade en uppgift',
      updated: 'uppdaterade en uppgift',
      status_changed: 'flyttade en uppgift',
      completed: 'slutförde en uppgift',
      deleted: 'tog bort en uppgift',
    },
    comment: {
      created: 'skrev en kommentar',
      updated: 'redigerade en kommentar',
      deleted: 'tog bort en kommentar',
    },
    evidence: {
      created: 'lade till bevis',
      updated: 'uppdaterade bevis',
      deleted: 'tog bort bevis',
    },
  }

  return actionMap[entityType]?.[action] || `${action} ${entityType}`
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function ActivityItem({
  user,
  action,
  entityType,
  createdAt,
}: ActivityItemProps) {
  const actionText = getActionText(action, entityType)
  const timeAgo = formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
    locale: sv,
  })

  return (
    <div className="flex gap-3 py-2">
      <Avatar className="h-8 w-8 shrink-0">
        {user.avatar_url && (
          <AvatarImage src={user.avatar_url} alt={user.name || ''} />
        )}
        <AvatarFallback className="text-xs">
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{user.name || 'Användare'}</span>{' '}
          <span className="text-muted-foreground">{actionText}</span>
        </p>
        <p className="text-xs text-muted-foreground">{timeAgo}</p>
      </div>
    </div>
  )
}
