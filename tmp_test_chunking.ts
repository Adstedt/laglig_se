import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { syncDocumentChunks } from './lib/chunks/sync-document-chunks'

const prisma = new PrismaClient()

async function main() {
  // Test 1: Arbetsmiljölagen (SFS 1977:1160) — large chaptered law
  const target = 'SFS 1977:1160'
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: target },
    select: {
      id: true,
      title: true,
      document_number: true,
      content_type: true,
    },
  })

  if (!doc) {
    console.log(`Document ${target} not found`)
    return
  }

  console.log(`\n=== Testing: ${doc.title} (${doc.document_number}) ===`)
  console.log(`ID: ${doc.id}, Type: ${doc.content_type}`)

  const result = await syncDocumentChunks(doc.id)
  console.log(`\nResult:`)
  console.log(`  Chunks deleted: ${result.chunksDeleted}`)
  console.log(`  Chunks created: ${result.chunksCreated}`)
  console.log(`  Duration: ${result.duration}ms`)

  // Inspect a few chunks
  const samples = await prisma.contentChunk.findMany({
    where: { source_id: doc.id },
    select: {
      path: true,
      contextual_header: true,
      content_role: true,
      token_count: true,
      content: true,
    },
    orderBy: { path: 'asc' },
    take: 5,
  })

  console.log(`\nFirst 5 chunks:`)
  for (const c of samples) {
    console.log(`  [${c.path}] ${c.contextual_header}`)
    console.log(
      `    role=${c.content_role}, tokens=${c.token_count}, chars=${c.content.length}`
    )
    console.log(`    content: ${c.content.substring(0, 100)}...`)
    console.log()
  }

  // Summary stats
  const stats = await prisma.contentChunk.aggregate({
    where: { source_id: doc.id },
    _count: true,
    _avg: { token_count: true },
    _min: { token_count: true },
    _max: { token_count: true },
  })
  console.log(
    `Stats: count=${stats._count}, avg_tokens=${Math.round(stats._avg.token_count ?? 0)}, min=${stats._min.token_count}, max=${stats._max.token_count}`
  )

  // Also test with 4 more random docs
  const moreDocs = await prisma.legalDocument.findMany({
    where: { content_type: { in: ['SFS_LAW', 'AGENCY_REGULATION'] } },
    select: {
      id: true,
      title: true,
      document_number: true,
      content_type: true,
    },
    take: 4,
    skip: 100,
  })

  console.log(`\n=== Testing 4 more documents ===`)
  for (const d of moreDocs) {
    const r = await syncDocumentChunks(d.id)
    console.log(
      `  ${d.document_number} (${d.content_type}): ${r.chunksCreated} chunks in ${r.duration}ms`
    )
  }

  // Total chunks in DB now
  const total = await prisma.contentChunk.count()
  console.log(`\nTotal chunks in DB: ${total}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
