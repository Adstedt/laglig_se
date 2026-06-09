/**
 * Build-time sitemap generator.
 *
 * Replaces the runtime metadata route at app/sitemaps/sitemap.ts and the
 * route handler at app/sitemap-index.xml/route.ts. Writes plain static XML
 * files into public/ so Vercel serves them straight from the CDN.
 *
 * Why static-at-build instead of ISR: GSC's Sitemaps panel processor
 * silently rejected the dynamic 2.3 MB children for 5+ weeks despite
 * successful Googlebot/2.1 fetches in Vercel logs. A controlled 100-URL
 * static test (public/sitemap-test.xml from PR #71) processed to Success
 * in hours, isolating the failure to the metadata-route serving path on
 * large responses. Static files in public/ use the same CDN path that
 * robots.txt and the test sitemap take, which is the only path proven to
 * work end-to-end with GSC.
 *
 * Freshness is maintained by a daily Vercel cron at /api/cron/refresh-sitemap
 * that POSTs to a Vercel Deploy Hook, triggering a production rebuild after
 * the daily SFS sync jobs land their data.
 *
 * Run via package.json `postbuild` (which runs after `next build`):
 *   tsx scripts/generate-sitemaps.ts
 *
 * Standalone (local sanity check):
 *   NEXT_PUBLIC_BASE_URL=https://www.laglig.se pnpm tsx scripts/generate-sitemaps.ts
 */

import { PrismaClient, ContentType } from '@prisma/client'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { LEGAL_DOCS } from '@/components/features/legal/legal-doc-registry'
import { SITEMAP_CHUNK_SIZE } from '@/lib/constants/sitemap'

const prisma = new PrismaClient()

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'
const publicDir = join(process.cwd(), 'public')

// Verbatim copy of getUrlPath from the pre-static app/sitemaps/sitemap.ts.
// The `_exhaustive: never` arm makes a future ContentType addition a TS
// build error instead of a silent 404.
function getUrlPath(contentType: ContentType, slug: string): string | null {
  switch (contentType) {
    case ContentType.SFS_LAW:
      return `/lagar/${slug}`
    case ContentType.SFS_AMENDMENT:
      return `/lagar/andringar/${slug}`
    case ContentType.AGENCY_REGULATION:
      return `/foreskrifter/${slug}`
    case ContentType.EU_REGULATION:
      return `/eu/forordningar/${slug}`
    case ContentType.EU_DIRECTIVE:
      return `/eu/direktiv/${slug}`
    case ContentType.COURT_CASE_AD:
    case ContentType.COURT_CASE_HD:
    case ContentType.COURT_CASE_HOVR:
    case ContentType.COURT_CASE_HFD:
    case ContentType.COURT_CASE_MOD:
    case ContentType.COURT_CASE_MIG:
      return null
    default: {
      const _exhaustive: never = contentType
      void _exhaustive
      return null
    }
  }
}

function getPriority(contentType: ContentType): number {
  if (contentType === ContentType.SFS_LAW) return 0.7
  if (contentType.startsWith('EU_')) return 0.5
  return 0.5
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

type UrlEntry = {
  loc: string
  lastmod: Date
  changefreq: 'daily' | 'weekly' | 'yearly'
  priority: number
}

function renderUrlset(urls: UrlEntry[]): string {
  const entries = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n    <lastmod>${u.lastmod.toISOString()}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
}

type IndexEntry = { loc: string; lastmod: Date }

function renderIndex(entries: IndexEntry[]): string {
  const body = entries
    .map(
      (e) =>
        `  <sitemap>\n    <loc>${escapeXml(e.loc)}</loc>\n    <lastmod>${e.lastmod.toISOString()}</lastmod>\n  </sitemap>`
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`
}

async function writeXml(relPath: string, xml: string): Promise<void> {
  const full = join(publicDir, relPath)
  await mkdir(dirname(full), { recursive: true })
  await writeFile(full, xml, 'utf8')
}

async function buildChildSitemap(id: number): Promise<{
  xml: string
  lastmod: Date
}> {
  const documents = await prisma.legalDocument.findMany({
    where: { status: 'ACTIVE' },
    select: { slug: true, updated_at: true, content_type: true },
    orderBy: { id: 'asc' },
    skip: id * SITEMAP_CHUNK_SIZE,
    take: SITEMAP_CHUNK_SIZE,
  })

  const documentUrls: UrlEntry[] = documents.flatMap((doc) => {
    const path = getUrlPath(doc.content_type, doc.slug)
    if (path === null) return []
    return [
      {
        loc: `${baseUrl}${path}`,
        lastmod: doc.updated_at,
        changefreq: 'weekly' as const,
        priority: getPriority(doc.content_type),
      },
    ]
  })

  const now = new Date()
  const allUrls: UrlEntry[] =
    id === 0
      ? [
          {
            loc: baseUrl,
            lastmod: now,
            changefreq: 'daily',
            priority: 1.0,
          },
          {
            loc: `${baseUrl}/lagar`,
            lastmod: now,
            changefreq: 'daily',
            priority: 0.9,
          },
          {
            loc: `${baseUrl}/eu`,
            lastmod: now,
            changefreq: 'daily',
            priority: 0.9,
          },
          {
            loc: `${baseUrl}/eu/forordningar`,
            lastmod: now,
            changefreq: 'weekly',
            priority: 0.8,
          },
          {
            loc: `${baseUrl}/eu/direktiv`,
            lastmod: now,
            changefreq: 'weekly',
            priority: 0.8,
          },
          ...LEGAL_DOCS.map((doc) => ({
            loc: `${baseUrl}/${doc.slug}`,
            lastmod: now,
            changefreq: 'yearly' as const,
            priority: 0.4,
          })),
          ...documentUrls,
        ]
      : documentUrls

  // Per-chunk lastmod = MAX(updated_at) across that chunk's URL entries,
  // so the index can give Google a useful per-chunk re-crawl signal.
  // Falls back to `now` when the chunk happens to be empty.
  let max: Date | null = null
  for (const u of allUrls) {
    if (max === null || u.lastmod > max) max = u.lastmod
  }
  const lastmod = max ?? now

  return { xml: renderUrlset(allUrls), lastmod }
}

async function main(): Promise<void> {
  const startedAt = Date.now()
  const total = await prisma.legalDocument.count({
    where: { status: 'ACTIVE' },
  })
  const count = Math.max(1, Math.ceil(total / SITEMAP_CHUNK_SIZE))

  const indexEntries: IndexEntry[] = []
  for (let id = 0; id < count; id++) {
    const { xml, lastmod } = await buildChildSitemap(id)
    await writeXml(`sitemaps/sitemap/${id}.xml`, xml)
    indexEntries.push({
      loc: `${baseUrl}/sitemaps/sitemap/${id}.xml`,
      lastmod,
    })
    console.log(
      `[generate-sitemaps] wrote public/sitemaps/sitemap/${id}.xml ` +
        `(lastmod=${lastmod.toISOString()})`
    )
  }

  await writeXml('sitemap-index.xml', renderIndex(indexEntries))
  console.log(
    `[generate-sitemaps] wrote public/sitemap-index.xml (${count} children)`
  )
  console.log(
    `[generate-sitemaps] done — ${total} ACTIVE rows, ${count} chunks, ` +
      `${Date.now() - startedAt}ms`
  )
}

main()
  .catch((err) => {
    console.error('[generate-sitemaps] failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
