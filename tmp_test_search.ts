import { config } from 'dotenv'
config({ path: '.env.local' })
import { prisma } from './lib/prisma'
import { generateEmbedding, vectorToString } from './lib/chunks/embed-chunks'

async function main() {
  // Generate embedding for test query
  console.log('Embedding test query...')
  const start = Date.now()
  const { embedding } = await generateEmbedding(
    'semesterersättning vid uppsägning',
    '',
    ''
  )
  console.log(`Embed time: ${Date.now() - start}ms`)

  const vecStr = vectorToString(embedding)

  // Run search
  console.log('\nSearching 228K vectors...')
  const searchStart = Date.now()
  const results = await prisma.$queryRawUnsafe<any[]>(`
    SELECT id, contextual_header, LEFT(content, 100) as content,
           1 - (embedding <=> '${vecStr}'::vector) as similarity
    FROM content_chunks
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> '${vecStr}'::vector
    LIMIT 5
  `)
  const searchMs = Date.now() - searchStart
  console.log(`Search time: ${searchMs}ms`)

  console.log('\nTop 5 results:')
  results.forEach((r, i) => {
    console.log(
      `  ${i + 1}. [${Number(r.similarity).toFixed(4)}] ${r.contextual_header}`
    )
    console.log(`     ${r.content}...`)
  })

  await prisma.$disconnect()
}

main()
