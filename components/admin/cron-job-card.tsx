'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, Clock, Loader2, Play } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { triggerJob } from '@/app/actions/admin-cron'
import type { CronJobDefinition } from '@/lib/admin/job-registry'
import type { JobRunStatus } from '@prisma/client'

interface SerializedRun {
  id: string
  job_name: string
  status: JobRunStatus
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  items_processed: number
  items_failed: number
  error_message: string | null
  relativeTime: string
}

interface CronJobCardProps {
  job: CronJobDefinition
  lastRun: SerializedRun | null
  recentRunStatuses: JobRunStatus[]
  nextRunText: string | null
  isStale: boolean
}

function StatusDot({ status }: { status: JobRunStatus | null }) {
  if (!status) {
    return (
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300" />
    )
  }

  switch (status) {
    case 'SUCCESS':
      return (
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
      )
    case 'FAILED':
      return (
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
      )
    case 'RUNNING':
      return (
        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-yellow-500" />
      )
  }
}

function StatusBadge({ status }: { status: JobRunStatus }) {
  switch (status) {
    case 'SUCCESS':
      return (
        <Badge variant="outline" className="border-green-200 text-green-700">
          Lyckades
        </Badge>
      )
    case 'FAILED':
      return (
        <Badge variant="outline" className="border-red-200 text-red-700">
          Misslyckades
        </Badge>
      )
    case 'RUNNING':
      return (
        <Badge variant="outline" className="border-yellow-200 text-yellow-700">
          Kör...
        </Badge>
      )
  }
}

function RunHistoryDots({ statuses }: { statuses: JobRunStatus[] }) {
  if (statuses.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 text-xs text-muted-foreground">Historik:</span>
      {statuses.map((status, i) => {
        const colorClass =
          status === 'SUCCESS'
            ? 'bg-green-500'
            : status === 'FAILED'
              ? 'bg-red-500'
              : 'bg-yellow-500'
        return (
          <span
            key={i}
            className={`inline-block h-2 w-2 rounded-full ${colorClass}`}
            title={
              status === 'SUCCESS'
                ? 'Lyckades'
                : status === 'FAILED'
                  ? 'Misslyckades'
                  : 'Kör...'
            }
          />
        )
      })}
    </div>
  )
}

export function CronJobCard({
  job,
  lastRun,
  recentRunStatuses,
  nextRunText,
  isStale,
}: CronJobCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [triggering, setTriggering] = useState(false)

  const isRunning = lastRun?.status === 'RUNNING' || triggering

  // Poll every 5s while running to refresh server data
  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => {
      router.refresh()
    }, 5000)
    return () => clearInterval(interval)
  }, [isRunning, router])

  // Clear triggering state once we see any status from the server
  useEffect(() => {
    if (triggering && lastRun?.status) {
      setTriggering(false)
    }
  }, [triggering, lastRun?.status])

  async function handleTrigger() {
    setTriggering(true)
    startTransition(async () => {
      const result = await triggerJob(job.name)
      if (!result.success) {
        setTriggering(false)
      }
    })
  }

  return (
    <Card className={isStale ? 'border-yellow-300' : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusDot status={lastRun?.status ?? null} />
            <CardTitle className="text-base">
              <Link
                href={`/admin/cron-jobs/${job.name}`}
                className="hover:underline"
              >
                {job.displayName}
              </Link>
            </CardTitle>
            {isStale && (
              <Badge
                variant="outline"
                className="border-yellow-300 bg-yellow-50 text-yellow-700"
              >
                <AlertTriangle className="mr-1 h-3 w-3" />
                Försenad
              </Badge>
            )}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={isRunning || isPending}
              >
                {isRunning ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Play className="mr-1 h-3 w-3" />
                )}
                Kör nu
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bekräfta körning</AlertDialogTitle>
                <AlertDialogDescription>
                  Vill du köra {job.displayName} nu?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction onClick={handleTrigger}>
                  Kör
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{job.description}</p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Schema: {job.scheduleHuman}</span>
          {nextRunText && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Nästa: {nextRunText}
            </span>
          )}
        </div>

        {lastRun ? (
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Senaste körning:</span>
              <StatusBadge status={lastRun.status} />
            </div>
            <div className="text-muted-foreground">
              {lastRun.relativeTime}
              {lastRun.duration_ms != null && (
                <> &middot; {(lastRun.duration_ms / 1000).toFixed(1)}s</>
              )}
            </div>
            {(lastRun.items_processed > 0 || lastRun.items_failed > 0) && (
              <div className="text-muted-foreground">
                {lastRun.items_processed} bearbetade
                {lastRun.items_failed > 0 && (
                  <span className="text-red-600">
                    {' '}
                    &middot; {lastRun.items_failed} misslyckade
                  </span>
                )}
              </div>
            )}
            {lastRun.status === 'FAILED' && lastRun.error_message && (
              <div className="mt-1 rounded bg-red-50 p-2 text-red-700">
                {lastRun.error_message}
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Ingen körhistorik</div>
        )}

        <RunHistoryDots statuses={recentRunStatuses} />

        {!job.instrumented && (
          <div className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
            Denna jobbtyp loggar inte körhistorik ännu.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
