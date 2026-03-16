/**
 * Re-sync all existing chunked documents to pick up metadata changes.
 * Usage: npx tsx scripts/tmp-resync-chunks.ts
 */

import { prisma } from '../lib/prisma'
import { syncDocumentChunks } from '../lib/chunks/sync-document-chunks'

async function main() {
  const rows = await prisma.contentChunk.groupBy({ by: ['source_id'] })
  console.log(`Documents to re-sync: ${rows.length}`)

  let totalCreated = 0
  let totalDeleted = 0

  for (const row of rows) {
    const result = await syncDocumentChunks(row.source_id)
    totalCreated += result.chunksCreated
    totalDeleted += result.chunksDeleted
    console.log(
      `  ${row.source_id.slice(0, 8)}... created=${result.chunksCreated} deleted=${result.chunksDeleted} (${result.duration}ms)`
    )
  }

  console.log(`\nTotal: deleted=${totalDeleted} created=${totalCreated}`)

  // Verify
  const total = await prisma.contentChunk.count()
  console.log(`Chunks in DB: ${total}`)

  // Sample a chunk to verify metadata shape
  const sample = await prisma.contentChunk.findFirst({
    where: { path: { startsWith: 'kap' } },
    select: { path: true, metadata: true },
  })
  console.log(`\nSample chunk metadata:`)
  console.log(JSON.stringify(sample, null, 2))

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
