import { config } from 'dotenv'
import { resolve } from 'path'
import { writeFileSync } from 'fs'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2025:1461' },
    select: { document_number: true, title: true, html_content: true },
  })
  if (!doc?.html_content) {
    console.log('NOT FOUND')
    return
  }

  console.log(`${doc.document_number} — ${doc.title}`)
  console.log(`Input: ${doc.html_content.length} chars`)

  // Apply whitespace cleanup to already-normalized content
  const cleaned = doc.html_content.replace(/\n\s*\n\s*\n/g, '\n\n')

  console.log(`Output: ${cleaned.length} chars`)
  console.log(`Changed: ${cleaned !== doc.html_content}`)

  if (cleaned !== doc.html_content) {
    await prisma.legalDocument.updateMany({
      where: { document_number: 'SFS 2025:1461' },
      data: { html_content: cleaned },
    })
    console.log(`Updated SFS 2025:1461 in DB`)
  } else {
    console.log(`No whitespace changes needed`)
  }
}
main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
