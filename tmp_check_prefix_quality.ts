import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRawUnsafe('SET statement_timeout = 300000')

  // Sample from different offsets to see quality range
  const offsets = [500, 2200, 5000, 50000, 100000, 150000]

  for (const offset of offsets) {
    const samples = await prisma.$queryRaw<
      {
        id: string
        source_id: string
        path: string
        context_prefix: string | null
        content: string
        contextual_header: string
      }[]
    >`
      SELECT id, source_id, path, context_prefix, LEFT(content, 300) as content, contextual_header
      FROM content_chunks
      WHERE context_prefix IS NOT NULL
      ORDER BY id ASC
      OFFSET ${offset}
      LIMIT 2
    `

    for (const s of samples) {
      const doc = await prisma.legalDocument.findUnique({
        where: { id: s.source_id },
        select: { title: true, document_number: true },
      })

      console.log(`\n${'='.repeat(80)}`)
      console.log(
        `OFFSET ${offset} | DOC: ${doc?.document_number} — ${doc?.title}`
      )
      console.log(`PATH: ${s.path}`)
      console.log(`HEADER: ${s.contextual_header}`)
      console.log(`PREFIX: ${s.context_prefix}`)
      console.log(`CONTENT: ${s.content}...`)
    }
  }

  // Also check: any chunks with empty/very short prefixes?
  const qualityStats = await prisma.$queryRaw<
    {
      total_with_prefix: number
      very_short: number
      short: number
      medium: number
      long: number
      avg_len: number
    }[]
  >`
    SELECT
      COUNT(*)::int as total_with_prefix,
      COUNT(*) FILTER (WHERE LENGTH(context_prefix) < 20)::int as very_short,
      COUNT(*) FILTER (WHERE LENGTH(context_prefix) BETWEEN 20 AND 80)::int as short,
      COUNT(*) FILTER (WHERE LENGTH(context_prefix) BETWEEN 81 AND 250)::int as medium,
      COUNT(*) FILTER (WHERE LENGTH(context_prefix) > 250)::int as long,
      AVG(LENGTH(context_prefix))::int as avg_len
    FROM content_chunks
    WHERE context_prefix IS NOT NULL
  `

  console.log(`\n${'='.repeat(80)}`)
  console.log('PREFIX LENGTH DISTRIBUTION:')
  const q = qualityStats[0]!
  console.log(`  Total with prefix: ${q.total_with_prefix}`)
  console.log(`  Very short (<20 chars): ${q.very_short}`)
  console.log(`  Short (20-80 chars): ${q.short}`)
  console.log(`  Medium (81-250 chars): ${q.medium}`)
  console.log(`  Long (>250 chars): ${q.long}`)
  console.log(`  Average length: ${q.avg_len} chars`)

  await prisma.$disconnect()
}

main()
