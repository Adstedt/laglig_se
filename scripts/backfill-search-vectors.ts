/**
 * Story 2.7: Backfill search vectors for existing documents
 *
 * SIMPLIFIED APPROACH: Only indexes title, document_number, and summary
 * full_text search will be added later via pgvector/embeddings
 *
 * This script populates the search_vector column for all existing documents
 * in batches to avoid timeouts. Run this after running the migration.
 *
 * Usage: pnpm tsx scripts/backfill-search-vectors.ts
 */

import { prisma } from '../lib/prisma'

const BATCH_SIZE = 1000 // Can use larger batches since we're not indexing full_text

async function backfill() {
  console.log('Starting search vector backfill (simplified approach)...')
  console.log('Indexing: title, document_number, summary')
  console.log('NOT indexing: full_text (will use pgvector later)\n')

  // Get total count of documents needing backfill
  const totalResult = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint as count
    FROM legal_documents
    WHERE search_vector IS NULL
  `
  const total = Number(totalResult[0].count)
  console.log(`Found ${total} documents without search_vector`)

  if (total === 0) {
    console.log('All documents already have search vectors!')
    return
  }

  let processed = 0
  let batchNum = 0

  while (processed < total) {
    batchNum++
    const start = Date.now()

    // Process a batch - simplified: no full_text
    const result = await prisma.$executeRaw`
      UPDATE legal_documents
      SET search_vector =
        setweight(to_tsvector('pg_catalog.swedish', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('pg_catalog.swedish', coalesce(document_number, '')), 'A') ||
        setweight(to_tsvector('pg_catalog.swedish', coalesce(summary, '')), 'B')
      WHERE id IN (
        SELECT id FROM legal_documents
        WHERE search_vector IS NULL
        LIMIT ${BATCH_SIZE}
      )
    `

    processed += result
    const elapsed = Date.now() - start
    const remaining = total - processed
    const estimatedRemaining = Math.ceil((remaining / BATCH_SIZE) * elapsed / 1000)

    console.log(
      `Batch ${batchNum}: ${result} docs in ${elapsed}ms | ` +
      `Progress: ${processed}/${total} (${((processed / total) * 100).toFixed(1)}%) | ` +
      `Est. remaining: ${estimatedRemaining}s`
    )

    // Small delay to avoid overwhelming the database
    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  console.log(`\nBackfill complete! Processed ${processed} documents.`)

  // Run ANALYZE to update query planner statistics
  console.log('Running ANALYZE on legal_documents...')
  await prisma.$executeRaw`ANALYZE legal_documents`
  console.log('Done!')
}

backfill()
  .catch((error) => {
    console.error('Backfill failed:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
