/**
 * Show raw text from database to see line break issues
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get specific section changes that we know have issues
  const changes = await prisma.sectionChange.findMany({
    where: {
      amendment: { base_law_sfs: 'SFS 1977:1160' },
      new_text: { not: null },
    },
    include: { amendment: { select: { sfs_number: true } } },
    orderBy: { amendment: { effective_date: 'desc' } },
    take: 3,
  })

  for (const c of changes) {
    console.log('='.repeat(70))
    console.log(`Amendment: ${c.amendment.sfs_number}`)
    console.log(
      `Section: ${c.chapter ? c.chapter + ' kap. ' : ''}${c.section} §`
    )
    console.log(`Change type: ${c.change_type}`)
    console.log('')
    console.log('RAW TEXT (with visible newlines):')
    console.log('---')
    // Show newlines explicitly
    const rawDisplay = c.new_text!.replace(/\n/g, '↵\n') // Show newlines as ↵ symbol
    console.log(rawDisplay)
    console.log('---')
    console.log('')
  }

  // Also show a LawSection current text
  console.log('='.repeat(70))
  console.log('CURRENT LAW SECTION TEXT (from LawSection table):')
  console.log('='.repeat(70))

  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: { contains: 'SFS 1977:1160' } },
  })

  if (doc) {
    const section = await prisma.lawSection.findFirst({
      where: { legal_document_id: doc.id, chapter: '3', section: '9' },
    })

    if (section) {
      console.log(`Section: ${section.chapter} kap. ${section.section} §`)
      console.log('')
      console.log('RAW TEXT (with visible newlines):')
      console.log('---')
      const rawDisplay = section.text_content.replace(/\n/g, '↵\n')
      console.log(rawDisplay)
      console.log('---')
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
