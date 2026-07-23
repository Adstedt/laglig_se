/**
 * Discover SFS Amendments Cron Job — Discovery ONLY
 *
 * Story 8.20 + 2026-07 incident fix: this route used to run discovery AND the
 * PDF→LLM processing pipeline in one 300s budget. From 2026-06-17 every run
 * was hard-killed by the function timeout before Phase 1 finished writing,
 * leaving zombie RUNNING job rows and a silently stale amendment register.
 *
 * Now this route does discovery only:
 * - Scan the svenskforfattningssamling.se index (all pages, knownNumbers mode)
 * - Create PENDING AmendmentDocument records INCREMENTALLY per index page,
 *   so a kill mid-scan loses only the unscanned tail
 * - Re-resolve "unknown" base_law_sfs records
 *
 * Processing (PDF → LLM → normalize → DB) lives in /api/cron/process-sfs-amendments.
 * Pipeline health monitoring lives in /api/cron/sfs-pipeline-health.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startJobRun, completeJobRun, failJobRun } from '@/lib/admin/job-logger'
import { ParseStatus, Prisma } from '@prisma/client'
import { constructStoragePath } from '@/lib/sfs/pdf-urls'
import { sendAmendmentDiscoveryEmail } from '@/lib/email/cron-notifications'
import {
  discoverFromIndex,
  extractSfsNumericPart,
  extractBaseLawSfs,
} from '@/lib/sfs/sfs-amendment-crawler'
import { ensureSfsPrefix } from '@/lib/sfs/ensure-prefix'

export const dynamic = 'force-dynamic'
export const maxDuration = 800 // Fluid compute ceiling — discovery is bounded by TIMEOUT_BUFFER below

const CRON_SECRET = process.env.CRON_SECRET

const CONFIG = {
  TIMEOUT_BUFFER_MS: 60_000, // stop scanning 60s before maxDuration
  REQUEST_DELAY_MS: 200,
  FETCH_TIMEOUT_MS: 15_000,
}

interface DiscoveryStats {
  discovered: number
  alreadyExists: number
  pendingCreated: number
  pagesScanned: number
  processed: number
  failed: number
  changeEventsCreated: number
  pdfsFetched: number
  pdfsStored: number
  pdfsFailed: number
  repealsProcessed: number
  newLawsSkipped: number
  duration: string
}

export async function GET(request: Request) {
  const startTime = Date.now()
  const deadlineAt = startTime + maxDuration * 1000 - CONFIG.TIMEOUT_BUFFER_MS

  // Auth check
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const triggeredBy = request.headers.get('x-triggered-by') || 'cron'
  let runId: string | undefined

  try {
    runId = await startJobRun('discover-sfs-amendments', triggeredBy)
  } catch {
    console.error('Failed to start job run logging')
  }

  const stats: DiscoveryStats = {
    discovered: 0,
    alreadyExists: 0,
    pendingCreated: 0,
    pagesScanned: 0,
    processed: 0,
    failed: 0,
    changeEventsCreated: 0,
    pdfsFetched: 0,
    pdfsStored: 0,
    pdfsFailed: 0,
    repealsProcessed: 0,
    newLawsSkipped: 0,
    duration: '0s',
  }

  try {
    const year = new Date().getFullYear()

    console.log(`[DISCOVER-SFS] Discovery for year ${year}`)
    const knownNumbers = await getKnownNumbers(year)
    console.log(
      `[DISCOVER-SFS] Known ${year} numbers: ${knownNumbers.size}` +
        (knownNumbers.size > 0 ? ` (max ${Math.max(...knownNumbers)})` : '')
    )

    // Scan the full index, filtering against everything we already have.
    // Records are persisted per page via onPage — a hard kill mid-scan only
    // loses the unscanned tail, and the next run picks it up (gaps are
    // re-surfaced every run until they land).
    const discoverResult = await discoverFromIndex(year, {
      knownNumbers,
      requestDelayMs: CONFIG.REQUEST_DELAY_MS,
      fetchTimeoutMs: CONFIG.FETCH_TIMEOUT_MS,
      deadlineAt,
      onPage: async (documents) => {
        for (const doc of documents) {
          stats.discovered++

          if (doc.documentType === 'new_law') {
            // New laws arrive via the Riksdagen pipeline (sync-sfs)
            stats.newLawsSkipped++
            continue
          }

          try {
            await prisma.amendmentDocument.create({
              data: {
                sfs_number: doc.sfsNumber,
                storage_path: constructStoragePath(doc.sfsNumber),
                original_url: doc.pdfUrl,
                base_law_sfs: doc.baseLawSfs
                  ? ensureSfsPrefix(doc.baseLawSfs)
                  : 'unknown',
                title: doc.title,
                publication_date: new Date(doc.publishedDate),
                parse_status: ParseStatus.PENDING,
              },
            })
            stats.pendingCreated++
            console.log(
              `[DISCOVER-SFS] Created PENDING: ${doc.sfsNumber} - ${doc.title}`
            )
          } catch (e) {
            if (
              e instanceof Prisma.PrismaClientKnownRequestError &&
              e.code === 'P2002'
            ) {
              stats.alreadyExists++
              continue
            }
            throw e
          }
        }
      },
    })

    stats.pagesScanned = discoverResult.pagesScanned
    console.log(
      `[DISCOVER-SFS] Index scan: ${discoverResult.pagesScanned} page(s), ` +
        `highest=${discoverResult.highestNumericPart}, found=${discoverResult.documents.length}, ` +
        `scanCompleted=${discoverResult.scanCompleted}`
    )

    // Re-resolve "unknown" base_law_sfs records
    const unknownRecords = await prisma.amendmentDocument.findMany({
      where: {
        sfs_number: { startsWith: `SFS ${year}:` },
        base_law_sfs: 'unknown',
      },
      select: { id: true, sfs_number: true, title: true },
    })

    if (unknownRecords.length > 0) {
      console.log(
        `[DISCOVER-SFS] Re-resolving ${unknownRecords.length} "unknown" base_law_sfs records`
      )
      for (const rec of unknownRecords) {
        const resolved = rec.title ? extractBaseLawSfs(rec.title) : null
        if (resolved) {
          await prisma.amendmentDocument.update({
            where: { id: rec.id },
            data: { base_law_sfs: ensureSfsPrefix(resolved) },
          })
          console.log(
            `[DISCOVER-SFS] Resolved ${rec.sfs_number}: unknown → ${resolved}`
          )
        }
      }
    }

    const duration = `${Math.round((Date.now() - startTime) / 1000)}s`
    stats.duration = duration

    console.log(`[DISCOVER-SFS] ========== SUMMARY ==========`)
    console.log(`[DISCOVER-SFS] Pages scanned: ${stats.pagesScanned}`)
    console.log(`[DISCOVER-SFS] Discovered: ${stats.discovered}`)
    console.log(`[DISCOVER-SFS] Already exists: ${stats.alreadyExists}`)
    console.log(`[DISCOVER-SFS] PENDING created: ${stats.pendingCreated}`)
    console.log(`[DISCOVER-SFS] New laws skipped: ${stats.newLawsSkipped}`)
    console.log(
      `[DISCOVER-SFS] Scan completed: ${discoverResult.scanCompleted}`
    )
    console.log(`[DISCOVER-SFS] Duration: ${duration}`)
    console.log(`[DISCOVER-SFS] ==============================`)

    try {
      await sendAmendmentDiscoveryEmail(stats, duration, true)
    } catch (emailErr) {
      console.error(
        '[DISCOVER-SFS] Failed to send notification email:',
        emailErr
      )
    }

    if (runId) {
      await completeJobRun(runId, {
        itemsProcessed: stats.pendingCreated,
        itemsFailed: 0,
        metadata: {
          pagesScanned: stats.pagesScanned,
          scanCompleted: discoverResult.scanCompleted,
          highestOnIndex: discoverResult.highestNumericPart,
        },
      })
    }

    return NextResponse.json({
      success: true,
      scanCompleted: discoverResult.scanCompleted,
      highestOnIndex: discoverResult.highestNumericPart,
      ...stats,
    })
  } catch (error) {
    const duration = `${Math.round((Date.now() - startTime) / 1000)}s`
    stats.duration = duration

    console.error('[DISCOVER-SFS] Cron failed:', error)

    if (runId) {
      await failJobRun(
        runId,
        error instanceof Error ? error : new Error(String(error))
      )
    }

    try {
      await sendAmendmentDiscoveryEmail(
        stats,
        duration,
        false,
        error instanceof Error ? error.message : 'Unknown error'
      )
    } catch {
      // email failure is non-fatal
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
 * Numbers we already have for the year — the union of discovered amendments
 * (AmendmentDocument) and ingested laws (LegalDocument, which covers new laws
 * arriving via the Riksdagen pipeline). Passed to discoverFromIndex so it
 * returns only genuinely-missing index rows, including gaps below the highest
 * known number.
 */
async function getKnownNumbers(year: number): Promise<Set<number>> {
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
  return known
}
