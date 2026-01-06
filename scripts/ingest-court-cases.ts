/* eslint-disable no-console */
/**
 * Court Case Ingestion Script
 *
 * Ingests Swedish court cases from Domstolsverket's PUH API into the database.
 *
 * Features:
 * - Multi-court support: AD, HFD, HD, HovR, MÖD, MIG
 * - Priority-based ingestion (AD first - most business value)
 * - Progress logging with court-level tracking
 * - Cross-reference creation for cited SFS laws
 * - Resume support via command-line args
 * - Rate limiting (5 req/sec) and retry logic
 *
 * Usage:
 *   pnpm tsx scripts/ingest-court-cases.ts              # Ingest all courts
 *   pnpm tsx scripts/ingest-court-cases.ts --court=AD   # Ingest only AD
 *   pnpm tsx scripts/ingest-court-cases.ts --limit=100  # Limit per court
 *   pnpm tsx scripts/ingest-court-cases.ts --skip-refs  # Skip cross-references
 */

import { PrismaClient, ContentType, ReferenceType } from '@prisma/client'
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

const prisma = new PrismaClient()

// ============================================================================
// Configuration
// ============================================================================

interface IngestConfig {
  courts: CourtType[]
  limitPerCourt?: number
  skipCrossReferences: boolean
  batchSize: number
  dryRun: boolean
}

// ============================================================================
// Parsing Command Line Arguments
// ============================================================================

