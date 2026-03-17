import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1907:15 s.1' },
    select: { html_content: true, title: true, document_number: true },
  })

  if (!doc?.html_content) {
    console.log('Not found')
    return
  }

  console.log(`${doc.document_number}: ${doc.title}`)
  console.log(`Size: ${doc.html_content.length} chars`)
  console.log(`Has paragraf: ${doc.html_content.includes('class="paragraf"')}`)
  console.log(
    `Has paragraph: ${doc.html_content.includes('class="paragraph"')}`
  )
  console.log(`\nFirst 1000 chars:`)
  console.log(doc.html_content.substring(0, 1000))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
