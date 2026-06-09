import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { ContentType } from '@prisma/client'
import { LEGAL_DOCS } from '@/components/features/legal/legal-doc-registry'
import { SITEMAP_CHUNK_SIZE } from '@/lib/constants/sitemap'

// Regenerate at most once per day. Without this, every Googlebot fetch
// would trigger a fresh count + findMany over tens of thousands of rows.
export const revalidate = 86_400

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'

// Map ContentType to URL path. Returns null for content types that have no
// public route yet — those rows are omitted from the sitemap entirely rather
// than being mapped to a route that 404s. The `_exhaustive: never` line in the
// default arm makes a future ContentType addition a TS build error instead of
// a silent 404 (the bug this function previously had via a string fallthrough).
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

// Get priority by content type
function getPriority(contentType: ContentType): number {
  if (contentType === ContentType.SFS_LAW) return 0.7
  if (contentType.startsWith('EU_')) return 0.5
  return 0.5
}

/**
 * Next.js 16 splits the sitemap into N child files at
 * `/sitemaps/sitemap/[id].xml` (the URL inherits this file's folder layout
 * under app/). The nested path is intentional — GSC caches per-URL fetch
 * state, and the original `/sitemap/[id].xml` URLs got stuck in
 * "Couldn't fetch" for 5+ weeks; moving the file gives Google a fresh URL
 * to crawl. Google's per-sitemap cap is 50,000 URLs
 * (see SITEMAP_CHUNK_SIZE). We exclude non-ACTIVE rows so Google doesn't
 * crawl drafts/archived/repealed URLs that risk soft-404s on a fresh
 * domain — a separate decision is required before re-including REPEALED.
 */
export async function generateSitemaps() {
  const total = await prisma.legalDocument.count({
    where: { status: 'ACTIVE' },
  })
  const count = Math.max(1, Math.ceil(total / SITEMAP_CHUNK_SIZE))
  return Array.from({ length: count }, (_, id) => ({ id }))
}

// Next 16: `id` arrives as a Promise<string> on the props.
export default async function sitemap(props: {
  id: Promise<string>
}): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id)

  const documents = await prisma.legalDocument.findMany({
    where: { status: 'ACTIVE' },
    select: {
      slug: true,
      updated_at: true,
      content_type: true,
    },
    orderBy: { id: 'asc' }, // stable ordering across chunks
    skip: id * SITEMAP_CHUNK_SIZE,
    take: SITEMAP_CHUNK_SIZE,
  })

  const documentUrls: MetadataRoute.Sitemap = documents.flatMap((doc) => {
    const path = getUrlPath(doc.content_type, doc.slug)
    if (path === null) return []
    return [
      {
        url: `${baseUrl}${path}`,
        lastModified: doc.updated_at,
        changeFrequency: 'weekly' as const,
        priority: getPriority(doc.content_type),
      },
    ]
  })

  // Static + legal-registry pages only ride in the first chunk so they
  // never get duplicated across child sitemaps.
  if (id !== 0) {
    return documentUrls
  }

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/lagar`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/eu`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/eu/forordningar`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/eu/direktiv`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    // Legal pages — read directly from the LEGAL_DOCS registry
    ...LEGAL_DOCS.map((doc) => ({
      url: `${baseUrl}/${doc.slug}`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.4,
    })),
  ]

  return [...staticPages, ...documentUrls]
}
