import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Get the 20 largest SFS_LAW docs by json_content size
  const docs = await prisma.$queryRaw<
    Array<{
      document_number: string
      title: string
      json_len: number
      md_len: number
      html_len: number
      json_tokens_est: number
    }>
  >`
    SELECT 
      document_number,
      title,
      LENGTH(json_content::text) as json_len,
      LENGTH(COALESCE(markdown_content, '')) as md_len,
      LENGTH(COALESCE(html_content, '')) as html_len,
      CEIL(LENGTH(json_content::text) / 4.0) as json_tokens_est
    FROM legal_documents
    WHERE content_type = 'SFS_LAW' AND json_content IS NOT NULL
    ORDER BY LENGTH(json_content::text) DESC
    LIMIT 30
  `

  console.log('Top 30 largest SFS_LAW documents by JSON size:\n')
  console.log(
    'Doc Number          | Title (truncated)                    | JSON chars | ~tokens | MD chars | HTML chars'
  )
  console.log('-'.repeat(120))
  for (const d of docs) {
    const title = (d.title ?? '').substring(0, 36).padEnd(36)
    console.log(
      `${d.document_number.padEnd(20)}| ${title} | ${String(d.json_len).padStart(10)} | ${String(d.json_tokens_est).padStart(7)} | ${String(d.md_len).padStart(8)} | ${String(d.html_len).padStart(10)}`
    )
  }

  // Distribution buckets
  const buckets = await prisma.$queryRaw<
    Array<{ bucket: string; count: bigint }>
  >`
    SELECT 
      CASE 
        WHEN LENGTH(json_content::text) / 4 > 200000 THEN '>200K tokens'
        WHEN LENGTH(json_content::text) / 4 > 100000 THEN '100-200K tokens'
        WHEN LENGTH(json_content::text) / 4 > 50000 THEN '50-100K tokens'
        WHEN LENGTH(json_content::text) / 4 > 20000 THEN '20-50K tokens'
        WHEN LENGTH(json_content::text) / 4 > 10000 THEN '10-20K tokens'
        ELSE '<10K tokens'
      END as bucket,
      COUNT(*) as count
    FROM legal_documents
    WHERE content_type = 'SFS_LAW' AND json_content IS NOT NULL
    GROUP BY bucket
    ORDER BY MIN(LENGTH(json_content::text)) DESC
  `

  console.log('\n\nDistribution (by estimated JSON tokens):')
  for (const b of buckets) {
    console.log(`  ${b.bucket.padEnd(20)} ${b.count} docs`)
  }

  // Total count
  const total = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW', json_content: { not: undefined } },
  })
  console.log(`\n  Total SFS_LAW with json_content: ${total}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
