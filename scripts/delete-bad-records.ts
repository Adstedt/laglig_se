import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Delete bad records with double SFS
  const deleted = await prisma.legalDocument.deleteMany({
    where: {
      document_number: { startsWith: 'SFS SFS' }
    }
  })
  console.log('Deleted bad records:', deleted.count)
}

main().catch(console.error).finally(() => prisma.$disconnect())
