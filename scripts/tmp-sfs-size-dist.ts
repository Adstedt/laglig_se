#!/usr/bin/env npx tsx
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { prisma } from '../lib/prisma'

async function main() {
  const results: any[] = await prisma.$queryRaw`
    SELECT
      CASE
        WHEN LENGTH(html_content) < 10000 THEN '1. <10K'
        WHEN LENGTH(html_content) < 50000 THEN '2. 10-50K'
        WHEN LENGTH(html_content) < 100000 THEN '3. 50-100K'
        WHEN LENGTH(html_content) < 200000 THEN '4. 100-200K'
        WHEN LENGTH(html_content) < 500000 THEN '5. 200-500K'
        ELSE '6. >500K'
      END as size_bucket,
      COUNT(*)::int as count,
      ROUND(AVG(LENGTH(html_content)))::int as avg_chars,
      ROUND(AVG(LENGTH(html_content)) / 4)::int as est_tokens
    FROM legal_documents
    WHERE content_type = 'SFS_LAW' AND html_content IS NOT NULL
    GROUP BY size_bucket
    ORDER BY size_bucket
  `
  console.log('SFS Law HTML size distribution:')
  console.table(results)

  const biggest: any[] = await prisma.$queryRaw`
    SELECT document_number,
           LEFT(title, 50) as title,
           LENGTH(html_content)::int as html_chars,
           (LENGTH(html_content) / 4)::int as est_input_tokens
    FROM legal_documents
    WHERE content_type = 'SFS_LAW' AND html_content IS NOT NULL
    ORDER BY LENGTH(html_content) DESC
    LIMIT 15
  `
  console.log('\n15 biggest SFS laws:')
  console.table(biggest)

  // Count total
  const total: any[] = await prisma.$queryRaw`
    SELECT COUNT(*)::int as total
    FROM legal_documents
    WHERE content_type = 'SFS_LAW' AND html_content IS NOT NULL
  `
  console.log('Total SFS laws with HTML:', total[0].total)

  await prisma.$disconnect()
}

main().catch(console.error)
