#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * One-off script: Backfill ALL missing/failed 2026 amendments
 *
 * Handles two cases:
 * 1. FAILED AmendmentDocuments — PDFs in storage, LLM parse never completed
 * 2. Missing SFS numbers — never crawled, need full pipeline (crawl → fetch PDF → parse)
 *
 * Usage:
 *   npx tsx scripts/retry-failed-2026-amendments.ts
 *   npx tsx scripts/retry-failed-2026-amendments.ts --dry-run
 *   npx tsx scripts/retry-failed-2026-amendments.ts --limit 5
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import {
  PrismaClient,
  ParseStatus,
  ContentType,
  ChangeType,
  SectionChangeType,
} from '@prisma/client'
import { parseAmendmentPdf } from '../lib/external/llm-amendment-parser'
import { downloadPdf as downloadPdfFromStorage } from '../lib/supabase/storage'
import { fetchAndStorePdf } from '../lib/sfs'
import { constructStoragePath } from '../lib/sfs/pdf-urls'
import { createLegalDocumentFromAmendment } from '../lib/sfs/amendment-to-legal-document'
import { normalizeSfsAmendment } from '../lib/transforms/normalizers/sfs-amendment-normalizer'
import { parseCanonicalHtml } from '../lib/transforms/canonical-html-parser'
import {
  htmlToMarkdown,
  htmlToPlainText,
} from '../lib/transforms/html-to-markdown'
import { linkifyHtmlContent, type SlugMap } from '../lib/linkify'
import { crawlDocumentPage } from '../lib/sfs/sfs-amendment-crawler'

const prisma = new PrismaClient()

const DELAY_MS = 2000

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const limitIdx = args.indexOf('--limit')
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1] ?? '0', 10) : 0

// ---------------------------------------------------------------------------
// Shared processing logic (same as discover-sfs-amendments route)
// ---------------------------------------------------------------------------

interface ProcessResult {
  ok: boolean
  error?: string
}

