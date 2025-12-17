import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const amendments = await prisma.amendmentDocument.findMany({
    where: { base_law_sfs: 'SFS 1977:1160' },
    select: { sfs_number: true, storage_path: true, original_url: true },
    orderBy: { effective_date: 'desc' },
    take: 15,
  })

  console.log('Sample PDF storage paths from our database:\n')
  for (const a of amendments) {
    console.log(a.sfs_number)
    console.log('  storage_path:', a.storage_path || 'NULL')
    console.log('  original_url:', a.original_url || 'NULL')
    console.log()
  }

  // Count how many have storage paths
  const withStorage = await prisma.amendmentDocument.count({
    where: { storage_path: { not: null } },
  })
  const total = await prisma.amendmentDocument.count()

  console.log('=== Summary ===')
  console.log('Amendments with storage_path:', withStorage)
  console.log('Total amendments:', total)
  console.log('Coverage:', ((withStorage / total) * 100).toFixed(1) + '%')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
