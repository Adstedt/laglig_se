/* eslint-disable no-console */
/**
 * EU Legislation Ingestion by Year
 *
 * Fetches EU regulations and directives from EUR-Lex SPARQL API using year-by-year queries.
 * Includes checkpoint system for resumability and enhanced metadata.
 *
 * Usage:
 *   pnpm tsx scripts/ingest-eu-by-year.ts
 *   pnpm tsx scripts/ingest-eu-by-year.ts --resume
 *   pnpm tsx scripts/ingest-eu-by-year.ts --year 2020
 *   pnpm tsx scripts/ingest-eu-by-year.ts --start-year 2010 --end-year 2020
 *   pnpm tsx scripts/ingest-eu-by-year.ts --type directives
 *   pnpm tsx scripts/ingest-eu-by-year.ts --dry-run
 *   pnpm tsx scripts/ingest-eu-by-year.ts --no-content
 */

import { PrismaClient, ContentType, DocumentStatus } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import {
  fetchRegulationsByYear,
  fetchDirectivesByYear,
  getRegulationsCountByYear,
  getDirectivesCountByYear,
  fetchDocumentContentViaCellar,
  fetchDocumentRelationships,
  generateEuSlug,
  extractEUMetadata,
  EurLexDocumentEnhanced,
} from '../lib/external/eurlex'

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Reduced parallelism to respect connection_limit=1
  parallelWorkers: 5,

  // Batch sizes
  sparqlBatchSize: 500,

  // Delays (only needed for API rate limiting, not DB)
  delayBetweenDocs: 0, // ms - no delay needed for sequential DB inserts
  delayBetweenBatches: 200, // ms - small pause between SPARQL batches
  delayBetweenYears: 1000, // ms

  // Memory management
  prismaReconnectEveryN: 1000,

  // Progress logging
  progressLogInterval: 50,

  // Checkpoint file
  checkpointFile: 'data/eu-ingestion-checkpoint.json',

  // Year range (EU law starts roughly from 1950s)
  defaultStartYear: 1950,
  defaultEndYear: new Date().getFullYear(),
}

// Parse command line arguments
const args = process.argv.slice(2)
const RESUME = args.includes('--resume')
const DRY_RUN = args.includes('--dry-run')
const NO_CONTENT = args.includes('--no-content')
const SINGLE_YEAR = args.find((a) => a.startsWith('--year='))?.split('=')[1]
const START_YEAR = parseInt(
  args.find((a) => a.startsWith('--start-year='))?.split('=')[1] ||
    CONFIG.defaultStartYear.toString(),
  10
)
const END_YEAR = parseInt(
  args.find((a) => a.startsWith('--end-year='))?.split('=')[1] ||
    CONFIG.defaultEndYear.toString(),
  10
)
const DOC_TYPE = args.find((a) => a.startsWith('--type='))?.split('=')[1] as
  | 'regulations'
  | 'directives'
  | undefined

// ============================================================================
// Types
// ============================================================================

interface Checkpoint {
  lastCompletedYear: number | null
  documentType: 'regulations' | 'directives'
  regulationsInserted: number
  regulationsSkipped: number
  regulationsErrors: number
  directivesInserted: number
  directivesSkipped: number
  directivesErrors: number
  yearsCompleted: number[]
  lastRun: string
}

interface YearStats {
  year: number
  type: 'regulations' | 'directives'
  apiCount: number
  fetched: number
  inserted: number
  skipped: number
  failed: number
  withContent: number
}

interface GlobalStats {
  totalApiCount: number
  totalFetched: number
  totalInserted: number
  totalSkipped: number
  totalFailed: number
  totalWithContent: number
  yearsProcessed: number
}

// ============================================================================
// Checkpoint Management
// ============================================================================

function getCheckpointPath(): string {
  return path.join(process.cwd(), CONFIG.checkpointFile)
}

function loadCheckpoint(): Checkpoint | null {
  const checkpointPath = getCheckpointPath()
  try {
    if (fs.existsSync(checkpointPath)) {
      const data = fs.readFileSync(checkpointPath, 'utf-8')
      return JSON.parse(data) as Checkpoint
    }
  } catch (error) {
    console.warn('⚠️  Could not load checkpoint:', error)
  }
  return null
}