async function processWithLlm(
  amendmentId: string,
  sfsNumber: string,
  baseLawSfs: string | null,
  title: string | null,
  storagePath: string,
  publicationDate: Date | null,
  originalUrl: string | null,
  slugMap: SlugMap,
  isNew: boolean
): Promise<ProcessResult> {
  // Step 1: Download PDF from storage
  const pdfBuffer = await downloadPdfFromStorage(sfsNumber)
  if (!pdfBuffer) {
    return { ok: false, error: 'PDF not in storage' }
  }
  console.log(`  PDF: ${(pdfBuffer.length / 1024).toFixed(0)} KB`)

  // Step 2: LLM parse
  const { html: rawHtml, validation } = await parseAmendmentPdf(
    pdfBuffer,
    sfsNumber,
    baseLawSfs ?? undefined,
    title ?? undefined
  )
  console.log(
    `  LLM: ${rawHtml.length} chars, ${validation.metrics.sectionCount} sections, ${validation.metrics.paragraphCount} §`
  )

  // Step 3: Normalize + derive
  const normalizedHtml = normalizeSfsAmendment(rawHtml, {
    documentNumber: `SFS ${sfsNumber}`,
    title: title ?? `SFS ${sfsNumber}`,
  })

  const canonicalJson = parseCanonicalHtml(normalizedHtml, {
    sfsNumber,
    documentType: 'SFS_AMENDMENT',
    ...(baseLawSfs ? { baseLawSfs } : {}),
  })

  const markdownContent = htmlToMarkdown(normalizedHtml)
  const plainText = htmlToPlainText(normalizedHtml)
  const linkifiedHtml = linkifyHtmlContent(
    normalizedHtml,
    slugMap,
    `SFS ${sfsNumber}`
  ).html

  const isRepeal = (title ?? '').toLowerCase().includes('upphävande')
  const defaultChangeType = isRepeal
    ? SectionChangeType.REPEALED
    : SectionChangeType.AMENDED

  let effectiveDate: Date | null = null
  if (canonicalJson.metadata.effectiveDate) {
    effectiveDate = new Date(canonicalJson.metadata.effectiveDate)
  }

  // Step 4: DB transaction
  await prisma.$transaction(async (tx) => {
    // Clean up any partial SectionChanges from previous failed runs
    if (!isNew) {
      await tx.sectionChange.deleteMany({
        where: { amendment_id: amendmentId },
      })
    }

    // Update or confirm AmendmentDocument
    await tx.amendmentDocument.update({
      where: { id: amendmentId },
      data: {
        title: canonicalJson.title || title,
        effective_date: effectiveDate,
        full_text: plainText,
        markdown_content: markdownContent,
        parse_status: ParseStatus.COMPLETED,
        parsed_at: new Date(),
        parse_error: null,
        confidence: validation.metrics.paragraphCount > 0 ? 0.9 : 0.5,
      },
    })

    // Create SectionChanges
    let sortOrder = 0
    for (const chapter of canonicalJson.chapters) {
      for (const paragraf of chapter.paragrafer) {
        await tx.sectionChange.create({
          data: {
            amendment_id: amendmentId,
            chapter: chapter.number,
            section: paragraf.number,
            change_type: defaultChangeType,
            description: paragraf.heading ?? null,
            new_text: paragraf.content || null,
            sort_order: sortOrder++,
          },
        })
      }
    }
    if (canonicalJson.divisions) {
      for (const division of canonicalJson.divisions) {
        for (const chapter of division.chapters) {
          for (const paragraf of chapter.paragrafer) {
            await tx.sectionChange.create({
              data: {
                amendment_id: amendmentId,
                chapter: chapter.number,
                section: paragraf.number,
                change_type: defaultChangeType,
                description: paragraf.heading ?? null,
                new_text: paragraf.content || null,
                sort_order: sortOrder++,
              },
            })
          }
        }
      }
    }
    console.log(`  ${sortOrder} SectionChanges`)

    // Create LegalDocument
    const legalDocResult = await createLegalDocumentFromAmendment(tx, {
      id: amendmentId,
      sfs_number: sfsNumber,
      title: canonicalJson.title || title,
      base_law_sfs: baseLawSfs,
      base_law_name: null,
      effective_date: effectiveDate,
      publication_date: publicationDate,
      original_url: originalUrl,
      storage_path: storagePath,
      full_text: plainText,
      html_content: linkifiedHtml,
      markdown_content: markdownContent,
      json_content: canonicalJson,
      confidence: validation.metrics.paragraphCount > 0 ? 0.9 : 0.5,
    })
    console.log(
      `  LegalDocument ${legalDocResult.isNew ? 'created' : 'updated'}: ${legalDocResult.slug}`
    )

    // ChangeEvent for base law
    if (baseLawSfs) {
      const baseLawDoc = await tx.legalDocument.findUnique({
        where: { document_number: `SFS ${baseLawSfs}` },
        select: { id: true },
      })

      if (baseLawDoc) {
        const existing = await tx.changeEvent.findFirst({
          where: {
            document_id: baseLawDoc.id,
            amendment_sfs: `SFS ${sfsNumber}`,
          },
        })
        if (!existing) {
          await tx.changeEvent.create({
            data: {
              document_id: baseLawDoc.id,
              content_type: ContentType.SFS_LAW,
              change_type: isRepeal ? ChangeType.REPEAL : ChangeType.AMENDMENT,
              amendment_sfs: `SFS ${sfsNumber}`,
              notification_sent: false,
            },
          })
          console.log(`  ChangeEvent created → ${baseLawSfs}`)
        }
      } else {
        console.log(`  Base law ${baseLawSfs} not in DB`)
      }
    }
  })

  return { ok: true }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const year = 2026

  console.log('='.repeat(60))
  console.log(`Backfill 2026 Amendments${DRY_RUN ? ' (DRY RUN)' : ''}`)
  console.log('='.repeat(60))
  console.log()

  // ---- Phase 1: Find FAILED/PENDING AmendmentDocuments ----
  const failedAmendments = await prisma.amendmentDocument.findMany({
    where: {
      sfs_number: { startsWith: `${year}:` },
      parse_status: { in: [ParseStatus.FAILED, ParseStatus.PENDING] },
    },
    select: {
      id: true,
      sfs_number: true,
      storage_path: true,
      base_law_sfs: true,
      title: true,
      publication_date: true,
      original_url: true,
    },
    orderBy: { sfs_number: 'asc' },
  })

  // ---- Phase 2: Find missing SFS numbers ----
  const allExisting = await prisma.amendmentDocument.findMany({
    where: { sfs_number: { startsWith: `${year}:` } },
    select: { sfs_number: true },
  })
  const existingNums = new Set(
    allExisting.map((a) => parseInt(a.sfs_number.split(':')[1] ?? '0'))
  )

  // Determine highest published SFS number
  // Use DB watermark + crawl. If crawl hangs (Windows fetch issue), fall back to DB.
  const { crawlCurrentYearIndex } = await import(
    '../lib/sfs/sfs-amendment-crawler'
  )
  const dbNums = [...existingNums].filter((n) => n > 0)
  const dbHighest = dbNums.length > 0 ? Math.max(...dbNums) : 0

  let highest = dbHighest
  if (!args.includes('--skip-crawl')) {
    console.log('Crawling index page to find highest SFS number...')
    try {
      const indexResult = await Promise.race([
        crawlCurrentYearIndex(year, {
          startFromSfsNumber: 0,
          requestDelayMs: 200,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Crawl timeout (30s)')), 30_000)
        ),
      ])
      highest = indexResult.highestSfsNum
    } catch (e) {
      console.log(`  Crawl failed: ${e instanceof Error ? e.message : e}`)
      console.log(`  Using DB watermark: ${year}:${dbHighest}`)
    }
  } else {
    console.log(
      `Skipping crawl (--skip-crawl), using DB watermark: ${year}:${dbHighest}`
    )
  }
  console.log(`Highest published: ${year}:${highest}\n`)

  const missingNums: number[] = []
  for (let i = 1; i <= highest; i++) {
    if (!existingNums.has(i)) missingNums.push(i)
  }

  console.log(`FAILED/PENDING AmendmentDocuments: ${failedAmendments.length}`)
  console.log(`Missing SFS numbers (1-${highest}): ${missingNums.length}`)
  console.log()

  // Build work queue
  interface WorkItem {
    type: 'retry' | 'discover'
    sfsNumber: string
    sfsNum: number
    amendmentId?: string
    storagePath?: string
    baseLawSfs?: string | null
    title?: string | null
    publicationDate?: Date | null
    originalUrl?: string | null
  }

  const queue: WorkItem[] = []

  for (const a of failedAmendments) {
    queue.push({
      type: 'retry',
      sfsNumber: a.sfs_number,
      sfsNum: parseInt(a.sfs_number.split(':')[1] ?? '0'),
      amendmentId: a.id,
      storagePath: a.storage_path,
      baseLawSfs: a.base_law_sfs,
      title: a.title,
      publicationDate: a.publication_date,
      originalUrl: a.original_url,
    })
  }

  for (const num of missingNums) {
    queue.push({
      type: 'discover',
      sfsNumber: `${year}:${num}`,
      sfsNum: num,
    })
  }

  // Sort by SFS number
  queue.sort((a, b) => a.sfsNum - b.sfsNum)

  const total = LIMIT > 0 ? Math.min(queue.length, LIMIT) : queue.length
  console.log(
    `Processing ${total} items${LIMIT > 0 ? ` (limited from ${queue.length})` : ''}\n`
  )

  if (DRY_RUN) {
    for (let i = 0; i < total; i++) {
      const item = queue[i]!
      console.log(
        `  [${i + 1}/${total}] ${item.sfsNumber} — ${item.type}${item.title ? ': ' + item.title : ''}`
      )
    }
    console.log('\nDry run complete. No changes made.')
    return
  }

  // Skip slug map — too large for Supabase free tier connection limits.
  // Linkification can be done later in a separate pass.
  const slugMap: SlugMap = new Map()
  console.log(`Using empty slug map (linkification skipped)\n`)

  let succeeded = 0
  let skippedNewLaws = 0
  let errors = 0

  for (let i = 0; i < total; i++) {
    const item = queue[i]!
    const label = `[${i + 1}/${total}] ${item.sfsNumber}`

    try {
      if (item.type === 'retry') {
        // ---- Retry existing FAILED/PENDING record ----
        console.log(`${label} RETRY: ${item.title ?? 'untitled'}`)

        // Check if PDF is in storage; if not, fetch it first
        const existingPdf = await downloadPdfFromStorage(item.sfsNumber)
        if (!existingPdf) {
          console.log(`  PDF missing from storage — fetching from source...`)
          const fetchResult = await fetchAndStorePdf(
            item.sfsNumber,
            item.publicationDate ?? undefined
          )
          if (!fetchResult.success) {
            errors++
            console.log(`  FAILED to fetch PDF: ${fetchResult.error}\n`)
            continue
          }
          console.log(
            `  Stored PDF: ${fetchResult.metadata?.fileSize ?? 0} bytes`
          )
        }

        const result = await processWithLlm(
          item.amendmentId!,
          item.sfsNumber,
          item.baseLawSfs ?? null,
          item.title ?? null,
          item.storagePath!,
          item.publicationDate ?? null,
          item.originalUrl ?? null,
          slugMap,
          false
        )

        if (result.ok) {
          succeeded++
          console.log(`  OK\n`)
        } else {
          errors++
          console.log(`  SKIP: ${result.error}\n`)
        }
      } else {
        // ---- Discover new SFS number ----
        console.log(`${label} DISCOVER`)

        // Crawl the document page
        const doc = await crawlDocumentPage(item.sfsNumber, {
          requestDelayMs: 200,
        })

        if (!doc) {
          console.log(`  404 — SFS number does not exist\n`)
          continue
        }

        console.log(`  ${doc.title} [${doc.documentType}]`)

        if (doc.documentType === 'new_law') {
          skippedNewLaws++
          console.log(`  Skipped (new law)\n`)
          continue
        }

        // Fetch and store PDF
        const publishedDate = doc.publishedDate ?? `${year}-01-01`
        const pdfResult = await fetchAndStorePdf(item.sfsNumber, publishedDate)

        if (!pdfResult.success) {
          console.log(`  PDF fetch failed: ${pdfResult.error}`)

          await prisma.amendmentDocument.create({
            data: {
              sfs_number: item.sfsNumber,
              storage_path: constructStoragePath(item.sfsNumber),
              original_url: doc.pdfUrl,
              base_law_sfs: doc.baseLawSfs ?? 'unknown',
              title: doc.title,
              publication_date: new Date(publishedDate),
              parse_status: ParseStatus.FAILED,
              parse_error: `PDF fetch failed: ${pdfResult.error}`,
            },
          })

          errors++
          console.log(`  AmendmentDocument created as FAILED\n`)
          continue
        }

        const storagePath =
          pdfResult.metadata?.storagePath ??
          constructStoragePath(item.sfsNumber)

        // Create AmendmentDocument first (PENDING)
        const amendment = await prisma.amendmentDocument.create({
          data: {
            sfs_number: item.sfsNumber,
            storage_path: storagePath,
            original_url: doc.pdfUrl,
            file_size: pdfResult.metadata?.fileSize ?? null,
            base_law_sfs: doc.baseLawSfs ?? 'unknown',
            title: doc.title,
            publication_date: new Date(publishedDate),
            parse_status: ParseStatus.PENDING,
          },
        })

        // Run LLM pipeline
        const result = await processWithLlm(
          amendment.id,
          item.sfsNumber,
          doc.baseLawSfs,
          doc.title,
          storagePath,
          new Date(publishedDate),
          doc.pdfUrl,
          slugMap,
          true
        )

        if (result.ok) {
          succeeded++
          console.log(`  OK\n`)
        } else {
          errors++
          await prisma.amendmentDocument.update({
            where: { id: amendment.id },
            data: {
              parse_status: ParseStatus.FAILED,
              parse_error: result.error,
            },
          })
          console.log(`  FAILED: ${result.error}\n`)
        }
      }
    } catch (err) {
      errors++
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ERROR: ${msg}\n`)

      if (item.type === 'retry' && item.amendmentId) {
        await prisma.amendmentDocument
          .update({
            where: { id: item.amendmentId },
            data: { parse_error: msg },
          })
          .catch(() => {})
      }
    }

    // Rate limit
    if (i < total - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS))
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('Results')
  console.log('='.repeat(60))
  console.log(`  Succeeded:        ${succeeded}`)
  console.log(`  Failed:           ${errors}`)
  console.log(`  New laws skipped: ${skippedNewLaws}`)
  console.log(`  Total processed:  ${total}`)
  console.log('='.repeat(60))
}

main()
  .catch((e) => {
    console.error('Fatal:', e)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
