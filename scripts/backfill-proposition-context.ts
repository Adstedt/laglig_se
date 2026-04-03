/**
 * Backfill Proposition Context for Existing Amendments
 * Story 8.24
 *
 * Finds all AmendmentDocuments with a Prop. reference in full_text but no
 * proposition_id, fetches context from riksdagen.se API, and updates records.
 *
 * Usage: npx tsx scripts/backfill-proposition-context.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client'
import {
  extractPropositionRef,
  fetchPropositionContext,
  type PropositionContext,
} from '../lib/riksdagen/proposition-fetcher'

const prisma = new PrismaClient()
const isDryRun = process.argv.includes('--dry-run')
const RATE_LIMIT_MS = 500 // 2 req/sec

async function main() {
  console.log(`[backfill-prop] Starting${isDryRun ? ' (DRY RUN)' : ''}...\n`)

  // Find amendments with full_text but no proposition_id
  const amendments = await prisma.amendmentDocument.findMany({
    where: {
      full_text: { not: null },
      proposition_id: null,
    },
    select: { id: true, sfs_number: true, full_text: true },
    orderBy: { sfs_number: 'asc' },
  })

  console.log(
    `[backfill-prop] Found ${amendments.length} amendments without proposition data\n`
  )

  // Extract prop references and deduplicate
  const byPropRef = new Map<
    string,
    { propRef: string; records: { id: string; sfs: string }[] }
  >()
  let withRef = 0
  let withoutRef = 0

  for (const a of amendments) {
    const propRef = extractPropositionRef(a.full_text!)
    if (propRef) {
      withRef++
      const entry = byPropRef.get(propRef) ?? { propRef, records: [] }
      entry.records.push({ id: a.id, sfs: a.sfs_number })
      byPropRef.set(propRef, entry)
    } else {
      withoutRef++
    }
  }

  console.log(`[backfill-prop] With prop reference: ${withRef}`)
  console.log(`[backfill-prop] Without (förordningar): ${withoutRef}`)
  console.log(
    `[backfill-prop] Unique propositions to fetch: ${byPropRef.size}\n`
  )

  if (isDryRun) {
    console.log('[backfill-prop] DRY RUN — no changes made')
    for (const [propRef, entry] of byPropRef) {
      console.log(
        `  ${propRef} → ${entry.records.map((r) => r.sfs).join(', ')}`
      )
    }
    await prisma.$disconnect()
    return
  }

  // Fetch and update
  let fetched = 0
  let enriched = 0
  let failed = 0
  const cache = new Map<string, PropositionContext | null>()

  for (const [propRef, entry] of byPropRef) {
    // Check cache first
    let context = cache.get(propRef)
    if (context === undefined) {
      context = await fetchPropositionContext(propRef)
      cache.set(propRef, context)
      fetched++

      if (context) {
        console.log(`  ✓ ${propRef}: ${context.title}`)
      } else {
        console.log(`  ✗ ${propRef}: no data from API`)
        failed++
      }

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS))
    }

    if (!context) continue

    // Update all amendments sharing this proposition
    for (const record of entry.records) {
      await prisma.amendmentDocument.update({
        where: { id: record.id },
        data: {
          proposition_id: context.id,
          proposition_title: context.title,
          proposition_summary: context.summary,
          proposition_organ: context.organ,
          proposition_datum: context.datum,
        },
      })
      enriched++
    }
  }

  console.log(`\n[backfill-prop] ========== SUMMARY ==========`)
  console.log(`[backfill-prop] Unique propositions fetched: ${fetched}`)
  console.log(`[backfill-prop] API failures: ${failed}`)
  console.log(`[backfill-prop] Amendments enriched: ${enriched}`)
  console.log(`[backfill-prop] Förordningar skipped: ${withoutRef}`)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('[backfill-prop] Fatal error:', err)
  process.exit(1)
})
