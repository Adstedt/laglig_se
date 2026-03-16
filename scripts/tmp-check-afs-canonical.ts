import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const docs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'AGENCY_REGULATION',
      metadata: { path: ['method'], equals: 'html-scraping' },
    },
    select: { document_number: true, html_content: true, created_at: true },
  })

  let canonical = 0
  let nonCanonical = 0
  const nonCanonicalDocs: string[] = []

  for (const d of docs) {
    const h = d.html_content || ''
    const hasLegalDoc = h.includes('class="legal-document"')
    const hasParagraph = h.includes('class="paragraph"')
    const hasText = h.includes('class="text"')

    if (hasLegalDoc && hasParagraph && hasText) {
      canonical++
    } else {
      nonCanonical++
      const wrapper = hasLegalDoc
        ? 'legal-document'
        : h.includes('class="sfs"')
          ? 'sfs'
          : 'other'
      nonCanonicalDocs.push(
        `  ${d.document_number} | wrapper=${wrapper} paragraph=${hasParagraph} text=${hasText}`
      )
    }
  }

  console.log(`AFS HTML-scraped docs: ${docs.length} total`)
  console.log(`  Canonical: ${canonical}`)
  console.log(`  Non-canonical: ${nonCanonical}`)
  if (nonCanonicalDocs.length > 0) {
    console.log('\nNon-canonical docs:')
    for (const line of nonCanonicalDocs) {
      console.log(line)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
