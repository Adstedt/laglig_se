/**
 * Backfill json_content and markdown_content for existing LegalDocument records.
 *
 * Targets documents that have html_content but are missing json_content.
 * Derives both fields from the existing html_content using the same
 * parseCanonicalHtml + htmlToMarkdown pipeline used in sync crons.
 *
 * Usage:
 *   npx tsx scripts/backfill-json-markdown.ts --dry-run
 *   npx tsx scripts/backfill-json-markdown.ts --limit 100
 *   npx tsx scripts/backfill-json-markdown.ts --resume
 *   npx tsx scripts/backfill-json-markdown.ts
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { parseCanonicalHtml } from '../lib/transforms/canonical-html-parser'
import { htmlToMarkdown } from '../lib/transforms/html-to-markdown'
import * as fs from 'fs'
import * as path from 'path'

const PROGRESS_FILE = path.join(
  __dirname,
  '..',
  'data',
  'backfill-json-md-progress.json'
)
const BATCH_SIZE = 50
const ALLOWED_TYPES = ['SFS_LAW', 'AGENCY_REGULATION']

interface Progress {
  lastProcessedId: string | null
  totalProcessed: number
  totalDerived: number
  totalErrors: number
  errors: Array<{ documentId: string; documentNumber: string; error: string }>
  startedAt: string
  lastUpdatedAt: string
}

function loadProgress(): Progress | null {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
    }
  } catch {
    // ignore
  }
  return null
}

function saveProgress(progress: Progress): void {
  const dir = path.dirname(PROGRESS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

/** Extract the bare number from document_number (e.g. "SFS 2024:123" → "2024:123") */
function extractNumber(documentNumber: string): string {
  return documentNumber.replace(/^SFS\s+/i, '')
}

