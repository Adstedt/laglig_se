/**
 * Process SFS Amendments Cron Job
 *
 * Split out of discover-sfs-amendments (2026-07 incident fix): discovery and
 * processing used to share one 300s budget and the function was hard-killed
 * on every run from 2026-06-17, silently stalling amendment ingestion.
 *
 * This route drains the PENDING/FAILED AmendmentDocument queue through the
 * shared pipeline in lib/sfs/amendment-processor:
 * - Recovers records stranded in PROCESSING by a previous hard kill
 * - Claims each record atomically (safe against concurrent runs/backfills)
 * - Guards its time budget: a record is only started when enough budget
 *   remains for a worst-case LLM parse, and the LLM call itself has a hard
 *   per-attempt timeout
 * - Backfills missing ChangeEvents for COMPLETED amendments
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startJobRun, completeJobRun, failJobRun } from '@/lib/admin/job-logger'
import { ContentType, ChangeType, ParseStatus, Prisma } from '@prisma/client'
import { buildSlugMap, type SlugMap } from '@/lib/linkify'
import {
  claimAmendmentRecord,
  processAmendmentRecord,
  releaseFailedRecord,
  resetStuckProcessing,
  type AmendmentProcessingStats,
} from '@/lib/sfs/amendment-processor'
import { classifyDocument } from '@/lib/sfs/sfs-amendment-crawler'
import { sendAmendmentDiscoveryEmail } from '@/lib/email/cron-notifications'
import { ensureSfsPrefix } from '@/lib/sfs/ensure-prefix'

export const dynamic = 'force-dynamic'
export const maxDuration = 800

const CRON_SECRET = process.env.CRON_SECRET

const CONFIG = {
  MAX_AMENDMENTS_PER_RUN: 50,
  // Only start a record when at least this much budget remains — covers a
  // worst-case parse (2 LLM attempts × 150s + PDF fetch + DB writes).
  PER_RECORD_RESERVE_MS: 400_000,
  LLM_MAX_RETRIES: 2,
  LLM_TIMEOUT_MS: 150_000,
  STUCK_PROCESSING_MINUTES: 30,
}

export async function GET(request: Request) {
  const startTime = Date.now()
  const budgetEndsAt = startTime + maxDuration * 1000

  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const triggeredBy = request.headers.get('x-triggered-by') || 'cron'
  let runId: string | undefined

  try {
    runId = await startJobRun('process-sfs-amendments', triggeredBy)
  } catch {
    console.error('Failed to start job run logging')
  }

  const stats: AmendmentProcessingStats & {
    claimed: number
    recoveredStuck: number
    remainingQueue: number
    earlyTerminated: boolean
  } = {
    processed: 0,
    failed: 0,
    changeEventsCreated: 0,
    pdfsFetched: 0,
    pdfsStored: 0,
    pdfsFailed: 0,
    repealsProcessed: 0,
    claimed: 0,
    recoveredStuck: 0,
    remainingQueue: 0,
    earlyTerminated: false,
  }

  try {
    const year = new Date().getFullYear()

    // Recover records stranded in PROCESSING by a hard-killed run
    stats.recoveredStuck = await resetStuckProcessing(
      CONFIG.STUCK_PROCESSING_MINUTES
    )
    if (stats.recoveredStuck > 0) {
      console.log(
        `[PROCESS-SFS] Recovered ${stats.recoveredStuck} stuck PROCESSING records → PENDING`
      )
    }

    const toProcess = await prisma.amendmentDocument.findMany({
      where: {
        sfs_number: { startsWith: `SFS ${year}:` },
        parse_status: { in: [ParseStatus.PENDING, ParseStatus.FAILED] },
        base_law_sfs: { not: 'unknown' },
      },
      orderBy: { created_at: 'asc' },
      take: CONFIG.MAX_AMENDMENTS_PER_RUN,
    })

    console.log(`[PROCESS-SFS] Found ${toProcess.length} records to process`)

    let slugMap: SlugMap | null = null

    for (const record of toProcess) {
      // Budget guard: don't start a record we may not be able to finish —
      // a hard kill mid-record is what stalled this pipeline for 5 weeks.
      const remaining = budgetEndsAt - Date.now()
      if (remaining < CONFIG.PER_RECORD_RESERVE_MS) {
        console.log(
          `[PROCESS-SFS] Budget guard: ${Math.round(remaining / 1000)}s remaining ` +
            `(< ${Math.round(CONFIG.PER_RECORD_RESERVE_MS / 1000)}s reserve), stopping. ` +
            `Processed ${stats.processed}/${toProcess.length}`
        )
        stats.earlyTerminated = true
        break
      }

      // Atomic claim — a concurrent run or local backfill skips claimed records
      const claimed = await claimAmendmentRecord(record.id)
      if (!claimed) {
        console.log(
          `[PROCESS-SFS] ${record.sfs_number} already claimed elsewhere, skipping`
        )
        continue
      }
      stats.claimed++

      if (!slugMap) {
        slugMap = await buildSlugMap()
      }

      try {
        await processAmendmentRecord(record, slugMap, stats, {
          llm: {
            maxRetries: CONFIG.LLM_MAX_RETRIES,
            timeoutMs: CONFIG.LLM_TIMEOUT_MS,
          },
        })
      } catch (error) {
        stats.failed++
        const errMsg = error instanceof Error ? error.message : String(error)
        console.error(`[PROCESS-SFS] Failed ${record.sfs_number}: ${errMsg}`)
        await releaseFailedRecord(record.id, errMsg)
      }
    }

    // Backfill missing ChangeEvents for COMPLETED amendments
    const backfilled = await backfillChangeEvents(year, stats)
    if (backfilled > 0) {
      console.log(`[PROCESS-SFS] Backfilled ${backfilled} missing ChangeEvents`)
    }

    stats.remainingQueue = await prisma.amendmentDocument.count({
      where: {
        sfs_number: { startsWith: `SFS ${year}:` },
        parse_status: { in: [ParseStatus.PENDING, ParseStatus.FAILED] },
      },
    })

    const duration = `${Math.round((Date.now() - startTime) / 1000)}s`

    console.log(`[PROCESS-SFS] ========== SUMMARY ==========`)
    console.log(`[PROCESS-SFS] Claimed: ${stats.claimed}`)
    console.log(`[PROCESS-SFS] Processed: ${stats.processed}`)
    console.log(`[PROCESS-SFS] Failed: ${stats.failed}`)
    console.log(`[PROCESS-SFS] Repeals: ${stats.repealsProcessed}`)
    console.log(`[PROCESS-SFS] ChangeEvents: ${stats.changeEventsCreated}`)
    console.log(
      `[PROCESS-SFS] PDFs fetched/stored/failed: ${stats.pdfsFetched}/${stats.pdfsStored}/${stats.pdfsFailed}`
    )
    console.log(`[PROCESS-SFS] Remaining queue: ${stats.remainingQueue}`)
    console.log(`[PROCESS-SFS] Duration: ${duration}`)
    console.log(`[PROCESS-SFS] ==============================`)

    try {
      await sendAmendmentDiscoveryEmail(
        {
          discovered: 0,
          alreadyExists: 0,
          pendingCreated: 0,
          pagesScanned: 0,
          processed: stats.processed,
          failed: stats.failed,
          changeEventsCreated: stats.changeEventsCreated,
          pdfsFetched: stats.pdfsFetched,
          pdfsStored: stats.pdfsStored,
          pdfsFailed: stats.pdfsFailed,
          repealsProcessed: stats.repealsProcessed,
          newLawsSkipped: 0,
          duration,
        },
        duration,
        true
      )
    } catch (emailErr) {
      console.error(
        '[PROCESS-SFS] Failed to send notification email:',
        emailErr
      )
    }

    if (runId) {
      await completeJobRun(runId, {
        itemsProcessed: stats.processed,
        itemsFailed: stats.failed,
        metadata: {
          remainingQueue: stats.remainingQueue,
          recoveredStuck: stats.recoveredStuck,
          earlyTerminated: stats.earlyTerminated,
        },
      })
    }

    return NextResponse.json({
      success: true,
      duration,
      ...stats,
    })
  } catch (error) {
    console.error('[PROCESS-SFS] Cron failed:', error)

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
        ...stats,
      },
      { status: 500 }
    )
  }
}

/**
 * Create ChangeEvents for COMPLETED amendments whose base law exists in the
 * DB but which have no event yet (e.g. the base law was ingested after the
 * amendment was processed).
 */
