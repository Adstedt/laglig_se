import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { ArrowLeft } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LogViewer } from '@/components/admin/log-viewer'
import { JOB_REGISTRY } from '@/lib/admin/job-registry'
import { getJobRunDetail } from '@/lib/admin/queries'
import type { JobRunStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

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

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.round((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ jobName: string; runId: string }>
}) {
  const { jobName, runId } = await params

  const job = JOB_REGISTRY.find((j) => j.name === jobName)
  if (!job) notFound()

  const run = await getJobRunDetail(runId)
  if (!run) notFound()

  // Prevent URL manipulation — run must belong to the job
  if (run.job_name !== jobName) notFound()

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/admin/cron-jobs" className="hover:text-foreground">
            Cron-jobb
          </Link>
          <span>/</span>
          <Link
            href={`/admin/cron-jobs/${jobName}`}
            className="hover:text-foreground"
          >
            {job.displayName}
          </Link>
          <span>/</span>
          <span>Körning {runId.slice(0, 8)}</span>
        </div>
        <Link
          href={`/admin/cron-jobs/${jobName}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Tillbaka till körhistorik
        </Link>
      </div>

      {/* Run Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Körningsdetaljer</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd className="mt-1">
                <StatusBadge status={run.status} />
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Starttid</dt>
              <dd className="mt-1 text-sm">
                {format(run.started_at, 'PPpp', { locale: sv })}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Avslutad</dt>
              <dd className="mt-1 text-sm">
                {run.completed_at
                  ? format(run.completed_at, 'PPpp', { locale: sv })
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Varaktighet</dt>
              <dd className="mt-1 text-sm">
                {formatDuration(run.duration_ms)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Bearbetade</dt>
              <dd className="mt-1 text-sm">{run.items_processed}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Misslyckade</dt>
              <dd className="mt-1 text-sm">
                {run.items_failed > 0 ? (
                  <span className="text-red-600">{run.items_failed}</span>
                ) : (
                  run.items_failed
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Utlöst av</dt>
              <dd className="mt-1 text-sm">{run.triggered_by ?? '—'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Error Section */}
      {run.status === 'FAILED' && run.error_message && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-lg text-red-700">
              Felmeddelande
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-red-700">{run.error_message}</p>
            {run.error_stack && (
              <details open>
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                  Stacktrace
                </summary>
                <pre className="mt-2 max-h-[400px] overflow-auto rounded-lg bg-gray-50 p-4 font-mono text-xs text-gray-800">
                  {run.error_stack}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {/* Log Output */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Loggar</CardTitle>
        </CardHeader>
        <CardContent>
          <LogViewer content={run.log_output} />
        </CardContent>
      </Card>

      {/* Metadata */}
      {run.metadata != null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[400px] overflow-auto rounded-lg bg-gray-50 p-4 font-mono text-xs text-gray-800">
              {JSON.stringify(run.metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
