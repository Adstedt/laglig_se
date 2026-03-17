import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const startTime = Date.now()

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET statement_timeout = 600000') // 10 min

      // Step 1: Drop the HNSW index (this is what makes updates slow)
      console.log('Dropping HNSW index...')
      await tx.$executeRawUnsafe(
        'DROP INDEX IF EXISTS content_chunks_embedding_idx'
      )
      console.log(`  Done in ${((Date.now() - startTime) / 1000).toFixed(0)}s`)

      // Step 2: Clear all embeddings (fast without index)
      console.log('Clearing all embeddings...')
      const result = await tx.$executeRawUnsafe(
        'UPDATE content_chunks SET embedding = NULL'
      )
      console.log(
        `  Cleared ${result} rows in ${((Date.now() - startTime) / 1000).toFixed(0)}s`
      )
    },
    { timeout: 600000 }
  )

  console.log(
    `\nDone! Total time: ${((Date.now() - startTime) / 1000).toFixed(0)}s`
  )
  console.log(
    '\nNote: HNSW index dropped. It will be recreated after re-embedding.'
  )
  console.log('To recreate manually:')
  console.log('  CREATE INDEX content_chunks_embedding_idx ON content_chunks')
  console.log('    USING hnsw (embedding vector_cosine_ops)')
  console.log('    WITH (m = 16, ef_construction = 64);')

  await prisma.$disconnect()
}

main()
