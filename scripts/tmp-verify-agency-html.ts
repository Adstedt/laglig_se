import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const docs = await prisma.legalDocument.findMany({
    where: { content_type: 'AGENCY_REGULATION' },
    select: { id: true, document_number: true, html_content: true },
  })

  let canonical = 0
  let oldWrapper = 0
  let noHtml = 0
  let other = 0

  for (const doc of docs) {
    if (!doc.html_content) {
      noHtml++
      continue
    }
    if (doc.html_content.includes('class="legal-document"')) {
      canonical++
      continue
    }
    if (doc.html_content.includes('class="sfs"')) {
      oldWrapper++
      continue
    }
    other++
    console.log(`  OTHER: ${doc.document_number}`)
  }

  console.log(`Total:     ${docs.length}`)
  console.log(`Canonical: ${canonical}`)
  console.log(`Old wrap:  ${oldWrapper}`)
  console.log(`No HTML:   ${noHtml}`)
  console.log(`Other:     ${other}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
