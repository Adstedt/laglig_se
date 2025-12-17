import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const sfs = process.argv[2] || 'SFS 2024:4'

async function main() {
  // Delete if exists
  const existing = await prisma.amendmentDocument.findUnique({
    where: { sfs_number: sfs },
  })

  if (existing) {
    await prisma.sectionChange.deleteMany({
      where: { amendment_id: existing.id },
    })
    await prisma.amendmentDocument.delete({
      where: { sfs_number: sfs },
    })
    console.log('Deleted existing:', sfs)
  }

  await prisma.$disconnect()
  console.log(
    'Now run: pnpm tsx scripts/ingest-amendments.ts --year 2024 --limit 10'
  )
}
main()
