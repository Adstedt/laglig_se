import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Count section changes for SFS 1977:1160
  const changes = await prisma.sectionChange.findMany({
    where: {
      amendment: { base_law_sfs: 'SFS 1977:1160' },
    },
    select: { chapter: true, section: true },
  })
  console.log('Total SectionChange records for 1977:1160:', changes.length)

  // Group by chapter
  const byChapter: Record<string, number> = {}
  for (const c of changes) {
    const ch = c.chapter || 'null'
    byChapter[ch] = (byChapter[ch] || 0) + 1
  }
  console.log('By chapter:', JSON.stringify(byChapter, null, 2))

  // Check amendment parse status
  const amendments = await prisma.amendmentDocument.findMany({
    where: { base_law_sfs: 'SFS 1977:1160' },
    select: { sfs_number: true, parse_status: true, effective_date: true },
    orderBy: { effective_date: 'desc' },
  })
  console.log('\nAmendment parse status:')
  for (const a of amendments) {
    const date = a.effective_date?.toISOString().split('T')[0] || 'no date'
    console.log(`  ${a.sfs_number} (${date}): ${a.parse_status}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
