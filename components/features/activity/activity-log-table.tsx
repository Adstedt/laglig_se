'use client'

/**
 * Story 6.10 + activity-log revamp: Aktivitetslogg table.
 *
 * Renders one human Swedish sentence per row with inline deep links, a
 * two-line timestamp, a category badge, and an expandable row revealing the
 * full old→new diff (+ notification recipients when applicable). Rows are
 * grouped under day-separator headers (Idag / Igår / absolute date).
 */

import { useMemo, useState } from 'react'
import { isToday, isYesterday, format, startOfDay } from 'date-fns'
import { sv } from 'date-fns/locale'
import { ChevronDown, ChevronRight, History } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { WorkspaceActivityEntry } from '@/app/actions/workspace-activity'
import { formatActivity } from '@/lib/activity/format-activity'
import { CATEGORY_META } from '@/lib/activity/categories'
import { SentenceRenderer } from './sentence-renderer'
import { ActivityTimestamp } from './activity-timestamp'
import { ActivityExpandedRow } from './activity-expanded-row'

interface ActivityLogTableProps {
  activities: WorkspaceActivityEntry[]
}

const COLUMN_COUNT = 5

type DayGroup = {
  key: string
  label: string
  activities: WorkspaceActivityEntry[]
}

function dayLabel(date: Date): string {
  if (isToday(date)) return 'Idag'
  if (isYesterday(date)) return 'Igår'
  return format(date, 'EEEE d MMMM yyyy', { locale: sv }).replace(/^./, (c) =>
    c.toUpperCase()
  )
}

function groupByDay(activities: WorkspaceActivityEntry[]): DayGroup[] {
  const groups: DayGroup[] = []
  let currentKey: string | null = null
  for (const activity of activities) {
    const d = new Date(activity.created_at)
    const dayStart = startOfDay(d)
    const key = dayStart.toISOString()
    if (key !== currentKey) {
      groups.push({ key, label: dayLabel(d), activities: [] })
      currentKey = key
    }
    groups[groups.length - 1]!.activities.push(activity)
  }
  return groups
}

export function ActivityLogTable({ activities }: ActivityLogTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const groups = useMemo(() => groupByDay(activities), [activities])

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

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10" aria-label="Expandera rad" />
          <TableHead className="w-[160px]">Tidpunkt</TableHead>
          <TableHead className="w-[180px]">Användare</TableHead>
          <TableHead className="w-[140px]">Kategori</TableHead>
          <TableHead>Aktivitet</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <GroupSection
            key={group.key}
            group={group}
            expandedIds={expandedIds}
            onToggle={toggle}
          />
        ))}
      </TableBody>
    </Table>
  )
}

function GroupSection({
  group,
  expandedIds,
  onToggle,
}: {
  group: DayGroup
  expandedIds: Set<string>
  onToggle: (_id: string) => void
}) {
  return (
    <>
      <TableRow className="hover:bg-transparent border-0">
        <TableCell
          colSpan={COLUMN_COUNT}
          className="bg-muted/40 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {group.label}
          <span className="ml-2 font-normal normal-case tracking-normal">
            · {group.activities.length}{' '}
            {group.activities.length === 1 ? 'händelse' : 'händelser'}
          </span>
        </TableCell>
      </TableRow>
      {group.activities.map((activity) => (
        <ActivityRow
          key={activity.id}
          activity={activity}
          isExpanded={expandedIds.has(activity.id)}
          onToggle={() => onToggle(activity.id)}
        />
      ))}
    </>
  )
}

interface ActivityRowProps {
  activity: WorkspaceActivityEntry
  isExpanded: boolean
  onToggle: () => void
}

function ActivityRow({ activity, isExpanded, onToggle }: ActivityRowProps) {
  const initials = (activity.user.name ?? activity.user.email)
    .slice(0, 2)
    .toUpperCase()

  const parts = formatActivity({
    action: activity.action,
    entity_type: activity.entity_type,
    user: { name: activity.user.name, email: activity.user.email },
    old_value: activity.old_value,
    new_value: activity.new_value,
    primary: activity.primary,
    ...(activity.secondary ? { secondary: activity.secondary } : {}),
  })

  const meta = CATEGORY_META[activity.category]
  const CategoryIcon = meta.icon

  // Shared row padding — puts every cell's content on the same top edge so
  // the timestamp / avatar / pill / sentence visually line up.
  const cellClass = 'align-top py-3'

  return (
    <>
      <TableRow className={cn(isExpanded && 'border-b-0')}>
        <TableCell className={cellClass}>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 mt-0.5"
            onClick={onToggle}
            aria-label={isExpanded ? 'Dölj detaljer' : 'Visa detaljer'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
        <TableCell className={cellClass}>
          <ActivityTimestamp date={activity.created_at} />
        </TableCell>
        <TableCell className={cellClass}>
          <div className="flex items-center gap-2 min-h-[24px]">
            <Avatar className="h-6 w-6 shrink-0">
              {activity.user.avatar_url && (
                <AvatarImage
                  src={activity.user.avatar_url}
                  alt={activity.user.name ?? ''}
                />
              )}
              <AvatarFallback className="text-[10px]">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm truncate max-w-[140px]">
              {activity.user.name ?? activity.user.email}
            </span>
          </div>
        </TableCell>
        <TableCell className={cellClass}>
          <div className="flex items-center min-h-[24px]">
            <Badge
              variant="outline"
              className={cn('gap-1 font-normal py-0.5', meta.badgeClass)}
            >
              <CategoryIcon className="h-3 w-3" />
              {meta.label}
            </Badge>
          </div>
        </TableCell>
        <TableCell className={cellClass}>
          <div className="min-h-[24px] flex items-center">
            <SentenceRenderer
              parts={parts}
              className="break-words leading-snug"
            />
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={COLUMN_COUNT} className="pt-0 pb-4 px-6">
            <ActivityExpandedRow activity={activity} />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
