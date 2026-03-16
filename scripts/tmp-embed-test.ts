import { config } from 'dotenv'
config({ path: '.env.local' })
import { prisma } from '../lib/prisma'
import {
  generateEmbeddingsBatch,
  vectorToString,
  buildEmbeddingInput,
} from '../lib/chunks/embed-chunks'

async function main() {
  // Only embed chunks that already have a context_prefix (our 15 test chunks)
  const chunks = await prisma.$queryRaw<
    Array<{
      id: string
      path: string
      content: string
      context_prefix: string | null
      contextual_header: string
      token_count: number
    }>
  >`
    SELECT id, path, content, context_prefix, contextual_header, token_count
    FROM content_chunks
    WHERE context_prefix IS NOT NULL
    ORDER BY id ASC
  `

  console.log(`Found ${chunks.length} chunks with prefixes to embed`)

  // Show what we're embedding
  for (const c of chunks) {
    const input = buildEmbeddingInput(
      c.content,
      c.context_prefix ?? '',
      c.contextual_header
    )
    console.log(
      `  ${c.path}: ${c.token_count} tokens, input ${input.length} chars`
    )
  }

  // Embed in batches of 100
  const items = chunks.map((c) => ({
    text: c.content,
    contextPrefix: c.context_prefix ?? '',
    contextualHeader: c.contextual_header,
  }))

  let totalTokens = 0
  for (let start = 0; start < items.length; start += 100) {
    const batch = items.slice(start, start + 100)
    console.log(`\nCalling OpenAI batch ${start}-${start + batch.length}...`)
    const result = await generateEmbeddingsBatch(batch)
    totalTokens += result.totalTokensUsed
    console.log(
      `Got ${result.embeddings.length} embeddings, ${result.totalTokensUsed} tokens used`
    )

    for (let j = 0; j < batch.length; j++) {
      const chunk = chunks[start + j]!
      const embedding = result.embeddings[j]!
      await prisma.$executeRaw`
        UPDATE content_chunks
        SET embedding = ${vectorToString(embedding)}::vector
        WHERE id = ${chunk.id}
      `
    }
  }
  console.log(`Total tokens: ${totalTokens}`)

  console.log(`Wrote ${chunks.length} embeddings to DB`)

  // Verify
  const withEmbed = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM content_chunks WHERE embedding IS NOT NULL
  `
  console.log(`Total chunks with embeddings: ${Number(withEmbed[0]?.count)}`)

  await prisma.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
