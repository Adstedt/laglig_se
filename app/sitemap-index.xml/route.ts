import { prisma } from '@/lib/prisma'
import { SITEMAP_CHUNK_SIZE } from '@/lib/constants/sitemap'

// Regenerate the index at most once per day. Pairs with the same revalidate
// window in app/sitemap.ts so the index and the chunks stay coherent.
export const revalidate = 86_400

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'

/**
 * Minimal XML escaper for the five reserved characters. Sitemap slugs are
 * URL-safe today, but emitting raw strings into XML without escaping is a
 * footgun the day someone introduces a `&` (e.g. `lag-om-a-och-b`).
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Custom sitemap index. Next.js's `generateSitemaps` emits child sitemaps
 * at `/sitemap/[id].xml` but does NOT produce an index file — we build one
 * ourselves so GSC can be pointed at a single URL.
 *
 * Per-chunk `<lastmod>` is the MAX(updated_at) of the rows in that chunk,
 * which lets Google re-crawl only the chunks that actually changed. This is
 * meaningful for our small chunks (10k each) and effectively free under
 * 24h ISR.
 */
export async function GET() {
  const total = await prisma.legalDocument.count({
    where: { status: 'ACTIVE' },
  })
  const count = Math.max(1, Math.ceil(total / SITEMAP_CHUNK_SIZE))
  const now = new Date()

  // For each chunk, compute MAX(updated_at) over the chunk's slice.
  // Prisma's aggregate doesn't accept skip/take, so we run a tiny paged
  // findMany selecting only updated_at and reduce in JS. At 10k rows per
  // chunk this is cheap, and it only runs every 24h thanks to ISR.
  const chunkLastmods = await Promise.all(
    Array.from({ length: count }, async (_, id) => {
      const rows = await prisma.legalDocument.findMany({
        where: { status: 'ACTIVE' },
        select: { updated_at: true },
        orderBy: { id: 'asc' },
        skip: id * SITEMAP_CHUNK_SIZE,
        take: SITEMAP_CHUNK_SIZE,
      })
      // Fall back to `now` if the chunk happens to be empty (e.g. boundary
      // race during a content purge). Better than emitting no lastmod.
      let max: Date | null = null
      for (const row of rows) {
        if (max === null || row.updated_at > max) max = row.updated_at
      }
      return max ?? now
    })
  )

  const entries = chunkLastmods
    .map((lastmod, id) => {
      const loc = escapeXml(`${baseUrl}/sitemap/${id}.xml`)
      return `  <sitemap>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod.toISOString()}</lastmod>\n  </sitemap>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      // Match the page-level revalidate so CDN caches don't keep stale
      // chunk references after the daily refresh.
      'Cache-Control': 'public, max-age=0, s-maxage=86400, must-revalidate',
    },
  })
}
