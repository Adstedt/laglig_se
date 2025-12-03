import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { ContentType } from '@prisma/client'

// Map ContentType to URL path
function getUrlPath(contentType: ContentType, slug: string): string {
  switch (contentType) {
    case ContentType.SFS_LAW:
      return `/lagar/${slug}`
    case ContentType.COURT_CASE_HD:
      return `/rattsfall/hd/${slug}`
    case ContentType.COURT_CASE_HOVR:
      return `/rattsfall/hovr/${slug}`
    case ContentType.COURT_CASE_HFD:
      return `/rattsfall/hfd/${slug}`
    case ContentType.COURT_CASE_AD:
      return `/rattsfall/ad/${slug}`
    case ContentType.COURT_CASE_MOD:
      return `/rattsfall/mod/${slug}`
    case ContentType.COURT_CASE_MIG:
      return `/rattsfall/mig/${slug}`
    case ContentType.EU_REGULATION:
      return `/eu/forordningar/${slug}`
    case ContentType.EU_DIRECTIVE:
      return `/eu/direktiv/${slug}`
    default:
      return `/lagar/${slug}`
  }
}

// Get priority by content type
function getPriority(contentType: ContentType): number {
  if (contentType === ContentType.SFS_LAW) return 0.7
  if (contentType.startsWith('COURT_CASE')) return 0.6
  if (contentType.startsWith('EU_')) return 0.5
  return 0.5
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'

  // Fetch all documents for sitemap
  const documents = await prisma.legalDocument.findMany({
    select: {
      slug: true,
      updated_at: true,
      content_type: true,
    },
  })

  // Generate document URLs
  const documentUrls: MetadataRoute.Sitemap = documents.map((doc) => ({
    url: `${baseUrl}${getUrlPath(doc.content_type, doc.slug)}`,
    lastModified: doc.updated_at,
    changeFrequency: 'weekly' as const,
    priority: getPriority(doc.content_type),
  }))

  // Static pages
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
      url: `${baseUrl}/rattsfall`,
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
    // Court listing pages
    {
      url: `${baseUrl}/rattsfall/hd`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/rattsfall/hovr`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/rattsfall/hfd`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/rattsfall/ad`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/rattsfall/mod`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/rattsfall/mig`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    // EU type listing pages
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
  ]

  return [...staticPages, ...documentUrls]
}
