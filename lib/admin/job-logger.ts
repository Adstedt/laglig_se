import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Start a new cron job run record.
 * Returns the run ID for subsequent updates.
 * Wrapped in try/catch — logging failures must NOT crash the actual cron job.
 */
export async function startJobRun(
  jobName: string,
  triggeredBy?: string | undefined
): Promise<string | undefined> {
  try {
    const run = await prisma.cronJobRun.create({
      data: {
        job_name: jobName,
        status: 'RUNNING',
        triggered_by: triggeredBy ?? 'cron',
      },
    })
    return run.id
  } catch (error) {
    console.error('Failed to start job run logging:', error)
    return undefined
  }
}

/**
 * Mark a job run as successfully completed.
 * Calculates duration from started_at.
 */
export async function completeJobRun(
  runId: string,
  result: {
    itemsProcessed: number
    itemsFailed: number
    metadata?: Record<string, unknown> | undefined
  }
): Promise<void> {
  try {
    const run = await prisma.cronJobRun.findUnique({
      where: { id: runId },
      select: { started_at: true },
    })

    const durationMs = run ? Date.now() - run.started_at.getTime() : null

    await prisma.cronJobRun.update({
      where: { id: runId },
      data: {
        status: 'SUCCESS',
        completed_at: new Date(),
        duration_ms: durationMs,
        items_processed: result.itemsProcessed,
        items_failed: result.itemsFailed,
        ...(result.metadata
          ? { metadata: result.metadata as Prisma.InputJsonValue }
          : {}),
      },
    })
  } catch (error) {
    console.error('Failed to complete job run logging:', error)
  }
}

/**
 * Mark a job run as failed with error details.
 */
export async function failJobRun(runId: string, error: Error): Promise<void> {
  try {
    const run = await prisma.cronJobRun.findUnique({
      where: { id: runId },
      select: { started_at: true },
    })

    const durationMs = run ? Date.now() - run.started_at.getTime() : null

    await prisma.cronJobRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        completed_at: new Date(),
        duration_ms: durationMs,
        error_message: error.message,
        error_stack: error.stack ?? null,
      },
    })
  } catch (err) {
    console.error('Failed to record job run failure:', err)
  }
}

/**
 * Mark zombie RUNNING runs as FAILED.
 *
 * A Vercel hard kill (maxDuration timeout, OOM) never reaches a cron's catch
 * block, so the run row stays RUNNING forever and no failure email is sent —
 * this is how discover-sfs-amendments failed silently for 5 weeks (2026-06/07).
 * Any run still RUNNING well past the longest allowed maxDuration (800s) was
 * killed; record it as FAILED so monitoring can see it.
 *
 * Returns the swept runs (job_name + started_at) for reporting.
 */
export async function sweepStaleJobRuns(
  staleAfterMinutes = 20
): Promise<{ job_name: string; started_at: Date }[]> {
  const cutoff = new Date(Date.now() - staleAfterMinutes * 60_000)
  try {
    const stale = await prisma.cronJobRun.findMany({
      where: { status: 'RUNNING', started_at: { lt: cutoff } },
      select: { id: true, job_name: true, started_at: true },
    })
    if (stale.length === 0) return []

    await prisma.cronJobRun.updateMany({
      where: { id: { in: stale.map((r) => r.id) } },
      data: {
        status: 'FAILED',
        completed_at: new Date(),
        error_message:
          'Marked FAILED by stale-run sweep: run never completed — ' +
          'function was hard-killed (maxDuration timeout or crash) before reaching its error handler.',
      },
    })
    return stale.map(({ job_name, started_at }) => ({ job_name, started_at }))
  } catch (error) {
    console.error('Failed to sweep stale job runs:', error)
    return []
  }
}

/**
 * Append a log line to the job run's log_output field.
 * Uses raw SQL for efficient concatenation without re-reading the full field.
 */
export async function appendJobLog(
  runId: string,
  message: string
): Promise<void> {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] ${message}\n`
  try {
    await prisma.$executeRaw`
      UPDATE cron_job_runs
      SET log_output = COALESCE(log_output, '') || ${line}
      WHERE id = ${runId}
    `
  } catch (error) {
    console.error('Failed to append job log:', error)
  }
}
