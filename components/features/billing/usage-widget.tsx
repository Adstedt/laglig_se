'use client'

/**
 * Story 5.5c — Usage widget for the billing dashboard.
 *
 * Three progress bars (tokens, storage, seats) + a reset-date hint. Fetched
 * via SWR from app/actions/usage.ts → getWorkspaceUsageSummary so the
 * widget revalidates if the user navigates away and back.
 *
 * Color thresholds:
 *   - <80% green
 *   - 80-100% amber (soft-warn zone)
 *   - 100-200% red (over included, in overage zone — only possible for tokens
 *     before 5.5d; storage and seats are hard-capped)
 *
 * Enterprise renders unlimited dimensions as "Obegränsat" muted text instead
 * of a bar.
 */

import { useEffect, useState } from 'react'
import { Activity, HardDrive, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  getWorkspaceUsageSummary,
  type WorkspaceUsageSummary,
} from '@/app/actions/usage'

function formatNumber(n: number): string {
  return new Intl.NumberFormat('sv-SE').format(n)
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return (
      new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 }).format(
        n / 1_000_000
      ) + 'M'
    )
  }
  if (n >= 1_000) {
    return (
      new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(
        n / 1_000
      ) + 'k'
    )
  }
  return formatNumber(n)
}

function formatBytesShort(bytes: number): string {
  const gb = bytes / 1_073_741_824
  if (gb >= 1) {
    return (
      new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 }).format(gb) +
      ' GB'
    )
  }
  const mb = bytes / (1024 * 1024)
  return (
    new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(mb) +
    ' MB'
  )
}

function formatResetDate(periodEnd: Date | null): string {
  if (!periodEnd) return 'Förnyas vid första betalning'
  const next = new Date(periodEnd)
  next.setDate(next.getDate() + 1)
  return `Förnyas ${new Intl.DateTimeFormat('sv-SE', { dateStyle: 'long' }).format(next)}`
}

export function UsageWidget() {
  const [data, setData] = useState<WorkspaceUsageSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getWorkspaceUsageSummary()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[UsageWidget] failed to fetch usage', err)
          setError('Kunde inte hämta användningsdata')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Användning</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Användning</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Hämtar...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Användning</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tokens */}
        <UsageRow
          icon={<Activity className="h-4 w-4" />}
          label="AI-tokens"
          used={data.tokens.used}
          limit={data.tokens.limit}
          formatValue={formatTokens}
          extra={
            data.tokens.approxQueriesRemaining !== null
              ? `≈ ${data.tokens.approxQueriesRemaining} AI-frågor kvar`
              : undefined
          }
        />

        {/* Storage */}
        <UsageRow
          icon={<HardDrive className="h-4 w-4" />}
          label="Lagring"
          used={data.storage.usedBytes}
          limit={data.storage.limitBytes}
          formatValue={formatBytesShort}
        />

        {/* Seats */}
        <UsageRow
          icon={<Users className="h-4 w-4" />}
          label="Platser"
          used={data.seats.used}
          limit={data.seats.limit}
          formatValue={(n) => `${n}`}
        />

        <p className="pt-1 text-xs text-muted-foreground">
          {formatResetDate(data.periodEnd)}
        </p>
      </CardContent>
    </Card>
  )
}

function UsageRow({
  icon,
  label,
  used,
  limit,
  formatValue,
  extra,
}: {
  icon: React.ReactNode
  label: string
  used: number
  limit: number | null
  formatValue: (_n: number) => string
  extra?: string | undefined
}) {
  const isUnlimited = limit === null
  const percent = isUnlimited ? 0 : Math.min(100, (used / limit) * 100)
  const overSoftWarn = !isUnlimited && used / limit >= 0.8
  const atOrOverCap = !isUnlimited && used >= limit

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="font-medium">
          {isUnlimited
            ? 'Obegränsat'
            : `${formatValue(used)} / ${formatValue(limit)}`}
        </span>
      </div>
      {!isUnlimited && (
        <Progress
          value={percent}
          className={
            atOrOverCap
              ? '[&>div]:bg-destructive'
              : overSoftWarn
                ? '[&>div]:bg-amber-500'
                : undefined
          }
        />
      )}
      {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
    </div>
  )
}
