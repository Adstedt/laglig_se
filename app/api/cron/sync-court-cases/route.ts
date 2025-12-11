/**
 * Court Cases Daily Sync Cron Job
 *
 * This endpoint is called by Vercel Cron to sync court cases from Domstolsverket API.
 * Runs daily at 5:00 AM UTC (6:00 AM CET / 7:00 AM CEST).
 *
 * Story 2.11 - Task 14: Cron Job Setup
 *
 * Features:
 * - Syncs new cases from AD, HD, HFD, and HovR courts
 * - Creates NEW_RULING change events for new cases
 * - Creates cross-references to cited SFS laws
 * - Early termination when reaching already-ingested cases
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ContentType, ReferenceType } from '@prisma/client'
import { createNewRulingEvent } from '@/lib/sync/change-detection'
import {
  fetchCourtCases,
  CourtType,
  COURT_CONFIGS,
  COURT_PRIORITY,
  PubliceringDTO,
  generateDocumentNumber,
  generateTitle,
  generateSlug,
  extractCaseNumber,
  parseApiDate,
  mapCourtCodeToContentType,
} from '@/lib/external/domstolsverket'
import { sendCourtSyncEmail } from '@/lib/email/cron-notifications'
import { invalidateCourtCaseCaches } from '@/lib/cache/invalidation'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for cron

const CRON_SECRET = process.env.CRON_SECRET

const CONFIG = {
  PAGE_SIZE: 100,
  MAX_PAGES: 10,
  EARLY_STOP_THRESHOLD: 5,
  DELAY_MS: 200,
}

interface CourtStats {
  court: CourtType
  fetched: number
  inserted: number
  skipped: number
  errors: number
  crossRefsCreated: number
  earlyTerminated: boolean
}

function htmlToPlainText(html: string | undefined): string | null {
  if (!html) return null

  let text = html.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ''
  )
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n\n')
  text = text.replace(/<\/div>/gi, '\n')
  text = text.replace(/<[^>]+>/g, '')
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim()

  return text || null
}

type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function createCrossReferences(
  tx: PrismaTransaction,
  sourceDocId: string,
  lagrumList: Array<{ sfsNummer: string; referens?: string }>
): Promise<number> {
  let created = 0

  for (const lagrum of lagrumList) {
    try {
      let sfsNumber = lagrum.sfsNummer
      if (!sfsNumber.startsWith('SFS ')) {
        sfsNumber = `SFS ${sfsNumber}`
      }

      const targetDoc = await tx.legalDocument.findFirst({
        where: {
          content_type: 'SFS_LAW',
          OR: [
            { document_number: sfsNumber },
            { document_number: lagrum.sfsNummer },
          ],
        },
        select: { id: true },
      })

      if (targetDoc) {
        const existingRef = await tx.crossReference.findFirst({
          where: {
            source_document_id: sourceDocId,
            target_document_id: targetDoc.id,
            reference_type: 'CITES',
          },
        })

        if (!existingRef) {
          await tx.crossReference.create({
            data: {
              source_document_id: sourceDocId,
              target_document_id: targetDoc.id,
              reference_type: 'CITES' as ReferenceType,
              context: lagrum.referens || null,
            },
          })
          created++
        }
      }
    } catch {
      // Silently skip
    }
  }

  return created
}

async function processCourtCase(
  dto: PubliceringDTO,
  stats: CourtStats
): Promise<boolean> {
  const courtCode = dto.domstol?.domstolKod
  const contentType = mapCourtCodeToContentType(courtCode)

  if (!contentType) {
    stats.skipped++
    return false
  }

  const documentNumber = generateDocumentNumber(dto)

  const existing = await prisma.legalDocument.findUnique({
    where: { document_number: documentNumber },
    select: { id: true },
  })

  if (existing) {
    stats.skipped++
    return false
  }

  try {
    const title = generateTitle(dto)
    const slug = generateSlug(title, documentNumber)
    const decisionDate = parseApiDate(dto.avgorandedatum)
    const publicationDate = parseApiDate(dto.publiceringstid)

    await prisma.$transaction(async (tx) => {
      const legalDoc = await tx.legalDocument.create({
        data: {
          content_type: contentType as ContentType,
          document_number: documentNumber,
          title,
          slug,
          summary: dto.sammanfattning || null,
          full_text: htmlToPlainText(dto.innehall),
          html_content: dto.innehall || null,
          effective_date: decisionDate,
          publication_date: publicationDate,
          status: 'ACTIVE',
          source_url: `https://rattspraxis.etjanst.domstol.se/sok/publicering/${dto.id}`,
          metadata: {
            api_id: dto.id,
            ecli: dto.ecliNummer || null,
            is_guiding: dto.arVagledande,
            case_numbers: dto.malNummerLista || [],
            keywords: dto.nyckelordLista || [],
            legal_areas: dto.rattsomradeLista || [],
            ad_case_number: dto.arbetsdomstolenDomsnummer || null,
            ingested_at: new Date().toISOString(),
            sync_source: 'cron-sync-court-cases',
          },
        },
      })

      await tx.courtCase.create({
        data: {
          document_id: legalDoc.id,
          court_name: dto.domstol?.domstolNamn || 'Unknown',
          case_number: extractCaseNumber(dto),
          decision_date: decisionDate || new Date(),
        },
      })

      await createNewRulingEvent(tx, legalDoc.id, contentType as ContentType)

      if (dto.lagrumLista && dto.lagrumLista.length > 0) {
        const refsCreated = await createCrossReferences(
          tx,
          legalDoc.id,
          dto.lagrumLista
        )
        stats.crossRefsCreated += refsCreated
      }
    })

    stats.inserted++
    return true
  } catch {
    stats.errors++
    return false
  }
}

async function syncCourt(court: CourtType): Promise<CourtStats> {
  const stats: CourtStats = {
    court,
    fetched: 0,
    inserted: 0,
    skipped: 0,
    errors: 0,
    crossRefsCreated: 0,
    earlyTerminated: false,
  }

  try {
    let page = 0
    let consecutiveSkips = 0

    while (page < CONFIG.MAX_PAGES) {
      const result = await fetchCourtCases(court, page, CONFIG.PAGE_SIZE)
      const cases = result.publiceringLista || []

      if (cases.length === 0) break

      for (const dto of cases) {
        stats.fetched++

        const isNew = await processCourtCase(dto, stats)

        if (isNew) {
          consecutiveSkips = 0
        } else {
          consecutiveSkips++
        }

        if (consecutiveSkips >= CONFIG.EARLY_STOP_THRESHOLD) {
          stats.earlyTerminated = true
          return stats
        }
      }

      page++
      await new Promise((resolve) => setTimeout(resolve, CONFIG.DELAY_MS))
    }
  } catch {
    stats.errors++
  }

  return stats
}

export async function GET(request: Request) {
  const startTime = new Date()

  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allStats: CourtStats[] = []

  try {
    for (const court of COURT_PRIORITY) {
      const stats = await syncCourt(court)
      allStats.push(stats)
    }

    const totalFetched = allStats.reduce((sum, s) => sum + s.fetched, 0)
    const totalInserted = allStats.reduce((sum, s) => sum + s.inserted, 0)
    const totalSkipped = allStats.reduce((sum, s) => sum + s.skipped, 0)
    const totalErrors = allStats.reduce((sum, s) => sum + s.errors, 0)
    const totalCrossRefs = allStats.reduce(
      (sum, s) => sum + s.crossRefsCreated,
      0
    )

    const duration = Date.now() - startTime.getTime()
    const durationStr = `${Math.round(duration / 1000)}s`

    const emailStats = {
      total: {
        fetched: totalFetched,
        inserted: totalInserted,
        skipped: totalSkipped,
        errors: totalErrors,
        crossRefsCreated: totalCrossRefs,
      },
      byCourt: allStats.map((s) => ({
        court: s.court,
        courtName: COURT_CONFIGS[s.court].name,
        inserted: s.inserted,
        skipped: s.skipped,
        errors: s.errors,
        earlyTerminated: s.earlyTerminated,
      })),
    }

    // Invalidate caches if any documents were inserted (Story 2.19)
    let cacheInvalidation = null
    if (totalInserted > 0) {
      cacheInvalidation = await invalidateCourtCaseCaches()
      console.log(
        `[SYNC-COURT-CASES] Cache invalidated: ${cacheInvalidation.redisKeysCleared} Redis keys, tags: ${cacheInvalidation.tagsRevalidated.join(', ')}`
      )
    }

    // Send email notification
    await sendCourtSyncEmail(emailStats, durationStr, true)

    return NextResponse.json({
      success: true,
      stats: emailStats,
      cacheInvalidation,
      duration: durationStr,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Court case sync failed:', error)

    const duration = Date.now() - startTime.getTime()
    const durationStr = `${Math.round(duration / 1000)}s`
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    // Send failure notification email
    await sendCourtSyncEmail(
      {
        total: {
          fetched: 0,
          inserted: 0,
          skipped: 0,
          errors: 0,
          crossRefsCreated: 0,
        },
        byCourt: [],
      },
      durationStr,
      false,
      errorMessage
    )

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
