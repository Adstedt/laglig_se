import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Check which AFS docs have canonical markers - are they the ones that went through normalizer?
  const docs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'AGENCY_REGULATION',
      metadata: { path: ['method'], equals: 'html-scraping' },
    },
    select: { document_number: true, html_content: true, updated_at: true },
  })

  console.log('=== Canonical AFS docs (have h3.paragraph + p.text) ===')
  for (const d of docs) {
    const h = d.html_content || ''
    if (h.includes('class="paragraph"') && h.includes('class="text"')) {
      // Check if it looks like it went through the normalizer
      const hasLegalDoc = h.includes('class="legal-document"')
      const hasLovhead = h.includes('class="lovhead"')
      const hasBody = h.includes('class="body"')
      console.log(
        `${d.document_number} | wrapper=${hasLegalDoc ? 'legal-document' : 'sfs'} lovhead=${hasLovhead} body=${hasBody} | updated=${d.updated_at.toISOString().substring(0, 16)}`
      )
    }
  }

  // Show one of the "canonical" AFS docs to see what its structure actually looks like
  const sample = docs.find(
    (d) =>
      d.html_content?.includes('class="paragraph"') &&
      d.html_content?.includes('class="text"')
  )
  if (sample) {
    console.log(
      `\n=== Sample: ${sample.document_number} (first 1200 chars) ===`
    )
    console.log(sample.html_content?.substring(0, 1200))
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
