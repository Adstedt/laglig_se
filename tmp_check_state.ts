import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRawUnsafe('SET statement_timeout = 300000')

  const counts = await prisma.$queryRaw<
    {
      total: number
      has_embedding: number
      has_prefix: number
      has_both: number
      no_embedding: number
    }[]
  >`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int as has_embedding,
      COUNT(*) FILTER (WHERE context_prefix IS NOT NULL)::int as has_prefix,
      COUNT(*) FILTER (WHERE embedding IS NOT NULL AND context_prefix IS NOT NULL)::int as has_both,
      COUNT(*) FILTER (WHERE embedding IS NULL)::int as no_embedding
    FROM content_chunks
  `

  const c = counts[0]!
  console.log('=== Content Chunks State ===')
  console.log(`Total chunks:        ${c.total}`)
  console.log(`Has embedding:       ${c.has_embedding}`)
  console.log(`Has prefix:          ${c.has_prefix}`)
  console.log(`Has both:            ${c.has_both}`)
  console.log(`No embedding:        ${c.no_embedding}`)
  console.log(`Has prefix, no emb:  ${c.has_prefix - c.has_both}`)
  console.log(`Has emb, no prefix:  ${c.has_embedding - c.has_both}`)

  await prisma.$disconnect()
}

main()
