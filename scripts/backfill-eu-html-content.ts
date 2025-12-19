/* eslint-disable no-console */
/**
 * Backfill HTML content for EU documents missing it
 *
 * Fetches HTML from CELLAR API for documents with null html_content
 *
 * NOTE: Correction documents (ending in R(01), R(02), etc.) are skipped
 * as they don't have standalone HTML in CELLAR.
 *
 * Run with: NODE_OPTIONS="--max-old-space-size=4096" pnpm tsx scripts/backfill-eu-html-content.ts
 */

import { PrismaClient } from '@prisma/client'
import {
  fetchDocumentContentViaCellar,
  extractEUMetadata,
} from '../lib/external/eurlex'

const BATCH_SIZE = 5 // Smaller batches for memory efficiency
const DELAY_BETWEEN_DOCS = 300 // ms - be nice to CELLAR API
const DELAY_BETWEEN_BATCHES = 1000 // ms
const RECONNECT_EVERY_N = 50 // Reconnect Prisma every N documents

// Regex to detect correction documents: 32020R1234R(01), 32020R1234R(02), etc.
const CORRECTION_REGEX = /R\(\d+\)$/

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  let prisma = new PrismaClient()
  const startTime = Date.now()
  let docsProcessed = 0

  try {
    // Get all documents missing HTML content
    console.log('Fetching EU documents missing HTML content...')
    const allDocs = await prisma.legalDocument.findMany({
      where: {
        content_type: { in: ['EU_REGULATION', 'EU_DIRECTIVE'] },
        html_content: null,
      },
      select: {
        id: true,
        document_number: true, // CELEX number
        title: true,
      },
    })

    // Filter out correction documents (R(01), R(02), etc.) - they don't have HTML in CELLAR
    const docs = allDocs.filter(
      (d) => !CORRECTION_REGEX.test(d.document_number)
    )
    const skippedCorrections = allDocs.length - docs.length

    console.log(`Found ${allDocs.length} documents missing HTML`)
    console.log(
      `Skipping ${skippedCorrections} correction documents (no standalone HTML)`
    )
    console.log(`Processing ${docs.length} regular documents\n`)

    if (docs.length === 0) {
      console.log('Nothing to backfill!')
      return
    }

    let totalUpdated = 0
    let totalFailed = 0
    let totalBytes = 0

    // Process in batches
    const totalBatches = Math.ceil(docs.length / BATCH_SIZE)

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const batch = docs.slice(i, i + BATCH_SIZE)

      console.log(
        `[${batchNum}/${totalBatches}] Processing ${batch.length} documents...`
      )

      let batchUpdated = 0
      let batchFailed = 0

      for (const doc of batch) {
        const celex = doc.document_number

        try {
          const content = await fetchDocumentContentViaCellar(celex)

          if (content && content.html) {
            // Extract metadata from content
            const metadata = extractEUMetadata(content.plainText, doc.title)

            await prisma.legalDocument.update({
              where: { id: doc.id },
              data: {
                html_content: content.html,
                full_text: content.plainText,
                metadata: {
                  // Preserve existing metadata and add extracted
                  articleCount: metadata.articleCount,
                  chapterCount: metadata.chapterCount,
                  sectionCount: metadata.sectionCount,
                  recitalCount: metadata.recitalCount,
                  wordCount: metadata.wordCount,
                  documentComplexity: metadata.documentComplexity,
                },
              },
            })

            totalBytes += content.html.length
            batchUpdated++
            totalUpdated++
          } else {
            // No content available
            batchFailed++
            totalFailed++
          }
        } catch (error) {
          console.error(
            `   ❌ ${celex}: ${error instanceof Error ? error.message : error}`
          )
          batchFailed++
          totalFailed++
        }

        await sleep(DELAY_BETWEEN_DOCS)
        docsProcessed++

        // Reconnect Prisma periodically to release memory
        if (docsProcessed % RECONNECT_EVERY_N === 0) {
          await prisma.$disconnect()
          prisma = new PrismaClient()
          if (global.gc) global.gc()
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const progress = (((i + batch.length) / docs.length) * 100).toFixed(1)
      const avgSize =
        totalUpdated > 0 ? Math.round(totalBytes / totalUpdated / 1024) : 0
      console.log(
        `   ✓ ${batchUpdated} updated, ${batchFailed} failed (${progress}% done, ${elapsed}s, avg ${avgSize}KB)`
      )

      await sleep(DELAY_BETWEEN_BATCHES)
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    const totalMB = (totalBytes / 1024 / 1024).toFixed(1)

    console.log('\n' + '='.repeat(60))
    console.log('HTML BACKFILL COMPLETE')
    console.log('='.repeat(60))
    console.log(`Total documents:     ${docs.length}`)
    console.log(`Successfully updated: ${totalUpdated}`)
    console.log(`Failed:               ${totalFailed}`)
    console.log(`Total content:        ${totalMB} MB`)
    console.log(`Duration:             ${duration}s`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
