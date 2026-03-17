import { config } from 'dotenv'
config({ path: '.env.local' })
import { prisma } from '../lib/prisma'

async function main() {
  const docs = await prisma.$queryRaw<
    Array<{
      document_number: string
      title: string
      chunk_count: bigint
    }>
  >`
    SELECT DISTINCT ld.document_number, ld.title, COUNT(cc.id) as chunk_count
    FROM content_chunks cc
    JOIN legal_documents ld ON cc.source_id = ld.id
    WHERE cc.embedding IS NOT NULL AND cc.context_prefix IS NOT NULL
    GROUP BY ld.document_number, ld.title
    ORDER BY ld.document_number
  `

  for (const d of docs) {
    console.log(`${d.document_number} (${d.chunk_count} chunks) — ${d.title}`)
  }

  await prisma.$disconnect()
}
main()
