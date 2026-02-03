import { formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'
import { CronExpressionParser } from 'cron-parser'

/**
 * Returns a human-readable Swedish string for the next scheduled run.
 * Returns null for manual schedules or invalid cron expressions.
 */
export function getNextRun(schedule: string): string | null {
  if (schedule === 'manual') return null
  try {
    const interval = CronExpressionParser.parse(schedule)
    const next = interval.next().toDate()
    return formatDistanceToNow(next, { addSuffix: true, locale: sv })
  } catch {
    return null
  }
}

/**
 * Determines if a scheduled job is overdue based on its cron expression.
 * Stale = last run is older than 1.5x the expected interval between runs.
 * Manual jobs and jobs with no run history are never stale.
 */
export function isStale(schedule: string, lastRunAt: Date | null): boolean {
  if (schedule === 'manual' || !lastRunAt) return false
  try {
    const interval = CronExpressionParser.parse(schedule)
    // Get two previous occurrences to calculate the interval
    const prev1 = interval.prev().toDate()
    const prev2 = interval.prev().toDate()
    const intervalMs = prev1.getTime() - prev2.getTime()
    // Stale if last run is older than 1.5x the schedule interval
    const staleness = intervalMs * 1.5
    return Date.now() - lastRunAt.getTime() > staleness
  } catch {
    return false
  }
}
