import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const year = process.argv[2] || '2025'

  const deleted = await prisma.sectionChange.deleteMany({
    where: { amendment: { sfs_number: { startsWith: `${year}:` } } },
  })
  console.log('Deleted', deleted.count, 'section changes')

  const docs = await prisma.amendmentDocument.deleteMany({
    where: { sfs_number: { startsWith: `${year}:` } },
  })
  console.log('Deleted', docs.count, 'amendment documents')

  await prisma.$disconnect()
}

main().catch(console.error)
