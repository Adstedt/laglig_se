import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
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

  console.log('Distribution (by estimated JSON tokens):')
  for (const b of buckets) {
    console.log(`  ${b.bucket.padEnd(20)} ${b.count} docs`)
  }

  // Claude Batch API limit is 200K input tokens per request
  // But we'd send: system prompt (~200) + full doc + chunk (~150)
  // So effective limit ~199K for the document
  const over200k = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM legal_documents 
    WHERE content_type = 'SFS_LAW' AND json_content IS NOT NULL 
    AND LENGTH(json_content::text) / 4 > 199000
  `
  const over100k = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM legal_documents 
    WHERE content_type = 'SFS_LAW' AND json_content IS NOT NULL 
    AND LENGTH(json_content::text) / 4 > 100000
  `
  console.log(
    `\nDocs exceeding 200K tokens (Batch API limit): ${over200k[0]?.count}`
  )
  console.log(`Docs exceeding 100K tokens: ${over100k[0]?.count}`)

  // What about markdown instead of JSON?
  console.log('\n--- Markdown comparison (top 10) ---')
  const mdTop = await prisma.$queryRaw<
    Array<{
      document_number: string
      json_tokens: number
      md_tokens: number
      ratio: number
    }>
  >`
    SELECT 
      document_number,
      CEIL(LENGTH(json_content::text) / 4.0)::int as json_tokens,
      CEIL(LENGTH(COALESCE(markdown_content, '')) / 4.0)::int as md_tokens,
      ROUND(LENGTH(COALESCE(markdown_content, ''))::numeric / NULLIF(LENGTH(json_content::text), 0), 2)::float as ratio
    FROM legal_documents
    WHERE content_type = 'SFS_LAW' AND json_content IS NOT NULL
    ORDER BY LENGTH(json_content::text) DESC
    LIMIT 10
  `
  for (const d of mdTop) {
    console.log(
      `  ${d.document_number.padEnd(18)} JSON: ${String(d.json_tokens).padStart(7)} | MD: ${String(d.md_tokens).padStart(7)} | ratio: ${d.ratio}`
    )
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