async function backfillChangeEvents(
  year: number,
  stats: AmendmentProcessingStats
): Promise<number> {
  const completed = await prisma.amendmentDocument.findMany({
    where: {
      sfs_number: { startsWith: `SFS ${year}:` },
      parse_status: ParseStatus.COMPLETED,
      base_law_sfs: { not: 'unknown' },
    },
    select: { sfs_number: true, base_law_sfs: true, title: true },
  })

  let backfilled = 0
  for (const record of completed) {
    const baseLawDocNumber = ensureSfsPrefix(record.base_law_sfs ?? '')
    const baseLawDoc = await prisma.legalDocument.findUnique({
      where: { document_number: baseLawDocNumber },
      select: { id: true },
    })
    if (!baseLawDoc) continue

    const existingEvent = await prisma.changeEvent.findFirst({
      where: {
        document_id: baseLawDoc.id,
        amendment_sfs: ensureSfsPrefix(record.sfs_number),
      },
      select: { id: true },
    })
    if (existingEvent) continue

    const isRepeal = record.title
      ? classifyDocument(record.title) === 'repeal'
      : false

    // Story 8.21: Catch unique constraint violation from partial index
    // (document_id, amendment_sfs) WHERE amendment_sfs IS NOT NULL
    try {
      await prisma.changeEvent.create({
        data: {
          document_id: baseLawDoc.id,
          content_type: ContentType.SFS_LAW,
          change_type: isRepeal ? ChangeType.REPEAL : ChangeType.AMENDMENT,
          amendment_sfs: ensureSfsPrefix(record.sfs_number),
          notification_sent: false,
        },
      })
      backfilled++
      stats.changeEventsCreated++
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        continue
      }
      throw e
    }
  }
  return backfilled
}
