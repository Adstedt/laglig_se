import Link from 'next/link'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ErrorFilters } from '@/components/admin/error-filters'
import { JOB_REGISTRY } from '@/lib/admin/job-registry'
import { getFailedRuns } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'

function truncate(str: string | null, maxLen: number): string {
  if (!str) return '\u2014'
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '...'
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.round((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

export default async function ErrorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams

  const jobName = typeof sp.jobName === 'string' ? sp.jobName : undefined
  const from = typeof sp.from === 'string' ? sp.from : undefined
  const to = typeof sp.to === 'string' ? sp.to : undefined
  const pageNum =
    typeof sp.page === 'string' ? Math.max(1, parseInt(sp.page, 10) || 1) : 1

  const fromDate = from ? new Date(from + 'T00:00:00.000Z') : undefined
  const toDate = to ? new Date(to + 'T23:59:59.999Z') : undefined

  const {
    data: runs,
    total,
    page,
    pageSize,
  } = await getFailedRuns({
    jobName,
    fromDate,
    toDate,
    page: pageNum,
  })

  const totalPages = Math.ceil(total / pageSize)

  const jobNamesForFilter = JOB_REGISTRY.map((j) => ({
    name: j.name,
    displayName: j.displayName,
  }))

  // Build pagination query string preserving filters
  function paginationHref(p: number): string {
    const params = new URLSearchParams()
    if (jobName) params.set('jobName', jobName)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    params.set('page', String(p))
    return `/admin/cron-jobs/errors?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Felloggar</h1>

      <ErrorFilters
        jobNames={jobNamesForFilter}
        currentJobName={jobName ?? null}
        currentFrom={from ?? null}
        currentTo={to ?? null}
      />

      {runs.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Inga misslyckade körningar hittades.
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jobbnamn</TableHead>
                <TableHead>Starttid</TableHead>
                <TableHead>Varaktighet</TableHead>
                <TableHead>Felmeddelande</TableHead>
                <TableHead className="text-right">Misslyckade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => {
                const jobDef = JOB_REGISTRY.find((j) => j.name === run.job_name)
                return (
                  <TableRow key={run.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        href={`/admin/cron-jobs/${run.job_name}/${run.id}`}
                        className="font-medium hover:underline"
                      >
                        {jobDef?.displayName ?? run.job_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/cron-jobs/${run.job_name}/${run.id}`}>
                        {format(run.started_at, 'PPp', { locale: sv })}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/cron-jobs/${run.job_name}/${run.id}`}>
                        {formatDuration(run.duration_ms)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/cron-jobs/${run.job_name}/${run.id}`}>
                        <span className="text-red-600">
                          {truncate(run.error_message, 100)}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/cron-jobs/${run.job_name}/${run.id}`}>
                        {run.items_failed}
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Sida {page} av {totalPages} ({total} fel)
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={paginationHref(page - 1)}>Föregående</Link>
                  </Button>
                )}
                {page < totalPages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={paginationHref(page + 1)}>Nästa</Link>
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
