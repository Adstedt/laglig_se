import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Get 10 properly normalized docs (have class="paragraph" and class="paragraf")
  // Mix of chaptered and flat
  const docs = await prisma.$queryRawUnsafe<any[]>(
    `SELECT document_number, title,
       LENGTH(html_content) as html_len,
       CASE WHEN html_content LIKE '%section class="kapitel"%' THEN 'chaptered' ELSE 'flat' END as structure,
       LEFT(html_content, 1500) as preview
     FROM legal_documents
     WHERE content_type = 'SFS_LAW'
       AND html_content LIKE '%class="paragraph"%'
       AND html_content LIKE '%class="paragraf"%'
     ORDER BY RANDOM()
     LIMIT 10`
  )

  for (const d of docs) {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`${d.document_number}: ${d.title}`)
    console.log(
      `Structure: ${d.structure} | HTML size: ${Number(d.html_len)} chars`
    )
    console.log('='.repeat(80))
    console.log(d.preview)
    console.log('...')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
