/* eslint-disable no-console */
/**
 * EUR-Lex EU Legislation Ingestion Script
 *
 * Fetches EU regulations and directives from EUR-Lex SPARQL API
 * and stores them in the database.
 *
 * Features:
 * - Fetches ~60,000+ regulations and ~4,700+ directives with Swedish titles
 * - Stores metadata in legal_documents and eu_documents tables
 * - Fetches National Implementation Measures (NIM) for directives
 * - Creates cross-references between SFS laws and EU directives
 * - Progress logging with ETA calculation
 * - Error handling with retry logic
 *
 * Usage: pnpm tsx scripts/ingest-eu-legislation.ts
 *
 * Prerequisites:
 * - DATABASE_URL set in .env.local
 * - Stories 2.1, 2.2 complete (schema + SFS laws in database)
 * - Test script passed: pnpm tsx scripts/test-eurlex-fetch.ts
 */

import { PrismaClient, ContentType } from '@prisma/client'
import pLimit from 'p-limit'
import {
  fetchRegulations,
  fetchDirectives,
  fetchDocumentContentViaCellar,
  fetchNationalMeasures,
  extractEUMetadata,
  getRegulationsCount,
  getDirectivesCount,
  generateEuSlug,
  type EurLexDocument,
  type NIMData,
} from '../lib/external/eurlex'

// ============================================================================
// Configuration
// ============================================================================

let prisma = new PrismaClient()

const CONFIG = {
  // Batch sizes - larger for metadata-only ingestion
  sparqlBatchSize: 1000, // Documents per SPARQL query (can be larger without HTML fetch)
  dbBatchSize: 100, // Documents per database transaction

  // Parallel processing - more workers for metadata-only (no API bottleneck)
  parallelWorkers: 50,

  // Progress logging
  logEveryN: 1000, // Log progress every N documents

  // Memory management
  prismaReconnectEveryN: 5000, // Reconnect Prisma every N documents to free memory

  // Rate limiting is handled in eurlex.ts (5 req/sec)

  // Fetch HTML content via CELLAR REST API (bypasses EUR-Lex WAF)
  // Set to false for fast initial bulk ingestion (metadata only)
  // HTML content can be backfilled later with scripts/backfill-eu-content.ts
  fetchHtmlContent: false,
}

// ============================================================================
// Types
// ============================================================================

