import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { ArrowLeft } from 'lucide-react'

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
import { AutoRefreshToggle } from '@/components/admin/auto-refresh-toggle'
import { JOB_REGISTRY } from '@/lib/admin/job-registry'
import { getJobRunHistory } from '@/lib/admin/queries'
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

export default async function JobHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobName: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { jobName } = await params
  const sp = await searchParams

  const job = JOB_REGISTRY.find((j) => j.name === jobName)
  if (!job) notFound()

  const pageNum =
    typeof sp.page === 'string' ? Math.max(1, parseInt(sp.page, 10) || 1) : 1

  const {
    data: runs,
    total,
    page,
    pageSize,
  } = await getJobRunHistory(jobName, { page: pageNum })

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            href="/admin/cron-jobs"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Cron-jobb
          </Link>
          <h1 className="text-2xl font-bold">{job.displayName}</h1>
          <p className="text-sm text-muted-foreground">{job.description}</p>
          <p className="text-xs text-muted-foreground">
            Schema: {job.scheduleHuman}
          </p>
        </div>
        <AutoRefreshToggle />
      </div>

      {!job.instrumented && (
        <div className="rounded bg-muted px-3 py-2 text-sm text-muted-foreground">
          Denna jobbtyp loggar inte körningar ännu.
        </div>
      )}

      {runs.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Ingen körhistorik
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Starttid</TableHead>
                <TableHead>Varaktighet</TableHead>
                <TableHead className="text-right">Bearbetade</TableHead>
                <TableHead className="text-right">Misslyckade</TableHead>
                <TableHead>Utlöst av</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/admin/cron-jobs/${jobName}/${run.id}`}>
                      <StatusBadge status={run.status} />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/cron-jobs/${jobName}/${run.id}`}>
                      {format(run.started_at, 'PPp', { locale: sv })}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/cron-jobs/${jobName}/${run.id}`}>
                      {formatDuration(run.duration_ms)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/cron-jobs/${jobName}/${run.id}`}>
                      {run.items_processed}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/cron-jobs/${jobName}/${run.id}`}>
                      {run.items_failed > 0 ? (
                        <span className="text-red-600">{run.items_failed}</span>
                      ) : (
                        run.items_failed
                      )}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/cron-jobs/${jobName}/${run.id}`}>
                      {run.triggered_by ?? '—'}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Sida {page} av {totalPages} ({total} körningar)
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/cron-jobs/${jobName}?page=${page - 1}`}>
                      Föregående
                    </Link>
                  </Button>
                )}
                {page < totalPages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/cron-jobs/${jobName}?page=${page + 1}`}>
                      Nästa
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
