/**
 * Check why many SectionChanges have null new_text
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== SectionChange Text Analysis ===\n')

  // Overall stats
  const total = await prisma.sectionChange.count()
  const withText = await prisma.sectionChange.count({
    where: { new_text: { not: null } },
  })
  const withoutText = await prisma.sectionChange.count({
    where: { new_text: null },
  })

  console.log('Overall stats:')
  console.log(`  Total: ${total}`)
  console.log(
    `  With text: ${withText} (${((withText / total) * 100).toFixed(1)}%)`
  )
  console.log(
    `  Without text: ${withoutText} (${((withoutText / total) * 100).toFixed(1)}%)`
  )

  // By change type
  console.log('\nBy change type:')
  const byType = await prisma.sectionChange.groupBy({
    by: ['change_type'],
    _count: true,
  })

  for (const t of byType) {
    const withTextCount = await prisma.sectionChange.count({
      where: { change_type: t.change_type, new_text: { not: null } },
    })
    console.log(
      `  ${t.change_type}: ${t._count} total, ${withTextCount} with text (${((withTextCount / t._count) * 100).toFixed(1)}%)`
    )
  }

  // Check amendments with most missing text (for 1977:1160)
  console.log('\nAmendments for 1977:1160 by text coverage:')
  const amendments = await prisma.amendmentDocument.findMany({
    where: { base_law_sfs: 'SFS 1977:1160' },
    include: {
      section_changes: {
        select: { new_text: true, change_type: true },
      },
    },
    orderBy: { effective_date: 'asc' },
  })

  for (const a of amendments) {
    const total = a.section_changes.length
    const withText = a.section_changes.filter((c) => c.new_text !== null).length
    const date = a.effective_date?.toISOString().split('T')[0] || 'no date'
    const pct = total > 0 ? ((withText / total) * 100).toFixed(0) : 'N/A'
    console.log(
      `  ${a.sfs_number} (${date}): ${withText}/${total} have text (${pct}%)`
    )
  }

  // Check if early amendments (pre-2008) have less text
  console.log('\nText coverage by year range:')
  const yearRanges = [
    {
      label: '1990-2000',
      start: new Date('1990-01-01'),
      end: new Date('2001-01-01'),
    },
    {
      label: '2001-2005',
      start: new Date('2001-01-01'),
      end: new Date('2006-01-01'),
    },
    {
      label: '2006-2010',
      start: new Date('2006-01-01'),
      end: new Date('2011-01-01'),
    },
    {
      label: '2011-2020',
      start: new Date('2011-01-01'),
      end: new Date('2021-01-01'),
    },
    {
      label: '2021-2025',
      start: new Date('2021-01-01'),
      end: new Date('2026-01-01'),
    },
  ]

  for (const range of yearRanges) {
    const total = await prisma.sectionChange.count({
      where: {
        amendment: {
          effective_date: { gte: range.start, lt: range.end },
        },
      },
    })
    const withText = await prisma.sectionChange.count({
      where: {
        new_text: { not: null },
        amendment: {
          effective_date: { gte: range.start, lt: range.end },
        },
      },
    })
    const pct = total > 0 ? ((withText / total) * 100).toFixed(1) : 'N/A'
    console.log(`  ${range.label}: ${withText}/${total} have text (${pct}%)`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
