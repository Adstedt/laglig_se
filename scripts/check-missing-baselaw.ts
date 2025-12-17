/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function main() {
  const missing = await prisma.amendmentDocument.findMany({
    where: {
      parse_error: { contains: 'Missing required field: baseLaw.sfsNumber' },
    },
    select: { sfs_number: true, title: true },
    take: 15,
  })
  console.log('Amendments with "Missing baseLaw.sfsNumber" error:\n')
  for (const m of missing) {
    console.log(`${m.sfs_number}: ${m.title}`)
  }
  await prisma.$disconnect()
}

main()
