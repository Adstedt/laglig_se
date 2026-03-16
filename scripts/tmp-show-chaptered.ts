import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Get 10 chaptered docs, sorted by size (biggest first)
  const docs = await prisma.$queryRawUnsafe<any[]>(
    `SELECT document_number, title,
       LENGTH(html_content) as html_len,
       LEFT(html_content, 2500) as preview
     FROM legal_documents
     WHERE content_type = 'SFS_LAW'
       AND html_content LIKE '%section class="kapitel"%'
       AND html_content LIKE '%class="paragraph"%'
     ORDER BY LENGTH(html_content) DESC
     LIMIT 10`
  )

  for (const d of docs) {
    console.log(`\n${'='.repeat(90)}`)
    console.log(`${d.document_number}: ${d.title}`)
    console.log(`HTML size: ${(Number(d.html_len) / 1024).toFixed(0)} KB`)
    console.log('='.repeat(90))
    console.log(d.preview)
    console.log('\n[...truncated...]')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