interface IngestionStats {
  regulationsTotal: number
  regulationsInserted: number
  regulationsSkipped: number
  regulationsErrors: number
  directivesTotal: number
  directivesInserted: number
  directivesSkipped: number
  directivesErrors: number
  nimFetched: number
  nimSkipped: number
  crossReferencesCreated: number
  startTime: number
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

function calculateETA(processed: number, total: number, startTime: number): string {
  if (processed === 0) return 'calculating...'

  const elapsed = Date.now() - startTime
  const rate = processed / elapsed
  const remaining = total - processed
  const etaMs = remaining / rate

  return formatDuration(etaMs)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Trigger garbage collection if available (requires --expose-gc flag)
 */
function tryGarbageCollect(): void {
  if (global.gc) {
    global.gc()
  }
}

/**
 * Log current memory usage
 */
function logMemoryUsage(label: string): void {
  const used = process.memoryUsage()
  console.log(
    `   [Memory ${label}] RSS: ${Math.round(used.rss / 1024 / 1024)}MB, ` +
      `Heap: ${Math.round(used.heapUsed / 1024 / 1024)}/${Math.round(used.heapTotal / 1024 / 1024)}MB, ` +
      `External: ${Math.round(used.external / 1024 / 1024)}MB`
  )
}

/**
 * Reconnect Prisma to free accumulated query engine memory
 */
async function reconnectPrisma(): Promise<void> {
  await prisma.$disconnect()
  prisma = new PrismaClient()
  await prisma.$connect()
  tryGarbageCollect()
}

// ============================================================================
// Document Processing
// ============================================================================

async function processEUDocument(
  doc: EurLexDocument,
  stats: IngestionStats
): Promise<string | null> {
  const contentType =
    doc.type === 'REG' ? ContentType.EU_REGULATION : ContentType.EU_DIRECTIVE

  try {
    // Check for duplicate by CELEX number
    const existing = await prisma.euDocument.findFirst({
      where: { celex_number: doc.celex },
    })

    if (existing) {
      if (doc.type === 'REG') {
        stats.regulationsSkipped++
      } else {
        stats.directivesSkipped++
      }
      return null
    }

    // Generate slug
    const slug = generateEuSlug(doc.title, doc.celex)

    // Check for slug collision
    const existingSlug = await prisma.legalDocument.findUnique({
      where: { slug },
    })

    const finalSlug = existingSlug ? `${slug}-${doc.celex.toLowerCase()}` : slug

    // Fetch HTML content via CELLAR REST API (if enabled)
    let htmlContent: string | null = null
    let fullText: string | null = null
    let extractedMetadata: ReturnType<typeof extractEUMetadata> | null = null

    if (CONFIG.fetchHtmlContent) {
      try {
        const content = await fetchDocumentContentViaCellar(doc.celex)
        if (content) {
          htmlContent = content.html
          fullText = content.plainText
          // Extract structured metadata from full text
          extractedMetadata = extractEUMetadata(content.plainText, doc.title)
        }
      } catch {
        // Content fetch failed - continue without content (can be backfilled later)
      }
    }

    // Build metadata object with extracted fields
    const metadata: Record<string, unknown> = {
      celex: doc.celex,
      sector: 3,
      documentType: doc.type,
      euDocNumber: doc.documentNumber,
      eutReference: doc.eutReference,
    }

    // Merge extracted metadata if available
    if (extractedMetadata) {
      Object.assign(metadata, {
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
        eliReferences: extractedMetadata.eliReferences.slice(0, 10),
        referencedCelex: extractedMetadata.referencedCelex.slice(0, 20),
        wordCount: extractedMetadata.wordCount,
      })
    }

    // Create LegalDocument and EuDocument in transaction
    const legalDoc = await prisma.legalDocument.create({
      data: {
        content_type: contentType,
        document_number: doc.documentNumber || doc.celex,
        title: doc.title,
        slug: finalSlug,
        summary: null, // Could extract from title or preamble later
        full_text: fullText,
        html_content: htmlContent,
        effective_date: doc.entryIntoForce,
        publication_date: doc.publicationDate,
        status: 'ACTIVE',
        source_url: doc.eurlexUrl,
        metadata,
        eu_document: {
          create: {
            celex_number: doc.celex,
            eut_reference: doc.eutReference,
            national_implementation_measures: null, // Will be populated for directives
          },
        },
      },
    })

    if (doc.type === 'REG') {
      stats.regulationsInserted++
    } else {
      stats.directivesInserted++
    }

    return legalDoc.id
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Handle unique constraint violations gracefully
    if (errorMessage.includes('Unique constraint')) {
      if (doc.type === 'REG') {
        stats.regulationsSkipped++
      } else {
        stats.directivesSkipped++
      }
      return null
    }

    console.error(`Error processing ${doc.celex}: ${errorMessage}`)
    if (doc.type === 'REG') {
      stats.regulationsErrors++
    } else {
      stats.directivesErrors++
    }
    return null
  }
}

// ============================================================================
// Ingestion Functions
// ============================================================================

async function ingestRegulations(stats: IngestionStats): Promise<void> {
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🇪🇺 Phase 1: EU Regulations (Sector 3, Type R)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`   Using ${CONFIG.parallelWorkers} parallel workers`)

  const totalCount = await getRegulationsCount()
  stats.regulationsTotal = totalCount
  console.log(`Total regulations with Swedish content: ${totalCount.toLocaleString()}`)

  // Create a concurrency limiter
  const limit = pLimit(CONFIG.parallelWorkers)

  let offset = 0
  let processed = 0
  const phaseStartTime = Date.now()

  while (offset < totalCount) {
    const batch = await fetchRegulations(CONFIG.sparqlBatchSize, offset)

    if (batch.length === 0) {
      console.log(`No more regulations found at offset ${offset}`)
      break
    }

    // Process batch in parallel with concurrency limit
    const promises = batch.map((doc) =>
      limit(async () => {
        await processEUDocument(doc, stats)
        processed++

        // Log progress every N documents (thread-safe via atomic increment check)
        if (processed % CONFIG.logEveryN === 0) {
          const percentage = ((processed / totalCount) * 100).toFixed(1)
          const eta = calculateETA(processed, totalCount, phaseStartTime)
          console.log(
            `   Regulations: ${processed.toLocaleString()}/${totalCount.toLocaleString()} (${percentage}%) - ` +
              `Inserted: ${stats.regulationsInserted.toLocaleString()}, ` +
              `Skipped: ${stats.regulationsSkipped.toLocaleString()}, ` +
              `ETA: ${eta}`
          )
          logMemoryUsage(`@${processed}`)
        }
      })
    )

    await Promise.all(promises)

    // Trigger GC after each batch
    tryGarbageCollect()

    // Reconnect Prisma periodically to free query engine memory
    if (processed % CONFIG.prismaReconnectEveryN === 0) {
      console.log(`   [Prisma] Reconnecting to free memory...`)
      await reconnectPrisma()
      logMemoryUsage('after reconnect')
    }

    offset += CONFIG.sparqlBatchSize
  }

  const duration = formatDuration(Date.now() - phaseStartTime)
  console.log('')
  console.log(
    `✅ Regulations complete: ${stats.regulationsInserted.toLocaleString()} inserted, ` +
      `${stats.regulationsSkipped.toLocaleString()} skipped, ` +
      `${stats.regulationsErrors} errors (${duration})`
  )
}

async function ingestDirectives(stats: IngestionStats): Promise<void> {
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🇪🇺 Phase 2: EU Directives (Sector 3, Type L)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const totalCount = await getDirectivesCount()
  stats.directivesTotal = totalCount
  console.log(`Total directives with Swedish content: ${totalCount.toLocaleString()}`)

  let offset = 0
  let processed = 0
  const phaseStartTime = Date.now()

  while (offset < totalCount) {
    const batch = await fetchDirectives(CONFIG.sparqlBatchSize, offset)

    if (batch.length === 0) {
      console.log(`No more directives found at offset ${offset}`)
      break
    }

    // Process batch
    for (const doc of batch) {
      await processEUDocument(doc, stats)
      processed++

      // Trigger GC every 50 documents to prevent memory buildup
      if (processed % 50 === 0) {
        tryGarbageCollect()
      }

      // Log progress and memory
      if (processed % CONFIG.logEveryN === 0 || processed === batch.length) {
        const percentage = ((processed / totalCount) * 100).toFixed(1)
        const eta = calculateETA(processed, totalCount, phaseStartTime)
        console.log(
          `   Directives: ${processed.toLocaleString()}/${totalCount.toLocaleString()} (${percentage}%) - ` +
            `Inserted: ${stats.directivesInserted.toLocaleString()}, ` +
            `Skipped: ${stats.directivesSkipped.toLocaleString()}, ` +
            `ETA: ${eta}`
        )
        logMemoryUsage(`@${processed}`)
      }

      // Reconnect Prisma periodically to free query engine memory
      if (processed % CONFIG.prismaReconnectEveryN === 0) {
        console.log(`   [Prisma] Reconnecting to free memory...`)
        await reconnectPrisma()
        logMemoryUsage('after reconnect')
      }
    }

    offset += CONFIG.sparqlBatchSize

    // Small delay between batches and trigger GC to prevent memory buildup
    await sleep(100)
    tryGarbageCollect()
  }

  const duration = formatDuration(Date.now() - phaseStartTime)
  console.log('')
  console.log(
    `✅ Directives complete: ${stats.directivesInserted.toLocaleString()} inserted, ` +
      `${stats.directivesSkipped.toLocaleString()} skipped, ` +
      `${stats.directivesErrors} errors (${duration})`
  )
}

async function _fetchAndStoreNIM(stats: IngestionStats): Promise<void> {
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 Phase 3: National Implementation Measures (Sweden)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Get all directive EuDocuments
  const directives = await prisma.euDocument.findMany({
    where: {
      document: {
        content_type: ContentType.EU_DIRECTIVE,
      },
      national_implementation_measures: null, // Only those without NIM data
    },
    select: {
      id: true,
      celex_number: true,
    },
  })

  console.log(`Directives to fetch NIM for: ${directives.length.toLocaleString()}`)

  const phaseStartTime = Date.now()
  let processed = 0

  for (const directive of directives) {
    try {
      const nimData = await fetchNationalMeasures(directive.celex_number)

      if (nimData?.sweden && nimData.sweden.measures.length > 0) {
        // Update EuDocument with NIM data
        await prisma.euDocument.update({
          where: { id: directive.id },
          data: {
            national_implementation_measures: nimData as unknown as Record<string, unknown>,
          },
        })
        stats.nimFetched++
      } else {
        stats.nimSkipped++
      }
    } catch (error) {
      console.error(`Error fetching NIM for ${directive.celex_number}:`, error)
      stats.nimSkipped++
    }

    processed++

    // Log progress every 100 directives
    if (processed % 100 === 0) {
      const percentage = ((processed / directives.length) * 100).toFixed(1)
      const eta = calculateETA(processed, directives.length, phaseStartTime)
      console.log(
        `   NIM: ${processed.toLocaleString()}/${directives.length.toLocaleString()} (${percentage}%) - ` +
          `With Swedish measures: ${stats.nimFetched.toLocaleString()}, ` +
          `ETA: ${eta}`
      )
    }

    // Rate limiting is handled in eurlex.ts
  }

  const duration = formatDuration(Date.now() - phaseStartTime)
  console.log('')
  console.log(
    `✅ NIM complete: ${stats.nimFetched.toLocaleString()} directives with Swedish measures, ` +
      `${stats.nimSkipped.toLocaleString()} without (${duration})`
  )
}

async function _createCrossReferences(stats: IngestionStats): Promise<void> {
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔗 Phase 4: Cross-References (SFS → EU Directives)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Get directives with NIM data
  const directivesWithNIM = await prisma.euDocument.findMany({
    where: {
      national_implementation_measures: { not: null },
      document: {
        content_type: ContentType.EU_DIRECTIVE,
      },
    },
    include: {
      document: true,
    },
  })

  console.log(`Directives with NIM data: ${directivesWithNIM.length.toLocaleString()}`)

  const phaseStartTime = Date.now()
  let processed = 0
  let crossRefsCreated = 0

  for (const directive of directivesWithNIM) {
    const nimData = directive.national_implementation_measures as unknown as NIMData

    if (!nimData?.sweden?.measures) {
      processed++
      continue
    }

    for (const measure of nimData.sweden.measures) {
      // Try to find the SFS law in the database
      const sfsLaw = await prisma.legalDocument.findFirst({
        where: {
          content_type: ContentType.SFS_LAW,
          document_number: {
            contains: measure.sfsNumber.replace(/\s+/g, ''),
          },
        },
      })

      if (sfsLaw) {
        // Check if cross-reference already exists
        const existingRef = await prisma.crossReference.findFirst({
          where: {
            source_document_id: sfsLaw.id,
            target_document_id: directive.document.id,
            reference_type: 'IMPLEMENTS',
          },
        })

        if (!existingRef) {
          await prisma.crossReference.create({
            data: {
              source_document_id: sfsLaw.id,
              target_document_id: directive.document.id,
              reference_type: 'IMPLEMENTS',
              context: `${measure.sfsNumber} implements this EU directive`,
            },
          })
          crossRefsCreated++
          stats.crossReferencesCreated++
        }
      }
    }

    processed++

    // Log progress every 100 directives
    if (processed % 100 === 0) {
      console.log(
        `   Cross-refs: Processed ${processed.toLocaleString()}/${directivesWithNIM.length.toLocaleString()} directives, ` +
          `${crossRefsCreated.toLocaleString()} links created`
      )
    }
  }

  const duration = formatDuration(Date.now() - phaseStartTime)
  console.log('')
  console.log(
    `✅ Cross-references complete: ${stats.crossReferencesCreated.toLocaleString()} links created (${duration})`
  )
}

// ============================================================================
// Main Function
// ============================================================================

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🇪🇺 EUR-Lex EU Legislation Ingestion')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Started at: ${new Date().toISOString()}`)

