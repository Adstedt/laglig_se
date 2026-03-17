import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRawUnsafe('SET statement_timeout = 300000')

  // Use raw SQL with timeout override — get 20 chunks with prefixes
  const samples = await prisma.$queryRaw<
    {
      id: string
      source_id: string
      path: string
      context_prefix: string
      content: string
    }[]
  >`
    SELECT id, source_id, path, context_prefix, LEFT(content, 200) as content
    FROM content_chunks
    WHERE context_prefix IS NOT NULL
    ORDER BY id ASC
    LIMIT 20
  `

  // Group by source_id
  const byDoc = new Map<string, typeof samples>()
  for (const s of samples) {
    if (!byDoc.has(s.source_id)) byDoc.set(s.source_id, [])
    byDoc.get(s.source_id)!.push(s)
  }

  let docCount = 0
  for (const [sourceId, chunks] of byDoc) {
    if (docCount >= 5) break
    docCount++

    const doc = await prisma.legalDocument.findUnique({
      where: { id: sourceId },
      select: { title: true, document_number: true },
    })
    if (!doc) continue

    console.log(`\n${'='.repeat(80)}`)
    console.log(`DOC: ${doc.title} (${doc.document_number})`)
    console.log(`${'='.repeat(80)}`)

    for (const chunk of chunks.slice(0, 2)) {
      const prefix = chunk.context_prefix || ''
      console.log(`\n  PATH: ${chunk.path}`)
      console.log(`  PREFIX: ${prefix}`)
      console.log(`  CONTENT: ${chunk.content}...`)

      const titleWords = (doc.title || '')
        .split(/\s+/)
        .filter((w) => w.length > 3)
      const mentionsTitle = titleWords.some((w) =>
        prefix.toLowerCase().includes(w.toLowerCase())
      )
      const mentionsNumber = doc.document_number
        ? prefix.includes(doc.document_number)
        : false
      console.log(`  MATCH: title=${mentionsTitle} | docNum=${mentionsNumber}`)
    }
  }

  // Count
  const counts = await prisma.$queryRaw<
    { with_prefix: number; total: number }[]
  >`
    SELECT
      COUNT(*) FILTER (WHERE context_prefix IS NOT NULL)::int as with_prefix,
      COUNT(*)::int as total
    FROM content_chunks
  `
  const c = counts[0]
  console.log(
    `\nSUMMARY: ${c.with_prefix}/${c.total} chunks have prefix (${((c.with_prefix / c.total) * 100).toFixed(1)}%)`
  )

  await prisma.$disconnect()
}

main()
