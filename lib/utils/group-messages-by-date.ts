import {
  isToday,
  isYesterday,
  differenceInCalendarDays,
  format,
} from 'date-fns'
import { sv } from 'date-fns/locale'
import type { UIMessage } from 'ai'

/** UIMessage with optional createdAt (added by our toUIMessages converter) */
type MessageWithDate = UIMessage & { createdAt?: Date | string | undefined }

export interface DateGroup {
  label: string
  messages: UIMessage[]
}

/**
 * Group messages by date for display with date separator headers.
 * Buckets: "Idag", "Igår", "Förra veckan" (2–7 days ago), or formatted date string.
 */
export function groupMessagesByDate(messages: UIMessage[]): DateGroup[] {
  if (messages.length === 0) return []

  const now = new Date()
  const groups: DateGroup[] = []
  let currentLabel: string | null = null
  let currentGroup: UIMessage[] = []

  for (const message of messages) {
    const msg = message as MessageWithDate
    const date = msg.createdAt ? new Date(msg.createdAt) : now
    const label = getDateLabel(date, now)

    if (label !== currentLabel) {
      if (currentLabel !== null && currentGroup.length > 0) {
        groups.push({ label: currentLabel, messages: currentGroup })
      }
      currentLabel = label
      currentGroup = [message]
    } else {
      currentGroup.push(message)
    }
  }

  // Push final group
  if (currentLabel !== null && currentGroup.length > 0) {
    groups.push({ label: currentLabel, messages: currentGroup })
  }

  return groups
}

function getDateLabel(date: Date, now: Date): string {
  if (isToday(date)) return 'Idag'
  if (isYesterday(date)) return 'Igår'
  const daysAgo = differenceInCalendarDays(now, date)
  if (daysAgo >= 2 && daysAgo <= 7) return 'Förra veckan'
  return format(date, 'd MMMM yyyy', { locale: sv })
}
