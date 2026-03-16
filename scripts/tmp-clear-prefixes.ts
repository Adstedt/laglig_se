import { config } from 'dotenv'
config({ path: '.env.local' })
import { prisma } from '../lib/prisma'

async function main() {
  const before = await prisma.contentChunk.count({
    where: { context_prefix: { not: null } },
  })
  console.log(`Before: ${before} chunks with prefix`)

  if (before > 0) {
    const result = await prisma.contentChunk.updateMany({
      where: { context_prefix: { not: null } },
      data: { context_prefix: null },
    })
    console.log(`Cleared ${result.count} prefixes`)
  }

  const after = await prisma.contentChunk.count({
    where: { context_prefix: { not: null } },
  })
  console.log(`After: ${after} chunks with prefix`)

  await prisma.$disconnect()
}
main()
