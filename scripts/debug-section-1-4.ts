/**
 * Debug why section 1:4 appears unchanged despite having changes with text
 */
import { getLawVersionAtDate } from '../lib/legal-document/version-reconstruction'
import { areTextsSemanticallyEqual } from '../lib/legal-document/version-diff'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const baseLawSfs = 'SFS 1977:1160'

  console.log('=== Debugging Section 1 kap. 4 § ===\n')

  // Get all changes for this section
  const changes = await prisma.sectionChange.findMany({
    where: {
      chapter: '1',
      section: '4',
      amendment: { base_law_sfs: baseLawSfs },
    },
    include: {
      amendment: { select: { sfs_number: true, effective_date: true } },
    },
    orderBy: { amendment: { effective_date: 'desc' } },
  })

  console.log('All changes in DB:')
  for (const c of changes) {
    const date =
      c.amendment.effective_date?.toISOString().split('T')[0] || 'no date'
    const textPreview =
      c.new_text?.substring(0, 60).replace(/\n/g, ' ') || '[NO TEXT]'
    console.log(`  ${date} (${c.amendment.sfs_number}): ${c.change_type}`)
    console.log(`    "${textPreview}..."`)
  }

  // Get current LawSection
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: { contains: baseLawSfs } },
  })
  const currentSection = await prisma.lawSection.findFirst({
    where: { legal_document_id: doc?.id, chapter: '1', section: '4' },
  })
  console.log('\nCurrent LawSection text:')
  console.log(
    `  "${currentSection?.text_content.substring(0, 100).replace(/\n/g, ' ')}..."`
  )

  // Get versions at different dates
  const dateA = new Date('1977-01-01')
  const dateB = new Date('2028-07-01')

  const versionA = await getLawVersionAtDate(baseLawSfs, dateA)
  const versionB = await getLawVersionAtDate(baseLawSfs, dateB)

  const sec1_4_A = versionA?.sections.find(
    (s) => s.chapter === '1' && s.section === '4'
  )
  const sec1_4_B = versionB?.sections.find(
    (s) => s.chapter === '1' && s.section === '4'
  )

  console.log('\nVersion at 1977-01-01:')
  console.log(`  Source: ${JSON.stringify(sec1_4_A?.source)}`)
  console.log(
    `  Text: "${sec1_4_A?.textContent.substring(0, 100).replace(/\n/g, ' ')}..."`
  )

  console.log('\nVersion at 2028-07-01:')
  console.log(`  Source: ${JSON.stringify(sec1_4_B?.source)}`)
  console.log(
    `  Text: "${sec1_4_B?.textContent.substring(0, 100).replace(/\n/g, ' ')}..."`
  )

  // Check semantic equality
  if (sec1_4_A && sec1_4_B) {
    console.log(
      '\nSemantically equal?',
      areTextsSemanticallyEqual(sec1_4_A.textContent, sec1_4_B.textContent)
    )

    // Check raw equality
    console.log('Raw equal?', sec1_4_A.textContent === sec1_4_B.textContent)

    // Show diff in lengths
    console.log(`Text A length: ${sec1_4_A.textContent.length}`)
    console.log(`Text B length: ${sec1_4_B.textContent.length}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
