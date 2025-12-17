/**
 * Parse all SFS_LAW documents into LawSection records
 *
 * Story 2.13 Phase 3: Populates the LawSection table with parsed sections
 * from all SFS_LAW documents. Used for historical version reconstruction.
 *
 * Usage:
 *   pnpm tsx scripts/parse-law-sections.ts [--resume] [--limit N] [--dry-run] [--year-min YYYY]
 *
 * Options:
 *   --resume      Skip laws that already have sections in the database
 *   --limit N     Only process N laws (for testing)
 *   --dry-run     Don't write to database, just report what would be done
 *   --year-min Y  Only process laws from year Y onwards (e.g., --year-min 2000)
 */
import { PrismaClient } from '@prisma/client'
import { parseLawSections } from '../lib/legal-document/section-parser'

const prisma = new PrismaClient()

interface Stats {
  lawsProcessed: number
  lawsSkipped: number
  lawsFailed: number
  sectionsCreated: number
  sectionsUpdated: number
  totalSectionsFound: number
  startTime: number
  errors: Array<{ documentNumber: string; error: string }>
}

async function main() {
  const args = process.argv.slice(2)
  const resume = args.includes('--resume')
  const dryRun = args.includes('--dry-run')
  const limitIndex = args.indexOf('--limit')
  const limit =
    limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : undefined
  const yearMinIndex = args.indexOf('--year-min')
  const yearMin =
    yearMinIndex !== -1 ? parseInt(args[yearMinIndex + 1], 10) : undefined

  console.log('=== Parse Law Sections ===\n')
  console.log(
    `Options: resume=${resume}, dryRun=${dryRun}, limit=${limit || 'none'}, yearMin=${yearMin || 'none'}`
  )

  const stats: Stats = {
    lawsProcessed: 0,
    lawsSkipped: 0,
    lawsFailed: 0,
    sectionsCreated: 0,
    sectionsUpdated: 0,
    totalSectionsFound: 0,
    startTime: Date.now(),
    errors: [],
  }

  // Get IDs of laws that already have sections (for resume)
  let processedLawIds: Set<string> = new Set()
  if (resume) {
    const existingSections = await prisma.lawSection.findMany({
      select: { legal_document_id: true },
      distinct: ['legal_document_id'],
    })
    processedLawIds = new Set(existingSections.map((s) => s.legal_document_id))
    console.log(
      `Resume mode: ${processedLawIds.size} laws already have sections\n`
    )
  }

  // Fetch all SFS_LAW documents with HTML content
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {
    content_type: 'SFS_LAW' as const,
    html_content: { not: null },
  }

  // Filter by year if specified (document_number format: "SFS YYYY:NNN")
  if (yearMin) {
    whereClause.document_number = { gte: `SFS ${yearMin}:` }
  }

  const totalCount = await prisma.legalDocument.count({ where: whereClause })
  console.log(`Total SFS_LAW documents with HTML: ${totalCount}\n`)

  // Process in batches for memory efficiency
  const batchSize = 100
  let offset = 0

  while (true) {
    const laws = await prisma.legalDocument.findMany({
      where: whereClause,
      select: {
        id: true,
        document_number: true,
        title: true,
        html_content: true,
      },
      orderBy: { document_number: 'asc' },
      take: batchSize,
      skip: offset,
    })

    if (laws.length === 0) break

    for (const law of laws) {
      // Check limit
      if (limit && stats.lawsProcessed >= limit) {
        console.log(`\nReached limit of ${limit} laws`)
        break
      }

      // Skip if resume mode and already processed
      if (resume && processedLawIds.has(law.id)) {
        stats.lawsSkipped++
        continue
      }

      try {
        await processLaw(law, stats, dryRun)
      } catch (error) {
        stats.lawsFailed++
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        stats.errors.push({
          documentNumber: law.document_number,
          error: errorMessage,
        })
        console.error(`  ERROR: ${law.document_number}: ${errorMessage}`)
      }

      // Progress logging
      const total = stats.lawsProcessed + stats.lawsSkipped + stats.lawsFailed
      if (total % 100 === 0) {
        const elapsed = (Date.now() - stats.startTime) / 1000
        const rate = stats.lawsProcessed / elapsed
        console.log(
          `Progress: ${total}/${totalCount} (${stats.lawsProcessed} processed, ${stats.lawsSkipped} skipped, ${stats.lawsFailed} failed) - ${rate.toFixed(1)} laws/sec`
        )
      }
    }

    // Check if we hit the limit
    if (limit && stats.lawsProcessed >= limit) break

    offset += batchSize
  }

  // Final report
  const elapsed = (Date.now() - stats.startTime) / 1000
  console.log('\n=== Final Statistics ===')
  console.log(`Time elapsed: ${elapsed.toFixed(1)} seconds`)
  console.log(`Laws processed: ${stats.lawsProcessed}`)
  console.log(`Laws skipped (resume): ${stats.lawsSkipped}`)
  console.log(`Laws failed: ${stats.lawsFailed}`)
  console.log(`Sections found: ${stats.totalSectionsFound}`)
  console.log(`Sections created: ${stats.sectionsCreated}`)
  console.log(`Sections updated: ${stats.sectionsUpdated}`)
  console.log(
    `Average sections per law: ${(stats.totalSectionsFound / stats.lawsProcessed).toFixed(1)}`
  )

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`)
    for (const { documentNumber, error } of stats.errors.slice(0, 20)) {
      console.log(`  ${documentNumber}: ${error}`)
    }
    if (stats.errors.length > 20) {
      console.log(`  ... and ${stats.errors.length - 20} more`)
    }
  }

  if (dryRun) {
    console.log('\n(Dry run - no data was written)')
  }

  await prisma.$disconnect()
}

async function processLaw(
  law: {
    id: string
    document_number: string
    title: string
    html_content: string | null
  },
  stats: Stats,
  dryRun: boolean
): Promise<void> {
  if (!law.html_content) {
    stats.lawsSkipped++
    return
  }

  const result = parseLawSections(law.html_content)

  if (result.sections.length === 0) {
    // Some laws don't have paragraf structure:
    // - Historical documents (HIST:* prefix)
    // - Very old laws (pre-1970) with different formatting
    // - Pure appendices/bilagor
    // This is expected, not an error
    stats.lawsSkipped++
    return
  }

  stats.totalSectionsFound += result.sections.length

  if (!dryRun) {
    // Use a transaction to upsert all sections
    // Increase timeout for laws with many sections (default is 5s)
    await prisma.$transaction(
      async (tx) => {
        for (const section of result.sections) {
          // Prisma composite unique doesn't handle null chapter well,
          // so we need to use findFirst when chapter is null
          const existing = section.chapter
            ? await tx.lawSection.findUnique({
                where: {
                  legal_document_id_chapter_section: {
                    legal_document_id: law.id,
                    chapter: section.chapter,
                    section: section.section,
                  },
                },
              })
            : await tx.lawSection.findFirst({
                where: {
                  legal_document_id: law.id,
                  chapter: null,
                  section: section.section,
                },
              })

          if (existing) {
            // Update if content changed
            if (
              existing.html_content !== section.htmlContent ||
              existing.text_content !== section.textContent
            ) {
              await tx.lawSection.update({
                where: { id: existing.id },
                data: {
                  html_content: section.htmlContent,
                  text_content: section.textContent,
                  heading: section.heading,
                  updated_at: new Date(),
                },
              })
              stats.sectionsUpdated++
            }
          } else {
            await tx.lawSection.create({
              data: {
                legal_document_id: law.id,
                chapter: section.chapter,
                section: section.section,
                html_content: section.htmlContent,
                text_content: section.textContent,
                heading: section.heading,
              },
            })
            stats.sectionsCreated++
          }
        }
      },
      { timeout: 60000 }
    ) // 60 second timeout for laws with many sections
  } else {
    // Dry run - just count what would be created
    stats.sectionsCreated += result.sections.length
  }

  stats.lawsProcessed++
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
