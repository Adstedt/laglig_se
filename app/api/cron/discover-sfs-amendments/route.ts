/**
 * Discover SFS Amendments Cron Job
 *
 * Story 8.20: Continuous SFS Amendment Discovery
 *
 * Two-phase architecture:
 * - Phase 1 (Discovery): Parse index page(s), create PENDING AmendmentDocument records.
 *   Fast (~5s), no external API calls beyond the index page. Watermark advances immediately.
 * - Phase 2 (Processing): Pick up all PENDING/FAILED records, run the full pipeline
 *   (PDF→LLM→normalize→DB). Failures stay FAILED; retried next run.
 *
 * Runs daily at 02:00 UTC (before generate-summaries at 03:00).
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startJobRun, completeJobRun, failJobRun } from '@/lib/admin/job-logger'
import {
  ContentType,
  ChangeType,
  ParseStatus,
  SectionChangeType,
} from '@prisma/client'
import { fetchAndStorePdf } from '@/lib/sfs'
import { parseAmendmentPdf } from '@/lib/external/llm-amendment-parser'
import { downloadPdf as downloadPdfFromStorage } from '@/lib/supabase/storage'
import { createLegalDocumentFromAmendment } from '@/lib/sfs/amendment-to-legal-document'
import { normalizeSfsAmendment } from '@/lib/transforms/normalizers/sfs-amendment-normalizer'
import { parseCanonicalHtml } from '@/lib/transforms/canonical-html-parser'
import {
  htmlToMarkdown,
  htmlToPlainText,
} from '@/lib/transforms/html-to-markdown'
import { linkifyHtmlContent, type SlugMap } from '@/lib/linkify'
import { buildSlugMap } from '@/lib/linkify'
import { constructStoragePath } from '@/lib/sfs/pdf-urls'
import { sendAmendmentDiscoveryEmail } from '@/lib/email/cron-notifications'
import {
  discoverFromIndex,
  extractSfsNumericPart,
  extractBaseLawSfs,
  classifyDocument,
  crawlDocumentPage,
} from '@/lib/sfs/sfs-amendment-crawler'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for cron

const CRON_SECRET = process.env.CRON_SECRET

const CONFIG = {
  MAX_AMENDMENTS_PER_RUN: 50,
  TIMEOUT_BUFFER_MS: 30_000, // 30s buffer before maxDuration
  REQUEST_DELAY_MS: 200,
}

// =============================================================================
// Stats (matches AmendmentDiscoveryStats from cron-notifications)
// =============================================================================

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

// =============================================================================
// GET Handler
// =============================================================================

export async function GET(request: Request) {
  const startTime = Date.now()
  const maxRuntime = maxDuration * 1000 - CONFIG.TIMEOUT_BUFFER_MS

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

  // Lazy-initialized slug map shared across processing
  let slugMap: SlugMap | null = null
  async function getSlugMap(): Promise<SlugMap> {
    if (!slugMap) {
      slugMap = await buildSlugMap()
    }
    return slugMap
  }

  try {
    const year = new Date().getFullYear()

    // ==========================================================================
    // Phase 1: Discovery — parse index, create PENDING records
    // ==========================================================================

    console.log(`[DISCOVER-SFS] Phase 1: Discovery for year ${year}`)
    const watermark = await computeWatermark(year)
    console.log(`[DISCOVER-SFS] Watermark: ${watermark ?? 'none (full crawl)'}`)

    const discoverResult = await discoverFromIndex(year, {
      ...(watermark !== null && { afterNumericPart: watermark }),
      requestDelayMs: CONFIG.REQUEST_DELAY_MS,
    })

    stats.pagesScanned = discoverResult.pagesScanned
    console.log(
      `[DISCOVER-SFS] Index scan: ${discoverResult.pagesScanned} page(s), ` +
        `highest=${discoverResult.highestNumericPart}, found=${discoverResult.documents.length}`
    )

    // Create PENDING records for amendments/repeals, skip new laws
    for (const doc of discoverResult.documents) {
      stats.discovered++

      if (doc.documentType === 'new_law') {
        stats.newLawsSkipped++
        console.log(
          `[DISCOVER-SFS] Skipping new law: ${doc.sfsNumber} - ${doc.title}`
        )
        continue
      }

      // Dedup: check if AmendmentDocument already exists
      const exists = await prisma.amendmentDocument.findUnique({
        where: { sfs_number: doc.sfsNumber },
        select: { id: true },
      })

      if (exists) {
        stats.alreadyExists++
        continue
      }

      // Create PENDING record — discovery always succeeds
      await prisma.amendmentDocument.create({
        data: {
          sfs_number: doc.sfsNumber,
          storage_path: constructStoragePath(doc.sfsNumber),
          original_url: doc.pdfUrl,
          base_law_sfs: doc.baseLawSfs ?? 'unknown',
          title: doc.title,
          publication_date: new Date(doc.publishedDate),
          parse_status: ParseStatus.PENDING,
        },
      })

      stats.pendingCreated++
      console.log(
        `[DISCOVER-SFS] Created PENDING: ${doc.sfsNumber} - ${doc.title}`
      )
    }

    console.log(
      `[DISCOVER-SFS] Phase 1 complete: ${stats.pendingCreated} PENDING created, ` +
        `${stats.newLawsSkipped} new laws skipped, ${stats.alreadyExists} already exist`
    )

    // ==========================================================================
    // Phase 1.5: Re-resolve "unknown" base_law_sfs records
    // ==========================================================================

    const unknownRecords = await prisma.amendmentDocument.findMany({
      where: {
        sfs_number: { startsWith: `${year}:` },
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
            data: { base_law_sfs: resolved },
          })
          console.log(
            `[DISCOVER-SFS] Resolved ${rec.sfs_number}: unknown → ${resolved}`
          )
        }
      }
    }

    // ==========================================================================
    // Phase 2: Processing — pick up PENDING/FAILED, run full pipeline
    // ==========================================================================

    console.log(`[DISCOVER-SFS] Phase 2: Processing PENDING/FAILED records`)

    const toProcess = await prisma.amendmentDocument.findMany({
      where: {
        sfs_number: { startsWith: `${year}:` },
        parse_status: { in: [ParseStatus.PENDING, ParseStatus.FAILED] },
        base_law_sfs: { not: 'unknown' },
      },
      orderBy: { created_at: 'asc' },
      take: CONFIG.MAX_AMENDMENTS_PER_RUN,
    })

    console.log(`[DISCOVER-SFS] Found ${toProcess.length} records to process`)

    if (toProcess.length > 0) {
      const processingSlugMap = await getSlugMap()

      for (const record of toProcess) {
        // Timeout protection
        const elapsed = Date.now() - startTime
        if (elapsed > maxRuntime) {
          console.log(
            `[DISCOVER-SFS] Approaching timeout (${Math.round(elapsed / 1000)}s elapsed), stopping. ` +
              `Processed ${stats.processed}/${toProcess.length}`
          )
          break
        }

        try {
          await processAmendmentRecord(record, processingSlugMap, stats)
        } catch (error) {
          stats.failed++
          const errMsg = error instanceof Error ? error.message : String(error)
          console.error(`[DISCOVER-SFS] Failed ${record.sfs_number}: ${errMsg}`)

          // Mark as FAILED so it's retried next run
          try {
            await prisma.amendmentDocument.update({
              where: { id: record.id },
              data: {
                parse_status: ParseStatus.FAILED,
                parse_error: errMsg.slice(0, 1000),
              },
            })
          } catch {
            // non-fatal — record stays PENDING/FAILED for next run
          }
        }
      }
    }

    // ==========================================================================
    // Phase 3: Backfill missing ChangeEvents for COMPLETED amendments
    // ==========================================================================

    const completedWithoutEvents = await prisma.amendmentDocument.findMany({
      where: {
        sfs_number: { startsWith: `${year}:` },
        parse_status: ParseStatus.COMPLETED,
        base_law_sfs: { not: 'unknown' },
      },
      select: { sfs_number: true, base_law_sfs: true, title: true },
    })

    let backfilled = 0
    for (const record of completedWithoutEvents) {
      const baseLawDocNumber = `SFS ${record.base_law_sfs}`
      const baseLawDoc = await prisma.legalDocument.findUnique({
        where: { document_number: baseLawDocNumber },
        select: { id: true },
      })
      if (!baseLawDoc) continue

      const existingEvent = await prisma.changeEvent.findFirst({
        where: {
          document_id: baseLawDoc.id,
          amendment_sfs: `SFS ${record.sfs_number}`,
        },
        select: { id: true },
      })
      if (existingEvent) continue

      const isRepeal = record.title
        ? classifyDocument(record.title) === 'repeal'
        : false

      await prisma.changeEvent.create({
        data: {
          document_id: baseLawDoc.id,
          content_type: ContentType.SFS_LAW,
          change_type: isRepeal ? ChangeType.REPEAL : ChangeType.AMENDMENT,
          amendment_sfs: `SFS ${record.sfs_number}`,
          notification_sent: false,
        },
      })
      backfilled++
      stats.changeEventsCreated++
    }

    if (backfilled > 0) {
      console.log(
        `[DISCOVER-SFS] Phase 3: Backfilled ${backfilled} missing ChangeEvents`
      )
    }

    const duration = `${Math.round((Date.now() - startTime) / 1000)}s`
    stats.duration = duration

    logSummary(stats)

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
        itemsProcessed: stats.processed,
        itemsFailed: stats.failed,
      })
    }

    return NextResponse.json({
      success: true,
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

// =============================================================================
// Watermark
// =============================================================================

async function computeWatermark(year: number): Promise<number | null> {
  const amendments = await prisma.amendmentDocument.findMany({
    where: {
      sfs_number: { startsWith: `${year}:` },
    },
    select: { sfs_number: true },
  })

  if (amendments.length === 0) return null

  const nums = amendments
    .map((a) => extractSfsNumericPart(a.sfs_number))
    .filter((n) => !isNaN(n))

  if (nums.length === 0) return null

  return Math.max(...nums)
}

// =============================================================================
// Unified Amendment Processing Pipeline
// =============================================================================

type AmendmentRecord = {
  id: string
  sfs_number: string
  storage_path: string
  original_url: string | null
  base_law_sfs: string | null
  base_law_name: string | null
  title: string | null
  publication_date: Date | null
}

/**
 * Process a single AmendmentDocument record through the full pipeline.
 * Handles both first-time PENDING and retry FAILED records identically.
 */