async function main() {
  const args = process.argv.slice(2)
  const isResume = args.includes('--resume')
  const isDryRun = args.includes('--dry-run')
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]!, 10) : undefined

  // Scope: has html_content, missing json_content, in allowed types
  const whereClause = {
    content_type: { in: ALLOWED_TYPES },
    html_content: { not: null },
    json_content: { equals: Prisma.DbNull },
  }

  const totalInScope = await prisma.legalDocument.count({ where: whereClause })
  const totalAll = await prisma.legalDocument.count({
    where: { content_type: { in: ALLOWED_TYPES } },
  })

  console.log(`Total documents (SFS_LAW + AGENCY_REGULATION): ${totalAll}`)
  console.log(`Documents needing backfill (html but no json): ${totalInScope}`)
  if (limit) console.log(`  --limit: processing only ${limit} documents`)

  if (isDryRun) {
    // Show breakdown by content_type
    const byType = await prisma.legalDocument.groupBy({
      by: ['content_type'],
      where: whereClause,
      _count: true,
    })
    console.log(`\nBy content type:`)
    for (const t of byType) {
      console.log(`  ${t.content_type}: ${t._count}`)
    }

    // Count how many already have json_content
    const alreadyHaveJson = await prisma.legalDocument.count({
      where: {
        content_type: { in: ALLOWED_TYPES },
        json_content: { not: Prisma.DbNull },
      },
    })
    console.log(`\nAlready have json_content: ${alreadyHaveJson}`)

    // Count how many already have markdown_content
    const alreadyHaveMd = await prisma.legalDocument.count({
      where: {
        content_type: { in: ALLOWED_TYPES },
        markdown_content: { not: null },
      },
    })
    console.log(`Already have markdown_content: ${alreadyHaveMd}`)

    await prisma.$disconnect()
    return
  }

  // Load or initialize progress
  let progress: Progress
  if (isResume) {
    const existing = loadProgress()
    if (existing) {
      progress = existing
      console.log(
        `Resuming from last processed ID: ${progress.lastProcessedId}`
      )
      console.log(`  Already processed: ${progress.totalProcessed} docs`)
    } else {
      console.log('No progress file found, starting fresh.')
      progress = createFreshProgress()
    }
  } else {
    progress = createFreshProgress()
  }

  const globalStart = Date.now()
  let consecutiveErrors = 0
  let processed = 0

  // Cursor-based pagination — process ALL matching docs (not just in-scope)
  // because --resume cursor needs stable ordering across the full set.
  // We filter in-code instead.
  let cursor: string | undefined = progress.lastProcessedId ?? undefined

  while (true) {
    const docs = await prisma.legalDocument.findMany({
      where: whereClause,
      select: {
        id: true,
        document_number: true,
        content_type: true,
        html_content: true,
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })

    if (docs.length === 0) break

    for (const doc of docs) {
      if (limit && processed >= limit) break

      try {
        const html = doc.html_content!
        const docNumber = extractNumber(doc.document_number ?? '')
        const docType =
          doc.content_type === 'AGENCY_REGULATION'
            ? 'AGENCY_REGULATION'
            : 'SFS_LAW'

        const jsonContent = parseCanonicalHtml(html, {
          sfsNumber: docNumber,
          documentType: docType,
        })
        const markdownContent = htmlToMarkdown(html)

        await prisma.legalDocument.update({
          where: { id: doc.id },
          data: {
            json_content: JSON.parse(JSON.stringify(jsonContent)),
            markdown_content: markdownContent,
          },
        })

        progress.totalDerived++
        consecutiveErrors = 0
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(
          `  ERROR: ${doc.document_number ?? doc.id} — ${msg.slice(0, 200)}`
        )
        progress.totalErrors++
        progress.errors.push({
          documentId: doc.id,
          documentNumber: doc.document_number ?? 'unknown',
          error: msg.slice(0, 500),
        })
        consecutiveErrors++

        if (consecutiveErrors >= 10) {
          console.error(
            `\nABORTING: 10 consecutive errors. Check the error log.`
          )
          saveProgress(progress)
          await prisma.$disconnect()
          process.exit(1)
        }
      }

      processed++
      progress.totalProcessed++
      progress.lastProcessedId = doc.id
      cursor = doc.id

      // Progress logging
      if (processed % 100 === 0 || processed === 1) {
        const elapsed = Date.now() - globalStart
        const rate = processed / (elapsed / 1000)
        const remaining = limit
          ? Math.max(0, limit - processed)
          : Math.max(0, totalInScope - progress.totalProcessed)
        const eta = rate > 0 ? remaining / rate : 0
        console.log(
          `[${progress.totalProcessed}/${totalInScope}] ` +
            `${((progress.totalProcessed / totalInScope) * 100).toFixed(1)}% | ` +
            `derived: ${progress.totalDerived} | ` +
            `errors: ${progress.totalErrors} | ` +
            `${formatDuration(elapsed)} elapsed | ` +
            `ETA: ${formatDuration(eta * 1000)} | ` +
            `${rate.toFixed(1)} docs/s`
        )
      }
    }

    // Save progress after each batch
    progress.lastUpdatedAt = new Date().toISOString()
    saveProgress(progress)

    if (limit && processed >= limit) break
  }

  // Final summary
  const totalElapsed = Date.now() - globalStart
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Backfill complete`)
  console.log(`  Documents processed: ${progress.totalProcessed}`)
  console.log(`  Successfully derived: ${progress.totalDerived}`)
  console.log(`  Errors:              ${progress.totalErrors}`)
  console.log(`  Duration:            ${formatDuration(totalElapsed)}`)
  if (totalElapsed > 0) {
    console.log(
      `  Rate:                ${(processed / (totalElapsed / 1000)).toFixed(1)} docs/s`
    )
  }

  if (progress.totalErrors > 0) {
    console.log(`\nErrors (first 20):`)
    for (const e of progress.errors.slice(0, 20)) {
      console.log(`  ${e.documentNumber}: ${e.error.slice(0, 100)}`)
    }
  }

  // Verify final state
  const nowHaveJson = await prisma.legalDocument.count({
    where: {
      content_type: { in: ALLOWED_TYPES },
      json_content: { not: Prisma.DbNull },
    },
  })
  const stillMissing = await prisma.legalDocument.count({
    where: {
      content_type: { in: ALLOWED_TYPES },
      html_content: { not: null },
      json_content: { equals: Prisma.DbNull },
    },
  })
  console.log(`\nDocuments with json_content: ${nowHaveJson}`)
  console.log(`Still missing json_content:  ${stillMissing}`)

  await prisma.$disconnect()
}

function createFreshProgress(): Progress {
  return {
    lastProcessedId: null,
    totalProcessed: 0,
    totalDerived: 0,
    totalErrors: 0,
    errors: [],
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
