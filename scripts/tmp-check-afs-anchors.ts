import { prisma } from '../lib/prisma'

async function main() {
  // Check what AFS doc looks like
  const doc = await prisma.legalDocument.findFirst({
    where: { slug: 'afs-2023-10-kap-11' },
    select: { html_content: true, document_number: true, slug: true },
  })

  if (!doc) {
    console.log('Doc not found, checking similar slugs...')
    const similar = await prisma.legalDocument.findMany({
      where: { slug: { contains: 'afs-2023-10' } },
      select: { slug: true, document_number: true },
    })
    console.log('Similar:', similar)
    await prisma.$disconnect()
    return
  }

  console.log('doc_num:', doc.document_number)
  console.log('slug:', doc.slug)

  const html = doc.html_content || ''
  const ids = [...html.matchAll(/id="([^"]+)"/g)]
  console.log(`\nAll id= attributes (${ids.length}):`)
  for (const m of ids.slice(0, 30)) {
    console.log(' ', m[1])
  }

  // Also check the chunk anchorIds
  const chunks = await prisma.contentChunk.findMany({
    where: { source_id: { in: [doc.slug] } },
    select: { metadata: true, path: true },
    take: 5,
  })

  // Actually need source_id from the legalDocument id
  const fullDoc = await prisma.legalDocument.findFirst({
    where: { slug: 'afs-2023-10-kap-11' },
    select: { id: true },
  })

  if (fullDoc) {
    const chunksBySource = await prisma.contentChunk.findMany({
      where: { source_id: fullDoc.id },
      select: { metadata: true, path: true },
      take: 10,
    })
    console.log('\nChunk anchorIds:')
    for (const c of chunksBySource) {
      const meta = c.metadata as Record<string, unknown> | null
      if (meta?.anchorId) {
        console.log(`  path=${c.path}  anchorId=${meta.anchorId}`)
      }
    }
  }

  await prisma.$disconnect()
}
main()
