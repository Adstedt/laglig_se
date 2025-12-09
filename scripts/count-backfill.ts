import { prisma } from '../lib/prisma'

async function count() {
  const [versions, amendments] = await Promise.all([
    prisma.documentVersion.count(),
    prisma.amendment.count()
  ])
  console.log('Versions:', versions)
  console.log('Amendments:', amendments)
  await prisma.$disconnect()
}

count()
