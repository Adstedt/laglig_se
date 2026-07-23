/**
 * Unified SFS Amendment Processing Pipeline
 *
 * Extracted from app/api/cron/discover-sfs-amendments so the cron routes
 * (discover / process) and local backfill scripts share one implementation.
 *
 * Processes a single AmendmentDocument record: PDF fetch → LLM parse →
 * normalize → derive content → write LegalDocument + SectionChanges +
 * ChangeEvent in a transaction.
 *
 * Concurrency: callers claim a record with claimAmendmentRecord() (atomic
 * PENDING/FAILED → PROCESSING transition) before processing, so a cron run
 * and a local backfill can't double-process the same record. A hard-killed
 * run leaves records stuck in PROCESSING — recover them with
 * resetStuckProcessing() at the start of each run.
 */

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
import { classifyDocument } from '@/lib/sfs/sfs-amendment-crawler'
import {
  extractPropositionRef,
  fetchPropositionContext,
} from '@/lib/riksdagen/proposition-fetcher'
import { extractEffectiveDate } from '@/lib/external/pdf-parser'
import { ensureSfsPrefix } from '@/lib/sfs/ensure-prefix'

export type AmendmentRecord = {
  id: string
  sfs_number: string
  storage_path: string
  original_url: string | null
  base_law_sfs: string | null
  base_law_name: string | null
  title: string | null
  publication_date: Date | null
}

export interface AmendmentProcessingStats {
  processed: number
  failed: number
  changeEventsCreated: number
  pdfsFetched: number
  pdfsStored: number
  pdfsFailed: number
  repealsProcessed: number
}

export interface ProcessAmendmentOptions {
  /** Passed through to the LLM parser. Callers with a fixed execution budget
   * should bound both so one record can't eat the whole run. */
  llm?: {
    maxRetries?: number
    timeoutMs?: number
  }
  log?: (_message: string) => void
}

/**
 * Atomically claim a record for processing (PENDING/FAILED → PROCESSING).
 * Returns false if another worker already claimed it.
 */
export async function claimAmendmentRecord(id: string): Promise<boolean> {
  const result = await prisma.amendmentDocument.updateMany({
    where: {
      id,
      parse_status: { in: [ParseStatus.PENDING, ParseStatus.FAILED] },
    },
    data: { parse_status: ParseStatus.PROCESSING },
  })
  return result.count === 1
}

/** Mark a claimed record FAILED so the next run retries it. */
export async function releaseFailedRecord(
  id: string,
  errorMessage: string
): Promise<void> {
  try {
    await prisma.amendmentDocument.update({
      where: { id },
      data: {
        parse_status: ParseStatus.FAILED,
        parse_error: errorMessage.slice(0, 1000),
      },
    })
  } catch {
    // non-fatal — record stays PROCESSING and is recovered by resetStuckProcessing
  }
}

/**
 * Recover records stranded in PROCESSING by a hard-killed run.
 * Anything PROCESSING and untouched for `staleAfterMinutes` goes back to PENDING.
 */
export async function resetStuckProcessing(
  staleAfterMinutes = 30
): Promise<number> {
  const cutoff = new Date(Date.now() - staleAfterMinutes * 60_000)
  const result = await prisma.amendmentDocument.updateMany({
    where: {
      parse_status: ParseStatus.PROCESSING,
      updated_at: { lt: cutoff },
    },
    data: { parse_status: ParseStatus.PENDING },
  })
  return result.count
}

/**
 * Process a single AmendmentDocument record through the full pipeline.
 * Caller is responsible for claiming the record first (claimAmendmentRecord)
 * and marking it FAILED on throw (releaseFailedRecord).
 */
