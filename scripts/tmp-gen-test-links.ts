import { prisma } from '../lib/prisma'

async function main() {
  const chunks = await prisma.contentChunk.findMany({
    where: { NOT: { metadata: { equals: null } } },
    select: { metadata: true, path: true },
    take: 2000,
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
    // pick first, middle, and a late one
    const indices = [
      0,
      Math.floor(metas.length / 3),
      Math.floor((2 * metas.length) / 3),
    ]
    for (const i of indices) {
      const m = metas[i]!
      console.log(`http://localhost:3000${prefix}${slug}#${m.anchorId}`)
    }
    console.log('')
  }

  await prisma.$disconnect()
}
main()
