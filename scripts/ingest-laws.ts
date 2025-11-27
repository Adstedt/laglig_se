#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Law Ingestion Script
 *
 * Fetches SFS laws from Riksdagen API and stores them in the database.
 *
 * Usage:
 *   pnpm ingest-laws           # Ingest 100 laws (default)
 *   pnpm ingest-laws -- --limit 50  # Ingest 50 laws
 *   pnpm ingest-laws -- --skip-text # Skip fetching full text (faster)
 */

import { PrismaClient, ContentType, DocumentStatus } from '@prisma/client'
import {
  fetchSFSLaws,
  fetchLawFullText,
  generateSlug,
  type ParsedLaw,
} from '../lib/external/riksdagen'

const prisma = new PrismaClient()

// ============================================================================
// Configuration
// ============================================================================

interface IngestionConfig {
  limit: number
  skipFullText: boolean
}

function parseArgs(): IngestionConfig {
  const args = process.argv.slice(2)
  const config: IngestionConfig = {
    limit: 100,
    skipFullText: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--limit' && args[i + 1]) {
      config.limit = parseInt(args[i + 1] ?? '100', 10)
      i++
    } else if (arg === '--skip-text') {
      config.skipFullText = true
    }
  }

  return config
}

// ============================================================================
// Ingestion Logic
// ============================================================================

async function ingestLaw(
  law: ParsedLaw,
  fullText: string | null
): Promise<void> {
  const slug = generateSlug(law.title, law.sfsNumber)

  // Generate summary from full text (first 300 chars)
  const summary = fullText
    ? fullText.substring(0, 300).replace(/\s+/g, ' ').trim() + '...'
    : null

  await prisma.legalDocument.upsert({
    where: { document_number: law.sfsNumber },
    update: {
      title: law.title,
      slug,
      full_text: fullText,
      summary,
      publication_date: law.publicationDate,
      source_url: law.sourceUrl,
      updated_at: new Date(),
      metadata: {
        dok_id: law.dokId,
        full_text_url: law.fullTextUrl,
      },
    },
    create: {
      document_number: law.sfsNumber,
      title: law.title,
      slug,
      content_type: ContentType.SFS_LAW,
      full_text: fullText,
      summary,
      publication_date: law.publicationDate,
      status: DocumentStatus.ACTIVE,
      source_url: law.sourceUrl,
      metadata: {
        dok_id: law.dokId,
        full_text_url: law.fullTextUrl,
      },
    },
  })
}

async function main(): Promise<void> {
  const config = parseArgs()

  console.log('='.repeat(60))
  console.log('Law Ingestion Script')
  console.log('='.repeat(60))
  console.log(`Limit: ${config.limit} laws`)
  console.log(`Skip full text: ${config.skipFullText}`)
  console.log('')

  try {
    // Step 1: Fetch law list from Riksdagen API
    console.log('Fetching law list from Riksdagen API...')
    const { laws, totalCount } = await fetchSFSLaws(config.limit)

    console.log(`Found ${totalCount} total laws, fetched ${laws.length}`)
    console.log('')

    // Step 2: Process each law
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < laws.length; i++) {
      const law = laws[i]
      if (!law) continue

      const progress = `[${i + 1}/${laws.length}]`

      try {
        // Fetch full text unless skipped
        let fullText: string | null = null
        if (!config.skipFullText) {
          process.stdout.write(
            `${progress} Fetching: ${law.title.substring(0, 50)}...`
          )
          fullText = await fetchLawFullText(law.dokId)
          process.stdout.write(' ✓\n')
        } else {
          console.log(
            `${progress} Skipping text: ${law.title.substring(0, 50)}...`
          )
        }

        // Store in database
        await ingestLaw(law, fullText)
        successCount++
      } catch (error) {
        console.error(`${progress} ERROR: ${(error as Error).message}`)
        errorCount++
      }

      // Small delay between laws to be nice to the API
      if (i < laws.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    // Step 3: Summary
    console.log('')
    console.log('='.repeat(60))
    console.log('Ingestion Complete')
    console.log('='.repeat(60))
    console.log(`✓ Success: ${successCount}`)
    console.log(`✗ Errors: ${errorCount}`)

    // Verify database count
    const dbCount = await prisma.legalDocument.count({
      where: { content_type: ContentType.SFS_LAW },
    })
    console.log(`Database now contains: ${dbCount} SFS laws`)
  } catch (error) {
    console.error('Fatal error during ingestion:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
