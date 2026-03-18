/**
 * Process Chunks Cron Job
 *
 * Finds LegalDocuments (SFS_LAW, AGENCY_REGULATION) that need chunking:
 *   - Documents with no ContentChunk records
 *   - Documents where updated_at > latest chunk created_at
 *
 * Calls syncDocumentChunks() for each, which handles:
 *   - Tier-based chunking (json → paragraf, markdown → paragraph-merge)
 *   - Context prefix generation (Claude Haiku)
 *   - Embedding generation (OpenAI text-embedding-3-small)
 *
 * Scheduled at 14:00 + 18:00 UTC to catch documents from upstream crons.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startJobRun, completeJobRun, failJobRun } from '@/lib/admin/job-logger'
import { syncDocumentChunks } from '@/lib/chunks/sync-document-chunks'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for cron

const CRON_SECRET = process.env.CRON_SECRET
const TIMEOUT_BUFFER_MS = 30_000
const BATCH_LIMIT = 50

interface ProcessStats {
  docsFound: number
  docsProcessed: number
  docsFailed: number
  chunksCreated: number
  chunksDeleted: number
  chunksEmbedded: number
  earlyTerminated: boolean
  failures: Array<{ documentNumber: string; error: string }>
}

export async function GET(request: Request) {
  const startTime = Date.now()

  // Auth check
  const authHeader = request.headers.get('authorization')
  const isDevelopment = process.env.NODE_ENV === 'development'

  if (!isDevelopment && CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const triggeredBy = request.headers.get('x-triggered-by') || 'cron'
  let runId: string | undefined

  try {
    runId = await startJobRun('process-chunks', triggeredBy)
  } catch {
    console.error('[PROCESS-CHUNKS] Failed to start job run logging')
  }

  const stats: ProcessStats = {
    docsFound: 0,
    docsProcessed: 0,
    docsFailed: 0,
    chunksCreated: 0,
    chunksDeleted: 0,
    chunksEmbedded: 0,
    earlyTerminated: false,
    failures: [],
  }

  try {
    console.log('[PROCESS-CHUNKS] ========================================')
    console.log('[PROCESS-CHUNKS] Starting chunk processing run')
    console.log(`[PROCESS-CHUNKS] Batch limit: ${BATCH_LIMIT}`)
    console.log('[PROCESS-CHUNKS] ========================================')

    // Find documents needing chunking:
    // 1. Documents with no chunks at all
    // 2. Documents updated since their last chunk
    const docsNeedingChunks = await prisma.$queryRaw<
      Array<{ id: string; document_number: string; reason: string }>
    >`
      SELECT ld.id, ld.document_number,
        CASE
          WHEN max_chunk_created IS NULL THEN 'no_chunks'
          ELSE 'stale_chunks'
        END as reason
      FROM legal_documents ld
      LEFT JOIN (
        SELECT source_id, MAX(created_at) as max_chunk_created
        FROM content_chunks
        WHERE source_type = 'LEGAL_DOCUMENT'
        GROUP BY source_id
      ) cc ON cc.source_id = ld.id
      WHERE ld.content_type IN ('SFS_LAW', 'AGENCY_REGULATION')
        AND (ld.html_content IS NOT NULL OR ld.json_content IS NOT NULL OR ld.markdown_content IS NOT NULL)
        AND (
          cc.max_chunk_created IS NULL
          OR ld.updated_at > cc.max_chunk_created
        )
      ORDER BY ld.updated_at DESC
      LIMIT ${BATCH_LIMIT}
    `

    stats.docsFound = docsNeedingChunks.length
    console.log(
      `[PROCESS-CHUNKS] Found ${stats.docsFound} documents needing chunk processing`
    )

    if (stats.docsFound === 0) {
      console.log(
        '[PROCESS-CHUNKS] Nothing to process — all documents are up to date'
      )
    }

    for (const doc of docsNeedingChunks) {
      // Timeout protection
      const elapsed = Date.now() - startTime
      if (elapsed > maxDuration * 1000 - TIMEOUT_BUFFER_MS) {
        console.log(
          `[PROCESS-CHUNKS] Approaching timeout (${Math.round(elapsed / 1000)}s elapsed), stopping gracefully`
        )
        stats.earlyTerminated = true
        break
      }

      try {
        console.log(
          `[PROCESS-CHUNKS] Processing: ${doc.document_number} (${doc.reason})`
        )
        const result = await syncDocumentChunks(doc.id)

        stats.docsProcessed++
        stats.chunksCreated += result.chunksCreated
        stats.chunksDeleted += result.chunksDeleted
        stats.chunksEmbedded += result.chunksEmbedded

        console.log(
          `[PROCESS-CHUNKS]   ✓ ${doc.document_number}: ` +
            `${result.chunksCreated} chunks created, ` +
            `${result.chunksEmbedded} embedded ` +
            `(${result.duration}ms)`
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        stats.docsFailed++
        stats.failures.push({
          documentNumber: doc.document_number,
          error: msg.slice(0, 200),
        })
        console.error(
          `[PROCESS-CHUNKS]   ✗ ${doc.document_number} failed: ${msg.slice(0, 200)}`
        )
      }
    }

    const duration = Date.now() - startTime
    const durationStr = `${Math.round(duration / 1000)}s`

    console.log('[PROCESS-CHUNKS] ============ SUMMARY ============')
    console.log(`[PROCESS-CHUNKS] Documents found:     ${stats.docsFound}`)
    console.log(`[PROCESS-CHUNKS] Documents processed: ${stats.docsProcessed}`)
    console.log(`[PROCESS-CHUNKS] Documents failed:    ${stats.docsFailed}`)
    console.log(`[PROCESS-CHUNKS] Chunks created:      ${stats.chunksCreated}`)
    console.log(`[PROCESS-CHUNKS] Chunks deleted:      ${stats.chunksDeleted}`)
    console.log(`[PROCESS-CHUNKS] Chunks embedded:     ${stats.chunksEmbedded}`)
    console.log(
      `[PROCESS-CHUNKS] Early terminated:   ${stats.earlyTerminated ? 'YES' : 'NO'}`
    )
    console.log(`[PROCESS-CHUNKS] Duration:           ${durationStr}`)
    console.log('[PROCESS-CHUNKS] =====================================')

    if (runId) {
      await completeJobRun(runId, {
        itemsProcessed: stats.docsProcessed,
        itemsFailed: stats.docsFailed,
      })
    }

    return NextResponse.json({
      success: true,
      stats,
      duration: durationStr,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[PROCESS-CHUNKS] Fatal error:', error)

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
        stats,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
