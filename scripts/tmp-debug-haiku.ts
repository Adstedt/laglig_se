import { config } from 'dotenv'
config({ path: '.env.local' })
import { prisma } from '../lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

async function main() {
  const client = new Anthropic()

  // Get first doc with chunks
  const doc = await prisma.legalDocument.findFirst({
    where: { id: '0000135a-8db8-461f-aa69-381e8845dd90' },
    select: {
      id: true,
      title: true,
      document_number: true,
      markdown_content: true,
    },
  })
  if (!doc || !doc.markdown_content) {
    console.log('No doc')
    return
  }

  const chunks = await prisma.contentChunk.findMany({
    where: { source_id: doc.id },
    select: { path: true, content: true },
    orderBy: { id: 'asc' },
    take: 5,
  })

  console.log(`Doc: ${doc.title} (${doc.document_number})`)
  console.log(`Chunk paths: ${chunks.map((c) => c.path).join(', ')}`)
  console.log(`Markdown length: ${doc.markdown_content.length} chars`)

  const chunkList = chunks
    .map((c) => `[${c.path}]: ${c.content.substring(0, 200)}...`)
    .join('\n')

  const prompt = `Here is a Swedish legal document "${doc.title}" (${doc.document_number}) in markdown format:

<document>
${doc.markdown_content.substring(0, 50000)}
</document>

Below are ${chunks.length} chunks extracted from this document. For each chunk, write a short context (1-2 sentences, 50-100 tokens in Swedish) that situates the chunk within the overall document. The context should help a search engine understand what the chunk is about without reading the full document.

Respond ONLY with valid JSON: { "prefixes": { "<path>": "<context>", ... } }

Chunks:
${chunkList}`

  console.log('\nCalling Haiku...')
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content.find((b) => b.type === 'text')
  console.log('\n=== RAW RESPONSE ===')
  console.log(text?.type === 'text' ? text.text : 'No text block')

  await prisma.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
