/**
 * Bulk chunking of all SFS_LAW and AGENCY_REGULATION documents.
 * Prerequisite for Story 14.3 (Embedding Generation Pipeline).
 *
 * Usage:
 *   npx tsx scripts/bulk-sync-chunks.ts
 *   npx tsx scripts/bulk-sync-chunks.ts --limit 100
 *   npx tsx scripts/bulk-sync-chunks.ts --resume
 *   npx tsx scripts/bulk-sync-chunks.ts --dry-run
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { syncDocumentChunks } from '../lib/chunks/sync-document-chunks'
import * as fs from 'fs'
import * as path from 'path'

const PROGRESS_FILE = path.join(__dirname, '..', 'data', 'chunk-progress.json')
const BATCH_SIZE = 50 // commit progress every N documents
const ALLOWED_TYPES = ['SFS_LAW', 'AGENCY_REGULATION']

interface Progress {
  lastProcessedId: string | null
  totalProcessed: number
  totalChunksCreated: number
  totalChunksDeleted: number
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

async function main() {
  const args = process.argv.slice(2)
  const isResume = args.includes('--resume')
  const isDryRun = args.includes('--dry-run')
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]!, 10) : undefined

  // Count total documents in scope
  const totalDocs = await prisma.legalDocument.count({
    where: { content_type: { in: ALLOWED_TYPES } },
  })
  console.log(`Total documents in scope: ${totalDocs}`)
  if (limit) console.log(`  --limit: processing only ${limit} documents`)

  // Load or initialize progress
  let progress: Progress
  if (isResume) {
    const existing = loadProgress()
    if (existing) {
      progress = existing
      console.log(
        `Resuming from last processed ID: ${progress.lastProcessedId}`
      )
      console.log(
        `  Already processed: ${progress.totalProcessed} docs, ${progress.totalChunksCreated} chunks`
      )
    } else {
      console.log('No progress file found, starting fresh.')
      progress = {
        lastProcessedId: null,
        totalProcessed: 0,
        totalChunksCreated: 0,
        totalChunksDeleted: 0,
        totalErrors: 0,
        errors: [],
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
      }
    }
  } else {
    progress = {
      lastProcessedId: null,
      totalProcessed: 0,
      totalChunksCreated: 0,
      totalChunksDeleted: 0,
      totalErrors: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    }
  }

  if (isDryRun) {
    // Count how many have content to chunk (use DbNull for JSON null checks)
    const withJson = await prisma.legalDocument.count({
      where: {
        content_type: { in: ALLOWED_TYPES },
        json_content: { not: Prisma.DbNull },
      },
    })
    const withMarkdown = await prisma.legalDocument.count({
      where: {
        content_type: { in: ALLOWED_TYPES },
        json_content: { equals: Prisma.DbNull },
        markdown_content: { not: null },
      },
    })
    const withHtml = await prisma.legalDocument.count({
      where: {
        content_type: { in: ALLOWED_TYPES },
        json_content: { equals: Prisma.DbNull },
        markdown_content: null,
        html_content: { not: null },
      },
    })
    const noContent = totalDocs - withJson - withMarkdown - withHtml

    console.log(`\nDry run — content breakdown:`)
    console.log(`  JSON content (Tier 1/2): ${withJson}`)
    console.log(`  Markdown only (Tier 3):  ${withMarkdown}`)
    console.log(`  HTML only (Tier 3):      ${withHtml}`)
    console.log(`  No content (skipped):    ${noContent}`)

    // Count by content_type
    const byType = await prisma.legalDocument.groupBy({
      by: ['content_type'],
      where: { content_type: { in: ALLOWED_TYPES } },
      _count: true,
    })
    console.log(`\nBy content type:`)
    for (const t of byType) {
      console.log(`  ${t.content_type}: ${t._count}`)
    }

    // Existing chunks
    const existingChunks = await prisma.contentChunk.count({
      where: { source_type: 'LEGAL_DOCUMENT' },
    })
    console.log(`\nExisting chunks in DB: ${existingChunks}`)
    console.log(
      `These will be deleted and recreated for each processed document.`
    )

    await prisma.$disconnect()
    return
  }

  const globalStart = Date.now()
  let consecutiveErrors = 0
  let processed = 0

  // Cursor-based pagination through all documents
  let cursor: string | undefined = progress.lastProcessedId ?? undefined

  while (true) {
    const docs = await prisma.legalDocument.findMany({
      where: { content_type: { in: ALLOWED_TYPES } },
      select: { id: true, document_number: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })

    if (docs.length === 0) break

    for (const doc of docs) {
      if (limit && processed >= limit) break

      try {
        const result = await syncDocumentChunks(doc.id)
        progress.totalChunksCreated += result.chunksCreated
        progress.totalChunksDeleted += result.chunksDeleted
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
          : Math.max(0, totalDocs - progress.totalProcessed)
        const eta = rate > 0 ? remaining / rate : 0
        console.log(
          `[${progress.totalProcessed}/${totalDocs}] ` +
            `${((progress.totalProcessed / totalDocs) * 100).toFixed(1)}% | ` +
            `chunks: ${progress.totalChunksCreated} | ` +
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
  console.log(`Bulk chunking complete`)
  console.log(`  Documents processed: ${progress.totalProcessed}`)
  console.log(`  Chunks created:      ${progress.totalChunksCreated}`)
  console.log(`  Chunks deleted:      ${progress.totalChunksDeleted}`)
  console.log(`  Errors:              ${progress.totalErrors}`)
  console.log(`  Duration:            ${formatDuration(totalElapsed)}`)
  console.log(
    `  Rate:                ${(processed / (totalElapsed / 1000)).toFixed(1)} docs/s`
  )

  if (progress.totalErrors > 0) {
    console.log(`\nErrors (first 20):`)
    for (const e of progress.errors.slice(0, 20)) {
      console.log(`  ${e.documentNumber}: ${e.error.slice(0, 100)}`)
    }
  }

  // Verify final state
  const totalChunks = await prisma.contentChunk.count({
    where: { source_type: 'LEGAL_DOCUMENT' },
  })
  console.log(`\nTotal chunks in DB: ${totalChunks}`)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
