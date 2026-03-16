import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // SFS_LAW docs WITHOUT canonical HTML wrapper
  const noCanonical: Array<{
    document_number: string
    title: string
    html_len: number | null
    has_json: boolean
  }> = await prisma.$queryRaw`
    SELECT document_number,
           COALESCE(title, '') as title,
           LENGTH(html_content) as html_len,
           (json_content IS NOT NULL) as has_json
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
      AND (html_content IS NULL OR html_content NOT LIKE '%<article class="legal-document"%')
    ORDER BY document_number
    LIMIT 30
  `

  const totalNoCanonical: Array<{ count: bigint }> = await prisma.$queryRaw`
    SELECT COUNT(*)::bigint as count
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
      AND (html_content IS NULL OR html_content NOT LIKE '%<article class="legal-document"%')
  `

  const nullHtml: Array<{ count: bigint }> = await prisma.$queryRaw`
    SELECT COUNT(*)::bigint as count
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
      AND html_content IS NULL
  `

  const hasHtmlNoWrapper: Array<{ count: bigint }> = await prisma.$queryRaw`
    SELECT COUNT(*)::bigint as count
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
      AND html_content IS NOT NULL
      AND html_content NOT LIKE '%<article class="legal-document"%'
  `

  console.log(
    `Total SFS_LAW without canonical HTML: ${totalNoCanonical[0]?.count}`
  )
  console.log(`  - html_content IS NULL: ${nullHtml[0]?.count}`)
  console.log(`  - has HTML but no wrapper: ${hasHtmlNoWrapper[0]?.count}`)

  console.log('\nFirst 30 examples:')
  for (const doc of noCanonical) {
    console.log(
      `  ${doc.document_number.padEnd(20)} html: ${doc.html_len ? `${doc.html_len} bytes` : 'NULL'.padEnd(12)} json: ${doc.has_json} — ${doc.title.substring(0, 60)}`
    )
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
