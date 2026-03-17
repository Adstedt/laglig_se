import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Total count
  const total = await prisma.$queryRawUnsafe<{ count: number }[]>(
    'SELECT COUNT(*)::int as count FROM content_chunks'
  )
  console.log('Total rows:', total[0]!.count)

  // Check for duplicates by path + source_id
  const dupes = await prisma.$queryRawUnsafe<
    { source_id: string; path: string; cnt: number }[]
  >(`
    SELECT source_id, path, COUNT(*)::int as cnt
    FROM content_chunks
    GROUP BY source_id, path
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 20
  `)
  console.log('\nDuplicate (source_id, path) pairs:', dupes.length)
  dupes
    .slice(0, 10)
    .forEach((d) =>
      console.log(`  ${d.cnt}x | path: ${d.path} | source: ${d.source_id}`)
    )

  // Total extra rows from dupes
  const dupeCount = await prisma.$queryRawUnsafe<{ extra_rows: number }[]>(`
    SELECT COALESCE(SUM(cnt - 1), 0)::int as extra_rows FROM (
      SELECT COUNT(*) as cnt FROM content_chunks GROUP BY source_id, path HAVING COUNT(*) > 1
    ) sub
  `)
  console.log('\nExtra duplicate rows:', dupeCount[0]!.extra_rows)

  // When were the rows created?
  const timeline = await prisma.$queryRawUnsafe<
    { day: string; cnt: number }[]
  >(`
    SELECT created_at::date as day, COUNT(*)::int as cnt
    FROM content_chunks
    GROUP BY created_at::date
    ORDER BY day DESC
    LIMIT 10
  `)
  console.log('\nRows by creation date:')
  timeline.forEach((t) => console.log(`  ${t.day}: ${t.cnt}`))

  // Check if extra rows have embeddings or not
  const embStatus = await prisma.$queryRawUnsafe<
    { has_emb: number; no_emb: number }[]
  >(`
    WITH dupes AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY source_id, path ORDER BY created_at ASC) as rn
      FROM content_chunks
    )
    SELECT
      COUNT(*) FILTER (WHERE cc.embedding IS NOT NULL)::int as has_emb,
      COUNT(*) FILTER (WHERE cc.embedding IS NULL)::int as no_emb
    FROM dupes d
    JOIN content_chunks cc ON cc.id = d.id
    WHERE d.rn > 1
  `)
  console.log('\nDuplicate rows embedding status:')
  console.log(`  With embedding: ${embStatus[0]!.has_emb}`)
  console.log(`  Without embedding: ${embStatus[0]!.no_emb}`)

  await prisma.$disconnect()
}

main()
