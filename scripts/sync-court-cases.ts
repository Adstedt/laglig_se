/* eslint-disable no-console */
/**
 * Daily Court Case Sync with Change Event Tracking
 *
 * Syncs Swedish court cases from Domstolsverket's PUH API with:
 * - Early termination when reaching already-ingested cases
 * - NEW_RULING ChangeEvent creation for new cases
 * - Cross-reference creation for cited SFS laws
 * - Multi-court support with priority order
 *
 * Story 2.11 - Tasks 9, 10, 11: Court Case Daily Sync
 *
 * Usage:
 *   pnpm tsx scripts/sync-court-cases.ts              # Sync all courts
 *   pnpm tsx scripts/sync-court-cases.ts --court=AD   # Sync only AD
 *   pnpm tsx scripts/sync-court-cases.ts --dry-run    # Preview without DB writes
 *   pnpm tsx scripts/sync-court-cases.ts --limit=50   # Limit per court
 *   pnpm tsx scripts/sync-court-cases.ts --no-early-stop  # Don't stop early
 *
 * Options:
 *   --dry-run       Don't modify DB, just show what would be changed
 *   --verbose       Show detailed progress for each case
 *   --no-early-stop Don't stop early (process all pages)
 *   --court=<code>  Only sync specific court (AD, HFD, HD, HovR)
 *   --limit=N       Maximum cases to process per court
 *   --skip-refs     Skip creating cross-references to SFS laws
 *   --max-pages=N   Maximum API pages to fetch per court (default: 20)
 */

import { prisma } from '../lib/prisma'
import { ContentType, ReferenceType } from '@prisma/client'
import { createNewRulingEvent } from '../lib/sync/change-detection'
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
} from '../lib/external/domstolsverket'

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  PAGE_SIZE: 100,
  DEFAULT_MAX_PAGES: 20, // Safety limit per court
  EARLY_STOP_THRESHOLD: 5, // Stop after N consecutive existing cases
  DELAY_BETWEEN_PAGES: 250, // ms
  DELAY_BETWEEN_INSERTS: 50, // ms - faster since no content fetch needed
}

// Parse command line arguments
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const VERBOSE = args.includes('--verbose')
const NO_EARLY_STOP = args.includes('--no-early-stop')
const SKIP_REFS = args.includes('--skip-refs')
const MAX_PAGES = parseInt(
  args.find((a) => a.startsWith('--max-pages='))?.split('=')[1] ||
    CONFIG.DEFAULT_MAX_PAGES.toString(),
  10
)
const LIMIT = parseInt(
  args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '0',
  10
)
const COURT_FILTER = args
  .find((a) => a.startsWith('--court='))
  ?.split('=')[1]
  ?.toUpperCase() as CourtType | undefined

// ============================================================================
// Types
// ============================================================================

interface SyncStats {
  court: CourtType
  apiCount: number
  fetched: number
  inserted: number
  skipped: number
  errors: number
  crossRefsCreated: number
  changeEventsCreated: number
  earlyTerminated: boolean
}

function createStats(court: CourtType): SyncStats {
  return {
    court,
    apiCount: 0,
    fetched: 0,
    inserted: 0,
    skipped: 0,
    errors: 0,
    crossRefsCreated: 0,
    changeEventsCreated: 0,
    earlyTerminated: false,
  }
}

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Extracts plain text from HTML content for full_text field
 */
function htmlToPlainText(html: string | undefined): string | null {
  if (!html) return null

  // Remove script and style tags
  let text = html.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ''
  )
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Convert block elements to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n\n')
  text = text.replace(/<\/div>/gi, '\n')
  text = text.replace(/<\/h[1-6]>/gi, '\n\n')
  text = text.replace(/<\/li>/gi, '\n')

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ouml;/g, 'ö')
    .replace(/&auml;/g, 'ä')
    .replace(/&aring;/g, 'å')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&Aring;/g, 'Å')

  // Normalize whitespace
  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim()

  return text || null
}

// ============================================================================
// Cross-Reference Creation
// ============================================================================

/**
 * Create cross-references from a court case to cited SFS laws
 */
