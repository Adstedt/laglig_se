/**
 * SFS Pipeline Health Cron Job
 *
 * End-to-end freshness watchdog for the SFS ingestion pipeline, added after
 * the 2026-06/07 incident where discover-sfs-amendments was hard-killed on
 * every run for 5 weeks with zero alerting (hard kills never reach the catch
 * block, so no FAILED status and no failure email).
 *
 * Daily checks:
 * 1. Sweep zombie RUNNING cron_job_runs rows (all jobs) → FAILED
 * 2. Compare the official register (svenskforfattningssamling.se) against our
 *    DB coverage: newest amendments/repeals published >3 days ago must exist
 *    in amendment_documents
 * 3. Queue health: PENDING/FAILED backlog size and age
 * 4. Last-success recency for every SFS cron
 *
 * Sends an alert email ONLY when something is wrong — silence means healthy.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  startJobRun,
  completeJobRun,
  failJobRun,
  sweepStaleJobRuns,
} from '@/lib/admin/job-logger'
import { ParseStatus } from '@prisma/client'
import {
  parseIndexPageRows,
  classifyDocument,
  extractSfsNumericPart,
} from '@/lib/sfs/sfs-amendment-crawler'
import {
  sendSfsPipelineHealthEmail,
  type SfsPipelineHealthReport,
} from '@/lib/email/cron-notifications'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const CRON_SECRET = process.env.CRON_SECRET

const THRESHOLDS = {
  ZOMBIE_SWEEP_AFTER_MINUTES: 20,
  // An amendment on the official register older than this must be in our DB
  AMENDMENT_MAX_LAG_DAYS: 3,
  // Missing numbers across the year (union of laws+amendments vs official max)
  MISSING_IN_RANGE_MAX: 40,
  PENDING_BACKLOG_MAX: 150,
  OLDEST_PENDING_MAX_DAYS: 7,
  DISCOVER_MAX_SUCCESS_AGE_H: 36,
  PROCESS_MAX_SUCCESS_AGE_H: 26,
  SYNC_SFS_MAX_SUCCESS_AGE_H: 48,
}

const MONITORED_JOBS = [
  'discover-sfs-amendments',
  'process-sfs-amendments',
  'sync-sfs',
  'sync-sfs-updates',
] as const

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const triggeredBy = request.headers.get('x-triggered-by') || 'cron'
  let runId: string | undefined
  try {
    runId = await startJobRun('sfs-pipeline-health', triggeredBy)
  } catch {
    console.error('Failed to start job run logging')
  }

  const issues: string[] = []

  try {
    const year = new Date().getFullYear()
    const now = Date.now()

    // 1. Sweep zombie RUNNING rows across ALL cron jobs
    const swept = await sweepStaleJobRuns(THRESHOLDS.ZOMBIE_SWEEP_AFTER_MINUTES)
    if (swept.length > 0) {
      issues.push(
        `${swept.length} zombie RUNNING cron run(s) swept to FAILED (hard-killed before completing): ` +
          [...new Set(swept.map((s) => s.job_name))].join(', ')
      )
    }

    // 2. Official register freshness check (page 1 = newest ~15 documents)
    let officialHighest: number | null = null
    let officialLatestPublished: string | null = null
    try {
      const res = await fetch(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html`,
        {
          headers: {
            'User-Agent': 'Laglig.se/1.0 (Legal research; contact@laglig.se)',
            Accept: 'text/html',
          },
          signal: AbortSignal.timeout(15_000),
        }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = await res.text()
      const rows = parseIndexPageRows(html, year)

      if (rows.length > 0) {
        officialHighest = Math.max(...rows.map((r) => r.numericPart))
        officialLatestPublished = rows
          .map((r) => r.publishedDate)
          .sort()
          .at(-1)!

        // Every amendment/repeal published more than AMENDMENT_MAX_LAG_DAYS ago
        // must exist in amendment_documents
        const lagCutoff = new Date(
          now - THRESHOLDS.AMENDMENT_MAX_LAG_DAYS * 86_400_000
        )
        const dueRows = rows.filter(
          (r) =>
            classifyDocument(r.title) !== 'new_law' &&
            new Date(r.publishedDate) < lagCutoff
        )
        if (dueRows.length > 0) {
          const existing = await prisma.amendmentDocument.findMany({
            where: { sfs_number: { in: dueRows.map((r) => r.sfsNumber) } },
            select: { sfs_number: true },
          })
          const existingSet = new Set(existing.map((e) => e.sfs_number))
          const overdue = dueRows.filter((r) => !existingSet.has(r.sfsNumber))
          if (overdue.length > 0) {
            issues.push(
              `Discovery stale: ${overdue.length} amendment(s) published >${THRESHOLDS.AMENDMENT_MAX_LAG_DAYS}d ago ` +
                `not yet discovered: ${overdue.map((r) => r.sfsNumber).join(', ')}`
            )
          }
        }
      } else {
        issues.push(
          'Official register page returned no parseable rows — index markup may have changed'
        )
      }
    } catch (e) {
      issues.push(
        `Official register unreachable: ${e instanceof Error ? e.message : String(e)}`
      )
    }

    // 3. DB coverage vs official max
    const [amendments, laws] = await Promise.all([
      prisma.amendmentDocument.findMany({
        where: { sfs_number: { startsWith: `SFS ${year}:` } },
        select: { sfs_number: true },
      }),
      prisma.legalDocument.findMany({
        where: { document_number: { startsWith: `SFS ${year}:` } },
        select: { document_number: true },
      }),
    ])
    const known = new Set<number>()
    for (const a of amendments) {
      const n = extractSfsNumericPart(a.sfs_number)
      if (!isNaN(n)) known.add(n)
    }
    for (const l of laws) {
      const m = l.document_number.match(/SFS\s+\d{4}:(\d+)/)
      if (m?.[1]) known.add(parseInt(m[1], 10))
    }
    const dbHighestKnown = known.size > 0 ? Math.max(...known) : 0

    let missingInRange = 0
    if (officialHighest) {
      for (let n = 1; n <= officialHighest; n++) {
        if (!known.has(n)) missingInRange++
      }
      if (missingInRange > THRESHOLDS.MISSING_IN_RANGE_MAX) {
        issues.push(
          `Coverage gap: ${missingInRange} SFS ${year} numbers missing from DB ` +
            `(official register reaches ${year}:${officialHighest}, we know ${known.size})`
        )
      }
    }

    // 4. Queue health
    const [pendingBacklog, failedBacklog, oldestPending] = await Promise.all([
      prisma.amendmentDocument.count({
        where: {
          sfs_number: { startsWith: `SFS ${year}:` },
          parse_status: ParseStatus.PENDING,
        },
      }),
      prisma.amendmentDocument.count({
        where: {
          sfs_number: { startsWith: `SFS ${year}:` },
          parse_status: ParseStatus.FAILED,
        },
      }),
      prisma.amendmentDocument.findFirst({
        where: {
          sfs_number: { startsWith: `SFS ${year}:` },
          parse_status: ParseStatus.PENDING,
        },
        orderBy: { created_at: 'asc' },
        select: { created_at: true, sfs_number: true },
      }),
    ])

    const oldestPendingAgeDays = oldestPending
      ? Math.floor((now - oldestPending.created_at.getTime()) / 86_400_000)
      : null

    if (pendingBacklog > THRESHOLDS.PENDING_BACKLOG_MAX) {
      issues.push(
        `Processing backlog: ${pendingBacklog} PENDING amendments (threshold ${THRESHOLDS.PENDING_BACKLOG_MAX})`
      )
    }
    if (
      oldestPendingAgeDays !== null &&
      oldestPendingAgeDays > THRESHOLDS.OLDEST_PENDING_MAX_DAYS
    ) {
      issues.push(
        `Oldest PENDING amendment (${oldestPending!.sfs_number}) is ${oldestPendingAgeDays} days old ` +
          `(threshold ${THRESHOLDS.OLDEST_PENDING_MAX_DAYS}d) — processing is not draining the queue`
      )
    }

    // 5. Last-success recency per job
    const lastSuccess: Record<string, string | null> = {}
    for (const job of MONITORED_JOBS) {
      const last = await prisma.cronJobRun.findFirst({
        where: { job_name: job, status: 'SUCCESS' },
        orderBy: { started_at: 'desc' },
        select: { started_at: true },
      })
      lastSuccess[job] = last?.started_at.toISOString() ?? null

      const maxAgeH =
        job === 'discover-sfs-amendments'
          ? THRESHOLDS.DISCOVER_MAX_SUCCESS_AGE_H
          : job === 'process-sfs-amendments'
            ? THRESHOLDS.PROCESS_MAX_SUCCESS_AGE_H
            : THRESHOLDS.SYNC_SFS_MAX_SUCCESS_AGE_H

      if (!last) {
        issues.push(`${job}: no successful run on record`)
      } else if (now - last.started_at.getTime() > maxAgeH * 3_600_000) {
        const ageH = Math.round((now - last.started_at.getTime()) / 3_600_000)
        issues.push(
          `${job}: last SUCCESS ${ageH}h ago (threshold ${maxAgeH}h) — job is failing or not running`
        )
      }
    }

    const report: SfsPipelineHealthReport = {
      healthy: issues.length === 0,
      issues,
      officialHighest,
      officialLatestPublished,
      dbHighestKnown,
      missingInRange,
      pendingBacklog,
      failedBacklog,
      oldestPendingAgeDays,
      sweptZombieRuns: swept,
      lastSuccess,
    }

    console.log(
      `[SFS-HEALTH] ${report.healthy ? 'HEALTHY' : `UNHEALTHY (${issues.length} issues)`}`
    )
    for (const issue of issues) console.log(`[SFS-HEALTH]   - ${issue}`)

    if (!report.healthy) {
      try {
        await sendSfsPipelineHealthEmail(report)
      } catch (emailErr) {
        console.error('[SFS-HEALTH] Failed to send alert email:', emailErr)
      }
    }

    if (runId) {
      await completeJobRun(runId, {
        itemsProcessed: swept.length,
        itemsFailed: issues.length,
        metadata: { ...report, sweptZombieRuns: swept.length } as Record<
          string,
          unknown
        >,
      })
    }

    return NextResponse.json({ success: true, ...report })
  } catch (error) {
    console.error('[SFS-HEALTH] Health check failed:', error)
    if (runId) {
      await failJobRun(
        runId,
        error instanceof Error ? error : new Error(String(error))
      )
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        issues,
      },
      { status: 500 }
    )
  }
}
