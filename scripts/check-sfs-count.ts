import { prisma } from '../lib/prisma'

async function main() {
  const sfsCount = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW' },
  })
  console.log('SFS_LAW count:', sfsCount)

  const total = await prisma.legalDocument.count()
  console.log('Total documents:', total)
  console.log('Non-SFS documents:', total - sfsCount)

  await prisma.$disconnect()
}

main()
