import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const failed = await prisma.amendmentDocument.findMany({
    where: {
      sfs_number: { startsWith: '2026:' },
      parse_status: 'FAILED',
    },
    select: {
      sfs_number: true,
      parse_error: true,
      storage_path: true,
      title: true,
    },
    orderBy: { sfs_number: 'asc' },
  })

  // Group by error pattern
  const errorPatterns: Record<string, string[]> = {}
  for (const f of failed) {
    const pattern = f.parse_error?.slice(0, 80) ?? 'null'
    if (!errorPatterns[pattern]) errorPatterns[pattern] = []
    errorPatterns[pattern].push(f.sfs_number)
  }

  console.log('Failed amendments by error pattern:\n')
  for (const [pattern, sfsList] of Object.entries(errorPatterns)) {
    console.log(`  "${pattern}"`)
    console.log(`    Count: ${sfsList.length}`)
    console.log(
      `    SFS: ${sfsList.slice(0, 5).join(', ')}${sfsList.length > 5 ? '...' : ''}`
    )
    console.log()
  }

  // Check storage paths
  const withStorage = failed.filter(
    (f) => f.storage_path && f.storage_path.length > 0
  ).length
  const withoutStorage = failed.length - withStorage
  console.log(`Have storage_path: ${withStorage}`)
  console.log(`No storage_path: ${withoutStorage}`)

  await prisma.$disconnect()
}

main()