export async function processAmendmentRecord(
  record: AmendmentRecord,
  slugMap: SlugMap,
  stats: AmendmentProcessingStats,
  options: ProcessAmendmentOptions = {}
): Promise<void> {
  const log = options.log ?? console.log
  const isRepeal = record.title
    ? classifyDocument(record.title) === 'repeal'
    : false

  log(
    `[AMENDMENT-PROC] Processing ${isRepeal ? 'repeal' : 'amendment'}: ${record.sfs_number} - ${record.title ?? '(no title)'}`
  )

  // Step A: Ensure PDF is in Supabase storage
  let pdfBuffer = await downloadPdfFromStorage(record.sfs_number)

  if (!pdfBuffer) {
    // PDF not in storage yet — fetch and store it.
    // fetchAndStorePdf resolves the canonical URL via the doc page (source of truth).
    stats.pdfsFetched++
    const pdfResult = await fetchAndStorePdf(record.sfs_number)

    if (!pdfResult.success) {
      stats.pdfsFailed++
      throw new Error(`PDF fetch failed: ${pdfResult.error}`)
    }

    stats.pdfsStored++

    // Update storage path and original_url with the resolved values
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
    record.title ?? undefined,
    options.llm ?? {}
  )

  log(
    `[AMENDMENT-PROC]   LLM returned HTML: ${rawHtml.length} chars, ` +
      `sections: ${validation.metrics.sectionCount}, paragraphs: ${validation.metrics.paragraphCount}`
  )

  if (validation.warnings.length > 0) {
    log(
      `[AMENDMENT-PROC]   Warnings: ${validation.warnings.map((w) => w.code).join(', ')}`
    )
  }

  // Step C: Normalize → derive content
  const normalizedHtml = normalizeSfsAmendment(rawHtml, {
    documentNumber: ensureSfsPrefix(record.sfs_number),
    title: record.title ?? ensureSfsPrefix(record.sfs_number),
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
    ensureSfsPrefix(record.sfs_number)
  ).html

  // Extract effective date: canonical JSON first, then fallback to plain text parsing
  let effectiveDate = canonicalJson.metadata.effectiveDate
    ? new Date(canonicalJson.metadata.effectiveDate)
    : null
  if (!effectiveDate) {
    const extracted = extractEffectiveDate(plainText)
    if (extracted) {
      effectiveDate = new Date(extracted)
      if (isNaN(effectiveDate.getTime())) effectiveDate = null
    }
  }

  // Step C.5: Fetch proposition context from riksdagen.se (non-blocking)
  let propositionData: {
    id: string
    title: string
    summary: string | null
    organ: string | null
    datum: Date | null
  } | null = null
  const propRef = extractPropositionRef(plainText)
  if (propRef) {
    propositionData = await fetchPropositionContext(propRef)
    if (propositionData) {
      log(
        `[AMENDMENT-PROC]   Proposition: ${propositionData.title} (${propRef})`
      )
    }
  }

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

    // Update AmendmentDocument to COMPLETED (with proposition context if available)
    const updatedAmendment = await tx.amendmentDocument.update({
      where: { id: record.id },
      data: {
        title:
          canonicalJson.title ||
          record.title ||
          ensureSfsPrefix(record.sfs_number),
        effective_date: effectiveDate,
        full_text: plainText,
        markdown_content: markdownContent,
        parse_status: ParseStatus.COMPLETED,
        parsed_at: new Date(),
        parse_error: null,
        confidence: validation.metrics.paragraphCount > 0 ? 0.9 : 0.5,
        ...(propositionData && {
          proposition_id: propositionData.id,
          proposition_title: propositionData.title,
          proposition_summary: propositionData.summary,
          proposition_organ: propositionData.organ,
          proposition_datum: propositionData.datum,
        }),
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
      log(`[AMENDMENT-PROC]   LegalDocument created: ${legalDocResult.slug}`)
    }

    // Create ChangeEvent if base law exists in DB (dedup: check first)
    if (record.base_law_sfs) {
      const baseLawDocNumber = ensureSfsPrefix(record.base_law_sfs ?? '')
      const baseLawDoc = await tx.legalDocument.findUnique({
        where: { document_number: baseLawDocNumber },
        select: { id: true },
      })

      if (baseLawDoc) {
        const existingEvent = await tx.changeEvent.findFirst({
          where: {
            document_id: baseLawDoc.id,
            amendment_sfs: ensureSfsPrefix(record.sfs_number),
          },
          select: { id: true },
        })

        if (!existingEvent) {
          await tx.changeEvent.create({
            data: {
              document_id: baseLawDoc.id,
              content_type: ContentType.SFS_LAW,
              change_type: isRepeal ? ChangeType.REPEAL : ChangeType.AMENDMENT,
              amendment_sfs: ensureSfsPrefix(record.sfs_number),
              notification_sent: false,
            },
          })
          stats.changeEventsCreated++
          log(
            `[AMENDMENT-PROC]   ChangeEvent created for base law ${record.base_law_sfs}`
          )
        } else {
          // Story 8.21: Re-trigger notification pipeline if sync-sfs-updates
          // created this event first — this pipeline is the authoritative source
          await tx.changeEvent.update({
            where: { id: existingEvent.id },
            data: { notification_sent: false },
          })
        }
      } else {
        log(
          `[AMENDMENT-PROC]   Base law ${record.base_law_sfs} not in DB — no ChangeEvent`
        )
      }
    }
  })

  stats.processed++
  if (isRepeal) stats.repealsProcessed++

  const paragrafer = canonicalJson.chapters.reduce(
    (sum, ch) => sum + ch.paragrafer.length,
    0
  )
  log(
    `[AMENDMENT-PROC]   Processed successfully: ${record.sfs_number} (${paragrafer} paragrafer)`
  )
}
