/**
 * SFS Laws - Updates Sync Cron Job
 *
 * This endpoint syncs UPDATES to EXISTING SFS laws from Riksdagen API.
 * Checks systemdatum changes for laws we already have in our database.
 *
 * For NEWLY PUBLISHED laws, see /api/cron/sync-sfs
 *
 * Runs daily at 4:30 AM UTC (5:30 AM CET / 6:30 AM CEST).
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ContentType, ParseStatus } from '@prisma/client'
import { fetchLawFullText, fetchLawHTML } from '@/lib/external/riksdagen'
import { archiveDocumentVersion } from '@/lib/sync/version-archive'
import { detectChanges } from '@/lib/sync/change-detection'
import {
  parseUndertitel,
  extractAllSfsReferences,
} from '@/lib/sync/section-parser'
import { createAmendmentFromChange } from '@/lib/sync/amendment-creator'
import { sendSfsSyncEmail } from '@/lib/email/cron-notifications'
import { invalidateLawCaches } from '@/lib/cache/invalidation'
import {
  classifyLawType,
  classificationToMetadata,
  fetchAndStorePdf,
  type PdfMetadata,
} from '@/lib/sfs'
import { createLegalDocumentFromAmendment } from '@/lib/sfs/amendment-to-legal-document'
import { parseAmendmentPdf } from '@/lib/external/llm-amendment-parser'
import { downloadPdf as downloadPdfFromStorage } from '@/lib/supabase/storage'
import {
  htmlToMarkdown,
  htmlToPlainText,
} from '@/lib/transforms/html-to-markdown'
import { htmlToJson } from '@/lib/transforms/html-to-json'
import { SectionChangeType } from '@prisma/client'
import { linkifyHtmlContent, type SlugMap } from '@/lib/linkify'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for cron

// Verify cron secret for security
const CRON_SECRET = process.env.CRON_SECRET

interface RiksdagenDocument {
  dok_id: string
  beteckning: string
  titel: string
  datum: string
  systemdatum: string
  undertitel?: string
  dokument_url_html: string
}

interface SyncStats {
  apiCount: number
  fetched: number
  updated: number
  skipped: number
  notInDb: number
  failed: number
  dateRange: { from: string; to: string }
  // Story 2.28: PDF and amendment stats
  pdfsFetched: number
  pdfsStored: number
  pdfsFailed: number
  amendmentsCreated: number
  amendmentsParsed: number
  // Story 2.29: LegalDocument creation for amendments
  legalDocsCreated: number
}

const CONFIG = {
  PAGE_SIZE: 50,
  MAX_PAGES: 2, // Only check recent systemdatum changes
  DELAY_MS: 100,
  LOOKBACK_HOURS: 48, // Look back 48 hours for systemdatum changes
}

export async function GET(request: Request) {
  const startTime = new Date()

  // Verify authorization
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Calculate cutoff time for systemdatum
  const now = new Date()
  const cutoffTime = new Date(now)
  cutoffTime.setHours(cutoffTime.getHours() - CONFIG.LOOKBACK_HOURS)

  const stats: SyncStats = {
    apiCount: 0,
    fetched: 0,
    updated: 0,
    skipped: 0,
    notInDb: 0,
    failed: 0,
    dateRange: {
      from: cutoffTime.toISOString(),
      to: now.toISOString(),
    },
    // Story 2.28: PDF and amendment stats
    pdfsFetched: 0,
    pdfsStored: 0,
    pdfsFailed: 0,
    amendmentsCreated: 0,
    amendmentsParsed: 0,
    // Story 2.29: LegalDocument creation
    legalDocsCreated: 0,
  }

  // Story 2.28 AC8: Track amendments for post-transaction LLM parsing
  const amendmentsToProcess: Array<{
    id: string
    sfsNumber: string
    storagePath: string
  }> = []

  try {
    // Fetch laws sorted by systemdatum (most recently modified first)
    let page = 1
    let hasMore = true
    let reachedCutoff = false

    while (hasMore && page <= CONFIG.MAX_PAGES && !reachedCutoff) {
      const url = new URL('https://data.riksdagen.se/dokumentlista/')
      url.searchParams.set('doktyp', 'sfs')
      url.searchParams.set('utformat', 'json')
      url.searchParams.set('sz', CONFIG.PAGE_SIZE.toString())
      url.searchParams.set('p', page.toString())
      url.searchParams.set('sort', 'systemdatum')
      url.searchParams.set('sortorder', 'desc')

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'Laglig.se/1.0 (Legal research; contact@laglig.se)',
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      stats.apiCount = parseInt(data.dokumentlista['@traffar'], 10) || 0
      const documents: RiksdagenDocument[] = data.dokumentlista.dokument || []
      const totalPages = parseInt(data.dokumentlista['@sidor'], 10) || 1

      console.log(
        `[SYNC-SFS-UPDATES] Page ${page}: ${documents.length} docs from API, total in API: ${stats.apiCount}`
      )

      for (const doc of documents) {
        const apiSystemdatum = new Date(doc.systemdatum.replace(' ', 'T') + 'Z')

        // Stop if we've reached documents older than our cutoff
        if (apiSystemdatum < cutoffTime) {
          reachedCutoff = true
          break
        }

        stats.fetched++
        const sfsNumber = `SFS ${doc.beteckning}`
        const latestAmendment = parseUndertitel(doc.undertitel || '')
        const amendmentInfo = latestAmendment
          ? ` (ändrad t.o.m. ${latestAmendment})`
          : ''

        // Check if we have this law in our database
        const existing = await prisma.legalDocument.findUnique({
          where: { document_number: sfsNumber },
          select: {
            id: true,
            full_text: true,
            html_content: true,
            metadata: true,
          },
        })

        // Skip if we don't have this law (handled by sync-sfs for new laws)
        if (!existing) {
          stats.notInDb++
          console.log(
            `[SYNC-SFS-UPDATES] ${sfsNumber}${amendmentInfo} not in DB, skipping`
          )
          continue
        }

        const storedMeta = existing.metadata as {
          systemdatum?: string
        } | null
        const storedSystemdatum = storedMeta?.systemdatum
          ? new Date(storedMeta.systemdatum.replace(' ', 'T') + 'Z')
          : null

        // Skip if we already have the latest version
        if (storedSystemdatum && apiSystemdatum <= storedSystemdatum) {
          stats.skipped++
          console.log(
            `[SYNC-SFS-UPDATES] ${sfsNumber}${amendmentInfo} already up-to-date`
          )
          continue
        }

        console.log(
          `[SYNC-SFS-UPDATES] ${sfsNumber}${amendmentInfo} needs update`
        )

        // Update existing law
        try {
          const [newHtml, newFullText] = await Promise.all([
            fetchLawHTML(doc.dok_id),
            fetchLawFullText(doc.dok_id),
          ])

          if (!newFullText && !newHtml) {
            stats.failed++
            console.log(
              `[SYNC-SFS-UPDATES] ${sfsNumber} failed to fetch content`
            )
            continue
          }

          // Story 2.28: Classify the updated document
          const classification = classifyLawType(doc.titel)
          const classificationMeta = classificationToMetadata(classification)

          // Story 2.28 Enhanced: Extract ALL amendments from full text, not just undertitel
          // This catches multiple amendments to the same law on the same day
          const currentYear = new Date().getFullYear()
          const allSfsRefs = newFullText
            ? extractAllSfsReferences(newFullText)
            : []
          const currentYearRefs = allSfsRefs.filter((sfs) =>
            sfs.startsWith(`${currentYear}:`)
          )

          // Check which amendments we already have in the database
          const existingAmendmentDocs = await prisma.amendmentDocument.findMany(
            {
              where: {
                sfs_number: { in: currentYearRefs },
              },
              select: { sfs_number: true },
            }
          )
          const existingSfsNumbers = new Set(
            existingAmendmentDocs.map((a) => a.sfs_number)
          )

          // Filter to only NEW amendments we haven't processed yet
          const newAmendments = currentYearRefs.filter(
            (sfs) => !existingSfsNumbers.has(sfs)
          )

          console.log(
            `[SYNC-SFS-UPDATES]   Full text has ${allSfsRefs.length} SFS refs, ${currentYearRefs.length} from ${currentYear}, ${newAmendments.length} new`
          )

          // Use systemdatum (base doc update time) as proxy for amendment publication date
          const amendmentDate = doc.systemdatum.split(' ')[0] // Extract YYYY-MM-DD

          // Track PDF metadata for all new amendments
          const amendmentPdfResults: Map<string, PdfMetadata | null> = new Map()

          // Fetch PDFs for ALL new amendments (not just undertitel)
          for (const amendmentSfs of newAmendments) {
            console.log(
              `[SYNC-SFS-UPDATES]   Fetching amendment PDF: SFS ${amendmentSfs}`
            )
            stats.pdfsFetched++

            const pdfResult = await fetchAndStorePdf(
              amendmentSfs,
              amendmentDate
            )

            if (pdfResult.success) {
              amendmentPdfResults.set(amendmentSfs, pdfResult.metadata)
              stats.pdfsStored++
              console.log(
                `[SYNC-SFS-UPDATES]     PDF stored: ${pdfResult.metadata?.storagePath}`
              )
            } else {
              stats.pdfsFailed++
              amendmentPdfResults.set(amendmentSfs, pdfResult.metadata)
              console.log(
                `[SYNC-SFS-UPDATES]     PDF failed: ${pdfResult.error}`
              )
            }
          }

          await prisma.$transaction(async (tx) => {
            const archivedVersion = await archiveDocumentVersion(tx, {
              documentId: existing.id,
              fullText: existing.full_text || '',
              htmlContent: existing.html_content || null,
              amendmentSfs: latestAmendment,
              sourceSystemdatum: apiSystemdatum,
            })

            await detectChanges(tx, {
              documentId: existing.id,
              contentType: ContentType.SFS_LAW,
              oldFullText: existing.full_text || '',
              newFullText: newFullText || '',
              amendmentSfs: latestAmendment,
              previousVersionId: archivedVersion?.id,
            })

            if (latestAmendment && newFullText) {
              await createAmendmentFromChange(tx, {
                baseDocumentId: existing.id,
                amendmentSfs: latestAmendment,
                fullText: newFullText,
                detectedFromVersionId: archivedVersion?.id,
              })
            }

            // Story 2.28 Enhanced: Create AmendmentDocument for ALL new amendments
            // Not just the undertitel one - this catches multiple amendments per day
            const baseLawSfs = doc.beteckning // e.g., "1977:1160"
            const baseLawNameMatch = doc.titel.match(/i\s+([^(]+?)\s*\(/i)
            const baseLawName = baseLawNameMatch?.[1]?.trim() ?? null

            for (const amendmentSfs of newAmendments) {
              const pdfMeta = amendmentPdfResults.get(amendmentSfs)
              if (!pdfMeta?.storagePath) continue

              const newAmendmentDoc = await tx.amendmentDocument.create({
                data: {
                  sfs_number: amendmentSfs,
                  storage_path: pdfMeta.storagePath,
                  original_url: pdfMeta.originalUrl,
                  file_size: pdfMeta.fileSize,
                  base_law_sfs: baseLawSfs,
                  base_law_name: baseLawName,
                  title: `Ändring SFS ${amendmentSfs}`,
                  parse_status: ParseStatus.PENDING,
                },
              })

              stats.amendmentsCreated++
              console.log(
                `[SYNC-SFS-UPDATES]     AmendmentDocument created: ${amendmentSfs}`
              )

              // Story 2.28 AC8: Queue for post-transaction LLM parsing
              amendmentsToProcess.push({
                id: newAmendmentDoc.id,
                sfsNumber: amendmentSfs,
                storagePath: pdfMeta.storagePath,
              })
            }

            await tx.legalDocument.update({
              where: { id: existing.id },
              data: {
                full_text: newFullText,
                html_content: newHtml,
                updated_at: new Date(),
                metadata: {
                  ...((existing.metadata as object) || {}),
                  systemdatum: doc.systemdatum,
                  latestAmendment,
                  lastSyncAt: new Date().toISOString(),
                  // Story 2.28: Add classification metadata
                  ...classificationMeta,
                },
              },
            })
          })

          stats.updated++
          console.log(
            `[SYNC-SFS-UPDATES] ${sfsNumber}${amendmentInfo} updated successfully`
          )
        } catch (err) {
          stats.failed++
          console.error(
            `[SYNC-SFS-UPDATES] ${sfsNumber}${amendmentInfo} update failed:`,
            err
          )
        }

        // Small delay to be respectful to API
        await new Promise((resolve) => setTimeout(resolve, CONFIG.DELAY_MS))
      }

      hasMore = page < totalPages && page < CONFIG.MAX_PAGES
      page++
    }

    // Story 2.28 AC8: Process amendments with PDF-direct LLM pipeline (outside main loop for timeout safety)
    const maxRuntime = maxDuration * 1000 - 30000 // 30s buffer before timeout

    // Story 2.29: Build slug map for linkification
    const { buildSlugMap } = await import('@/lib/linkify')
    const slugMap: SlugMap = await buildSlugMap()

    for (const amendment of amendmentsToProcess) {
      // Timeout protection: stop if approaching the maxDuration limit
      const elapsed = Date.now() - startTime.getTime()
      if (elapsed > maxRuntime) {
        console.log(
          `[SYNC-SFS-UPDATES] Approaching timeout (${Math.round(elapsed / 1000)}s elapsed), stopping LLM parsing. ` +
            `${amendmentsToProcess.indexOf(amendment)}/${amendmentsToProcess.length} processed.`
        )
        break
      }

      try {
        console.log(
          `[SYNC-SFS-UPDATES] Parsing amendment PDF with LLM: ${amendment.sfsNumber}`
        )

        // Download PDF from Supabase Storage
        const pdfBuffer = await downloadPdfFromStorage(amendment.sfsNumber)
        if (!pdfBuffer) {
          console.log(
            `[SYNC-SFS-UPDATES]   Failed to download PDF for parsing: ${amendment.sfsNumber}`
          )
          await prisma.amendmentDocument.update({
            where: { id: amendment.id },
            data: { parse_status: ParseStatus.FAILED },
          })
          continue
        }

        // Fetch base law info for the prompt
        const amendmentDoc = await prisma.amendmentDocument.findUnique({
          where: { id: amendment.id },
          select: { base_law_sfs: true, base_law_name: true, title: true },
        })

        // Send PDF directly to Claude → get semantic HTML back
        const { html: htmlContent, validation } = await parseAmendmentPdf(
          pdfBuffer,
          amendment.sfsNumber,
          amendmentDoc?.base_law_sfs ?? undefined,
          amendmentDoc?.title ?? undefined
        )

        console.log(
          `[SYNC-SFS-UPDATES]   LLM returned HTML: ${htmlContent.length} chars, ` +
            `sections: ${validation.metrics.sectionCount}, paragraphs: ${validation.metrics.paragraphCount}`
        )

        if (validation.warnings.length > 0) {
          console.log(
            `[SYNC-SFS-UPDATES]   Warnings: ${validation.warnings.map((w) => w.code).join(', ')}`
          )
        }

        // Derive all content formats from unlinkified HTML
        const markdownContent = htmlToMarkdown(htmlContent)
        const jsonContent = htmlToJson(htmlContent, {
          sfsNumber: amendment.sfsNumber,
          documentType: 'amendment',
        })
        const plainText = htmlToPlainText(htmlContent)

        // Story 2.29: Linkify AFTER deriving fields, BEFORE DB write
        const linkifiedHtml = linkifyHtmlContent(
          htmlContent,
          slugMap,
          `SFS ${amendment.sfsNumber}`
        ).html

        // Map JSON section changeType to database enum
        const mapChangeType = (
          type: 'amended' | 'repealed' | 'new' | null
        ): SectionChangeType => {
          switch (type) {
            case 'amended':
              return SectionChangeType.AMENDED
            case 'repealed':
              return SectionChangeType.REPEALED
            case 'new':
              return SectionChangeType.NEW
            default:
              return SectionChangeType.AMENDED // default for sections without explicit changeType
          }
        }

        // Create SectionChange records + update AmendmentDocument + create LegalDocument
        await prisma.$transaction(async (tx) => {
          // Create SectionChange records from JSON sections
          let sortOrder = 0
          for (const section of jsonContent.sections) {
            // Skip chapter-level entries (they don't have section numbers)
            if (section.type === 'chapter' && !section.number) continue

            await tx.sectionChange.create({
              data: {
                amendment_id: amendment.id,
                chapter: section.chapter,
                section: section.number || 'unknown',
                change_type: mapChangeType(section.changeType),
                description: section.heading ?? null,
                new_text: section.content || null,
                sort_order: sortOrder++,
              },
            })
          }

          // Extract title and effective_date from JSON metadata
          const effectiveDateStr = jsonContent.transitionProvisions.find(
            (tp) => tp.effectiveDate
          )?.effectiveDate
          const effectiveDate = effectiveDateStr
            ? new Date(effectiveDateStr)
            : null

          // Update AmendmentDocument with parsed data
          const updatedAmendment = await tx.amendmentDocument.update({
            where: { id: amendment.id },
            data: {
              title: jsonContent.title || `Ändring SFS ${amendment.sfsNumber}`,
              effective_date: effectiveDate,
              full_text: plainText,
              markdown_content: markdownContent,
              parse_status: ParseStatus.COMPLETED,
              parsed_at: new Date(),
            },
          })

          // Create LegalDocument entry with all content formats
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
            json_content: jsonContent,
            confidence: updatedAmendment.confidence,
          })

          if (legalDocResult.isNew) {
            stats.legalDocsCreated++
            console.log(
              `[SYNC-SFS-UPDATES]     LegalDocument created: ${legalDocResult.slug}`
            )
          }
        })

        stats.amendmentsParsed++
        console.log(
          `[SYNC-SFS-UPDATES]   Amendment parsed successfully: ${amendment.sfsNumber} ` +
            `(${jsonContent.sections.length} sections)`
        )
      } catch (err) {
        console.error(
          `[SYNC-SFS-UPDATES]   LLM parsing failed for ${amendment.sfsNumber}:`,
          err
        )
        // Mark as failed but don't block the sync
        await prisma.amendmentDocument.update({
          where: { id: amendment.id },
          data: { parse_status: ParseStatus.FAILED },
        })
      }
    }

    const duration = Date.now() - startTime.getTime()
    const durationStr = `${Math.round(duration / 1000)}s`

    console.log(`[SYNC-SFS-UPDATES] ========== SUMMARY ==========`)
    console.log(`[SYNC-SFS-UPDATES] Lookback: ${CONFIG.LOOKBACK_HOURS} hours`)
    console.log(`[SYNC-SFS-UPDATES] API total: ${stats.apiCount} documents`)
    console.log(`[SYNC-SFS-UPDATES] Fetched (within cutoff): ${stats.fetched}`)
    console.log(`[SYNC-SFS-UPDATES] Updated: ${stats.updated}`)
    console.log(
      `[SYNC-SFS-UPDATES] Skipped (already up-to-date): ${stats.skipped}`
    )
    console.log(`[SYNC-SFS-UPDATES] Not in DB: ${stats.notInDb}`)
    console.log(`[SYNC-SFS-UPDATES] Failed: ${stats.failed}`)
    console.log(`[SYNC-SFS-UPDATES] Duration: ${durationStr}`)
    console.log(`[SYNC-SFS-UPDATES] ──── PDF/Amendment Stats (Story 2.28) ────`)
    console.log(`[SYNC-SFS-UPDATES] PDFs fetched: ${stats.pdfsFetched}`)
    console.log(`[SYNC-SFS-UPDATES] PDFs stored: ${stats.pdfsStored}`)
    console.log(`[SYNC-SFS-UPDATES] PDFs failed: ${stats.pdfsFailed}`)
    console.log(
      `[SYNC-SFS-UPDATES] Amendments created: ${stats.amendmentsCreated}`
    )
    console.log(
      `[SYNC-SFS-UPDATES] Amendments parsed (LLM): ${stats.amendmentsParsed}`
    )
    console.log(
      `[SYNC-SFS-UPDATES] LegalDocs created (2.29): ${stats.legalDocsCreated}`
    )
    console.log(`[SYNC-SFS-UPDATES] ======================================`)

    // Invalidate caches if any documents were updated
    let cacheInvalidation = null
    if (stats.updated > 0) {
      cacheInvalidation = await invalidateLawCaches()
      console.log(
        `[SYNC-SFS-UPDATES] Cache invalidated: ${cacheInvalidation.redisKeysCleared} Redis keys, tags: ${cacheInvalidation.tagsRevalidated.join(', ')}`
      )
    }

    // Send email notification (with PDF/amendment stats from Story 2.28)
    await sendSfsSyncEmail(
      {
        apiCount: stats.apiCount,
        fetched: stats.fetched,
        inserted: 0,
        updated: stats.updated,
        skipped: stats.skipped + stats.notInDb,
        failed: stats.failed,
        dateRange: stats.dateRange,
        pdfsFetched: stats.pdfsFetched,
        pdfsStored: stats.pdfsStored,
        pdfsFailed: stats.pdfsFailed,
        amendmentsCreated: stats.amendmentsCreated,
        amendmentsParsed: stats.amendmentsParsed,
      },
      durationStr,
      true
    )

    return NextResponse.json({
      success: true,
      stats,
      cacheInvalidation,
      duration: durationStr,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('SFS updates sync failed:', error)

    const duration = Date.now() - startTime.getTime()
    const durationStr = `${Math.round(duration / 1000)}s`
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    // Send failure notification email (with PDF/amendment stats from Story 2.28)
    await sendSfsSyncEmail(
      {
        apiCount: stats.apiCount,
        fetched: stats.fetched,
        inserted: 0,
        updated: stats.updated,
        skipped: stats.skipped + stats.notInDb,
        failed: stats.failed,
        dateRange: stats.dateRange,
        pdfsFetched: stats.pdfsFetched,
        pdfsStored: stats.pdfsStored,
        pdfsFailed: stats.pdfsFailed,
        amendmentsCreated: stats.amendmentsCreated,
        amendmentsParsed: stats.amendmentsParsed,
      },
      durationStr,
      false,
      errorMessage
    )

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        stats,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
