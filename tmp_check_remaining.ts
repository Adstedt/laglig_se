import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET statement_timeout = 300000')

      const counts = await tx.$queryRaw<
        {
          no_embedding: number
          no_emb_has_prefix: number
          no_emb_no_prefix: number
          has_embedding: number
        }[]
      >`
      SELECT
        COUNT(*) FILTER (WHERE embedding IS NULL)::int as no_embedding,
        COUNT(*) FILTER (WHERE embedding IS NULL AND context_prefix IS NOT NULL)::int as no_emb_has_prefix,
        COUNT(*) FILTER (WHERE embedding IS NULL AND context_prefix IS NULL)::int as no_emb_no_prefix,
        COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int as has_embedding
      FROM content_chunks
    `

      const c = counts[0]!
      console.log('=== Remaining Embedding Work ===')
      console.log(`Has embedding:                ${c.has_embedding}`)
      console.log(`Missing embedding (total):    ${c.no_embedding}`)
      console.log(`  - Has prefix, needs embed:  ${c.no_emb_has_prefix}`)
      console.log(`  - No prefix (15 large docs): ${c.no_emb_no_prefix}`)
    },
    { timeout: 300000 }
  )

  await prisma.$disconnect()
}

main()
