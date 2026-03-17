import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

// Pick 3 doc IDs from the batch
const docIds = [
  '0000135a-8db8-461f-aa69-381e8845dd90',
  '0035601e-5308-41c4-a452-4d86264eedc9',
  '00b456c7-d5c8-425c-a9d4-111333347c8a',
]

async function main() {
  for (const docId of docIds) {
    // Get doc title
    const doc = await p.legalDocument.findUnique({
      where: { id: docId },
      select: { title: true, document_number: true },
    })
    console.log(`\n${'='.repeat(80)}`)
    console.log(`DOC: ${doc?.title} (${doc?.document_number})`)
    console.log('='.repeat(80))

    // Get first 3 chunks with context_prefix
    const chunks = await p.contentChunk.findMany({
      where: { source_id: docId, context_prefix: { not: null } },
      select: { path: true, context_prefix: true, content: true },
      orderBy: { path: 'asc' },
      take: 3,
    })

    for (const c of chunks) {
      console.log(`\n--- ${c.path} ---`)
      console.log(`PREFIX: ${c.context_prefix}`)
      console.log(`CHUNK (first 200): ${c.content.substring(0, 200)}...`)
    }
  }

  await p.$disconnect()
}

main()
