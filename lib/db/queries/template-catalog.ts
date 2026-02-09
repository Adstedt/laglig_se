/**
 * Story 12.8: User-facing published template queries
 * Separate from admin queries (lib/admin/template-queries.ts)
 */

import { prisma } from '@/lib/prisma'

export interface PublishedTemplateVariant {
  id: string
  name: string
  slug: string
  document_count: number
  section_count: number
  target_audience: string | null
}

export interface PublishedTemplate {
  id: string
  name: string
  slug: string
  description: string | null
  domain: string
  target_audience: string | null
  document_count: number
  section_count: number
  primary_regulatory_bodies: string[]
  is_variant: boolean
  variants: PublishedTemplateVariant[]
}

/**
 * Get all published, non-variant templates with their published variants.
 * Sorted by domain asc, then name asc.
 */
export async function getPublishedTemplates(): Promise<PublishedTemplate[]> {
  const templates = await prisma.lawListTemplate.findMany({
    where: {
      status: 'PUBLISHED',
      is_variant: false,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      domain: true,
      target_audience: true,
      document_count: true,
      section_count: true,
      primary_regulatory_bodies: true,
      is_variant: true,
      children: {
        where: { status: 'PUBLISHED' },
        select: {
          id: true,
          name: true,
          slug: true,
          document_count: true,
          section_count: true,
          target_audience: true,
        },
      },
    },
    orderBy: [{ domain: 'asc' }, { name: 'asc' }],
  })

  return templates.map((t) => ({
    ...t,
    variants: t.children,
  }))
}

/**
 * Extract unique domains from published templates for filter UI.
 */
export async function getUniqueDomains(): Promise<string[]> {
  const templates = await prisma.lawListTemplate.findMany({
    where: {
      status: 'PUBLISHED',
      is_variant: false,
    },
    select: { domain: true },
    distinct: ['domain'],
    orderBy: { domain: 'asc' },
  })

  return templates.map((t) => t.domain)
}
