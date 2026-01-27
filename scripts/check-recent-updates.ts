import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const docs = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_AMENDMENT', html_content: { not: null } },
    orderBy: { updated_at: 'desc' },
    select: { document_number: true, updated_at: true, title: true },
    take: 10,
  })
  console.log('Most recently updated SFS_AMENDMENT:')
  for (const d of docs) {
    console.log(
      `  ${d.document_number} - ${d.updated_at?.toISOString()} - ${d.title?.substring(0, 40)}`
    )
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
