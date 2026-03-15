'use client'

/**
 * Story 6.10: Activity Log Table
 * Table view for workspace-wide activity log entries
 */

import { formatDistanceToNow, format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { ArrowRight, History } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { WorkspaceActivityEntry } from '@/app/actions/workspace-activity'
import {
  ACTION_LABELS,
  ENTITY_TYPE_LABELS,
} from '@/lib/constants/activity-labels'

interface ActivityLogTableProps {
  activities: WorkspaceActivityEntry[]
}

export function ActivityLogTable({ activities }: ActivityLogTableProps) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-3 mb-3">
          <History className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Ingen aktivitet ännu</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tidpunkt</TableHead>
          <TableHead>Användare</TableHead>
          <TableHead>Åtgärd</TableHead>
          <TableHead>Typ</TableHead>
          <TableHead>Ändring</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {activities.map((activity) => (
          <ActivityRow key={activity.id} activity={activity} />
        ))}
      </TableBody>
    </Table>
  )
}

function ActivityRow({ activity }: { activity: WorkspaceActivityEntry }) {
  const initials = (activity.user.name ?? activity.user.email)
    .slice(0, 2)
    .toUpperCase()

  const actionLabel = ACTION_LABELS[activity.action] ?? activity.action
  const entityLabel =
    ENTITY_TYPE_LABELS[activity.entity_type] ?? activity.entity_type

  const oldValue = activity.old_value as Record<string, unknown> | null
  const newValue = activity.new_value as Record<string, unknown> | null

  const renderValueChange = () => {
    if (!oldValue && !newValue)
      return <span className="text-muted-foreground">-</span>

    const key = Object.keys(oldValue ?? newValue ?? {})[0]
    if (!key) return <span className="text-muted-foreground">-</span>

    const oldVal = oldValue?.[key]
    const newVal = newValue?.[key]

    // Skip long text fields
    if (
      key === 'description' ||
      key === 'business_context' ||
      key === 'compliance_actions'
    )
      return <span className="text-muted-foreground italic">text</span>

    if (oldVal && newVal) {
      return (
        <span className="flex items-center gap-1 text-xs">
          <span className="font-medium truncate max-w-[100px]">
            {String(oldVal)}
          </span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="font-medium truncate max-w-[100px]">
            {String(newVal)}
          </span>
        </span>
      )
    }

    if (newVal) {
      return (
        <span className="text-xs">
          <span className="font-medium">{String(newVal)}</span>
        </span>
      )
    }

    return <span className="text-muted-foreground">-</span>
  }

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">
        <span
          className="text-sm"
          title={format(new Date(activity.created_at), 'PPpp', { locale: sv })}
        >
          {formatDistanceToNow(new Date(activity.created_at), {
            addSuffix: true,
            locale: sv,
          })}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            {activity.user.avatar_url && (
              <AvatarImage
                src={activity.user.avatar_url}
                alt={activity.user.name ?? ''}
              />
            )}
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm truncate max-w-[140px]">
            {activity.user.name ?? activity.user.email}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">{actionLabel}</span>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="text-xs">
          {entityLabel}
        </Badge>
      </TableCell>
      <TableCell>{renderValueChange()}</TableCell>
    </TableRow>
  )
}
