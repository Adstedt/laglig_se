'use client'

import { format, formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'

interface ActivityTimestampProps {
  date: Date | string
}

/**
 * Two-line timestamp used in the activity log row: absolute on top
 * (`yyyy-MM-dd HH:mm`) so auditors can scan a concrete moment, relative
 * below (`2 minuter sedan`) for at-a-glance recency, full ISO on hover.
 */
export function ActivityTimestamp({ date }: ActivityTimestampProps) {
  const d = typeof date === 'string' ? new Date(date) : date
  const absolute = format(d, 'yyyy-MM-dd HH:mm', { locale: sv })
  const relative = formatDistanceToNow(d, { addSuffix: true, locale: sv })
  const iso = d.toISOString()

  return (
    <div className="flex flex-col whitespace-nowrap leading-tight" title={iso}>
      <span className="text-sm font-medium tabular-nums">{absolute}</span>
      <span className="text-xs text-muted-foreground">{relative}</span>
    </div>
  )
}