async function processAmendmentRecord(
  record: AmendmentRecord,
  slugMap: SlugMap,
  stats: DiscoveryStats
): Promise<void> {
  const isRepeal = record.title
    ? classifyDocument(record.title) === 'repeal'
    : false

  console.log(
    `[DISCOVER-SFS] Processing ${isRepeal ? 'repeal' : 'amendment'}: ${record.sfs_number} - ${record.title ?? '(no title)'}`
  )

  // Step A: Ensure PDF is in Supabase storage
  let pdfBuffer = await downloadPdfFromStorage(record.sfs_number)

  if (!pdfBuffer) {
    // PDF not in storage yet — fetch and store it
    stats.pdfsFetched++
    const pubDate = record.publication_date
      ? record.publication_date.toISOString().slice(0, 10)
      : undefined

    let pdfResult = await fetchAndStorePdf(record.sfs_number, pubDate)

    // Fallback: publication date month may not match the PDF folder on the site.
    // Scrape the actual doc page to get the real PDF URL.
    if (!pdfResult.success) {
      console.log(
        `[DISCOVER-SFS]   Date-based URL failed, scraping doc page for real PDF URL`
      )
      const docPage = await crawlDocumentPage(record.sfs_number)
      if (docPage?.pdfUrl) {
        // Extract the month from the real PDF URL (e.g. ".../sfs/2026-02/SFS...")
        const monthMatch = docPage.pdfUrl.match(/\/sfs\/(\d{4}-\d{2})\//)
        const realDate = monthMatch ? `${monthMatch[1]}-01` : undefined
        pdfResult = await fetchAndStorePdf(record.sfs_number, realDate)
      }
    }

    if (!pdfResult.success) {
      stats.pdfsFailed++
      throw new Error(`PDF fetch failed: ${pdfResult.error}`)
    }

    stats.pdfsStored++

    // Update storage path and original_url if needed
    if (pdfResult.metadata?.storagePath) {
      await prisma.amendmentDocument.update({
        where: { id: record.id },
        data: {
          storage_path: pdfResult.metadata.storagePath,
          original_url: pdfResult.metadata.originalUrl,
          file_size: pdfResult.metadata.fileSize ?? null,
        },
      })
    }

    // Download the newly stored PDF
    pdfBuffer = await downloadPdfFromStorage(record.sfs_number)
    if (!pdfBuffer) {
      throw new Error('Failed to download PDF from storage after upload')
    }
  }

  // Step B: Parse PDF with LLM → semantic HTML
  const { html: rawHtml, validation } = await parseAmendmentPdf(
    pdfBuffer,
    record.sfs_number,
    record.base_law_sfs ?? undefined,
    record.title ?? undefined
  )

  console.log(
    `[DISCOVER-SFS]   LLM returned HTML: ${rawHtml.length} chars, ` +
      `sections: ${validation.metrics.sectionCount}, paragraphs: ${validation.metrics.paragraphCount}`
  )

  if (validation.warnings.length > 0) {
    console.log(
      `[DISCOVER-SFS]   Warnings: ${validation.warnings.map((w) => w.code).join(', ')}`
    )
  }

  // Step C: Normalize → derive content
  const normalizedHtml = normalizeSfsAmendment(rawHtml, {
    documentNumber: `SFS ${record.sfs_number}`,
    title: record.title ?? `SFS ${record.sfs_number}`,
  })

  const canonicalJson = parseCanonicalHtml(normalizedHtml, {
    sfsNumber: record.sfs_number,
    documentType: 'SFS_AMENDMENT',
    ...(record.base_law_sfs ? { baseLawSfs: record.base_law_sfs } : {}),
  })

  const markdownContent = htmlToMarkdown(normalizedHtml)
  const plainText = htmlToPlainText(normalizedHtml)

  const linkifiedHtml = linkifyHtmlContent(
    normalizedHtml,
    slugMap,
    `SFS ${record.sfs_number}`
  ).html

  const effectiveDate = canonicalJson.metadata.effectiveDate
    ? new Date(canonicalJson.metadata.effectiveDate)
    : null

  // Step D: Update all records in a transaction
  const defaultChangeType = isRepeal
    ? SectionChangeType.REPEALED
    : SectionChangeType.AMENDED

  await prisma.$transaction(async (tx) => {
    // Clean up any partial SectionChanges from previous failed attempts
    await tx.sectionChange.deleteMany({
      where: { amendment_id: record.id },
    })

    // Create SectionChange records from canonical JSON
    let sortOrder = 0
    for (const chapter of canonicalJson.chapters) {
      for (const paragraf of chapter.paragrafer) {
        await tx.sectionChange.create({
          data: {
            amendment_id: record.id,
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
                amendment_id: record.id,
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

    // Update AmendmentDocument to COMPLETED
    const updatedAmendment = await tx.amendmentDocument.update({
      where: { id: record.id },
      data: {
        title:
          canonicalJson.title || record.title || `SFS ${record.sfs_number}`,
        effective_date: effectiveDate,
        full_text: plainText,
        markdown_content: markdownContent,
        parse_status: ParseStatus.COMPLETED,
        parsed_at: new Date(),
        parse_error: null,
        confidence: validation.metrics.paragraphCount > 0 ? 0.9 : 0.5,
      },
    })

    // Create LegalDocument
    const legalDocResult = await createLegalDocumentFromAmendment(tx, {
      id: updatedAmendment.id,
      sfs_number: updatedAmendment.sfs_number,
      title: updatedAmendment.title,
      base_law_sfs: updatedAmendment.base_law_sfs,
      base_law_name: updatedAmendment.base_law_name,
      effective_date: updatedAmendment.effective_date,
      publication_date: updatedAmendment.publication_date,
      original_url: updatedAmendment.original_url,
      storage_path: updatedAmendment.storage_path,
      full_text: plainText,
      html_content: linkifiedHtml,
      markdown_content: markdownContent,
      json_content: canonicalJson,
      confidence: updatedAmendment.confidence,
    })

    if (legalDocResult.isNew) {
      console.log(
        `[DISCOVER-SFS]   LegalDocument created: ${legalDocResult.slug}`
      )
    }

    // Create ChangeEvent if base law exists in DB (dedup: check first)
    if (record.base_law_sfs) {
      const baseLawDocNumber = `SFS ${record.base_law_sfs}`
      const baseLawDoc = await tx.legalDocument.findUnique({
        where: { document_number: baseLawDocNumber },
        select: { id: true },
      })

      if (baseLawDoc) {
        const existingEvent = await tx.changeEvent.findFirst({
          where: {
            document_id: baseLawDoc.id,
            amendment_sfs: `SFS ${record.sfs_number}`,
          },
          select: { id: true },
        })

        if (!existingEvent) {
          await tx.changeEvent.create({
            data: {
              document_id: baseLawDoc.id,
              content_type: ContentType.SFS_LAW,
              change_type: isRepeal ? ChangeType.REPEAL : ChangeType.AMENDMENT,
              amendment_sfs: `SFS ${record.sfs_number}`,
              notification_sent: false,
            },
          })
          stats.changeEventsCreated++
          console.log(
            `[DISCOVER-SFS]   ChangeEvent created for base law ${record.base_law_sfs}`
          )
        }
      } else {
        console.log(
          `[DISCOVER-SFS]   Base law ${record.base_law_sfs} not in DB — no ChangeEvent`
        )
      }
    }
  })

  stats.processed++
  if (isRepeal) stats.repealsProcessed++

  console.log(
    `[DISCOVER-SFS]   Processed successfully: ${record.sfs_number} (${sortOrderLabel(canonicalJson)})`
  )
}

function sortOrderLabel(json: {
  chapters: { paragrafer: unknown[] }[]
}): string {
  const total = json.chapters.reduce((sum, ch) => sum + ch.paragrafer.length, 0)
  return `${total} paragrafer`
}

// =============================================================================
// Admin Reporting
// =============================================================================

function logSummary(stats: DiscoveryStats): void {
  console.log(`[DISCOVER-SFS] ========== SUMMARY ==========`)
  console.log(`[DISCOVER-SFS] ──── Phase 1: Discovery ────`)
  console.log(`[DISCOVER-SFS] Pages scanned: ${stats.pagesScanned}`)
  console.log(`[DISCOVER-SFS] Discovered: ${stats.discovered}`)
  console.log(`[DISCOVER-SFS] Already exists: ${stats.alreadyExists}`)
  console.log(`[DISCOVER-SFS] PENDING created: ${stats.pendingCreated}`)
  console.log(`[DISCOVER-SFS] New laws skipped: ${stats.newLawsSkipped}`)
  console.log(`[DISCOVER-SFS] ──── Phase 2: Processing ────`)
  console.log(`[DISCOVER-SFS] Processed: ${stats.processed}`)
  console.log(`[DISCOVER-SFS] Failed: ${stats.failed}`)
  console.log(
    `[DISCOVER-SFS] Change events created: ${stats.changeEventsCreated}`
  )
  console.log(`[DISCOVER-SFS] PDFs fetched: ${stats.pdfsFetched}`)
  console.log(`[DISCOVER-SFS] PDFs stored: ${stats.pdfsStored}`)
  console.log(`[DISCOVER-SFS] PDFs failed: ${stats.pdfsFailed}`)
  console.log(`[DISCOVER-SFS] Repeals processed: ${stats.repealsProcessed}`)
  console.log(`[DISCOVER-SFS] Duration: ${stats.duration}`)
  console.log(`[DISCOVER-SFS] ======================================`)
}
