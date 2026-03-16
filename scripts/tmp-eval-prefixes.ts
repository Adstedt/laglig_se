import { config } from 'dotenv'
config({ path: '.env.local' })
import { prisma } from '../lib/prisma'

async function main() {
  // Get all chunks with prefixes, grouped by document
  const chunks = await prisma.$queryRaw<
    Array<{
      document_number: string
      title: string
      path: string
      context_prefix: string
      contextual_header: string
      content: string
    }>
  >`
    SELECT ld.document_number, ld.title, cc.path,
           cc.context_prefix, cc.contextual_header,
           LEFT(cc.content, 150) as content
    FROM content_chunks cc
    JOIN legal_documents ld ON cc.source_id = ld.id
    WHERE cc.context_prefix IS NOT NULL
    ORDER BY ld.document_number, cc.path
  `

  let currentDoc = ''
  for (const c of chunks) {
    if (c.document_number !== currentDoc) {
      currentDoc = c.document_number
      console.log(`\n${'='.repeat(70)}`)
      console.log(`${c.title} (${c.document_number})`)
      console.log('='.repeat(70))
    }
    console.log(`\n  [${c.path}]`)
    console.log(`  Header:  ${c.contextual_header}`)
    console.log(`  Prefix:  ${c.context_prefix}`)
    console.log(`  Content: ${c.content}...`)
  }

  console.log(`\n\nTotal: ${chunks.length} chunks with prefixes`)
  await prisma.$disconnect()
}
main()
