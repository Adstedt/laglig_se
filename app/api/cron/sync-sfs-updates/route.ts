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
import { ContentType } from '@prisma/client'
import { fetchLawFullText, fetchLawHTML } from '@/lib/external/riksdagen'
import { archiveDocumentVersion } from '@/lib/sync/version-archive'
import { detectChanges } from '@/lib/sync/change-detection'
import { parseUndertitel } from '@/lib/sync/section-parser'
import { createAmendmentFromChange } from '@/lib/sync/amendment-creator'
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
  updated: number
  skipped: number
  notInDb: number
  failed: number
  dateRange: { from: string; to: string }
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
  }

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
          console.log(`[SYNC-SFS-UPDATES] ${sfsNumber} not in DB, skipping`)
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
            `[SYNC-SFS-UPDATES] ${sfsNumber} already up-to-date (stored: ${storedMeta?.systemdatum}, api: ${doc.systemdatum})`
          )
          continue
        }

        console.log(
          `[SYNC-SFS-UPDATES] ${sfsNumber} needs update (stored: ${storedMeta?.systemdatum || 'none'}, api: ${doc.systemdatum})`
        )

        // Update existing law
        try {
          const [newHtml, newFullText] = await Promise.all([
            fetchLawHTML(doc.dok_id),
            fetchLawFullText(doc.dok_id),
          ])

          if (!newFullText && !newHtml) {
            stats.failed++
            continue
          }

          const latestAmendment = parseUndertitel(doc.undertitel || '')

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
                },
              },
            })
          })

          stats.updated++
          console.log(`[SYNC-SFS-UPDATES] ${sfsNumber} updated successfully`)
        } catch (err) {
          stats.failed++
          console.error(`[SYNC-SFS-UPDATES] ${sfsNumber} update failed:`, err)
        }

        // Small delay to be respectful to API
        await new Promise((resolve) => setTimeout(resolve, CONFIG.DELAY_MS))
      }

      hasMore = page < totalPages && page < CONFIG.MAX_PAGES
      page++
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
    console.log(`[SYNC-SFS-UPDATES] ======================================`)

    // Invalidate caches if any documents were updated
    let cacheInvalidation = null
    if (stats.updated > 0) {
      cacheInvalidation = await invalidateLawCaches()
      console.log(
        `[SYNC-SFS-UPDATES] Cache invalidated: ${cacheInvalidation.redisKeysCleared} Redis keys, tags: ${cacheInvalidation.tagsRevalidated.join(', ')}`
      )
    }

    // Send email notification (reuse SFS sync email with updated stats)
    await sendSfsSyncEmail(
      {
        apiCount: stats.apiCount,
        fetched: stats.fetched,
        inserted: 0,
        updated: stats.updated,
        skipped: stats.skipped + stats.notInDb,
        failed: stats.failed,
        dateRange: stats.dateRange,
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

    // Send failure notification email
    await sendSfsSyncEmail(
      {
        apiCount: stats.apiCount,
        fetched: stats.fetched,
        inserted: 0,
        updated: stats.updated,
        skipped: stats.skipped + stats.notInDb,
        failed: stats.failed,
        dateRange: stats.dateRange,
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
