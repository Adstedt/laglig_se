/**
 * Apply Browse Performance Indexes (Story 2.19)
 *
 * This script creates database indexes for optimized catalogue browsing.
 * Run with: pnpm tsx scripts/apply-browse-indexes.ts
 *
 * Note: Uses regular CREATE INDEX (not CONCURRENTLY) because Prisma wraps
 * queries in transactions. For large production databases, consider running
 * these SQL statements directly via psql with CONCURRENTLY.
 */

import { prisma } from '../lib/prisma'

async function applyBrowseIndexes() {
  console.log('🗄️ Applying browse performance indexes...\n')

  const indexes = [
    {
      name: 'idx_browse_composite',
      sql: `CREATE INDEX IF NOT EXISTS idx_browse_composite
            ON legal_documents (content_type, status, effective_date DESC)`,
      purpose: 'Composite index for filtered catalogue browsing',
    },
    {
      name: 'idx_browse_content_date',
      sql: `CREATE INDEX IF NOT EXISTS idx_browse_content_date
            ON legal_documents (content_type, effective_date DESC)`,
      purpose: 'Index for content-type specific browsing',
    },
    {
      name: 'idx_publication_date',
      sql: `CREATE INDEX IF NOT EXISTS idx_publication_date
            ON legal_documents (publication_date DESC)`,
      purpose: 'Index for court case sorting by publication date',
    },
  ]

  for (const index of indexes) {
    try {
      console.log(`📊 Creating ${index.name}...`)
      console.log(`   Purpose: ${index.purpose}`)
      await prisma.$executeRawUnsafe(index.sql)
      console.log(`   ✅ ${index.name} created successfully\n`)
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log(`   ℹ️ ${index.name} already exists, skipping\n`)
      } else {
        console.error(`   ❌ Error creating ${index.name}:`, error)
      }
    }
  }

  // Verify indexes exist
  console.log('🔍 Verifying indexes...')
  const result = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'legal_documents'
    AND indexname IN ('idx_browse_composite', 'idx_browse_content_date', 'idx_publication_date')
  `

  console.log(`\n✅ Found ${result.length}/3 browse indexes:`)
  result.forEach((idx) => console.log(`   - ${idx.indexname}`))

  if (result.length < 3) {
    console.log('\n⚠️ Some indexes may still be creating (CONCURRENTLY).')
    console.log('   Re-run this script to verify completion.')
  }

  console.log('\n🎉 Browse index optimization complete!')
}

applyBrowseIndexes()
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
