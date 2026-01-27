import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Total EU documents
  const euDocCount = await prisma.euDocument.count()
  console.log('Total EU Documents:', euDocCount)

  // EU Regulations
  const regCount = await prisma.legalDocument.count({
    where: { content_type: 'EU_REGULATION' },
  })
  console.log('EU Regulations:', regCount)

  // EU Directives
  const dirCount = await prisma.legalDocument.count({
    where: { content_type: 'EU_DIRECTIVE' },
  })
  console.log('EU Directives:', dirCount)

  await prisma.$disconnect()
}

main()
