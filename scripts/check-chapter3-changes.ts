import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Get section changes for chapter 3
  const changes = await prisma.sectionChange.findMany({
    where: {
      chapter: '3',
      amendment: { base_law_sfs: 'SFS 1977:1160' },
    },
    include: {
      amendment: {
        select: { sfs_number: true, effective_date: true },
      },
    },
    orderBy: [{ section: 'asc' }, { amendment: { effective_date: 'asc' } }],
  })

  console.log('Chapter 3 section changes for Arbetsmiljölag (1977:1160):')
  console.log('Total:', changes.length)
  console.log('')

  // Group by section
  const bySection = new Map<string, typeof changes>()
  for (const c of changes) {
    const key = c.section
    if (!bySection.has(key)) {
      bySection.set(key, [])
    }
    bySection.get(key)!.push(c)
  }

  for (const [section, sectionChanges] of bySection) {
    console.log(
      `\n--- 3 kap. ${section} § (${sectionChanges.length} changes) ---`
    )
    for (const c of sectionChanges) {
      const date =
        c.amendment.effective_date?.toISOString().split('T')[0] || 'no date'
      const textPreview =
        c.new_text?.substring(0, 80).replace(/\n/g, ' ') || '[no text]'
      console.log(`  ${date} (${c.amendment.sfs_number}): ${c.change_type}`)
      console.log(`    "${textPreview}..."`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
