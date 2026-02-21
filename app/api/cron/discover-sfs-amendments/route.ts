/**
 * Discover SFS Amendments Cron Job
 *
 * Story 8.20: Continuous SFS Amendment Discovery
 *
 * Crawls svenskforfattningssamling.se daily to discover new amendments
 * and repeals, processes them through the LLM pipeline, and creates
 * ChangeEvent records for the notification system.
 *
 * Runs daily at 02:00 UTC (before generate-summaries at 03:00).
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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
  crawlCurrentYearIndex,
  extractSfsNumericPart,
  type CrawledDocument,
} from '@/lib/sfs/sfs-amendment-crawler'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for cron

const CRON_SECRET = process.env.CRON_SECRET

const CONFIG = {
  MAX_AMENDMENTS_PER_RUN: 15,
  MAX_RETRIES_PER_RUN: 10,
  TIMEOUT_BUFFER_MS: 30_000, // 30s buffer before maxDuration
  REQUEST_DELAY_MS: 200,
}

// =============================================================================
// Stats
// =============================================================================

interface DiscoveryStats {
  discovered: number
  alreadyExists: number
  processed: number
  failed: number
  changeEventsCreated: number
  pdfsFetched: number
  pdfsStored: number
  pdfsFailed: number
  repealsProcessed: number
  newLawsSkipped: number
  retriesAttempted: number
  retriesSucceeded: number
  retriesFailed: number
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

  const stats: DiscoveryStats = {
    discovered: 0,
    alreadyExists: 0,
    processed: 0,
    failed: 0,
    changeEventsCreated: 0,
    pdfsFetched: 0,
    pdfsStored: 0,
    pdfsFailed: 0,
    repealsProcessed: 0,
    newLawsSkipped: 0,
    retriesAttempted: 0,
    retriesSucceeded: 0,
    retriesFailed: 0,
    duration: '0s',
  }

  // Lazy-initialized slug map shared between retry and discovery phases
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
    // Phase 0: Retry FAILED/PENDING amendments (higher priority than discovery)
    // ==========================================================================
    const failedAmendments = await prisma.amendmentDocument.findMany({
      where: {
        sfs_number: { startsWith: `${year}:` },
        parse_status: { in: [ParseStatus.FAILED, ParseStatus.PENDING] },
      },
      orderBy: { created_at: 'asc' },
      take: CONFIG.MAX_RETRIES_PER_RUN,
    })

    if (failedAmendments.length > 0) {
      console.log(
        `[DISCOVER-SFS] Found ${failedAmendments.length} FAILED/PENDING amendments to retry`
      )

      const retrySlugMap = await getSlugMap()

      for (const amendment of failedAmendments) {
        // Timeout protection
        const elapsed = Date.now() - startTime
        if (elapsed > maxRuntime) {
          console.log(
            `[DISCOVER-SFS] Approaching timeout during retries (${Math.round(elapsed / 1000)}s elapsed), stopping.`
          )
          break
        }

        stats.retriesAttempted++
        try {
          await retryAmendment(amendment, retrySlugMap, stats)
          stats.retriesSucceeded++
        } catch (error) {
          stats.retriesFailed++
          console.error(
            `[DISCOVER-SFS] Retry failed for ${amendment.sfs_number}:`,
            error instanceof Error ? error.message : error
          )
        }
      }

      console.log(
        `[DISCOVER-SFS] Retries complete: ${stats.retriesSucceeded}/${stats.retriesAttempted} succeeded`
      )
    }

    // ==========================================================================
    // Phase 1: Discover new amendments
    // ==========================================================================

    // Step 1: Compute watermark from existing AmendmentDocuments
    console.log(`[DISCOVER-SFS] Starting discovery for year ${year}`)
    const watermark = await computeWatermark(year)
    console.log(`[DISCOVER-SFS] Watermark: ${watermark ?? 'none (full crawl)'}`)

    // Step 2: Crawl index to discover new SFS numbers above watermark
    const crawlOptions: Parameters<typeof crawlCurrentYearIndex>[1] = {
      requestDelayMs: CONFIG.REQUEST_DELAY_MS,
    }
    if (watermark !== null) {
      crawlOptions.startFromSfsNumber = watermark
    }
    const crawlResult = await crawlCurrentYearIndex(year, crawlOptions)

    console.log(
      `[DISCOVER-SFS] Index crawl: highest=${crawlResult.highestSfsNum}, discovered=${crawlResult.documents.length}`
    )

    // Step 3: Filter to amendments + repeals, skip new laws
    const toProcess: CrawledDocument[] = []

    for (const doc of crawlResult.documents) {
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
        console.log(`[DISCOVER-SFS] Already exists: ${doc.sfsNumber}`)
        continue
      }

      toProcess.push(doc)
    }

    console.log(
      `[DISCOVER-SFS] To process: ${toProcess.length} (${stats.newLawsSkipped} new laws skipped, ${stats.alreadyExists} already exist)`
    )

    // Step 4: Process amendments/repeals (up to MAX_AMENDMENTS_PER_RUN)
    if (toProcess.length > 0) {
      const discoverSlugMap = await getSlugMap()

      const batch = toProcess.slice(0, CONFIG.MAX_AMENDMENTS_PER_RUN)

      for (const doc of batch) {
        // Timeout protection
        const elapsed = Date.now() - startTime
        if (elapsed > maxRuntime) {
          console.log(
            `[DISCOVER-SFS] Approaching timeout (${Math.round(elapsed / 1000)}s elapsed), stopping. ` +
              `Processed ${stats.processed}/${batch.length}`
          )
          break
        }

        try {
          await processAmendment(doc, discoverSlugMap, stats)
        } catch (error) {
          stats.failed++
          console.error(
            `[DISCOVER-SFS] Failed to process ${doc.sfsNumber}:`,
            error instanceof Error ? error.message : error
          )
        }
      }
    }

    const duration = `${Math.round((Date.now() - startTime) / 1000)}s`
    stats.duration = duration

    // Step 5: Admin reporting
    logSummary(stats)

    try {
      await sendAmendmentDiscoveryEmail(stats, duration, true)
    } catch (emailErr) {
      console.error(
        '[DISCOVER-SFS] Failed to send notification email:',
        emailErr
      )
    }

    return NextResponse.json({
      success: true,
      ...stats,
    })
  } catch (error) {
    const duration = `${Math.round((Date.now() - startTime) / 1000)}s`
    stats.duration = duration

    console.error('[DISCOVER-SFS] Cron failed:', error)

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
// Amendment Processing Pipeline
// =============================================================================

async function processAmendment(
  doc: CrawledDocument,
  slugMap: SlugMap,
  stats: DiscoveryStats
): Promise<void> {
  const isRepeal = doc.documentType === 'repeal'
  console.log(
    `[DISCOVER-SFS] Processing ${isRepeal ? 'repeal' : 'amendment'}: ${doc.sfsNumber} - ${doc.title}`
  )

  // Step A: Fetch and store PDF
  stats.pdfsFetched++
  const pdfResult = await fetchAndStorePdf(doc.sfsNumber, doc.publishedDate)

  if (!pdfResult.success) {
    stats.pdfsFailed++
    console.error(`[DISCOVER-SFS]   PDF fetch failed: ${pdfResult.error}`)

    // Create AmendmentDocument with FAILED status
    await prisma.amendmentDocument.create({
      data: {
        sfs_number: doc.sfsNumber,
        storage_path: constructStoragePath(doc.sfsNumber),
        original_url: doc.pdfUrl,
        base_law_sfs: doc.baseLawSfs ?? 'unknown',
        title: doc.title,
        publication_date: new Date(doc.publishedDate),
        parse_status: ParseStatus.FAILED,
        parse_error: `PDF fetch failed: ${pdfResult.error}`,
      },
    })

    stats.failed++
    return
  }

  stats.pdfsStored++

  // Step B: Download PDF buffer for LLM parsing
  const pdfBuffer = await downloadPdfFromStorage(doc.sfsNumber)
  if (!pdfBuffer) {
    console.error(
      `[DISCOVER-SFS]   Failed to download PDF from storage: ${doc.sfsNumber}`
    )

    await prisma.amendmentDocument.create({
      data: {
        sfs_number: doc.sfsNumber,
        storage_path:
          pdfResult.metadata?.storagePath ??
          constructStoragePath(doc.sfsNumber),
        original_url: doc.pdfUrl,
        base_law_sfs: doc.baseLawSfs ?? 'unknown',
        title: doc.title,
        publication_date: new Date(doc.publishedDate),
        parse_status: ParseStatus.FAILED,
        parse_error: 'Failed to download PDF from storage for LLM parsing',
      },
    })

    stats.failed++
    return
  }

  // Step C: Parse PDF with LLM → semantic HTML
  const { html: rawHtml, validation } = await parseAmendmentPdf(
    pdfBuffer,
    doc.sfsNumber,
    doc.baseLawSfs ?? undefined,
    doc.title
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

  // Step D: Normalize → derive content
  const normalizedHtml = normalizeSfsAmendment(rawHtml, {
    documentNumber: `SFS ${doc.sfsNumber}`,
    title: doc.title,
  })

  const canonicalParserOpts: Parameters<typeof parseCanonicalHtml>[1] = {
    sfsNumber: doc.sfsNumber,
    documentType: 'SFS_AMENDMENT',
  }
  if (doc.baseLawSfs) {
    canonicalParserOpts.baseLawSfs = doc.baseLawSfs
  }
  const canonicalJson = parseCanonicalHtml(normalizedHtml, canonicalParserOpts)

  const markdownContent = htmlToMarkdown(normalizedHtml)
  const plainText = htmlToPlainText(normalizedHtml)

  // Linkify AFTER deriving fields, BEFORE DB write
  const linkifiedHtml = linkifyHtmlContent(
    normalizedHtml,
    slugMap,
    `SFS ${doc.sfsNumber}`
  ).html

  // Step E: Extract effective date from canonical JSON transition provisions
  let effectiveDate: Date | null = null
  if (canonicalJson.metadata.effectiveDate) {
    effectiveDate = new Date(canonicalJson.metadata.effectiveDate)
  }

  // Step F: Create all records in a transaction
  const defaultChangeType = isRepeal
    ? SectionChangeType.REPEALED
    : SectionChangeType.AMENDED

  await prisma.$transaction(async (tx) => {
    // Create AmendmentDocument
    const amendment = await tx.amendmentDocument.create({
      data: {
        sfs_number: doc.sfsNumber,
        storage_path:
          pdfResult.metadata?.storagePath ??
          constructStoragePath(doc.sfsNumber),
        original_url: doc.pdfUrl,
        file_size: pdfResult.metadata?.fileSize ?? null,
        base_law_sfs: doc.baseLawSfs ?? 'unknown',
        title: doc.title,
        effective_date: effectiveDate,
        publication_date: new Date(doc.publishedDate),
        full_text: plainText,
        markdown_content: markdownContent,
        parse_status: ParseStatus.COMPLETED,
        parsed_at: new Date(),
        confidence: validation.metrics.paragraphCount > 0 ? 0.9 : 0.5,
      },
    })

    // Create SectionChange records from canonical JSON
    let sortOrder = 0
    for (const chapter of canonicalJson.chapters) {
      for (const paragraf of chapter.paragrafer) {
        await tx.sectionChange.create({
          data: {
            amendment_id: amendment.id,
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

    // Also walk divisions if present
    if (canonicalJson.divisions) {
      for (const division of canonicalJson.divisions) {
        for (const chapter of division.chapters) {
          for (const paragraf of chapter.paragrafer) {
            await tx.sectionChange.create({
              data: {
                amendment_id: amendment.id,
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

    // Create LegalDocument
    const legalDocResult = await createLegalDocumentFromAmendment(tx, {
      id: amendment.id,
      sfs_number: amendment.sfs_number,
      title: amendment.title,
      base_law_sfs: amendment.base_law_sfs,
      base_law_name: null,
      effective_date: amendment.effective_date,
      publication_date: amendment.publication_date,
      original_url: amendment.original_url,
      storage_path: amendment.storage_path,
      full_text: plainText,
      html_content: linkifiedHtml,
      markdown_content: markdownContent,
      json_content: canonicalJson,
      confidence: amendment.confidence,
    })

    if (legalDocResult.isNew) {
      console.log(
        `[DISCOVER-SFS]   LegalDocument created: ${legalDocResult.slug}`
      )
    }

    // Create ChangeEvent if base law exists in DB
    if (doc.baseLawSfs) {
      const baseLawDocNumber = `SFS ${doc.baseLawSfs}`
      const baseLawDoc = await tx.legalDocument.findUnique({
        where: { document_number: baseLawDocNumber },
        select: { id: true },
      })

      if (baseLawDoc) {
        await tx.changeEvent.create({
          data: {
            document_id: baseLawDoc.id,
            content_type: ContentType.SFS_LAW,
            change_type: isRepeal ? ChangeType.REPEAL : ChangeType.AMENDMENT,
            amendment_sfs: `SFS ${doc.sfsNumber}`,
            notification_sent: false,
          },
        })
        stats.changeEventsCreated++
        console.log(
          `[DISCOVER-SFS]   ChangeEvent created for base law ${doc.baseLawSfs}`
        )
      } else {
        console.log(
          `[DISCOVER-SFS]   Base law ${doc.baseLawSfs} not in DB — no ChangeEvent`
        )
      }
    }
  })

  stats.processed++
  if (isRepeal) stats.repealsProcessed++

  console.log(
    `[DISCOVER-SFS]   Processed successfully: ${doc.sfsNumber} (${sortOrderLabel(canonicalJson)})`
  )
}

// =============================================================================
// Retry Pipeline (for FAILED/PENDING amendments)
// =============================================================================

type AmendmentRecord = {
  id: string
  sfs_number: string
  storage_path: string
  base_law_sfs: string | null
  base_law_name: string | null
  title: string | null
}

async function retryAmendment(
  amendment: AmendmentRecord,
  slugMap: SlugMap,
  stats: DiscoveryStats
): Promise<void> {
  console.log(`[DISCOVER-SFS] Retrying: ${amendment.sfs_number}`)

  // Step A: Download PDF from Supabase storage
  const pdfBuffer = await downloadPdfFromStorage(amendment.sfs_number)
  if (!pdfBuffer) {
    console.error(
      `[DISCOVER-SFS]   Failed to download PDF from storage: ${amendment.sfs_number}`
    )
    await prisma.amendmentDocument.update({
      where: { id: amendment.id },
      data: {
        parse_status: ParseStatus.FAILED,
        parse_error: 'Retry: failed to download PDF from storage',
      },
    })
    throw new Error('Failed to download PDF from storage')
  }

  // Step B: Parse PDF with LLM → semantic HTML
  const { html: rawHtml, validation } = await parseAmendmentPdf(
    pdfBuffer,
    amendment.sfs_number,
    amendment.base_law_sfs ?? undefined,
    amendment.title ?? undefined
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
    documentNumber: `SFS ${amendment.sfs_number}`,
    title: amendment.title ?? `SFS ${amendment.sfs_number}`,
  })

  const canonicalJson = parseCanonicalHtml(normalizedHtml, {
    sfsNumber: amendment.sfs_number,
    documentType: 'SFS_AMENDMENT',
    ...(amendment.base_law_sfs ? { baseLawSfs: amendment.base_law_sfs } : {}),
  })

  const markdownContent = htmlToMarkdown(normalizedHtml)
  const plainText = htmlToPlainText(normalizedHtml)

  const linkifiedHtml = linkifyHtmlContent(
    normalizedHtml,
    slugMap,
    `SFS ${amendment.sfs_number}`
  ).html

  const effectiveDate = canonicalJson.metadata.effectiveDate
    ? new Date(canonicalJson.metadata.effectiveDate)
    : null

  // Step D: Update records in a transaction
  await prisma.$transaction(async (tx) => {
    // Clean up any partial SectionChanges from previous failed attempts
    await tx.sectionChange.deleteMany({
      where: { amendment_id: amendment.id },
    })

    // Create SectionChange records from canonical JSON
    let sortOrder = 0
    for (const chapter of canonicalJson.chapters) {
      for (const paragraf of chapter.paragrafer) {
        await tx.sectionChange.create({
          data: {
            amendment_id: amendment.id,
            chapter: chapter.number,
            section: paragraf.number,
            change_type: SectionChangeType.AMENDED,
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
                amendment_id: amendment.id,
                chapter: chapter.number,
                section: paragraf.number,
                change_type: SectionChangeType.AMENDED,
                description: paragraf.heading ?? null,
                new_text: paragraf.content || null,
                sort_order: sortOrder++,
              },
            })
          }
        }
      }
    }

    // Update AmendmentDocument with parsed data
    const updatedAmendment = await tx.amendmentDocument.update({
      where: { id: amendment.id },
      data: {
        title:
          canonicalJson.title ||
          amendment.title ||
          `SFS ${amendment.sfs_number}`,
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
    if (amendment.base_law_sfs) {
      const baseLawDocNumber = `SFS ${amendment.base_law_sfs}`
      const baseLawDoc = await tx.legalDocument.findUnique({
        where: { document_number: baseLawDocNumber },
        select: { id: true },
      })

      if (baseLawDoc) {
        // Dedup: only create if no matching ChangeEvent exists
        const existingEvent = await tx.changeEvent.findFirst({
          where: {
            document_id: baseLawDoc.id,
            amendment_sfs: `SFS ${amendment.sfs_number}`,
          },
          select: { id: true },
        })

        if (!existingEvent) {
          await tx.changeEvent.create({
            data: {
              document_id: baseLawDoc.id,
              content_type: ContentType.SFS_LAW,
              change_type: ChangeType.AMENDMENT,
              amendment_sfs: `SFS ${amendment.sfs_number}`,
              notification_sent: false,
            },
          })
          stats.changeEventsCreated++
          console.log(
            `[DISCOVER-SFS]   ChangeEvent created for base law ${amendment.base_law_sfs}`
          )
        }
      }
    }
  })

  console.log(
    `[DISCOVER-SFS]   Retry succeeded: ${amendment.sfs_number} (${sortOrderLabel(canonicalJson)})`
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
  if (stats.retriesAttempted > 0) {
    console.log(`[DISCOVER-SFS] ──── Retries ────`)
    console.log(`[DISCOVER-SFS] Retries attempted: ${stats.retriesAttempted}`)
    console.log(`[DISCOVER-SFS] Retries succeeded: ${stats.retriesSucceeded}`)
    console.log(`[DISCOVER-SFS] Retries failed: ${stats.retriesFailed}`)
  }
  console.log(`[DISCOVER-SFS] ──── Discovery ────`)
  console.log(`[DISCOVER-SFS] Discovered: ${stats.discovered}`)
  console.log(`[DISCOVER-SFS] Already exists: ${stats.alreadyExists}`)
  console.log(`[DISCOVER-SFS] Processed: ${stats.processed}`)
  console.log(`[DISCOVER-SFS] Failed: ${stats.failed}`)
  console.log(
    `[DISCOVER-SFS] Change events created: ${stats.changeEventsCreated}`
  )
  console.log(`[DISCOVER-SFS] PDFs fetched: ${stats.pdfsFetched}`)
  console.log(`[DISCOVER-SFS] PDFs stored: ${stats.pdfsStored}`)
  console.log(`[DISCOVER-SFS] PDFs failed: ${stats.pdfsFailed}`)
  console.log(`[DISCOVER-SFS] Repeals processed: ${stats.repealsProcessed}`)
  console.log(`[DISCOVER-SFS] New laws skipped: ${stats.newLawsSkipped}`)
  console.log(`[DISCOVER-SFS] Duration: ${stats.duration}`)
  console.log(`[DISCOVER-SFS] ======================================`)
}
