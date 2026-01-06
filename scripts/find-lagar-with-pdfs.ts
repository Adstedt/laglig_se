import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Get amendments with PDFs that are lagar (parse_status indicates PDF was processed)
  const amendments = await prisma.amendmentDocument.findMany({
    where: {
      OR: [
        { title: { contains: 'Lag (' } },
        { title: { contains: 'Lag om' } },
      ],
      parse_status: 'COMPLETED' // This means PDF exists and was downloaded
    },
    select: {
      sfs_number: true,
      title: true,
    },
    orderBy: { sfs_number: 'desc' },
    take: 20
  })

  console.log('Lagar with parse_status=COMPLETED (have PDFs):')
  for (const a of amendments) {
    console.log(`  ${a.sfs_number}: ${a.title?.substring(0, 50)}`)
  }

  // Count by year
  const allWithPdf = await prisma.amendmentDocument.findMany({
    where: {
      OR: [
        { title: { contains: 'Lag (' } },
        { title: { contains: 'Lag om' } },
      ],
      parse_status: 'COMPLETED'
    },
    select: { sfs_number: true }
  })

  const byYear: Record<string, number> = {}
  for (const a of allWithPdf) {
    const year = a.sfs_number.split(':')[0]
    byYear[year] = (byYear[year] || 0) + 1
  }

  console.log('\nLagar with PDFs by year:')
  Object.entries(byYear).sort((a, b) => b[0].localeCompare(a[0])).forEach(([year, count]) => {
    console.log(`  ${year}: ${count}`)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
