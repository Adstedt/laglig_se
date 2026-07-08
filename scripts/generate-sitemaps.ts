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

import * as dotenv from 'dotenv'
import { PrismaClient, ContentType } from '@prisma/client'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import matter from 'gray-matter'
import { LEGAL_DOCS } from '@/components/features/legal/legal-doc-registry'
import { SITEMAP_CHUNK_SIZE } from '@/lib/constants/sitemap'
import { getPublicUrlPath } from '@/lib/catalog/public-url'

// Standalone tsx script: next build loads .env.local itself, but postbuild
// runs outside Next, so DATABASE_URL must be loaded here (no-op on Vercel
// where the platform provides env and no .env.local exists).
dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'
const publicDir = join(process.cwd(), 'public')

// Story 26.3: getUrlPath moved verbatim to lib/catalog/public-url.ts
// (shared with the marketing catalog-link resolver — single source of truth).

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

// Story 26.1: marketing-page auto-registration. Walks content/marketing/
// and emits one entry per published MDX file — editorial adds a file, the
// next deploy registers it; no per-page coordination. Underscore-prefixed
// files (_template.mdx, drafts) never publish. Priority 0.8 sits between
// catalog (0.7) and homepage (1.0). The list of kinds mirrors
// MARKETING_KINDS in lib/marketing/frontmatter-schemas.ts — extend BOTH
// when a new kind (jamfor, kundcase) ships.
const MARKETING_KINDS = ['funktioner', 'branscher', 'omraden'] as const

function getMarketingUrls(): UrlEntry[] {
  const contentRoot = join(process.cwd(), 'content', 'marketing')
  const urls: UrlEntry[] = []
  for (const kind of MARKETING_KINDS) {
    const dir = join(contentRoot, kind)
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.mdx') || file.startsWith('_')) continue
      const slug = file.replace(/\.mdx$/, '')
      urls.push({
        loc: `${baseUrl}/${kind}/${slug}`,
        lastmod: statSync(join(dir, file)).mtime,
        changefreq: 'weekly',
        priority: 0.8,
      })
    }
  }
  // Ordbok / glossary (Story 26.11) — a separate light surface, not a
  // MARKETING_KIND, so it gets its own walk. One file per term.
  const ordbokDir = join(contentRoot, 'ordbok')
  if (existsSync(ordbokDir)) {
    for (const file of readdirSync(ordbokDir)) {
      if (!file.endsWith('.mdx') || file.startsWith('_')) continue
      const slug = file.replace(/\.mdx$/, '')
      urls.push({
        loc: `${baseUrl}/ordbok/${slug}`,
        lastmod: statSync(join(ordbokDir, file)).mtime,
        changefreq: 'monthly',
        priority: 0.6,
      })
    }
  }
  return urls
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
    const path = getPublicUrlPath(doc.content_type, doc.slug)
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
          {
            loc: `${baseUrl}/omraden`,
            lastmod: now,
            changefreq: 'weekly',
            priority: 0.8,
          },
          {
            loc: `${baseUrl}/ordbok`,
            lastmod: now,
            changefreq: 'weekly',
            priority: 0.7,
          },
          ...LEGAL_DOCS.map((doc) => ({
            loc: `${baseUrl}/${doc.slug}`,
            lastmod: now,
            changefreq: 'yearly' as const,
            priority: 0.4,
          })),
          ...getMarketingUrls(),
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

// ── Story 26.3: build-time dead-link warnings ───────────────────────────────
// After sitemap generation, resolve every marketing page's relatedCatalogLaws
// frontmatter against the DB and write .next/marketing-link-warnings.txt.
// WARNINGS, not errors — an unmatched link renders as plain text on the page
// (graceful), so it must never fail a deploy. Shares only the pure URL mapper
// with lib/marketing/catalog-link.ts; the resolver itself binds the Next
// prisma singleton, which doesn't belong in a standalone script.

type FrontmatterLawEntry = {
  documentNumber?: string
  slug?: string
  title?: string
}

async function checkMarketingCatalogLinks(): Promise<void> {
  const contentRoot = join(process.cwd(), 'content', 'marketing')
  const pages: Array<{ page: string; entries: FrontmatterLawEntry[] }> = []

  for (const kind of MARKETING_KINDS) {
    const dir = join(contentRoot, kind)
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.mdx') || file.startsWith('_')) continue
      // next build already Zod-validated this frontmatter minutes earlier in
      // the same pipeline — a light parse is enough here.
      const { data } = matter(readFileSync(join(dir, file), 'utf-8'))
      const entries = Array.isArray(data.relatedCatalogLaws)
        ? (data.relatedCatalogLaws as FrontmatterLawEntry[])
        : []
      if (entries.length > 0) {
        pages.push({ page: `${kind}/${file}`, entries })
      }
    }
  }

  const allEntries = pages.flatMap((p) => p.entries)
  const documentNumbers = allEntries
    .map((e) => e.documentNumber)
    .filter((v): v is string => Boolean(v))
  const slugs = allEntries
    .map((e) => e.slug)
    .filter((v): v is string => Boolean(v))

  const rows =
    allEntries.length === 0
      ? []
      : await prisma.legalDocument.findMany({
          where: {
            status: 'ACTIVE',
            OR: [
              ...(documentNumbers.length
                ? [{ document_number: { in: documentNumbers } }]
                : []),
              ...(slugs.length ? [{ slug: { in: slugs } }] : []),
            ],
          },
          select: { document_number: true, slug: true, content_type: true },
        })

  const byDocumentNumber = new Map(rows.map((r) => [r.document_number, r]))
  const bySlug = new Map(rows.map((r) => [r.slug, r]))

  const warnings: string[] = []
  for (const { page, entries } of pages) {
    for (const entry of entries) {
      const row =
        (entry.documentNumber
          ? byDocumentNumber.get(entry.documentNumber)
          : undefined) ?? (entry.slug ? bySlug.get(entry.slug) : undefined)
      const id = entry.documentNumber ?? entry.slug ?? entry.title ?? '(empty)'
      if (!row) {
        warnings.push(`${page}: "${id}" — no ACTIVE catalog row`)
      } else if (getPublicUrlPath(row.content_type, row.slug) === null) {
        warnings.push(
          `${page}: "${id}" — no public page for ${row.content_type}`
        )
      }
    }
  }

  const outPath = join(process.cwd(), '.next', 'marketing-link-warnings.txt')
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(
    outPath,
    warnings.join('\n') + (warnings.length ? '\n' : ''),
    'utf8'
  )

  if (warnings.length > 0) {
    console.warn(
      `[generate-sitemaps] ${warnings.length} unmatched catalog link(s) — see .next/marketing-link-warnings.txt`
    )
    for (const w of warnings) console.warn(`  [CATALOG_LINK_UNMATCHED] ${w}`)
  } else {
    console.log('[generate-sitemaps] 0 unmatched catalog links')
  }
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

  // Story 26.3: dead-link audit for marketing pages (warnings, never fatal)
  await checkMarketingCatalogLinks()
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