  const stats: IngestionStats = {
    regulationsTotal: 0,
    regulationsInserted: 0,
    regulationsSkipped: 0,
    regulationsErrors: 0,
    directivesTotal: 0,
    directivesInserted: 0,
    directivesSkipped: 0,
    directivesErrors: 0,
    nimFetched: 0,
    nimSkipped: 0,
    crossReferencesCreated: 0,
    startTime: Date.now(),
  }

  try {
    // Test database connection
    await prisma.$connect()
    console.log('Database connection established')
    logMemoryUsage('startup')

    // Phase 1: Ingest Regulations
    await ingestRegulations(stats)

    // Phase 2: Ingest Directives
    await ingestDirectives(stats)

    // Phase 3: Fetch NIM data for directives (WAF may block some)
    // Skipping NIM fetch since EUR-Lex WAF blocks it
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 Phase 3: NIM Fetch (Skipped - EUR-Lex WAF protection)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('   ⚠️ NIM fetch is blocked by CloudFront WAF')
    console.log('   ⚠️ Cross-references cannot be created without NIM data')
    console.log('   ⚠️ This can be addressed later with browser automation')

    // Phase 4: Create cross-references (requires NIM data)
    // Skipping since NIM fetch is blocked
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔗 Phase 4: Cross-References (Skipped - No NIM data)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } finally {
    await prisma.$disconnect()
  }

