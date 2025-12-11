import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const sfsNumber = process.argv[2]
  if (!sfsNumber) {
    console.log('Usage: pnpm tsx scripts/delete-amendment.ts 2025:1')
    process.exit(1)
  }

  const deleted = await prisma.sectionChange.deleteMany({
    where: { amendment: { sfs_number: sfsNumber } },
  })
  console.log(`Deleted ${deleted.count} section changes`)

  const doc = await prisma.amendmentDocument.deleteMany({
    where: { sfs_number: sfsNumber },
  })
  console.log(`Deleted ${doc.count} amendment document`)

  await prisma.$disconnect()
}

main().catch(console.error)
