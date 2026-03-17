import { prisma } from '../lib/prisma'

async function main() {
  const chunks = await prisma.contentChunk.findMany({
    where: { NOT: { metadata: { equals: null } } },
    select: { metadata: true, path: true, source_id: true },
    take: 3000,
  })

  const bySlug = new Map<string, Array<Record<string, unknown>>>()
  for (const c of chunks) {
    const meta = c.metadata as Record<string, unknown> | null
    if (!meta?.anchorId || !meta?.slug) continue
    const slug = meta.slug as string
    if (!bySlug.has(slug)) bySlug.set(slug, [])
    bySlug.get(slug)!.push(meta)
  }

  for (const [slug, metas] of bySlug) {
    const ct = metas[0]!.contentType as string
    const prefix = ct === 'SFS_LAW' ? '/browse/lagar/' : '/browse/foreskrifter/'
    // pick first, a middle one, and a deep one
    const indices = new Set([
      0,
      Math.floor(metas.length / 4),
      Math.floor(metas.length / 2),
      Math.floor((3 * metas.length) / 4),
      metas.length - 1,
    ])
    console.log(`\n${slug} (${metas.length} paragraphs with anchorId):`)
    for (const i of indices) {
      const m = metas[i]!
      console.log(`  http://localhost:3000${prefix}${slug}#${m.anchorId}`)
    }
  }

  await prisma.$disconnect()
}
main()
