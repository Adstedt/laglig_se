/**
 * Verify that the diff API correctly reflects actual database content
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Verifying Diff Accuracy for SFS 1977:1160 ===\n')

  // 1. Get the base law
  const law = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1977:1160' },
    select: { id: true, document_number: true, title: true },
  })

  if (!law) {
    console.log('Law not found')
    return
  }

  console.log(`Base Law: ${law.document_number} - ${law.title}\n`)

  // 2. Get all amendments to this law
  const amendments = await prisma.amendment.findMany({
    where: { base_document_id: law.id },
    include: {
      amending_document: {
        select: { document_number: true },
      },
    },
    orderBy: { effective_date: 'asc' },
  })

  console.log(`Total amendments in DB: ${amendments.length}\n`)

  // 3. Get section changes for chapter 3 via AmendmentDocument
  const sectionChanges = await prisma.sectionChange.findMany({
    where: {
      chapter: '3',
      amendment: {
        base_law_sfs: '1977:1160',
      },
    },
    include: {
      amendment: true,
    },
    orderBy: {
      amendment: { effective_date: 'asc' },
    },
  })

  console.log(`Section changes in Chapter 3: ${sectionChanges.length}\n`)

  // Group by section
  const bySectionMap = new Map<string, typeof sectionChanges>()
  for (const sc of sectionChanges) {
    const key = sc.section
    if (!bySectionMap.has(key)) {
      bySectionMap.set(key, [])
    }
    bySectionMap.get(key)!.push(sc)
  }

  // Show changes for sections 2, 3, 3a
  for (const sec of ['2', '3', '3a']) {
    const changes = bySectionMap.get(sec) || []
    console.log(`--- 3 kap. ${sec} § (${changes.length} changes in DB) ---`)
    for (const c of changes.slice(0, 5)) {
      const date = c.amendment.effective_date?.toISOString().split('T')[0]
      const sfs = c.amendment.sfs_number
      console.log(`  ${date}: ${c.change_type} (SFS ${sfs})`)
      if (c.new_text) {
        console.log(`    New text: ${c.new_text.substring(0, 100)}...`)
      }
    }
    if (changes.length > 5) {
      console.log(`  ... and ${changes.length - 5} more changes`)
    }
    console.log('')
  }

  // 4. Check current LawSection content
  console.log('=== Current LawSection content ===\n')
  const lawSections = await prisma.lawSection.findMany({
    where: {
      legal_document_id: law.id,
      chapter: '3',
      section: { in: ['2', '3', '3a'] },
    },
    select: {
      chapter: true,
      section: true,
      text_content: true,
    },
  })

  for (const ls of lawSections) {
    console.log(`--- 3 kap. ${ls.section} § (current) ---`)
    console.log(ls.text_content.substring(0, 300) + '...\n')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