  // Final Summary
  const totalDuration = formatDuration(Date.now() - stats.startTime)
  const totalInserted = stats.regulationsInserted + stats.directivesInserted
  const totalSkipped = stats.regulationsSkipped + stats.directivesSkipped
  const totalErrors = stats.regulationsErrors + stats.directivesErrors

  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 FINAL SUMMARY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Total EU documents processed: ${(stats.regulationsTotal + stats.directivesTotal).toLocaleString()}`)
  console.log(`  - Regulations: ${stats.regulationsTotal.toLocaleString()} (inserted: ${stats.regulationsInserted.toLocaleString()})`)
  console.log(`  - Directives: ${stats.directivesTotal.toLocaleString()} (inserted: ${stats.directivesInserted.toLocaleString()})`)
  console.log('')
  console.log(`Total inserted: ${totalInserted.toLocaleString()}`)
  console.log(`Total skipped (duplicates): ${totalSkipped.toLocaleString()}`)
  console.log(`Total errors: ${totalErrors}`)
  console.log('')
  console.log(`NIM data fetched: ${stats.nimFetched} (WAF blocked)`)
  console.log(`Cross-references created: ${stats.crossReferencesCreated}`)
  console.log('')
  console.log(`Execution time: ${totalDuration}`)
  console.log(`Finished at: ${new Date().toISOString()}`)
  console.log('')

  if (totalInserted > 0) {
    console.log('✅ EU legislation ingestion complete!')
  } else {
    console.log('⚠️ No new documents inserted (all may be duplicates)')
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