async function createCrossReferences(
  sourceDocId: string,
  lagrumList: Array<{ sfsNummer: string; referens?: string }>
): Promise<number> {
  let created = 0

  for (const lagrum of lagrumList) {
    try {
      // Normalize SFS number format
      // API returns "1982:80" or "SFS 1982:80" - we store as "SFS 1982:80"
      let sfsNumber = lagrum.sfsNummer
      if (!sfsNumber.startsWith('SFS ')) {
        sfsNumber = `SFS ${sfsNumber}`
      }

      // Find the target law document
      const targetDoc = await prisma.legalDocument.findFirst({
        where: {
          content_type: 'SFS_LAW',
          OR: [
            { document_number: sfsNumber },
            { document_number: lagrum.sfsNummer }, // Also try without SFS prefix
          ],
        },
        select: { id: true },
      })

      if (targetDoc) {
        // Check if cross-reference already exists
        const existingRef = await prisma.crossReference.findFirst({
          where: {
            source_document_id: sourceDocId,
            target_document_id: targetDoc.id,
            reference_type: 'CITES',
          },
        })

        if (!existingRef) {
          await prisma.crossReference.create({
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
      // Silently skip cross-reference errors
    }
  }

  return created
}

// ============================================================================
// Case Processing
// ============================================================================

/**
 * Process a single court case
 * Returns: true if new case was inserted, false if skipped (already exists)
 */
async function processCourtCase(
  dto: PubliceringDTO,
  stats: SyncStats
): Promise<boolean> {
  const courtCode = dto.domstol?.domstolKod
  const contentType = mapCourtCodeToContentType(courtCode)

  if (!contentType) {
    if (VERBOSE) {
      console.log(`  ⚠️  Unknown court code: ${courtCode}, skipping`)
    }
    stats.skipped++
    return false
  }

  const documentNumber = generateDocumentNumber(dto)
  const title = generateTitle(dto)
  const slug = generateSlug(title, documentNumber)
  const decisionDate = parseApiDate(dto.avgorandedatum)
  const publicationDate = parseApiDate(dto.publiceringstid)

  // Check if document already exists
  const existing = await prisma.legalDocument.findUnique({
    where: { document_number: documentNumber },
    select: { id: true },
  })

  if (existing) {
    // Already exists - skip
    stats.skipped++
    if (VERBOSE) {
      console.log(`  Skipped: ${documentNumber} (exists)`)
    }
    return false
  }

  // New case - insert
  if (DRY_RUN) {
    console.log(
      `  Would insert: ${documentNumber} - ${title.substring(0, 50)}...`
    )
    stats.inserted++
    return true
  }

  try {
    // Use transaction for atomic insert of document + court case + change event + cross-refs
    await prisma.$transaction(async (tx) => {
      // Create LegalDocument
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
            attachments:
              dto.bilagaLista?.map((b) => ({
                id: b.fillagringId,
                filename: b.filnamn,
              })) || [],
            group_id: dto.gruppKorrelationsnummer || null,
            related_cases:
              dto.hanvisadePubliceringarLista?.map((h) => ({
                gruppKorrelationsnummer: h.gruppKorrelationsnummer || null,
                publiceringId: h.publiceringId || null,
              })) || [],
            sfs_refs:
              dto.lagrumLista?.map((l) => ({
                sfsNummer: l.sfsNummer,
                referens: l.referens || null,
              })) || [],
            ingested_at: new Date().toISOString(),
            sync_source: 'sync-court-cases',
          },
        },
      })

      // Create CourtCase type-specific record
      await tx.courtCase.create({
        data: {
          document_id: legalDoc.id,
          court_name: dto.domstol?.domstolNamn || 'Unknown',
          case_number: extractCaseNumber(dto),
          decision_date: decisionDate || new Date(),
          lower_court: null, // Not available in API
          parties: null, // Not available in API
        },
      })

      // Create NEW_RULING ChangeEvent
      await createNewRulingEvent(tx, legalDoc.id, contentType as ContentType)
      stats.changeEventsCreated++

      // Create cross-references (outside transaction for performance)
      if (!SKIP_REFS && dto.lagrumLista && dto.lagrumLista.length > 0) {
        const refsCreated = await createCrossReferences(
          legalDoc.id,
          dto.lagrumLista
        )
        stats.crossRefsCreated += refsCreated
      }
    })

    stats.inserted++

    if (VERBOSE) {
      console.log(`  Inserted: ${documentNumber}`)
    }

    await sleep(CONFIG.DELAY_BETWEEN_INSERTS)
    return true
  } catch (error) {
    stats.errors++
    console.error(
      `  ❌ Error inserting ${documentNumber}:`,
      error instanceof Error ? error.message : error
    )
    return false
  }
}

