/**
 * SFS Laws - New Laws Sync Cron Job (Catchup Strategy)
 *
 * This endpoint ensures our database is caught up with the Riksdagen API.
 * It fetches the 300 newest laws by `publicerad` (API publication date)
 * and inserts any that are missing from our database.
 *
 * Strategy:
 * - Sort by publicerad desc (newest API additions first)
 * - Check each against our DB
 * - Insert any missing laws
 * - Always check 3 pages (300 docs) to catch any gaps
 *
 * This handles:
 * - Normal daily new publications
 * - Gaps from missed cron runs
 * - Laws published to API after their enactment date
 *
 * For updates/amendments to EXISTING laws, see /api/cron/sync-sfs-updates
 *
 * Runs daily at 4:00 AM UTC (5:00 AM CET / 6:00 AM CEST).
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ContentType, DocumentStatus, ChangeType } from '@prisma/client'
import {
  fetchLawFullText,
  fetchLawHTML,
  generateSlug,
} from '@/lib/external/riksdagen'
import { parseUndertitel } from '@/lib/sync/section-parser'
import { sendSfsSyncEmail } from '@/lib/email/cron-notifications'
import { invalidateLawCaches } from '@/lib/cache/invalidation'
import {
  classifyLawType,
  classificationToMetadata,
  fetchAndStorePdf,
  type PdfMetadata,
} from '@/lib/sfs'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for cron

// Verify cron secret for security
const CRON_SECRET = process.env.CRON_SECRET

interface RiksdagenDocument {
  dok_id: string
  beteckning: string
  titel: string
  datum: string
  publicerad: string
  systemdatum: string
  undertitel?: string
  dokument_url_html: string
}

interface InsertedDoc {
  sfsNumber: string
  title: string
  publicerad: string
  datum: string
  lawType: string
  documentCategory: string
  pdfFetched: boolean
}

interface SyncStats {
  apiCount: number
  pagesChecked: number
  fetched: number
  inserted: number
  skipped: number
  failed: number
  noSfsNumber: number
  newestApiSfs: string | null
  newestApiPublicerad: string | null
  newestInDb: boolean | null
  insertedDocs: InsertedDoc[]
  // PDF stats (Story 2.28)
  pdfsFetched: number
  pdfsStored: number
  pdfsFailed: number
}

const CONFIG = {
  PAGE_SIZE: 100,
  MAX_PAGES: 3, // Check 300 docs (covers ~2-3 weeks of new laws)
  DELAY_MS: 100,
}

export async function GET(request: Request) {
  const startTime = new Date()

  // Verify authorization
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stats: SyncStats = {
    apiCount: 0,
    pagesChecked: 0,
    fetched: 0,
    inserted: 0,
    skipped: 0,
    failed: 0,
    noSfsNumber: 0,
    newestApiSfs: null,
    newestApiPublicerad: null,
    newestInDb: null,
    insertedDocs: [],
    // PDF stats (Story 2.28)
    pdfsFetched: 0,
    pdfsStored: 0,
    pdfsFailed: 0,
  }

  // Collect all log entries for detailed output
  const logEntries: string[] = []

  try {
    console.log(`[SYNC-SFS] ========================================`)
    console.log(`[SYNC-SFS] Starting catchup sync (newest 300 by publicerad)`)
    console.log(
      `[SYNC-SFS] Strategy: Check API docs against DB, insert missing`
    )
    console.log(
      `[SYNC-SFS] Max pages: ${CONFIG.MAX_PAGES} (${CONFIG.MAX_PAGES * CONFIG.PAGE_SIZE} docs)`
    )
    console.log(`[SYNC-SFS] ========================================`)

    let page = 0

    while (page < CONFIG.MAX_PAGES) {
      page++
      stats.pagesChecked = page

      // Fetch newest laws by publicerad (API publication date)
      const url = new URL('https://data.riksdagen.se/dokumentlista/')
      url.searchParams.set('doktyp', 'sfs')
      url.searchParams.set('utformat', 'json')
      url.searchParams.set('sz', CONFIG.PAGE_SIZE.toString())
      url.searchParams.set('p', page.toString())
      url.searchParams.set('sort', 'publicerad')
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

      console.log(`[SYNC-SFS] --- Page ${page}/${CONFIG.MAX_PAGES} ---`)
      console.log(`[SYNC-SFS] Fetched ${documents.length} docs from API`)

      if (documents.length === 0) {
        console.log(`[SYNC-SFS] No documents returned, stopping`)
        break
      }

      // Track newest for verification
      if (page === 1 && documents.length > 0) {
        const newestDoc = documents.find((d) => d.beteckning)
        if (newestDoc) {
          stats.newestApiSfs = `SFS ${newestDoc.beteckning}`
          stats.newestApiPublicerad = newestDoc.publicerad
          console.log(
            `[SYNC-SFS] Newest in API: ${stats.newestApiSfs} (publicerad: ${newestDoc.publicerad})`
          )
        }
      }

      let pageInserted = 0
      let pageSkipped = 0
      let pageNoSfs = 0

      for (const doc of documents) {
        stats.fetched++

        // Skip documents without SFS number (historical docs)
        if (!doc.beteckning) {
          stats.noSfsNumber++
          pageNoSfs++
          logEntries.push(`[ ] (no SFS number) dok_id=${doc.dok_id} - skipped`)
          continue
        }

        const sfsNumber = `SFS ${doc.beteckning}`
        const apiSystemdatum = new Date(doc.systemdatum.replace(' ', 'T') + 'Z')

        // Check if already exists
        const existing = await prisma.legalDocument.findUnique({
          where: { document_number: sfsNumber },
          select: { id: true },
        })

        if (existing) {
          stats.skipped++
          pageSkipped++
          logEntries.push(
            `[✓] ${sfsNumber.padEnd(20)} exists (publicerad: ${doc.publicerad})`
          )
          continue
        }

        // New document - insert it
        logEntries.push(
          `[+] ${sfsNumber.padEnd(20)} NEW (publicerad: ${doc.publicerad})`
        )
        console.log(
          `[SYNC-SFS] INSERTING: ${sfsNumber} "${doc.titel.substring(0, 50)}..."`
        )

        try {
          const [htmlContent, fullText] = await Promise.all([
            fetchLawHTML(doc.dok_id),
            fetchLawFullText(doc.dok_id),
          ])

          if (!fullText && !htmlContent) {
            console.log(
              `[SYNC-SFS] ${sfsNumber} - no content available, skipping`
            )
            stats.failed++
            continue
          }

          const slug = generateSlug(doc.titel, sfsNumber)
          const latestAmendment = parseUndertitel(doc.undertitel || '')

          // Story 2.28: Classify the document
          const classification = classifyLawType(doc.titel)
          const classificationMeta = classificationToMetadata(classification)
          console.log(
            `[SYNC-SFS]   Classification: ${classification.type}/${classification.category} (confidence: ${classification.confidence})`
          )

          // Story 2.28: Fetch and store PDF
          let pdfMetadata: PdfMetadata | null = null
          stats.pdfsFetched++
          const pdfResult = await fetchAndStorePdf(
            doc.beteckning,
            doc.datum || doc.publicerad
          )
          if (pdfResult.success) {
            pdfMetadata = pdfResult.metadata
            stats.pdfsStored++
            console.log(`[SYNC-SFS]   PDF stored: ${pdfMetadata?.storagePath}`)
          } else {
            stats.pdfsFailed++
            pdfMetadata = pdfResult.metadata // Store error metadata for retry
            console.log(`[SYNC-SFS]   PDF failed: ${pdfResult.error}`)
          }

          await prisma.$transaction(async (tx) => {
            const newDoc = await tx.legalDocument.create({
              data: {
                document_number: sfsNumber,
                title: doc.titel,
                slug,
                content_type: ContentType.SFS_LAW,
                full_text: fullText,
                html_content: htmlContent,
                publication_date: doc.datum ? new Date(doc.datum) : null,
                status: DocumentStatus.ACTIVE,
                source_url: `https://data.riksdagen.se/dokument/${doc.dok_id}`,
                metadata: {
                  dokId: doc.dok_id,
                  source: 'data.riksdagen.se',
                  publicerad: doc.publicerad,
                  systemdatum: doc.systemdatum,
                  latestAmendment,
                  versionCount: 1,
                  fetchedAt: new Date().toISOString(),
                  method: 'cron-sync-catchup',
                  // Story 2.28: Classification metadata
                  ...classificationMeta,
                  // Story 2.28: PDF metadata (spread to satisfy Prisma JSON type)
                  pdf: pdfMetadata ? { ...pdfMetadata } : null,
                },
              },
            })

            await tx.documentVersion.create({
              data: {
                document_id: newDoc.id,
                version_number: 1,
                full_text: fullText || '',
                html_content: htmlContent,
                amendment_sfs: latestAmendment,
                source_systemdatum: apiSystemdatum,
              },
            })

            await tx.changeEvent.create({
              data: {
                document_id: newDoc.id,
                content_type: ContentType.SFS_LAW,
                change_type: ChangeType.NEW_LAW,
              },
            })
          })

          stats.inserted++
          pageInserted++
          stats.insertedDocs.push({
            sfsNumber,
            title: doc.titel,
            publicerad: doc.publicerad,
            datum: doc.datum,
            lawType: classification.type,
            documentCategory: classification.category,
            pdfFetched: pdfResult.success,
          })
          console.log(`[SYNC-SFS] ✓ INSERTED: ${sfsNumber}`)
          console.log(
            `[SYNC-SFS]   Title: ${doc.titel.substring(0, 80)}${doc.titel.length > 80 ? '...' : ''}`
          )
          console.log(
            `[SYNC-SFS]   Datum: ${doc.datum} | Publicerad: ${doc.publicerad}`
          )
        } catch (err) {
          stats.failed++
          console.error(`[SYNC-SFS] ✗ ${sfsNumber} insert failed:`, err)
        }

        // Small delay to be respectful to API
        await new Promise((resolve) => setTimeout(resolve, CONFIG.DELAY_MS))
      }

      console.log(
        `[SYNC-SFS] Page ${page} summary: ${pageInserted} inserted, ${pageSkipped} exist, ${pageNoSfs} no SFS`
      )

      // Continue to next page if available
      if (page >= totalPages) {
        console.log(`[SYNC-SFS] Reached last API page`)
        break
      }
    }

    // Verification: Check if newest API doc exists in our DB
    console.log(`[SYNC-SFS] `)
    console.log(`[SYNC-SFS] ──────────── VERIFICATION ────────────`)

    if (stats.newestApiSfs) {
      const newestExists = await prisma.legalDocument.findUnique({
        where: { document_number: stats.newestApiSfs },
        select: { id: true },
      })
      stats.newestInDb = !!newestExists

      console.log(`[SYNC-SFS] Newest in API:  ${stats.newestApiSfs}`)
      console.log(`[SYNC-SFS] Publicerad:     ${stats.newestApiPublicerad}`)
      console.log(
        `[SYNC-SFS] In our DB:      ${stats.newestInDb ? '✓ YES' : '✗ NO - MISSING!'}`
      )

      if (!stats.newestInDb) {
        console.log(
          `[SYNC-SFS] ⚠️  WARNING: Newest API document not in database!`
        )
      }
    }

    const duration = Date.now() - startTime.getTime()
    const durationStr = `${Math.round(duration / 1000)}s`

    // Final summary
    console.log(`[SYNC-SFS] `)
    console.log(`[SYNC-SFS] ============ SUMMARY ============`)
    console.log(`[SYNC-SFS] Pages checked:    ${stats.pagesChecked}`)
    console.log(`[SYNC-SFS] API total:        ${stats.apiCount} documents`)
    console.log(`[SYNC-SFS] Fetched:          ${stats.fetched}`)
    console.log(`[SYNC-SFS] Inserted:         ${stats.inserted}`)
    console.log(`[SYNC-SFS] Already exist:    ${stats.skipped}`)
    console.log(`[SYNC-SFS] No SFS number:    ${stats.noSfsNumber}`)
    console.log(`[SYNC-SFS] Failed:           ${stats.failed}`)
    console.log(`[SYNC-SFS] Duration:         ${durationStr}`)
    console.log(`[SYNC-SFS] ──── PDF Stats (Story 2.28) ────`)
    console.log(`[SYNC-SFS] PDFs fetched:     ${stats.pdfsFetched}`)
    console.log(`[SYNC-SFS] PDFs stored:      ${stats.pdfsStored}`)
    console.log(`[SYNC-SFS] PDFs failed:      ${stats.pdfsFailed}`)
    console.log(`[SYNC-SFS] =====================================`)

    // Get current DB count
    const dbCount = await prisma.legalDocument.count({
      where: { content_type: ContentType.SFS_LAW },
    })
    console.log(`[SYNC-SFS] Total SFS_LAW in DB: ${dbCount}`)

    // Determine sync status
    const syncStatus =
      stats.inserted === 0 && stats.newestInDb === true
        ? 'CAUGHT_UP'
        : stats.inserted > 0
          ? 'SYNCED_NEW'
          : 'UNKNOWN'

    console.log(`[SYNC-SFS] Sync status: ${syncStatus}`)

    // Log inserted documents summary
    if (stats.insertedDocs.length > 0) {
      console.log(`[SYNC-SFS] `)
      console.log(`[SYNC-SFS] ──────── NEW LAWS ADDED ────────`)
      for (const doc of stats.insertedDocs) {
        console.log(`[SYNC-SFS] `)
        console.log(`[SYNC-SFS] ${doc.sfsNumber}`)
        console.log(
          `[SYNC-SFS]   "${doc.title.substring(0, 70)}${doc.title.length > 70 ? '...' : ''}"`
        )
        console.log(
          `[SYNC-SFS]   Datum: ${doc.datum} | Publicerad: ${doc.publicerad}`
        )
      }
      console.log(`[SYNC-SFS] ─────────────────────────────────`)
    }

    // Invalidate caches if any documents were inserted
    let cacheInvalidation = null
    if (stats.inserted > 0) {
      cacheInvalidation = await invalidateLawCaches()
      console.log(
        `[SYNC-SFS] Cache invalidated: ${cacheInvalidation.redisKeysCleared} Redis keys, tags: ${cacheInvalidation.tagsRevalidated.join(', ')}`
      )
    }

    // Send email notification (with PDF stats from Story 2.28)
    await sendSfsSyncEmail(
      {
        apiCount: stats.apiCount,
        fetched: stats.fetched,
        inserted: stats.inserted,
        skipped: stats.skipped,
        failed: stats.failed,
        dateRange: { from: 'catchup', to: 'latest' },
        pdfsFetched: stats.pdfsFetched,
        pdfsStored: stats.pdfsStored,
        pdfsFailed: stats.pdfsFailed,
      },
      durationStr,
      true
    )

    return NextResponse.json({
      success: true,
      syncStatus,
      stats: {
        ...stats,
        dbCount,
      },
      cacheInvalidation,
      duration: durationStr,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[SYNC-SFS] Sync failed:', error)

    const duration = Date.now() - startTime.getTime()
    const durationStr = `${Math.round(duration / 1000)}s`
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    // Send failure notification email (with PDF stats from Story 2.28)
    await sendSfsSyncEmail(
      {
        apiCount: stats.apiCount,
        fetched: stats.fetched,
        inserted: stats.inserted,
        skipped: stats.skipped,
        failed: stats.failed,
        dateRange: { from: 'catchup', to: 'latest' },
        pdfsFetched: stats.pdfsFetched,
        pdfsStored: stats.pdfsStored,
        pdfsFailed: stats.pdfsFailed,
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
