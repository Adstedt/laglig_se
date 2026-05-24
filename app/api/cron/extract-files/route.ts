/**
 * Extract-Files Cron Job (Story 17.8)
 *
 * Processes uploaded WorkspaceFiles queued for text extraction:
 *   - PENDING, non-folder files → extractFile() → markdown on extracted_text
 *   - Re-enqueues PROCESSING rows orphaned by a crashed/timed-out previous run
 *
 * Runs GLOBAL-scope (cron has no session) via the service-role storage client +
 * direct prisma. Idempotent: each file is claimed with an atomic
 * updateMany(PENDING→PROCESSING) so overlapping runs never double-process.
 *
 * On DONE, Story 17.9 wires the chunk+embed hand-off here (see the marked seam).
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStorageClient } from '@/lib/supabase/storage'
import { startJobRun, completeJobRun, failJobRun } from '@/lib/admin/job-logger'
import { extractFile } from '@/lib/documents/extract-file'
import { estimateCostUsd } from '@/lib/usage/cost-estimator'
import { syncWorkspaceChunks } from '@/lib/chunks/sync-workspace-chunks'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for cron

const CRON_SECRET = process.env.CRON_SECRET
const TIMEOUT_BUFFER_MS = 30_000
const BATCH_LIMIT = 25
const BUCKET_NAME = 'workspace-files'
// A row stuck PROCESSING longer than this is assumed orphaned (the previous run
// crashed/timed out mid-file) and re-enqueued to PENDING.
const STALE_PROCESSING_MS = 15 * 60 * 1000

interface ExtractStats {
  reEnqueued: number
  filesFound: number
  processed: number
  done: number
  failed: number
  skipped: number
  earlyTerminated: boolean
}

export async function GET(request: Request) {
  const startTime = Date.now()

  const authHeader = request.headers.get('authorization')
  const isDevelopment = process.env.NODE_ENV === 'development'
  if (!isDevelopment && CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const triggeredBy = request.headers.get('x-triggered-by') || 'cron'
  let runId: string | undefined
  try {
    runId = await startJobRun('extract-files', triggeredBy)
  } catch {
    console.error('[EXTRACT-FILES] Failed to start job run logging')
  }

  const stats: ExtractStats = {
    reEnqueued: 0,
    filesFound: 0,
    processed: 0,
    done: 0,
    failed: 0,
    skipped: 0,
    earlyTerminated: false,
  }

  try {
    // 1. Re-enqueue orphaned PROCESSING rows (crash/timeout recovery).
    const reEnqueued = await prisma.workspaceFile.updateMany({
      where: {
        extraction_status: 'PROCESSING',
        updated_at: { lt: new Date(Date.now() - STALE_PROCESSING_MS) },
      },
      data: { extraction_status: 'PENDING' },
    })
    stats.reEnqueued = reEnqueued.count

    // 2. Find PENDING non-folder files (global scope).
    const pending = await prisma.workspaceFile.findMany({
      where: { extraction_status: 'PENDING', is_folder: false },
      select: {
        id: true,
        workspace_id: true,
        uploaded_by: true,
        mime_type: true,
        storage_path: true,
        filename: true,
        category: true, // Story 17.9 — chunk metadata + contextual_header
        content_hash: true, // Story 17.9 — re-embed dedupe gate
      },
      orderBy: { created_at: 'asc' },
      take: BATCH_LIMIT,
    })
    stats.filesFound = pending.length

    const storage = getStorageClient()

    for (const file of pending) {
      if (Date.now() - startTime > maxDuration * 1000 - TIMEOUT_BUFFER_MS) {
        stats.earlyTerminated = true
        break
      }

      // Idempotent claim: only THIS run may flip PENDING→PROCESSING.
      const claim = await prisma.workspaceFile.updateMany({
        where: { id: file.id, extraction_status: 'PENDING' },
        data: { extraction_status: 'PROCESSING' },
      })
      if (claim.count !== 1) {
        stats.skipped++ // another run claimed it first
        continue
      }

      try {
        if (!file.storage_path) {
          await prisma.workspaceFile.update({
            where: { id: file.id },
            data: { extraction_status: 'FAILED', extracted_at: new Date() },
          })
          stats.processed++
          stats.failed++
          continue
        }

        const { data: blob, error } = await storage.storage
          .from(BUCKET_NAME)
          .download(file.storage_path)
        if (error || !blob) {
          console.error(
            `[EXTRACT-FILES] download failed for ${file.id}: ${error?.message ?? 'no blob'}`
          )
          await prisma.workspaceFile.update({
            where: { id: file.id },
            data: { extraction_status: 'FAILED', extracted_at: new Date() },
          })
          stats.processed++
          stats.failed++
          continue
        }

        const buffer = Buffer.from(await blob.arrayBuffer())
        const result = await extractFile(buffer, file.mime_type)

        await prisma.workspaceFile.update({
          where: { id: file.id },
          data: {
            extraction_status: result.status,
            extracted_text: result.markdown,
            extracted_at: new Date(),
          },
        })
        stats.processed++
        if (result.status === 'DONE') stats.done++
        else if (result.status === 'FAILED') stats.failed++

        if (result.truncated) {
          console.warn(
            `[EXTRACT-FILES] ${file.filename} (${file.id}) truncated at 200k chars`
          )
        }

        // FILE_EXTRACTION cost telemetry (PDF/LLM path only). Fail-safe.
        if (result.usage) {
          try {
            await prisma.chatUsageEvent.create({
              data: {
                workspace_id: file.workspace_id,
                user_id: file.uploaded_by,
                model: result.usage.model,
                context_type: 'FILE_EXTRACTION',
                input_tokens: result.usage.inputTokens,
                output_tokens: result.usage.outputTokens,
                cost_usd_estimate: estimateCostUsd({
                  model: result.usage.model,
                  inputTokens: result.usage.inputTokens,
                  outputTokens: result.usage.outputTokens,
                  cacheReadInputTokens: 0,
                  cacheWriteInputTokens: 0,
                  reasoningTokens: 0,
                }),
              },
            })
          } catch (e) {
            console.error('[EXTRACT-FILES] usage telemetry write failed:', e)
          }
        }

        // ── Story 17.9: chunk + embed into the RAG pipeline ─────────────────
        // On DONE, hand off the extracted markdown for workspace-scoped indexing.
        // Cron-triggered (not fire-and-forget) per 17.8/17.9's reliability rule.
        // Fail-safe: a chunking error must not fail the file (already DONE) or the
        // rest of the batch — it's retryable via re-sync / extractWorkspaceFile.
        // Story 19.1: CHAT_ATTACHMENT files are conversational — extracted (so the
        // chat converter can read them) but NOT embedded into the RAG index. They
        // become searchable only if promoted to a curated category (Story 19.1b).
        if (
          result.status === 'DONE' &&
          result.markdown &&
          file.category !== 'CHAT_ATTACHMENT'
        ) {
          try {
            const sync = await syncWorkspaceChunks(
              file.id,
              'USER_FILE',
              file.workspace_id,
              result.markdown,
              {
                filename: file.filename,
                category: file.category,
                content_hash: file.content_hash,
              }
            )
            if (sync.skipped) {
              console.log(
                `[EXTRACT-FILES] ${file.id} chunks unchanged (content_hash) — re-embed skipped`
              )
            } else {
              console.log(
                `[EXTRACT-FILES] ${file.id} indexed: ${sync.chunksCreated} chunks, ${sync.chunksEmbedded} embedded`
              )
            }
          } catch (e) {
            console.error(
              `[EXTRACT-FILES] chunk+embed failed for ${file.id}:`,
              e instanceof Error ? e.message : e
            )
          }
        }
        // ────────────────────────────────────────────────────────────────────
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[EXTRACT-FILES] ${file.id} failed: ${msg.slice(0, 200)}`)
        await prisma.workspaceFile
          .update({
            where: { id: file.id },
            data: { extraction_status: 'FAILED', extracted_at: new Date() },
          })
          .catch(() => {})
        stats.processed++
        stats.failed++
      }
    }

    console.log('[EXTRACT-FILES] ============ SUMMARY ============')
    console.log(`[EXTRACT-FILES] Re-enqueued (stale): ${stats.reEnqueued}`)
    console.log(`[EXTRACT-FILES] Found:               ${stats.filesFound}`)
    console.log(`[EXTRACT-FILES] Processed:           ${stats.processed}`)
    console.log(`[EXTRACT-FILES] Done:                ${stats.done}`)
    console.log(`[EXTRACT-FILES] Failed:              ${stats.failed}`)
    console.log(`[EXTRACT-FILES] Skipped (claimed):   ${stats.skipped}`)
    console.log(
      `[EXTRACT-FILES] Early terminated:    ${stats.earlyTerminated ? 'YES' : 'NO'}`
    )
    console.log('[EXTRACT-FILES] =====================================')

    if (runId) {
      await completeJobRun(runId, {
        itemsProcessed: stats.processed,
        itemsFailed: stats.failed,
      })
    }

    return NextResponse.json({
      success: true,
      stats,
      duration: `${Math.round((Date.now() - startTime) / 1000)}s`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[EXTRACT-FILES] Fatal error:', error)
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
