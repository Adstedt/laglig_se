import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const count = await prisma.sectionChange.count()
  console.log('Total SectionChange records in DB:', count)

  // Get amendments for 1977:1160
  const amendments = await prisma.amendmentDocument.findMany({
    where: { base_law_sfs: '1977:1160' },
    select: { sfs_number: true, effective_date: true, parse_status: true },
    orderBy: { effective_date: 'desc' },
    take: 10,
  })

  console.log('\nAmendments for 1977:1160:')
  for (const a of amendments) {
    console.log(
      `  ${a.sfs_number} - ${a.effective_date?.toISOString().split('T')[0]} - ${a.parse_status}`
    )
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
