/* eslint-disable no-console */
/**
 * Backfill SFS amendments — discovery + processing, locally.
 *
 * Written for the 2026-07 incident recovery (discover-sfs-amendments cron
 * hard-killed on every run since 2026-06-17, amendments stale from 2026:1198)
 * but reusable for any future gap drain.
 *
 * Phase A: scan the full svenskforfattningssamling.se index for the year and
 *          create PENDING AmendmentDocument records for every missing
 *          amendment/repeal (same logic as the discover cron). New laws are
 *          reported (they arrive via Riksdagen/sync-sfs, which lags the
 *          official register by days-to-weeks).
 * Phase B: drain the PENDING/FAILED queue through the shared pipeline
 *          (lib/sfs/amendment-processor) sequentially. Records are claimed
 *          atomically, so this is safe to run alongside the prod
 *          process-sfs-amendments cron.
 *
 * Usage:
 *   npx tsx scripts/backfill-sfs-amendments.ts                 # both phases
 *   npx tsx scripts/backfill-sfs-amendments.ts --discover-only
 *   npx tsx scripts/backfill-sfs-amendments.ts --process-only --limit 20
 *   npx tsx scripts/backfill-sfs-amendments.ts --year 2025
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

// SAFE SEQUENTIAL PROFILE — see scripts/ingest-eu-corpus.ts for the incident
// history. Session-mode connection (DIRECT_URL:5432), one connection, one
// statement in flight; pgbouncer=true prevents lib/prisma's singleton from
// clobbering the profile with connection_limit=10.
if (process.env.DIRECT_URL) {
  const sessionUrl = new URL(process.env.DIRECT_URL)
  sessionUrl.searchParams.set('connection_limit', '1')
  sessionUrl.searchParams.set('pool_timeout', '300')
  sessionUrl.searchParams.set('pgbouncer', 'true')
  process.env.DATABASE_URL = sessionUrl.toString()
  console.log(
    '🔌 Using session-mode DB connection (DIRECT_URL:5432, SAFE SEQUENTIAL: limit 1)'
  )
}

import { prisma } from '../lib/prisma'
import { ParseStatus, Prisma } from '@prisma/client'
import {
  discoverFromIndex,
  extractSfsNumericPart,
} from '../lib/sfs/sfs-amendment-crawler'
import { constructStoragePath } from '../lib/sfs/pdf-urls'
import { ensureSfsPrefix } from '../lib/sfs/ensure-prefix'
import { buildSlugMap } from '../lib/linkify'
import {
  claimAmendmentRecord,
  processAmendmentRecord,
  releaseFailedRecord,
  resetStuckProcessing,
  type AmendmentProcessingStats,
} from '../lib/sfs/amendment-processor'

const args = process.argv.slice(2)
const DISCOVER_ONLY = args.includes('--discover-only')
const PROCESS_ONLY = args.includes('--process-only')
const YEAR = parseInt(
  args[args.indexOf('--year') + 1] && args.includes('--year')
    ? args[args.indexOf('--year') + 1]!
    : String(new Date().getFullYear()),
  10
)
const LIMIT = args.includes('--limit')
  ? parseInt(args[args.indexOf('--limit') + 1]!, 10)
  : Infinity

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

async function discoverPhase(): Promise<void> {
  console.log(`\n═══ Phase A: Discovery (${YEAR}) ═══`)
  const knownNumbers = await getKnownNumbers(YEAR)
  console.log(
    `Known ${YEAR} numbers: ${knownNumbers.size}` +
      (knownNumbers.size > 0 ? ` (max ${Math.max(...knownNumbers)})` : '')
  )

  let pendingCreated = 0
  const newLawGaps: string[] = []

  const result = await discoverFromIndex(YEAR, {
    knownNumbers,
    requestDelayMs: 200,
    onPage: async (documents, { pagesScanned }) => {
      for (const doc of documents) {
        if (doc.documentType === 'new_law') {
          newLawGaps.push(`${doc.sfsNumber} (publ ${doc.publishedDate})`)
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
          pendingCreated++
          console.log(
            `  [page ${pagesScanned}] + PENDING ${doc.sfsNumber} — ${doc.title.slice(0, 70)}`
          )
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
    },
  })

  console.log(
    `\nDiscovery done: ${result.pagesScanned} pages, highest ${YEAR}:${result.highestNumericPart}, scanCompleted=${result.scanCompleted}`
  )
  console.log(`PENDING created: ${pendingCreated}`)
  if (newLawGaps.length > 0) {
    console.log(
      `\n⚠️  ${newLawGaps.length} NEW LAWS on the official register missing from legal_documents.`
    )
    console.log(
      `These arrive via the Riksdagen API (sync-sfs cron), which lags the official register — no action needed unless the lag exceeds ~3 weeks:`
    )
    for (const g of newLawGaps) console.log(`  - ${g}`)
  }
}

async function processPhase(): Promise<void> {
  console.log(`\n═══ Phase B: Processing (${YEAR}) ═══`)

  const recovered = await resetStuckProcessing(30)
  if (recovered > 0)
    console.log(`Recovered ${recovered} stuck PROCESSING → PENDING`)

  const queue = await prisma.amendmentDocument.findMany({
    where: {
      sfs_number: { startsWith: `SFS ${YEAR}:` },
      parse_status: { in: [ParseStatus.PENDING, ParseStatus.FAILED] },
      base_law_sfs: { not: 'unknown' },
    },
    orderBy: { created_at: 'asc' },
  })

  const total = Math.min(queue.length, LIMIT)
  console.log(`Queue: ${queue.length} records; processing ${total}`)

  const slugMap = await buildSlugMap()
  const stats: AmendmentProcessingStats = {
    processed: 0,
    failed: 0,
    changeEventsCreated: 0,
    pdfsFetched: 0,
    pdfsStored: 0,
    pdfsFailed: 0,
    repealsProcessed: 0,
  }

  const startTime = Date.now()
  let attempted = 0

  for (const record of queue) {
    if (attempted >= LIMIT) break

    const claimed = await claimAmendmentRecord(record.id)
    if (!claimed) {
      console.log(`  ~ ${record.sfs_number} claimed elsewhere, skipping`)
      continue
    }
    attempted++

    const elapsed = Math.round((Date.now() - startTime) / 1000)
    console.log(
      `\n[${attempted}/${total}] (${elapsed}s elapsed, ${stats.processed} ok, ${stats.failed} failed) ${record.sfs_number}`
    )

    try {
      await processAmendmentRecord(record, slugMap, stats, {
        llm: { maxRetries: 2, timeoutMs: 150_000 },
      })
    } catch (error) {
      stats.failed++
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error(`  ✗ ${record.sfs_number}: ${errMsg}`)
      await releaseFailedRecord(record.id, errMsg)
    }
  }

  const remaining = await prisma.amendmentDocument.count({
    where: {
      sfs_number: { startsWith: `SFS ${YEAR}:` },
      parse_status: { in: [ParseStatus.PENDING, ParseStatus.FAILED] },
    },
  })

  console.log(`\n═══ Processing summary ═══`)
  console.log(
    `Processed: ${stats.processed} (${stats.repealsProcessed} repeals)`
  )
  console.log(`Failed:    ${stats.failed}`)
  console.log(`ChangeEvents created: ${stats.changeEventsCreated}`)
  console.log(
    `PDFs fetched/stored/failed: ${stats.pdfsFetched}/${stats.pdfsStored}/${stats.pdfsFailed}`
  )
  console.log(`Remaining in queue: ${remaining}`)
  console.log(`Duration: ${Math.round((Date.now() - startTime) / 60000)} min`)
}

async function main() {
  if (!PROCESS_ONLY) await discoverPhase()
  if (!DISCOVER_ONLY) await processPhase()
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e)
    process.exitCode = 1
  })
  .finally(() => process.exit())