// ============================================================================
// Court Sync
// ============================================================================

/**
 * Sync a single court type
 */
async function syncCourt(court: CourtType): Promise<SyncStats> {
  const config = COURT_CONFIGS[court]
  const stats = createStats(court)

  console.log('')
  console.log('━'.repeat(60))
  console.log(`📜 Syncing: ${config.name}`)
  console.log(
    `   Court code: ${Array.isArray(config.code) ? config.code.join(', ') : config.code}`
  )
  console.log(`   Content type: ${config.contentType}`)
  console.log('━'.repeat(60))

  try {
    // Get first page to get total count
    const firstPage = await fetchCourtCases(court, 0, CONFIG.PAGE_SIZE)
    stats.apiCount = firstPage.total

    console.log(`  Total in API: ${stats.apiCount.toLocaleString()} cases`)
    if (LIMIT > 0) {
      console.log(`  Processing limit: ${LIMIT} cases`)
    }
    console.log('')

    // Process pages
    let page = 0
    let consecutiveSkips = 0
    let cases = firstPage.publiceringLista || []

    while (cases.length > 0 && page < MAX_PAGES) {
      if (page > 0) {
        await sleep(CONFIG.DELAY_BETWEEN_PAGES)
        const pageResult = await fetchCourtCases(court, page, CONFIG.PAGE_SIZE)
        cases = pageResult.publiceringLista || []

        if (cases.length === 0) break
      }

      // Process cases on this page
      for (const dto of cases) {
        stats.fetched++

        // Check limit
        if (LIMIT > 0 && stats.fetched > LIMIT) {
          console.log(`  Reached limit of ${LIMIT} cases`)
          cases = []
          break
        }

        const isNew = await processCourtCase(dto, stats)

        if (isNew) {
          consecutiveSkips = 0
        } else {
          consecutiveSkips++
        }

        // Early termination check
        if (!NO_EARLY_STOP && consecutiveSkips >= CONFIG.EARLY_STOP_THRESHOLD) {
          console.log(
            `\n  Early termination: ${consecutiveSkips} consecutive existing cases`
          )
          stats.earlyTerminated = true
          cases = []
          break
        }
      }

      // Progress log every page
      if (!stats.earlyTerminated && cases.length > 0) {
        console.log(
          `  Page ${page + 1}: ${stats.fetched} processed, +${stats.inserted} new, ${stats.skipped} skipped`
        )
      }

      page++
    }

    // Final stats for this court
    console.log('')
    console.log(`  ✅ ${config.name} sync complete:`)
    console.log(`     Fetched:        ${stats.fetched.toLocaleString()}`)
    console.log(`     New cases:      ${stats.inserted.toLocaleString()}`)
    console.log(`     Skipped:        ${stats.skipped.toLocaleString()}`)
    console.log(`     Errors:         ${stats.errors.toLocaleString()}`)
    console.log(
      `     Cross-refs:     ${stats.crossRefsCreated.toLocaleString()}`
    )
    console.log(
      `     Change events:  ${stats.changeEventsCreated.toLocaleString()}`
    )
    console.log(`     Early stop:     ${stats.earlyTerminated}`)
  } catch (error) {
    console.error(`  ❌ Fatal error syncing ${court}:`, error)
    stats.errors++
  }

  return stats
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const startTime = new Date()

  console.log('═'.repeat(60))
  console.log('Court Case Daily Sync')
  console.log('═'.repeat(60))
  console.log(`Started at: ${startTime.toISOString()}`)
  console.log(`Dry run: ${DRY_RUN}`)
  console.log(`Early stop: ${!NO_EARLY_STOP}`)
  console.log(`Max pages per court: ${MAX_PAGES}`)
  console.log(`Skip cross-references: ${SKIP_REFS}`)
  if (LIMIT > 0) {
    console.log(`Limit per court: ${LIMIT}`)
  }
  if (COURT_FILTER) {
    console.log(`Court filter: ${COURT_FILTER}`)
  }

  // Determine which courts to sync
  const courtsToSync: CourtType[] = COURT_FILTER
    ? [COURT_FILTER]
    : [...COURT_PRIORITY]

  // Validate court filter
  if (COURT_FILTER && !COURT_CONFIGS[COURT_FILTER]) {
    console.error(
      `Invalid court: ${COURT_FILTER}. Valid courts: ${Object.keys(COURT_CONFIGS).join(', ')}`
    )
    process.exit(1)
  }

  console.log(`Courts to sync: ${courtsToSync.join(', ')}`)

  const allStats: SyncStats[] = []

  try {
    // Sync each court
    for (const court of courtsToSync) {
      const stats = await syncCourt(court)
      allStats.push(stats)
    }

    // Final summary
    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()
    const minutes = Math.floor(duration / 60000)
    const seconds = Math.floor((duration % 60000) / 1000)

    const totalFetched = allStats.reduce((sum, s) => sum + s.fetched, 0)
    const totalInserted = allStats.reduce((sum, s) => sum + s.inserted, 0)
    const totalSkipped = allStats.reduce((sum, s) => sum + s.skipped, 0)
    const totalErrors = allStats.reduce((sum, s) => sum + s.errors, 0)
    const totalCrossRefs = allStats.reduce(
      (sum, s) => sum + s.crossRefsCreated,
      0
    )
    const totalChangeEvents = allStats.reduce(
      (sum, s) => sum + s.changeEventsCreated,
      0
    )

    console.log('')
    console.log('═'.repeat(60))
    console.log('SYNC COMPLETE')
    console.log('═'.repeat(60))
    console.log('')
    console.log(`Total fetched:       ${totalFetched.toLocaleString()}`)
    console.log(`Total new cases:     ${totalInserted.toLocaleString()}`)
    console.log(`Total skipped:       ${totalSkipped.toLocaleString()}`)
    console.log(`Total errors:        ${totalErrors.toLocaleString()}`)
    console.log(`Total cross-refs:    ${totalCrossRefs.toLocaleString()}`)
    console.log(`Total change events: ${totalChangeEvents.toLocaleString()}`)
    console.log('')
    console.log(`Duration: ${minutes}m ${seconds}s`)

    // Per-court breakdown
    console.log('')
    console.log('Per-court breakdown:')
    for (const stats of allStats) {
      const courtConfig = COURT_CONFIGS[stats.court]
      console.log(
        `  ${stats.court} (${courtConfig.name}): +${stats.inserted} new, ${stats.skipped} skipped${stats.earlyTerminated ? ' (early stop)' : ''}`
      )
    }

    // Log final DB counts if not dry run
    if (!DRY_RUN) {
      console.log('')
      const [adCount, hdCount, hfdCount, hovrCount, changeEventCount] =
        await Promise.all([
          prisma.legalDocument.count({
            where: { content_type: 'COURT_CASE_AD' },
          }),
          prisma.legalDocument.count({
            where: { content_type: 'COURT_CASE_HD' },
          }),
          prisma.legalDocument.count({
            where: { content_type: 'COURT_CASE_HFD' },
          }),
          prisma.legalDocument.count({
            where: { content_type: 'COURT_CASE_HOVR' },
          }),
          prisma.changeEvent.count({ where: { change_type: 'NEW_RULING' } }),
        ])

      console.log('Database totals:')
      console.log(`  COURT_CASE_AD:   ${adCount.toLocaleString()}`)
      console.log(`  COURT_CASE_HD:   ${hdCount.toLocaleString()}`)
      console.log(`  COURT_CASE_HFD:  ${hfdCount.toLocaleString()}`)
      console.log(`  COURT_CASE_HOVR: ${hovrCount.toLocaleString()}`)
      console.log(`  NEW_RULING events: ${changeEventCount.toLocaleString()}`)
    }
  } catch (error) {
    console.error('')
    console.error('❌ Fatal error during sync:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run
main().catch(console.error)
