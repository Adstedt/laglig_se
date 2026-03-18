/**
 * Enrich Amendment Summaries Cron Job
 *
 * Story 8.8: Generates brief AI summaries for amendments that lack them.
 * Runs at 06:30 UTC — after discover-sfs-amendments (10:00-13:00 previous day),
 * before notify-amendment-changes (07:00) sends emails.
 *
 * Populates ChangeEvent.ai_summary + amendment LegalDocument.summary
 * so notification emails show meaningful content instead of fallback text.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { startJobRun, completeJobRun, failJobRun } from '@/lib/admin/job-logger'
import {
  buildAmendmentSummaryPrompt,
  buildAmendmentContext,
  type SectionChangeInfo,
} from '@/lib/ai/prompts/amendment-summary'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const CRON_SECRET = process.env.CRON_SECRET
const TIMEOUT_BUFFER_MS = 30_000
const BATCH_LIMIT = 30
const SONNET_MODEL = 'claude-sonnet-4-20250514'

interface EnrichStats {
  enriched: number
  skipped: number
  failed: number
  alreadyHadSummary: number
  failures: Array<{ sfsNumber: string; error: string }>
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
    runId = await startJobRun('enrich-amendment-summaries', triggeredBy)
  } catch {
    console.error('[ENRICH-SUMMARIES] Failed to start job run logging')
  }

  const stats: EnrichStats = {
    enriched: 0,
    skipped: 0,
    failed: 0,
    alreadyHadSummary: 0,
    failures: [],
  }

  try {
    console.log('[ENRICH-SUMMARIES] ========================================')
    console.log('[ENRICH-SUMMARIES] Starting amendment summary enrichment')
    console.log(`[ENRICH-SUMMARIES] Batch limit: ${BATCH_LIMIT}`)
    console.log('[ENRICH-SUMMARIES] ========================================')

    // Find un-enriched amendments grouped by amendment_sfs
    // Join path: ChangeEvent.amendment_sfs → AmendmentDocument.sfs_number → LegalDocument
    const unenriched = await prisma.$queryRaw<
      Array<{
        amendment_sfs: string
        change_event_ids: string[]
        base_law_id: string
        base_law_title: string
        base_law_summary: string | null
        amendment_id: string
        amendment_title: string | null
        amendment_markdown: string | null
        amendment_effective_date: Date | null
        amendment_legal_doc_id: string | null
      }>
    >`
      SELECT
        ce.amendment_sfs,
        ARRAY_AGG(ce.id) as change_event_ids,
        MIN(bl.id) as base_law_id,
        MIN(bl.title) as base_law_title,
        MIN(bl.summary) as base_law_summary,
        MIN(ad.id) as amendment_id,
        MIN(ad.title) as amendment_title,
        MIN(ad.markdown_content) as amendment_markdown,
        MIN(ad.effective_date) as amendment_effective_date,
        MIN(ald.id) as amendment_legal_doc_id
      FROM change_events ce
      JOIN legal_documents bl ON bl.id = ce.document_id
      JOIN amendment_documents ad ON ad.sfs_number = REPLACE(ce.amendment_sfs, 'SFS ', '')
      LEFT JOIN legal_documents ald ON ald.document_number = ce.amendment_sfs AND ald.content_type = 'SFS_AMENDMENT'
      WHERE ce.ai_summary IS NULL
        AND ce.amendment_sfs IS NOT NULL
        AND ad.parse_status = 'COMPLETED'
        AND ad.markdown_content IS NOT NULL
      GROUP BY ce.amendment_sfs
      ORDER BY MIN(ce.detected_at) ASC
      LIMIT ${BATCH_LIMIT}
    `

    console.log(
      `[ENRICH-SUMMARIES] Found ${unenriched.length} amendments needing summaries`
    )

    if (unenriched.length === 0) {
      console.log(
        '[ENRICH-SUMMARIES] Nothing to process — all amendments have summaries'
      )
    }

    const anthropic = new Anthropic()
    const systemPrompt = buildAmendmentSummaryPrompt()

    for (const row of unenriched) {
      // Timeout protection
      const elapsed = Date.now() - startTime
      if (elapsed > maxDuration * 1000 - TIMEOUT_BUFFER_MS) {
        console.log(
          `[ENRICH-SUMMARIES] Approaching timeout (${Math.round(elapsed / 1000)}s elapsed), stopping`
        )
        break
      }

      const sfsNumber = row.amendment_sfs.replace('SFS ', '')

      if (!row.amendment_markdown) {
        stats.skipped++
        console.log(
          `[ENRICH-SUMMARIES] ${row.amendment_sfs} — no markdown, skipping`
        )
        continue
      }

      try {
        // Fetch section changes for structure context
        const sectionChanges = await prisma.sectionChange.findMany({
          where: { amendment_id: row.amendment_id },
          select: {
            chapter: true,
            section: true,
            change_type: true,
          },
          orderBy: { sort_order: 'asc' },
        })

        const scInfo: SectionChangeInfo[] = sectionChanges.map((sc) => ({
          chapter: sc.chapter,
          section: sc.section,
          changeType: sc.change_type,
        }))

        const userMessage = buildAmendmentContext(
          {
            sfsNumber,
            title: row.amendment_title,
            markdownContent: row.amendment_markdown,
            effectiveDate: row.amendment_effective_date,
          },
          {
            title: row.base_law_title,
            summary: row.base_law_summary,
          },
          scInfo
        )

        console.log(
          `[ENRICH-SUMMARIES] Generating summary for ${row.amendment_sfs}...`
        )

        const summary = await generateWithRetry(
          anthropic,
          systemPrompt,
          userMessage,
          row.amendment_sfs
        )

        if (!summary) {
          stats.failed++
          stats.failures.push({
            sfsNumber: row.amendment_sfs,
            error: 'Empty LLM response after retry',
          })
          console.error(
            `[ENRICH-SUMMARIES]   ✗ ${row.amendment_sfs} — empty response after retry`
          )
          continue
        }

        // Store on all related ChangeEvents
        const now = new Date()
        await prisma.changeEvent.updateMany({
          where: { id: { in: row.change_event_ids } },
          data: {
            ai_summary: summary,
            ai_summary_generated_at: now,
          },
        })

        // Store on amendment LegalDocument.summary (if it exists)
        if (row.amendment_legal_doc_id) {
          await prisma.legalDocument.update({
            where: { id: row.amendment_legal_doc_id },
            data: { summary },
          })
        }

        stats.enriched++
        console.log(
          `[ENRICH-SUMMARIES]   ✓ ${row.amendment_sfs}: "${summary.substring(0, 80)}..."`
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        stats.failed++
        stats.failures.push({
          sfsNumber: row.amendment_sfs,
          error: msg.slice(0, 200),
        })
        console.error(
          `[ENRICH-SUMMARIES]   ✗ ${row.amendment_sfs} failed: ${msg.slice(0, 200)}`
        )
      }
    }

    const duration = Date.now() - startTime
    const durationStr = `${Math.round(duration / 1000)}s`

    console.log('[ENRICH-SUMMARIES] ============ SUMMARY ============')
    console.log(`[ENRICH-SUMMARIES] Enriched:           ${stats.enriched}`)
    console.log(`[ENRICH-SUMMARIES] Skipped:            ${stats.skipped}`)
    console.log(`[ENRICH-SUMMARIES] Failed:             ${stats.failed}`)
    console.log(
      `[ENRICH-SUMMARIES] Already had summary: ${stats.alreadyHadSummary}`
    )
    console.log(`[ENRICH-SUMMARIES] Duration:           ${durationStr}`)
    console.log('[ENRICH-SUMMARIES] =====================================')

    if (runId) {
      await completeJobRun(runId, {
        itemsProcessed: stats.enriched,
        itemsFailed: stats.failed,
      })
    }

    return NextResponse.json({
      success: true,
      stats,
      duration: durationStr,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[ENRICH-SUMMARIES] Fatal error:', error)

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

const RETRY_DELAY_MS = 5000

async function generateWithRetry(
  anthropic: InstanceType<typeof Anthropic>,
  systemPrompt: string,
  userMessage: string,
  sfsLabel: string
): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: SONNET_MODEL,
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      })

      const text =
        response.content[0]?.type === 'text'
          ? response.content[0].text.trim()
          : null

      if (text) return text

      if (attempt === 1) {
        console.warn(
          `[ENRICH-SUMMARIES]   ${sfsLabel} — empty response, retrying in ${RETRY_DELAY_MS / 1000}s...`
        )
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (attempt === 1) {
        console.warn(
          `[ENRICH-SUMMARIES]   ${sfsLabel} — attempt 1 failed (${msg.slice(0, 100)}), retrying in ${RETRY_DELAY_MS / 1000}s...`
        )
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
      } else {
        throw err // Re-throw on second failure — caught by outer try/catch
      }
    }
  }
  return null
}
