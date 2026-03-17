import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { normalizeSfsLaw } from '../lib/transforms/normalizers/sfs-law-normalizer'

const prisma = new PrismaClient()

async function main() {
  // Fetch one of the 47 broken docs
  const doc = await prisma.legalDocument.findFirst({
    where: {
      content_type: 'SFS_LAW',
      document_number: 'SFS 2020:1010',
    },
    select: {
      id: true,
      document_number: true,
      title: true,
      html_content: true,
    },
  })

  if (!doc || !doc.html_content) {
    console.log('Doc not found')
    return
  }

  console.log('=== BEFORE (first 800 chars) ===')
  console.log(doc.html_content.substring(0, 800))

  const normalized = normalizeSfsLaw(doc.html_content, {
    documentNumber: doc.document_number,
    title: doc.title,
  })

  console.log('\n=== AFTER (first 1200 chars) ===')
  console.log(normalized.substring(0, 1200))

  // Check for canonical markers
  const hasWrapper = normalized.includes('article class="legal-document"')
  const hasParagraph = normalized.includes('class="paragraph"')
  const hasParagraf = normalized.includes('class="paragraf"')
  const hasOldBold = normalized.includes('<b>') && normalized.includes('§</b>')

  console.log('\n=== MARKERS ===')
  console.log(`  article.legal-document: ${hasWrapper}`)
  console.log(`  h3.paragraph: ${hasParagraph}`)
  console.log(`  a.paragraf: ${hasParagraf}`)
  console.log(`  old <b>§</b>: ${hasOldBold}`)
  console.log(`  length: ${doc.html_content.length} → ${normalized.length}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
