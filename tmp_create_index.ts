import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Check existing indexes
  const indexes = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
    "SELECT indexname FROM pg_indexes WHERE tablename = 'content_chunks'"
  )
  console.log(
    'Current indexes:',
    indexes.map((i) => i.indexname)
  )

  // Check for invalid indexes (from interrupted CREATE INDEX)
  const invalid = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
    'SELECT indexrelid::regclass as indexname FROM pg_index WHERE NOT indisvalid'
  )
  console.log(
    'Invalid indexes:',
    invalid.map((i) => i.indexname)
  )

  // Drop any existing (possibly broken) HNSW index
  console.log('\nDropping any existing embedding index...')
  await prisma.$executeRawUnsafe(
    'DROP INDEX IF EXISTS content_chunks_embedding_idx'
  )

  // Set long timeout and create
  console.log('Setting 10min timeout...')
  await prisma.$executeRawUnsafe('SET statement_timeout = 600000')

  console.log(
    'Creating HNSW index on 228K vectors (this will take a few minutes)...'
  )
  const start = Date.now()
  await prisma.$executeRawUnsafe(
    'CREATE INDEX content_chunks_embedding_idx ON content_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)'
  )
  const elapsed = ((Date.now() - start) / 1000).toFixed(0)
  console.log(`HNSW index created in ${elapsed}s`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ERROR:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})
