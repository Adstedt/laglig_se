/* eslint-disable no-console */
/**
 * Embedding verification script — manual inspection of retrieval quality
 * Story 14.3, Task 7 (AC: 16)
 *
 * Runs sample Swedish legal queries, embeds them, and displays top-5 results
 * with cosine similarity scores.
 *
 * Usage:
 *   npx tsx scripts/verify-embeddings.ts
 *   npx tsx scripts/verify-embeddings.ts --top 10
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { prisma } from '../lib/prisma'
import { generateEmbedding, vectorToString } from '../lib/chunks/embed-chunks'

const TOP_K = parseInt(
  process.argv.find((_, i, arr) => arr[i - 1] === '--top') ?? '5',
  10
)

const testQueries = [
  'arbetsgivarens skyldigheter för skyddsutrustning', // employer PPE obligations
  'semesterersättning vid uppsägning', // vacation pay on termination
  'krav på ventilation i arbetslokaler', // ventilation requirements
  'anmälan av allvarligt olycksfall', // serious accident reporting
  'diskrimineringsförbudet vid anställning', // discrimination in hiring
  'minimikrav på arbetstider och raster', // working hours and breaks
  'hantering av personuppgifter på arbetsplatsen', // GDPR in workplace
  'sanktioner vid brott mot arbetsmiljölagen', // penalties for violations
]

interface SearchResult {
  id: string
  path: string
  contextual_header: string
  content: string
  context_prefix: string | null
  similarity: number
}

async function searchSimilar(
  queryEmbedding: number[],
  topK: number
): Promise<SearchResult[]> {
  const vecStr = vectorToString(queryEmbedding)

  // Set higher ef_search for verification accuracy
  await prisma.$executeRaw`SET hnsw.ef_search = 100`

  const results = await prisma.$queryRaw<SearchResult[]>`
    SELECT
      id,
      path,
      contextual_header,
      LEFT(content, 200) as content,
      LEFT(context_prefix, 200) as context_prefix,
      1 - (embedding <=> ${vecStr}::vector) as similarity
    FROM content_chunks
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vecStr}::vector
    LIMIT ${topK}
  `

  return results
}

async function main(): Promise<void> {
  // Check embedding coverage
  const stats = await prisma.$queryRaw<
    Array<{ total: bigint; with_embedding: bigint; with_prefix: bigint }>
  >`
    SELECT
      COUNT(*) as total,
      COUNT(embedding) as with_embedding,
      COUNT(context_prefix) as with_prefix
    FROM content_chunks
  `

  const total = Number(stats[0]?.total ?? 0)
  const withEmbedding = Number(stats[0]?.with_embedding ?? 0)
  const withPrefix = Number(stats[0]?.with_prefix ?? 0)

  console.log('=== Embedding Coverage ===')
  console.log(`Total chunks: ${total.toLocaleString()}`)
  console.log(
    `With embedding: ${withEmbedding.toLocaleString()} (${((withEmbedding / total) * 100).toFixed(1)}%)`
  )
  console.log(
    `With context prefix: ${withPrefix.toLocaleString()} (${((withPrefix / total) * 100).toFixed(1)}%)`
  )
  console.log()

  if (withEmbedding === 0) {
    console.log('No embeddings found. Run generate-embeddings.ts first.')
    await prisma.$disconnect()
    return
  }

  console.log(
    `=== Running ${testQueries.length} test queries (top ${TOP_K}) ===\n`
  )

  for (const query of testQueries) {
    console.log(`\nQuery: "${query}"`)
    console.log('-'.repeat(60))

    try {
      const { embedding } = await generateEmbedding(query, '', '')
      const results = await searchSimilar(embedding, TOP_K)

      for (let i = 0; i < results.length; i++) {
        const r = results[i]!
        console.log(
          `  ${i + 1}. [${r.similarity.toFixed(4)}] ${r.contextual_header}`
        )
        console.log(`     Path: ${r.path}`)
        if (r.context_prefix) {
          console.log(`     Prefix: ${r.context_prefix}...`)
        }
        console.log(`     Content: ${r.content}...`)
        console.log()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ERROR: ${msg}`)
    }
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  prisma.$disconnect()
  process.exit(1)
})
