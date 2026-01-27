import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const total = await prisma.legalDocument.count()
  const amendments = await prisma.legalDocument.count({
    where: { content_type: 'SFS_AMENDMENT' },
  })
  const withHtml = await prisma.legalDocument.count({
    where: { content_type: 'SFS_AMENDMENT', html_content: { not: null } },
  })

  console.log('Total legal_documents:', total)
  console.log('SFS_AMENDMENT count:', amendments)
  console.log('With html_content:', withHtml)

  const recent = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_AMENDMENT' },
    orderBy: { created_at: 'desc' },
    take: 5,
    select: { document_number: true, created_at: true },
  })
  console.log('\nMost recent amendments:')
  recent.forEach((r) => console.log(r.document_number, '-', r.created_at))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
