/**
 * SFS Laws Daily Sync Cron Job
 *
 * This endpoint is called by Vercel Cron to sync SFS laws from Riksdagen API.
 * Runs daily at 4:00 AM UTC (5:00 AM CET / 6:00 AM CEST).
 *
 * Story 2.11 - Task 14: Cron Job Setup
 *
 * Features:
 * - Syncs updates using systemdatum (last update timestamp)
 * - Archives previous versions before updating
 * - Creates ChangeEvent records for all changes
 * - Creates Amendment records for detected amendments
 * - Early termination when caught up
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ContentType, DocumentStatus, ChangeType } from '@prisma/client'
import { fetchLawFullText, fetchLawHTML, generateSlug } from '@/lib/external/riksdagen'
import { archiveDocumentVersion } from '@/lib/sync/version-archive'
import { detectChanges } from '@/lib/sync/change-detection'
import { parseUndertitel } from '@/lib/sync/section-parser'
import { createAmendmentFromChange } from '@/lib/sync/amendment-creator'

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
  updated: number
  skipped: number
  failed: number
  earlyTerminated: boolean
}

const CONFIG = {
  PAGE_SIZE: 100,
  MAX_PAGES: 20,
  DELAY_MS: 250,
  EARLY_STOP_THRESHOLD: 10,
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
    fetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    earlyTerminated: false,
  }

  try {
    // Fetch laws sorted by systemdatum (most recently updated first)
    let page = 1
    let hasMore = true
    let consecutiveSkips = 0

    while (hasMore && page <= CONFIG.MAX_PAGES) {
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

      for (const doc of documents) {
        stats.fetched++
        const sfsNumber = `SFS ${doc.beteckning}`
        const apiSystemdatum = new Date(doc.systemdatum.replace(' ', 'T') + 'Z')

        // Check if exists
        const existing = await prisma.legalDocument.findUnique({
          where: { document_number: sfsNumber },
          select: {
            id: true,
            full_text: true,
            html_content: true,
            metadata: true,
          },
        })

        if (existing) {
          const storedMeta = existing.metadata as { systemdatum?: string } | null
          const storedSystemdatum = storedMeta?.systemdatum
            ? new Date(storedMeta.systemdatum.replace(' ', 'T') + 'Z')
            : null

          if (storedSystemdatum && apiSystemdatum <= storedSystemdatum) {
            stats.skipped++
            consecutiveSkips++

            if (consecutiveSkips >= CONFIG.EARLY_STOP_THRESHOLD) {
              stats.earlyTerminated = true
              hasMore = false
              break
            }
            continue
          }

          // Update existing law
          consecutiveSkips = 0
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
                    ...(existing.metadata as object || {}),
                    systemdatum: doc.systemdatum,
                    latestAmendment,
                    lastSyncAt: new Date().toISOString(),
                  },
                },
              })
            })

            stats.updated++
          } catch {
            stats.failed++
          }
        } else {
          // Insert new law
          consecutiveSkips = 0
          try {
            const [htmlContent, fullText] = await Promise.all([
              fetchLawHTML(doc.dok_id),
              fetchLawFullText(doc.dok_id),
            ])

            if (!fullText && !htmlContent) {
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
          } catch {
            stats.failed++
          }
        }

        // Small delay to be respectful to API
        await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_MS))
      }

      hasMore = page < totalPages && page < CONFIG.MAX_PAGES
      page++
    }

    const duration = Date.now() - startTime.getTime()

    return NextResponse.json({
      success: true,
      stats,
      duration: `${Math.round(duration / 1000)}s`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('SFS sync failed:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
