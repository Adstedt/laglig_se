import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const samples = await prisma.amendmentDocument.findMany({
    where: { parse_status: 'COMPLETED' },
    select: { sfs_number: true, storage_path: true },
    orderBy: { sfs_number: 'desc' },
    take: 20
  })

  console.log('Recent amendments (sfs_number format):')
  samples.forEach(a => console.log(`"${a.sfs_number}" -> ${a.storage_path?.substring(0, 40) || 'NO PATH'}`))

  // Count by pattern
  const all = await prisma.amendmentDocument.findMany({
    where: { parse_status: 'COMPLETED' },
    select: { sfs_number: true }
  })

  const patterns: Record<string, number> = {}
  all.forEach(a => {
    const match = a.sfs_number.match(/^(\d{4}):/)
    if (match) {
      const year = match[1]
      patterns[year] = (patterns[year] || 0) + 1
    }
  })

  console.log('\nAmendments by year:')
  Object.entries(patterns)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 10)
    .forEach(([year, count]) => console.log(`  ${year}: ${count}`))

  await prisma.$disconnect()
}
main()
