import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const amendments = await prisma.amendmentDocument.findMany({
    where: { parse_status: 'COMPLETED' },
    select: { sfs_number: true, storage_path: true },
    orderBy: { sfs_number: 'asc' }
  })

  const noStorage = amendments.filter(a => !a.storage_path)
  console.log('Total amendments:', amendments.length)
  console.log('Without storage_path:', noStorage.length)

  if (noStorage.length > 0) {
    console.log('\nSample without storage_path:')
    noStorage.slice(0, 20).forEach(a => console.log(' ', a.sfs_number))
  }

  // Check if we have storage but maybe download fails
  const withStorage = amendments.filter(a => a.storage_path)
  console.log('\nWith storage_path:', withStorage.length)

  await prisma.$disconnect()
}
main()
