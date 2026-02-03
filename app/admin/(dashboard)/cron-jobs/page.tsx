import { formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CronJobCard } from '@/components/admin/cron-job-card'
import { JOB_REGISTRY } from '@/lib/admin/job-registry'
import { getRecentJobRuns } from '@/lib/admin/queries'
import { runAllHealthChecks } from '@/lib/admin/health'
import { getNextRun, isStale } from '@/lib/admin/cron-utils'
import type { HealthCheckResult } from '@/lib/admin/health'
import type { JobRunStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

function HealthCheckDot({ check }: { check: HealthCheckResult }) {
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${
          check.ok ? 'bg-green-500' : 'bg-red-500'
        }`}
      />
      <span className="text-sm font-medium">{check.name}</span>
      <span className="ml-auto text-xs text-muted-foreground">
        {check.ok ? 'Tillgänglig' : 'Otillgänglig'}
        {check.latencyMs > 0 && ` (${check.latencyMs}ms)`}
      </span>
    </div>
  )
}

export default async function CronJobsPage() {
  const jobNames = JOB_REGISTRY.map((j) => j.name)
  const [recentRuns, healthChecks] = await Promise.all([
    getRecentJobRuns(jobNames, 10),
    runAllHealthChecks(),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cron-jobb</h1>

      {/* Health Checks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Systemhälsa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {healthChecks.map((check) => (
              <HealthCheckDot key={check.name} check={check} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Job Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {JOB_REGISTRY.map((job) => {
          const runs = recentRuns[job.name] ?? []
          const lastRun = runs[0] ?? null
          const nextRunText = getNextRun(job.schedule)
          const stale = isStale(job.schedule, lastRun?.started_at ?? null)

          const lastRunSerialized = lastRun
            ? {
                ...lastRun,
                started_at: lastRun.started_at.toISOString(),
                completed_at: lastRun.completed_at?.toISOString() ?? null,
                relativeTime: formatDistanceToNow(lastRun.started_at, {
                  addSuffix: true,
                  locale: sv,
                }),
              }
            : null

          const recentRunStatuses: JobRunStatus[] =
            runs.length > 0 ? runs.map((r) => r.status).reverse() : []

          return (
            <CronJobCard
              key={job.name}
              job={job}
              lastRun={lastRunSerialized}
              recentRunStatuses={recentRunStatuses}
              nextRunText={nextRunText}
              isStale={stale}
            />
          )
        })}
      </div>
    </div>
  )
}
