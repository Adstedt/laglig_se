import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const docs = await prisma.$queryRawUnsafe<any[]>(
    `SELECT document_number, title, LENGTH(html_content) as html_len
     FROM legal_documents
     WHERE content_type = 'SFS_LAW'
       AND html_content LIKE '%article class="legal-document"%'
       AND html_content NOT LIKE '%class="paragraph"%'
       AND (
         html_content LIKE '%<a class="paragraf"%'
         OR html_content LIKE '%<a name="K%'
         OR html_content LIKE '%class="LedParagraf"%'
       )
     ORDER BY document_number`
  )

  console.log(`Total: ${docs.length}\n`)
  for (const d of docs) {
    console.log(
      `${d.document_number.padEnd(16)} ${(Number(d.html_len) / 1024).toFixed(0).padStart(5)} KB  ${d.title}`
    )
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
