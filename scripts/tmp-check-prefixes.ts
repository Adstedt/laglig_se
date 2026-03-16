import { config } from 'dotenv'
config({ path: '.env.local' })
import { prisma } from '../lib/prisma'

async function main() {
  // Check if any context_prefix was written
  const withPrefix = await prisma.contentChunk.findMany({
    where: { context_prefix: { not: null } },
    select: { id: true, path: true, context_prefix: true, source_id: true },
    take: 20,
  })
  console.log(`Chunks with context_prefix: ${withPrefix.length}`)
  for (const c of withPrefix) {
    console.log(`  ${c.path}: ${c.context_prefix?.substring(0, 100)}...`)
  }

  // Check first 5 docs' chunks
  const firstChunks = await prisma.contentChunk.findMany({
    where: { source_id: '0000135a-8db8-461f-aa69-381e8845dd90' },
    select: { path: true, context_prefix: true },
    orderBy: { path: 'asc' },
    take: 10,
  })
  console.log(`\nFirst doc chunks (SFS 2005:559):`)
  for (const c of firstChunks) {
    console.log(`  ${c.path}: prefix=${c.context_prefix ? 'YES' : 'NULL'}`)
  }

  await prisma.$disconnect()
}
main()
