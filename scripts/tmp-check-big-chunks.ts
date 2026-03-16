import { config } from 'dotenv'
config({ path: '.env.local' })
import { prisma } from '../lib/prisma'

async function main() {
  const big = await prisma.$queryRaw<
    Array<{
      id: string
      path: string
      token_count: number
      char_count: number
      document_number: string
      title: string
    }>
  >`
    SELECT cc.id, cc.path, cc.token_count, LENGTH(cc.content) as char_count,
           ld.document_number, ld.title
    FROM content_chunks cc
    JOIN legal_documents ld ON cc.source_id = ld.id
    WHERE cc.token_count > 7000
    ORDER BY cc.token_count DESC
    LIMIT 30
  `

  console.log(`Chunks with >7000 tokens: ${big.length}`)
  for (const c of big) {
    console.log(
      `  ${c.token_count} tokens | ${c.char_count} chars | ${c.document_number} | ${c.path} | ${c.title.substring(0, 60)}`
    )
  }

  // Also check distribution
  const dist = await prisma.$queryRaw<Array<{ bucket: string; cnt: bigint }>>`
    SELECT
      CASE
        WHEN token_count <= 500 THEN '0-500'
        WHEN token_count <= 1000 THEN '501-1000'
        WHEN token_count <= 2000 THEN '1001-2000'
        WHEN token_count <= 4000 THEN '2001-4000'
        WHEN token_count <= 8000 THEN '4001-8000'
        ELSE '8000+'
      END as bucket,
      COUNT(*) as cnt
    FROM content_chunks
    GROUP BY bucket
    ORDER BY bucket
  `
  console.log('\nToken distribution:')
  for (const d of dist) {
    console.log(`  ${d.bucket}: ${d.cnt}`)
  }

  await prisma.$disconnect()
}
main()