function parseArgs(): IngestConfig {
  const args = process.argv.slice(2)
  const config: IngestConfig = {
    courts: [...COURT_PRIORITY],
    skipCrossReferences: false,
    batchSize: 100,
    dryRun: false,
  }

  for (const arg of args) {
    if (arg.startsWith('--court=')) {
      const court = arg.split('=')[1]?.toUpperCase() as CourtType
      if (court && COURT_CONFIGS[court]) {
        config.courts = [court]
      } else {
        console.error(`Invalid court: ${court}. Valid courts: ${Object.keys(COURT_CONFIGS).join(', ')}`)
        process.exit(1)
      }
    } else if (arg.startsWith('--limit=')) {
      config.limitPerCourt = parseInt(arg.split('=')[1] || '0', 10)
    } else if (arg === '--skip-refs') {
      config.skipCrossReferences = true
    } else if (arg === '--dry-run') {
      config.dryRun = true
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Court Case Ingestion Script

Usage:
  pnpm tsx scripts/ingest-court-cases.ts [options]

Options:
  --court=<court>   Ingest only specified court (AD, HFD, HD, HovR)
  --limit=<n>       Limit number of cases per court
  --skip-refs       Skip creating cross-references to SFS laws
  --dry-run         Fetch but don't save to database
  --help, -h        Show this help

Courts (in priority order):
  AD    - Arbetsdomstolen (Labour Court) - Employment law
  HFD   - Högsta förvaltningsdomstolen (Supreme Admin Court) - Tax/admin
  HD    - Högsta domstolen (Supreme Court) - Civil/criminal
  HovR  - Hovrätterna (Courts of Appeal) - All 6 regions
`)
      process.exit(0)
    }
  }

  return config
}

// ============================================================================
// Progress Tracking
// ============================================================================

interface ProgressStats {
  court: CourtType
  total: number
  processed: number
  inserted: number
  updated: number
  skipped: number
  errors: number
  crossRefsCreated: number
  startTime: number
}

function createProgressStats(court: CourtType, total: number): ProgressStats {
  return {
    court,
    total,
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    crossRefsCreated: 0,
    startTime: Date.now(),
  }
}

function logProgress(stats: ProgressStats, force = false) {
  // Log every 10 cases or when forced
  if (!force && stats.processed % 10 !== 0) return

  const elapsed = (Date.now() - stats.startTime) / 1000
  const rate = stats.processed / elapsed
  const remaining = stats.total - stats.processed
  const eta = remaining / rate

  const pct = ((stats.processed / stats.total) * 100).toFixed(1)
  const etaMin = Math.ceil(eta / 60)

  console.log(
    `  ${stats.court}: ${stats.processed.toLocaleString()}/${stats.total.toLocaleString()} (${pct}%) | ` +
      `+${stats.inserted} new, ~${stats.updated} upd, ${stats.errors} err | ` +
      `${rate.toFixed(1)}/s, ETA ${etaMin}m`
  )
}

// ============================================================================
// HTML Content Processing
// ============================================================================

/**
 * Extracts plain text from HTML content for full_text field
 */
function htmlToPlainText(html: string | undefined): string | null {
  if (!html) return null

  // Remove script and style tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
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
// Database Operations
// ============================================================================

/**
 * Process and store a single court case
 */
async function processCourtCase(
  dto: PubliceringDTO,
  stats: ProgressStats,
  config: IngestConfig
): Promise<void> {
  stats.processed++

  try {
    // Skip PROVNINGSTILLSTAND (leave to appeal) cases - they have no actual content
    // Only the granted leave, not the judgment itself which is a separate record
    if (dto.typ === 'PROVNINGSTILLSTAND') {
      stats.skipped++
      return
    }

    const courtCode = dto.domstol?.domstolKod
    const contentType = mapCourtCodeToContentType(courtCode)

    if (!contentType) {
      console.warn(`  ⚠️  Unknown court code: ${courtCode}, skipping`)
      stats.skipped++
      return
    }

    const documentNumber = generateDocumentNumber(dto)
    const title = generateTitle(dto)
    const slug = generateSlug(title, documentNumber)
    const decisionDate = parseApiDate(dto.avgorandedatum)
    const publicationDate = parseApiDate(dto.publiceringstid)

    // Check if document already exists
    const existing = await prisma.legalDocument.findUnique({
      where: { document_number: documentNumber },
    })

    if (existing) {
      // Update existing document if we have newer data
      if (!config.dryRun) {
        await prisma.legalDocument.update({
          where: { id: existing.id },
          data: {
            title,
            summary: dto.sammanfattning || existing.summary,
            full_text: htmlToPlainText(dto.innehall) || existing.full_text,
            html_content: dto.innehall || existing.html_content,
            effective_date: decisionDate || existing.effective_date,
            publication_date: publicationDate || existing.publication_date,
            metadata: {
              api_id: dto.id,
              ecli: dto.ecliNummer,
              is_guiding: dto.arVagledande,
              case_type: dto.typ, // DOM_ELLER_BESLUT, PROVNINGSTILLSTAND, REFERAT
              case_name: dto.benamning || null, // "Andnöden", "Internetförtalet" etc.
              case_numbers: dto.malNummerLista,
              keywords: dto.nyckelordLista,
              legal_areas: dto.rattsomradeLista,
              ad_case_number: dto.arbetsdomstolenDomsnummer,
              attachments: dto.bilagaLista?.map((b) => ({
                id: b.fillagringId,
                filename: b.filnamn,
              })),
              group_id: dto.gruppKorrelationsnummer,
              related_cases: dto.hanvisadePubliceringarLista,
              // Additional reference data for future use
              preparatory_works: dto.forarbeteLista,
              eu_case_refs: dto.europarattsligaAvgorandenLista,
              literature_refs: dto.litteraturLista,
              sfs_refs: dto.lagrumLista, // Also store raw SFS refs in metadata
            },
            updated_at: new Date(),
          },
        })
      }
      stats.updated++
    } else {
      // Create new document
      if (!config.dryRun) {
        const legalDoc = await prisma.legalDocument.create({
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
              ecli: dto.ecliNummer,
              is_guiding: dto.arVagledande,
              case_type: dto.typ, // DOM_ELLER_BESLUT, PROVNINGSTILLSTAND, REFERAT
              case_name: dto.benamning || null, // "Andnöden", "Internetförtalet" etc.
              case_numbers: dto.malNummerLista,
              keywords: dto.nyckelordLista,
              legal_areas: dto.rattsomradeLista,
              ad_case_number: dto.arbetsdomstolenDomsnummer,
              attachments: dto.bilagaLista?.map((b) => ({
                id: b.fillagringId,
                filename: b.filnamn,
              })),
              group_id: dto.gruppKorrelationsnummer,
              related_cases: dto.hanvisadePubliceringarLista,
              // Additional reference data for future use
              preparatory_works: dto.forarbeteLista,
              eu_case_refs: dto.europarattsligaAvgorandenLista,
              literature_refs: dto.litteraturLista,
              sfs_refs: dto.lagrumLista, // Also store raw SFS refs in metadata
            },
          },
        })

        // Create CourtCase type-specific record
        await prisma.courtCase.create({
          data: {
            document_id: legalDoc.id,
            court_name: dto.domstol?.domstolNamn || 'Unknown',
            case_number: extractCaseNumber(dto),
            decision_date: decisionDate || new Date(),
            lower_court: null, // Not available in API
            parties: null, // Not available in API
          },
        })

        // Create cross-references for cited SFS laws
        if (!config.skipCrossReferences && dto.lagrumLista && dto.lagrumLista.length > 0) {
          const refsCreated = await createCrossReferences(legalDoc.id, dto.lagrumLista)
          stats.crossRefsCreated += refsCreated
        }
      }
      stats.inserted++
    }
  } catch (error) {
    stats.errors++
    console.error(`  ❌ Error processing case ${generateDocumentNumber(dto)}:`, error)
  }

  logProgress(stats)
}

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
    } catch (error) {
      // Silently skip cross-reference errors
    }
  }

  return created
}

// ============================================================================
// Court Ingestion
// ============================================================================

/**
 * Ingest all cases from a specific court
 */
async function ingestCourt(court: CourtType, config: IngestConfig): Promise<ProgressStats> {
  const courtConfig = COURT_CONFIGS[court]
  console.log('')
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`📜 Ingesting: ${courtConfig.name}`)
  console.log(`   Court code: ${Array.isArray(courtConfig.code) ? courtConfig.code.join(', ') : courtConfig.code}`)
  console.log(`   Content type: ${courtConfig.contentType}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  // First, get total count
  const initialResult = await fetchCourtCases(court, 0, 1)
  const totalCases = config.limitPerCourt
    ? Math.min(config.limitPerCourt, initialResult.total)
    : initialResult.total

  console.log(`  Found ${initialResult.total.toLocaleString()} total cases`)
  if (config.limitPerCourt) {
    console.log(`  Limiting to ${totalCases.toLocaleString()} cases`)
  }

  const stats = createProgressStats(court, totalCases)

  // Paginate through all cases
  let page = 0
  const pageSize = config.batchSize

  while (stats.processed < totalCases) {
    const result = await fetchCourtCases(court, page, pageSize)
    const cases = result.publiceringLista || []

    if (cases.length === 0) break

    for (const dto of cases) {
      if (stats.processed >= totalCases) break
      await processCourtCase(dto, stats, config)
    }

    page++
  }

  // Final progress log
  logProgress(stats, true)

  const elapsed = (Date.now() - stats.startTime) / 1000
  console.log('')
  console.log(`  ✅ Completed ${courtConfig.name}:`)
  console.log(`     Processed: ${stats.processed.toLocaleString()} cases`)
  console.log(`     Inserted:  ${stats.inserted.toLocaleString()} new`)
  console.log(`     Updated:   ${stats.updated.toLocaleString()} existing`)
  console.log(`     Errors:    ${stats.errors.toLocaleString()}`)
  console.log(`     Cross-refs: ${stats.crossRefsCreated.toLocaleString()} created`)
  console.log(`     Duration:  ${Math.round(elapsed)}s`)

  return stats
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const config = parseArgs()

  console.log('')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  Court Case Ingestion Script')
  console.log('  Domstolsverket PUH API → Laglig.se Database')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')
  console.log(`Courts to ingest: ${config.courts.join(', ')}`)
  if (config.limitPerCourt) {
    console.log(`Limit per court: ${config.limitPerCourt}`)
  }
  if (config.skipCrossReferences) {
    console.log('Cross-references: SKIPPED')
  }
  if (config.dryRun) {
    console.log('Mode: DRY RUN (no database writes)')
  }

  const overallStartTime = Date.now()
  const allStats: ProgressStats[] = []

  try {
    // Ingest each court in priority order
    for (const court of config.courts) {
      const stats = await ingestCourt(court, config)
      allStats.push(stats)
    }

    // Final summary
    const totalProcessed = allStats.reduce((sum, s) => sum + s.processed, 0)
    const totalInserted = allStats.reduce((sum, s) => sum + s.inserted, 0)
    const totalUpdated = allStats.reduce((sum, s) => sum + s.updated, 0)
    const totalErrors = allStats.reduce((sum, s) => sum + s.errors, 0)
    const totalCrossRefs = allStats.reduce((sum, s) => sum + s.crossRefsCreated, 0)
    const totalDuration = (Date.now() - overallStartTime) / 1000

    console.log('')
    console.log('═══════════════════════════════════════════════════════')
    console.log('  INGESTION COMPLETE')
    console.log('═══════════════════════════════════════════════════════')
    console.log('')
    console.log(`  Total processed: ${totalProcessed.toLocaleString()} cases`)
    console.log(`  Total inserted:  ${totalInserted.toLocaleString()} new`)
    console.log(`  Total updated:   ${totalUpdated.toLocaleString()} existing`)
    console.log(`  Total errors:    ${totalErrors.toLocaleString()}`)
    console.log(`  Cross-references: ${totalCrossRefs.toLocaleString()} created`)
    console.log(`  Total duration:  ${Math.round(totalDuration / 60)}m ${Math.round(totalDuration % 60)}s`)
    console.log('')

    // Log per-court summary
    console.log('  Per-court breakdown:')
    for (const stats of allStats) {
      const courtConfig = COURT_CONFIGS[stats.court]
      console.log(`    ${stats.court} (${courtConfig.name}): ${stats.inserted} new, ${stats.updated} updated`)
    }

  } catch (error) {
    console.error('')
    console.error('❌ Fatal error during ingestion:')
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
