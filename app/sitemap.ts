import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { ContentType } from '@prisma/client'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'

  // Fetch all laws for sitemap
  const laws = await prisma.legalDocument.findMany({
    where: { content_type: ContentType.SFS_LAW },
    select: { slug: true, updated_at: true },
  })

  // Generate law page URLs
  const lawUrls: MetadataRoute.Sitemap = laws.map((law) => ({
    url: `${baseUrl}/alla-lagar/${law.slug}`,
    lastModified: law.updated_at,
    changeFrequency: 'weekly',
    priority: 0.7,
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
      url: `${baseUrl}/alla-lagar`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ]

  return [...staticPages, ...lawUrls]
}
