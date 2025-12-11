/**
 * SFS Laws - New Laws Sync Cron Job
 *
 * This endpoint syncs NEWLY PUBLISHED SFS laws from Riksdagen API.
 * Filters by publication date (datum) to only get recent laws.
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
  inserted: number
  skipped: number
  failed: number
  dateRange: { from: string; to: string }
}

const CONFIG = {
  PAGE_SIZE: 50,
  MAX_PAGES: 3, // Should rarely need more than 1-2 pages for daily sync
  DELAY_MS: 100,
  LOOKBACK_DAYS: 2, // Look back 2 days to catch any missed updates
}

export async function GET(request: Request) {
  const startTime = new Date()

  // Verify authorization
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Calculate date range for recent documents only
  const now = new Date()
  const fromDate = new Date(now)
  fromDate.setDate(fromDate.getDate() - CONFIG.LOOKBACK_DAYS)
  // Format as YYYY-MM-DD
  const fromDateStr = fromDate.toISOString().slice(0, 10)
  const toDateStr = now.toISOString().slice(0, 10)

  const stats: SyncStats = {
    apiCount: 0,
    fetched: 0,
    inserted: 0,
    skipped: 0,
    failed: 0,
    dateRange: { from: fromDateStr, to: toDateStr },
  }

  try {
    // Fetch only recent laws (published in the last few days)
    let page = 1
    let hasMore = true

    while (hasMore && page <= CONFIG.MAX_PAGES) {
      const url = new URL('https://data.riksdagen.se/dokumentlista/')
      url.searchParams.set('doktyp', 'sfs')
      url.searchParams.set('utformat', 'json')
      url.searchParams.set('sz', CONFIG.PAGE_SIZE.toString())
      url.searchParams.set('p', page.toString())
      url.searchParams.set('sort', 'datum')
      url.searchParams.set('sortorder', 'desc')
      // Only fetch documents from the last LOOKBACK_DAYS
      url.searchParams.set('from', fromDateStr)
      url.searchParams.set('tom', toDateStr)

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
        `[SYNC-SFS] Page ${page}/${totalPages}: ${documents.length} docs from API (date range: ${fromDateStr} to ${toDateStr}), total matches: ${stats.apiCount}`
      )

      for (const doc of documents) {
        stats.fetched++
        const sfsNumber = `SFS ${doc.beteckning}`
        const apiSystemdatum = new Date(doc.systemdatum.replace(' ', 'T') + 'Z')

        // Check if already exists - skip if so (updates handled by sync-sfs-updates)
        const existing = await prisma.legalDocument.findUnique({
          where: { document_number: sfsNumber },
          select: { id: true },
        })

        if (existing) {
          stats.skipped++
          console.log(`[SYNC-SFS] ${sfsNumber} already exists, skipping`)
          continue
        }

        // Insert new law
        console.log(
          `[SYNC-SFS] ${sfsNumber} "${doc.titel}" - inserting new law...`
        )
        try {
          const [htmlContent, fullText] = await Promise.all([
            fetchLawHTML(doc.dok_id),
            fetchLawFullText(doc.dok_id),
          ])

          if (!fullText && !htmlContent) {
            console.log(`[SYNC-SFS] ${sfsNumber} failed to fetch content`)
            stats.failed++
            continue
          }

          const slug = generateSlug(doc.titel, sfsNumber)
          const latestAmendment = parseUndertitel(doc.undertitel || '')

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
                  systemdatum: doc.systemdatum,
                  latestAmendment,
                  versionCount: 1,
                  fetchedAt: new Date().toISOString(),
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
          console.log(`[SYNC-SFS] ${sfsNumber} inserted successfully`)
        } catch (err) {
          stats.failed++
          console.error(`[SYNC-SFS] ${sfsNumber} insert failed:`, err)
        }

        // Small delay to be respectful to API
        await new Promise((resolve) => setTimeout(resolve, CONFIG.DELAY_MS))
      }

      hasMore = page < totalPages && page < CONFIG.MAX_PAGES
      page++
    }

    const duration = Date.now() - startTime.getTime()
    const durationStr = `${Math.round(duration / 1000)}s`

    console.log(`[SYNC-SFS] ========== SUMMARY ==========`)
    console.log(`[SYNC-SFS] Date range: ${fromDateStr} to ${toDateStr}`)
    console.log(`[SYNC-SFS] API returned: ${stats.apiCount} documents`)
    console.log(`[SYNC-SFS] Fetched: ${stats.fetched}`)
    console.log(`[SYNC-SFS] Inserted: ${stats.inserted}`)
    console.log(`[SYNC-SFS] Skipped (already exist): ${stats.skipped}`)
    console.log(`[SYNC-SFS] Failed: ${stats.failed}`)
    console.log(`[SYNC-SFS] Duration: ${durationStr}`)
    console.log(`[SYNC-SFS] ==============================`)

    // Invalidate caches if any documents were inserted
    let cacheInvalidation = null
    if (stats.inserted > 0) {
      cacheInvalidation = await invalidateLawCaches()
      console.log(
        `[SYNC-SFS] Cache invalidated: ${cacheInvalidation.redisKeysCleared} Redis keys, tags: ${cacheInvalidation.tagsRevalidated.join(', ')}`
      )
    }

    // Send email notification
    await sendSfsSyncEmail(stats, durationStr, true)

    return NextResponse.json({
      success: true,
      stats,
      cacheInvalidation,
      duration: durationStr,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('SFS sync failed:', error)

    const duration = Date.now() - startTime.getTime()
    const durationStr = `${Math.round(duration / 1000)}s`
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    // Send failure notification email
    await sendSfsSyncEmail(stats, durationStr, false, errorMessage)

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
