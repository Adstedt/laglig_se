import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Count section changes with and without text for 1977:1160
  const withText = await prisma.sectionChange.count({
    where: {
      amendment: { base_law_sfs: 'SFS 1977:1160' },
      new_text: { not: null },
    },
  })

  const withoutText = await prisma.sectionChange.count({
    where: {
      amendment: { base_law_sfs: 'SFS 1977:1160' },
      new_text: null,
    },
  })

  console.log('=== SFS 1977:1160 Text Coverage ===')
  console.log(`With text: ${withText}`)
  console.log(`Without text: ${withoutText}`)
  console.log(`Total: ${withText + withoutText}`)
  console.log(
    `Coverage: ${((withText / (withText + withoutText)) * 100).toFixed(1)}%`
  )

  // Show which amendments have missing text
  console.log('\n=== Amendments with missing section text ===')

  const amendments = await prisma.amendmentDocument.findMany({
    where: {
      base_law_sfs: 'SFS 1977:1160',
      section_changes: { some: { new_text: null } },
    },
    select: {
      sfs_number: true,
      effective_date: true,
      _count: {
        select: {
          section_changes: true,
        },
      },
      section_changes: {
        where: { new_text: null },
        select: { chapter: true, section: true },
      },
    },
    orderBy: { effective_date: 'asc' },
  })

  for (const a of amendments) {
    const missingSections = a.section_changes
      .map((s) => `${s.chapter || ''} kap. ${s.section} §`)
      .join(', ')
    console.log(
      `\n${a.sfs_number} (${a.effective_date?.toISOString().split('T')[0] || 'no date'}):`
    )
    console.log(`  Missing text for: ${missingSections}`)
  }

  // Overall stats
  console.log('\n=== Overall Database Stats ===')

  const totalWithText = await prisma.sectionChange.count({
    where: { new_text: { not: null } },
  })

  const totalWithoutText = await prisma.sectionChange.count({
    where: { new_text: null },
  })

  console.log(`Total with text: ${totalWithText}`)
  console.log(`Total without text: ${totalWithoutText}`)
  console.log(
    `Overall coverage: ${((totalWithText / (totalWithText + totalWithoutText)) * 100).toFixed(1)}%`
  )
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
