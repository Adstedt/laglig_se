/**
 * One-off backfill: generate AI summaries for all amendments that lack them.
 *
 * Usage:
 *   npx tsx scripts/backfill-amendment-summaries.ts
 *   npx tsx scripts/backfill-amendment-summaries.ts --dry-run
 *
 * Reuses the same prompt and context assembly as the cron job (Story 8.8),
 * but removes the batch limit and timeout constraints.
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { PrismaClient } from '@prisma/client'
import Anthropic from '@anthropic-ai/sdk'
import {
  buildAmendmentSummaryPrompt,
  buildAmendmentContext,
  type SectionChangeInfo,
} from '../lib/ai/prompts/amendment-summary'

const prisma = new PrismaClient()
const anthropic = new Anthropic()

const SONNET_MODEL = 'claude-sonnet-4-20250514'
const RETRY_DELAY_MS = 5_000
const DRY_RUN = process.argv.includes('--dry-run')

interface Stats {
  enriched: number
  skipped: number
  failed: number
  failures: Array<{ sfs: string; error: string }>
}

async function generateWithRetry(
  systemPrompt: string,
  userMessage: string,
  label: string
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
          `  ${label} — empty response, retrying in ${RETRY_DELAY_MS / 1000}s...`
        )
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (attempt === 1) {
        console.warn(
          `  ${label} — attempt 1 failed (${msg.slice(0, 100)}), retrying...`
        )
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
      } else {
        throw err
      }
    }
  }
  return null
}

async function main() {
  console.log('=== Amendment Summary Backfill ===')
  if (DRY_RUN) console.log('(DRY RUN — no writes)\n')

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
    JOIN amendment_documents ad ON ad.sfs_number = ce.amendment_sfs
    LEFT JOIN legal_documents ald ON ald.document_number = ce.amendment_sfs AND ald.content_type = 'SFS_AMENDMENT'
    WHERE ce.ai_summary IS NULL
      AND ce.amendment_sfs IS NOT NULL
      AND ad.parse_status = 'COMPLETED'
      AND ad.markdown_content IS NOT NULL
    GROUP BY ce.amendment_sfs
    ORDER BY MIN(ce.detected_at) ASC
  `

  console.log(`Found ${unenriched.length} amendments needing summaries\n`)

  if (unenriched.length === 0) {
    console.log('Nothing to backfill!')
    return
  }

  if (DRY_RUN) {
    for (const row of unenriched) {
      console.log(
        `  ${row.amendment_sfs} — ${row.change_event_ids.length} change event(s), base: ${row.base_law_title?.slice(0, 60)}`
      )
    }
    return
  }

  const stats: Stats = { enriched: 0, skipped: 0, failed: 0, failures: [] }
  const systemPrompt = buildAmendmentSummaryPrompt()
  const startTime = Date.now()

  for (let i = 0; i < unenriched.length; i++) {
    const row = unenriched[i]
    const progress = `[${i + 1}/${unenriched.length}]`

    if (!row.amendment_markdown) {
      stats.skipped++
      console.log(`${progress} ${row.amendment_sfs} — no markdown, skipping`)
      continue
    }

    try {
      const sfsNumber = row.amendment_sfs.replace('SFS ', '')

      const sectionChanges = await prisma.sectionChange.findMany({
        where: { amendment_id: row.amendment_id },
        select: { chapter: true, section: true, change_type: true },
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
        { title: row.base_law_title, summary: row.base_law_summary },
        scInfo
      )

      const summary = await generateWithRetry(
        systemPrompt,
        userMessage,
        row.amendment_sfs
      )

      if (!summary) {
        stats.failed++
        stats.failures.push({
          sfs: row.amendment_sfs,
          error: 'Empty response after retry',
        })
        console.log(`${progress} ✗ ${row.amendment_sfs} — empty response`)
        continue
      }

      const now = new Date()
      await prisma.changeEvent.updateMany({
        where: { id: { in: row.change_event_ids } },
        data: { ai_summary: summary, ai_summary_generated_at: now },
      })

      if (row.amendment_legal_doc_id) {
        await prisma.legalDocument.update({
          where: { id: row.amendment_legal_doc_id },
          data: { summary },
        })
      }

      stats.enriched++
      console.log(
        `${progress} ✓ ${row.amendment_sfs}: "${summary.substring(0, 80)}..."`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      stats.failed++
      stats.failures.push({ sfs: row.amendment_sfs, error: msg.slice(0, 200) })
      console.error(`${progress} ✗ ${row.amendment_sfs}: ${msg.slice(0, 200)}`)
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000)
  const cost = (stats.enriched * 0.002).toFixed(2)

  console.log('\n=== Results ===')
  console.log(`Enriched: ${stats.enriched}`)
  console.log(`Skipped:  ${stats.skipped}`)
  console.log(`Failed:   ${stats.failed}`)
  console.log(`Duration: ${duration}s`)
  console.log(`Est cost: ~$${cost}`)

  if (stats.failures.length > 0) {
    console.log('\nFailures:')
    for (const f of stats.failures) {
      console.log(`  ${f.sfs}: ${f.error}`)
    }
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