function saveCheckpoint(checkpoint: Checkpoint): void {
  const checkpointPath = getCheckpointPath()
  const dir = path.dirname(checkpointPath)

  // Ensure data directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2))
}

function createDefaultCheckpoint(): Checkpoint {
  return {
    lastCompletedYear: null,
    documentType: 'regulations',
    regulationsInserted: 0,
    regulationsSkipped: 0,
    regulationsErrors: 0,
    directivesInserted: 0,
    directivesSkipped: 0,
    directivesErrors: 0,
    yearsCompleted: [],
    lastRun: new Date().toISOString(),
  }
}

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((ms % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

// Memory management
function tryGarbageCollect(): void {
  if (global.gc) {
    global.gc()
  }
}

// ============================================================================
// Document Processing
// ============================================================================

async function processDocument(
  prisma: PrismaClient,
  doc: EurLexDocumentEnhanced,
  stats: YearStats,
  fetchContent: boolean
): Promise<string | null> {
  const celex = doc.celex

  // Check if already exists
  const existing = await prisma.euDocument.findUnique({
    where: { celex_number: celex },
  })

  if (existing) {
    stats.skipped++
    return null
  }

  if (DRY_RUN) {
    stats.inserted++
    return celex // Return CELEX for dry run tracking
  }

  try {
    // Generate slug
    let slug = generateEuSlug(doc.title, celex)

    // Check for slug collision
    const slugExists = await prisma.legalDocument.findUnique({
      where: { slug },
    })
    if (slugExists) {
      slug = `${slug}-${celex.toLowerCase()}`
    }

    // Fetch content if requested
    let htmlContent: string | null = null
    let fullText: string | null = null
    let extractedMetadata: ReturnType<typeof extractEUMetadata> | null = null

    if (fetchContent) {
      try {
        const content = await fetchDocumentContentViaCellar(celex)
        if (content) {
          htmlContent = content.html
          fullText = content.plainText
          extractedMetadata = extractEUMetadata(fullText, doc.title)
          stats.withContent++
        }
      } catch {
        // Content fetch failed - continue with metadata only
      }
    }

    // Prepare metadata
    const baseMetadata = {
      celex: doc.celex,
      sector: 3,
      documentType: doc.type,
      euDocNumber: doc.documentNumber,
      eutReference: doc.eutReference,
      source: 'eur-lex.europa.eu',
      fetchedAt: new Date().toISOString(),
      method: 'year-by-year-enhanced',
    }

    // Add extracted metadata if available
    const metadata = extractedMetadata
      ? {
          ...baseMetadata,
          articleCount: extractedMetadata.articleCount,
          chapterCount: extractedMetadata.chapterCount,
          sectionCount: extractedMetadata.sectionCount,
          recitalCount: extractedMetadata.recitalCount,
          issuingBody: extractedMetadata.issuingBody,
          issuingBodySwedish: extractedMetadata.issuingBodySwedish,
          documentComplexity: extractedMetadata.documentComplexity,
          ojSeries: extractedMetadata.ojSeries,
          ojNumber: extractedMetadata.ojNumber,
          ojDate: extractedMetadata.ojDate,
          eliReferences: extractedMetadata.eliReferences,
          referencedCelex: extractedMetadata.referencedCelex,
          wordCount: extractedMetadata.wordCount,
        }
      : baseMetadata

    // Create document with nested eu_document
    await prisma.legalDocument.create({
      data: {
        document_number: celex,
        title: doc.title,
        slug,
        content_type:
          doc.type === 'REG'
            ? ContentType.EU_REGULATION
            : ContentType.EU_DIRECTIVE,
        full_text: fullText,
        html_content: htmlContent,
        publication_date: doc.publicationDate,
        effective_date: doc.entryIntoForce,
        status: DocumentStatus.ACTIVE,
        source_url: doc.eurlexUrl,
        metadata,
        eu_document: {
          create: {
            celex_number: doc.celex,
            eut_reference: doc.eutReference,
            // Enhanced metadata from SPARQL
            eli_identifier: doc.eli,
            in_force: doc.inForce,
            directory_codes: doc.directoryCodes,
            subject_matters: doc.subjectMatters,
            eurovoc_concepts: doc.eurovocConcepts,
            authors: doc.authors,
            legal_basis_celex: doc.legalBasisCelex,
            cites_celex: doc.citesCelex,
            end_of_validity: doc.endOfValidity,
            signature_date: doc.signatureDate,
            transposition_deadline: doc.transpositionDeadline,
            eea_relevant: doc.eeaRelevant,
          },
        },
      },
    })

    stats.inserted++
    return celex // Return CELEX on successful insert
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Handle unique constraint violations gracefully
    if (errorMessage.includes('Unique constraint')) {
      stats.skipped++
      return null
    }

    console.error(`   ❌ Error processing ${celex}:`, errorMessage)
    stats.failed++
    return null
  }
}

// ============================================================================
// Relationship Updates
// ============================================================================

/**
 * Fetches and updates relationship data for a batch of CELEX numbers.
 * Updates the eu_documents table with cites_celex, legal_basis_celex, etc.
 */
async function updateRelationships(
  prisma: PrismaClient,
  celexNumbers: string[]
): Promise<{ updated: number; failed: number }> {
  if (celexNumbers.length === 0 || DRY_RUN) {
    return { updated: 0, failed: 0 }
  }

  console.log(
    `   📎 Fetching relationships for ${celexNumbers.length} documents...`
  )

  try {
    const relationships = await fetchDocumentRelationships(celexNumbers)

    let updated = 0
    let failed = 0

    for (const [celex, rel] of relationships) {
      try {
        // Only update if we have any relationship data
        if (
          rel.citesCelex.length > 0 ||
          rel.legalBasisCelex.length > 0 ||
          rel.amendedByCelex.length > 0 ||
          rel.correctedByCelex.length > 0
        ) {
          await prisma.euDocument.update({
            where: { celex_number: celex },
            data: {
              cites_celex: rel.citesCelex,
              legal_basis_celex: rel.legalBasisCelex,
              amended_by_celex: rel.amendedByCelex,
              corrected_by_celex: rel.correctedByCelex,
            },
          })
          updated++
        }
      } catch {
        failed++
      }
    }

    console.log(`   📎 Relationships updated: ${updated}, failed: ${failed}`)
    return { updated, failed }
  } catch (error) {
    console.error('   ❌ Failed to fetch relationships:', error)
    return { updated: 0, failed: celexNumbers.length }
  }
}

// ============================================================================
// Year Processing
// ============================================================================

async function processYear(
  prisma: PrismaClient,
  year: number,
  type: 'regulations' | 'directives',
  checkpoint: Checkpoint
): Promise<YearStats> {
  const stats: YearStats = {
    year,
    type,
    apiCount: 0,
    fetched: 0,
    inserted: 0,
    skipped: 0,
    failed: 0,
    withContent: 0,
  }

  // Get count for this year
  const countFn =
    type === 'regulations'
      ? getRegulationsCountByYear
      : getDirectivesCountByYear
  const fetchFn =
    type === 'regulations' ? fetchRegulationsByYear : fetchDirectivesByYear

  stats.apiCount = await countFn(year)

  if (stats.apiCount === 0) {
    console.log(`📅 ${year} (${type}): No documents found, skipping`)
    return stats
  }

  console.log(`📅 ${year} (${type}): ${stats.apiCount} documents in API`)

  // Fetch all documents for this year in batches
  let offset = 0
  let processed = 0
  const fetchContent = !NO_CONTENT
  const insertedCelexNumbers: string[] = []

  while (offset < stats.apiCount) {
    // Fetch batch
    const documents = await fetchFn(year, CONFIG.sparqlBatchSize, offset)
    stats.fetched += documents.length

    // Process documents sequentially to respect connection limits
    for (const doc of documents) {
      const insertedCelex = await processDocument(
        prisma,
        doc,
        stats,
        fetchContent
      )
      if (insertedCelex) {
        insertedCelexNumbers.push(insertedCelex)
      }
      processed++

      // Progress logging
      if (processed % CONFIG.progressLogInterval === 0) {
        console.log(
          `   Progress: ${processed}/${stats.apiCount} (Inserted: ${stats.inserted}, Skipped: ${stats.skipped}, Content: ${stats.withContent})`
        )
      }

      await sleep(CONFIG.delayBetweenDocs)
    }

    offset += CONFIG.sparqlBatchSize

    // Memory management
    tryGarbageCollect()

    await sleep(CONFIG.delayBetweenBatches)
  }

  // Fetch and update relationships for newly inserted documents
  if (insertedCelexNumbers.length > 0) {
    // Process relationships in batches of 50 to avoid large SPARQL queries
    const RELATIONSHIP_BATCH_SIZE = 50
    for (
      let i = 0;
      i < insertedCelexNumbers.length;
      i += RELATIONSHIP_BATCH_SIZE
    ) {
      const batch = insertedCelexNumbers.slice(i, i + RELATIONSHIP_BATCH_SIZE)
      await updateRelationships(prisma, batch)
    }
  }

  // Update checkpoint stats
  if (type === 'regulations') {
    checkpoint.regulationsInserted += stats.inserted
    checkpoint.regulationsSkipped += stats.skipped
    checkpoint.regulationsErrors += stats.failed
  } else {
    checkpoint.directivesInserted += stats.inserted
    checkpoint.directivesSkipped += stats.skipped
    checkpoint.directivesErrors += stats.failed
  }

  // Mark year as completed
  if (!checkpoint.yearsCompleted.includes(year)) {
    checkpoint.yearsCompleted.push(year)
  }
  checkpoint.lastCompletedYear = year
  checkpoint.lastRun = new Date().toISOString()
  saveCheckpoint(checkpoint)

  console.log(
    `   ✅ Year ${year} complete: Inserted ${stats.inserted}, Skipped ${stats.skipped}, Failed ${stats.failed}, WithContent ${stats.withContent}`
  )

  return stats
}

// ============================================================================
// Main Ingestion
// ============================================================================

async function main(): Promise<void> {
  const startTime = Date.now()

  console.log('='.repeat(80))
  console.log('🇪🇺 EU Legislation Ingestion by Year')
  console.log('='.repeat(80))
  console.log(`Started at: ${new Date().toISOString()}`)
  console.log(`Resume: ${RESUME}`)
  console.log(`Dry run: ${DRY_RUN}`)
  console.log(`Fetch content: ${!NO_CONTENT}`)
  console.log('')

  // Load or create checkpoint
  let checkpoint: Checkpoint
  if (RESUME) {
    const loaded = loadCheckpoint()
    if (loaded) {
      checkpoint = loaded
      console.log(`📋 Resuming from checkpoint:`)
      console.log(`   Last completed year: ${checkpoint.lastCompletedYear}`)
      console.log(`   Document type: ${checkpoint.documentType}`)
      console.log(
        `   Regulations: ${checkpoint.regulationsInserted} inserted, ${checkpoint.regulationsSkipped} skipped`
      )
      console.log(
        `   Directives: ${checkpoint.directivesInserted} inserted, ${checkpoint.directivesSkipped} skipped`
      )
      console.log(`   Years completed: ${checkpoint.yearsCompleted.length}`)
    } else {
      console.log('⚠️  No checkpoint found, starting fresh')
      checkpoint = createDefaultCheckpoint()
    }
  } else {
    checkpoint = createDefaultCheckpoint()
  }
  console.log('')

  // Create Prisma client
  let prisma = new PrismaClient()
  let docsProcessed = 0

  const globalStats: GlobalStats = {
    totalApiCount: 0,
    totalFetched: 0,
    totalInserted: 0,
    totalSkipped: 0,
    totalFailed: 0,
    totalWithContent: 0,
    yearsProcessed: 0,
  }

  // Get initial DB counts
  const initialRegCount = await prisma.legalDocument.count({
    where: { content_type: ContentType.EU_REGULATION },
  })
  const initialDirCount = await prisma.legalDocument.count({
    where: { content_type: ContentType.EU_DIRECTIVE },
  })
  console.log(
    `📊 Initial counts - Regulations: ${initialRegCount}, Directives: ${initialDirCount}`
  )
  console.log('')

  try {
    // Determine years to process
    let yearsToProcess: number[]
    if (SINGLE_YEAR) {
      yearsToProcess = [parseInt(SINGLE_YEAR, 10)]
    } else {
      yearsToProcess = []
      for (let y = END_YEAR; y >= START_YEAR; y--) {
        yearsToProcess.push(y)
      }
    }

    // Determine document types to process
    const typesToProcess: Array<'regulations' | 'directives'> = DOC_TYPE
      ? [DOC_TYPE]
      : ['regulations', 'directives']

    // Process each type
    for (const type of typesToProcess) {
      console.log('')
      console.log('─'.repeat(80))
      console.log(`📂 Processing ${type.toUpperCase()}`)
      console.log('─'.repeat(80))

      // If resuming, skip to the right type
      if (RESUME && checkpoint.documentType !== type && type === 'directives') {
        // Check if regulations are complete
        if (checkpoint.documentType === 'regulations') {
          console.log(`   Switching from regulations to directives`)
          checkpoint.documentType = 'directives'
          saveCheckpoint(checkpoint)
        }
      }

      for (const year of yearsToProcess) {
        // Skip completed years if resuming
        if (RESUME && checkpoint.yearsCompleted.includes(year)) {
          console.log(`⏭️  Year ${year} already completed, skipping`)
          continue
        }

        try {
          const yearStats = await processYear(prisma, year, type, checkpoint)

          globalStats.totalApiCount += yearStats.apiCount
          globalStats.totalFetched += yearStats.fetched
          globalStats.totalInserted += yearStats.inserted
          globalStats.totalSkipped += yearStats.skipped
          globalStats.totalFailed += yearStats.failed
          globalStats.totalWithContent += yearStats.withContent
          globalStats.yearsProcessed++

          docsProcessed += yearStats.inserted + yearStats.skipped

          // Reconnect Prisma periodically
          if (docsProcessed >= CONFIG.prismaReconnectEveryN) {
            console.log('   🔄 Reconnecting Prisma client...')
            await prisma.$disconnect()
            prisma = new PrismaClient()
            docsProcessed = 0
          }
        } catch (error) {
          console.error(
            `❌ Error processing year ${year}:`,
            error instanceof Error ? error.message : error
          )
        }

        await sleep(CONFIG.delayBetweenYears)
      }

      // Mark type as complete and switch if needed
      if (type === 'regulations' && typesToProcess.includes('directives')) {
        checkpoint.documentType = 'directives'
        checkpoint.yearsCompleted = [] // Reset for directives
        saveCheckpoint(checkpoint)
      }
    }
  } finally {
    await prisma.$disconnect()
  }

  // Final summary
  const duration = Date.now() - startTime

  console.log('')
  console.log('='.repeat(80))
  console.log('✅ INGESTION COMPLETE')
  console.log('='.repeat(80))
  console.log('')
  console.log(`📊 Years processed:    ${globalStats.yearsProcessed}`)
  console.log(`📊 API total count:    ${globalStats.totalApiCount}`)
  console.log(`📊 Documents fetched:  ${globalStats.totalFetched}`)
  console.log(`✅ Inserted:           ${globalStats.totalInserted}`)
  console.log(`⏭️  Skipped (existing): ${globalStats.totalSkipped}`)
  console.log(`❌ Failed:             ${globalStats.totalFailed}`)
  console.log(`📄 With content:       ${globalStats.totalWithContent}`)
  console.log('')
  console.log(`⏱️  Duration: ${formatDuration(duration)}`)
  console.log('')

  // Final DB counts
  const finalPrisma = new PrismaClient()
  const finalRegCount = await finalPrisma.legalDocument.count({
    where: { content_type: ContentType.EU_REGULATION },
  })
  const finalDirCount = await finalPrisma.legalDocument.count({
    where: { content_type: ContentType.EU_DIRECTIVE },
  })
  await finalPrisma.$disconnect()

  console.log(
    `📊 Final counts - Regulations: ${finalRegCount} (+${finalRegCount - initialRegCount}), Directives: ${finalDirCount} (+${finalDirCount - initialDirCount})`
  )
}

// Run
main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
