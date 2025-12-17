/**
 * Check all amendments for a specific section to understand history
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Check 4 kap. 3 § of Arbetsmiljölagen
  console.log('=== Amendment history for 4 kap. 3 § (SFS 1977:1160) ===\n')

  const legalDoc = await prisma.legalDocument.findFirst({
    where: {
      document_number: { contains: '1977:1160' },
      content_type: 'SFS_LAW',
    },
    select: { id: true },
  })

  if (!legalDoc) {
    console.log('Legal document not found')
    return
  }

  // Get all section changes for this section
  const sectionChanges = await prisma.sectionChange.findMany({
    where: {
      amendment: { base_law_sfs: 'SFS 1977:1160' },
      chapter: '4',
      section: '3',
    },
    include: {
      amendment: {
        select: {
          sfs_number: true,
          effective_date: true,
          title: true,
        },
      },
    },
    orderBy: { amendment: { effective_date: 'asc' } },
  })

  console.log(`Found ${sectionChanges.length} amendments for 4 kap. 3 §:\n`)

  for (const change of sectionChanges) {
    const hasText = change.new_text !== null && change.new_text.length > 0
    console.log(
      `${change.amendment.sfs_number} (${change.amendment.effective_date?.toISOString().split('T')[0] || 'no date'})`
    )
    console.log(`  Change type: ${change.change_type}`)
    console.log(
      `  Has text: ${hasText ? 'YES (' + change.new_text!.length + ' chars)' : 'NO'}`
    )
    if (hasText) {
      console.log(`  Text preview: ${change.new_text!.substring(0, 100)}...`)
    }
    console.log()
  }

  // Check if there are older amendments for this law that we might be missing
  console.log('\n=== All amendments for this law by effective date ===')
  const allAmendments = await prisma.amendmentDocument.findMany({
    where: { base_law_sfs: 'SFS 1977:1160' },
    select: {
      sfs_number: true,
      effective_date: true,
      _count: { select: { section_changes: true } },
    },
    orderBy: { effective_date: 'asc' },
  })

  console.log(`Total amendments: ${allAmendments.length}\n`)

  const before2013 = allAmendments.filter(
    (a) => a.effective_date && a.effective_date < new Date('2013-01-01')
  )
  console.log('Amendments before 2013:')
  for (const a of before2013) {
    console.log(
      `  ${a.sfs_number} (${a.effective_date?.toISOString().split('T')[0]}) - ${a._count.section_changes} section changes`
    )
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
