import { PrismaClient } from '@prisma/client'
import { parseAmendmentStructure } from '../lib/sfs/parse-amendment-structure'

const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.amendmentDocument.findFirst({
    where: { sfs_number: '2025:1461' },
    select: { full_text: true }
  })

  if (!doc?.full_text) {
    console.log('Document not found')
    return
  }

  // Find section 36 in raw text
  const idx36 = doc.full_text.indexOf('36 §')
  if (idx36 > 0) {
    console.log('=== RAW TEXT AROUND 36 § ===')
    console.log(doc.full_text.slice(idx36, idx36 + 1200))
    console.log('')
  }

  // Parse the document and find section 36
  const parsed = parseAmendmentStructure(doc.full_text)
  if (parsed) {
    const section36 = parsed.sections.find(s => s.sectionNumber === '36 §')
    if (section36) {
      console.log('=== PARSED SECTION 36 ===')
      console.log('Lead text:', section36.leadText)
      console.log('Items:')
      section36.items.forEach((item, i) => {
        console.log(`  ${item.marker} ${item.text.substring(0, 80)}...`)
      })
    } else {
      console.log('Section 36 not found in parsed structure')
      console.log('Available sections:', parsed.sections.map(s => s.sectionNumber).join(', '))
    }
  }

  await prisma.$disconnect()
}

main().catch(console.error)
