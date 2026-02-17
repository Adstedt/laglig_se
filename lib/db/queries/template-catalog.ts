/**
 * Story 12.8: User-facing published template queries
 * Separate from admin queries (lib/admin/template-queries.ts)
 */

import { cache } from 'react'
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

// --- Story 12.9: Template Detail types and query ---

export interface TemplateDetailItem {
  id: string
  index: string
  position: number
  compliance_summary: string | null
  expert_commentary: string | null
  source_type: string | null
  regulatory_body: string | null
  document: {
    id: string
    document_number: string
    title: string
    slug: string
  }
}

export interface TemplateDetailSection {
  id: string
  section_number: string
  name: string
  description: string | null
  item_count: number
  position: number
  items: TemplateDetailItem[]
}

export interface TemplateDetail {
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
  updated_at: string
  parent_slug: string | null
  variants: PublishedTemplateVariant[]
  sections: TemplateDetailSection[]
}

const ITEM_SELECT = {
  id: true,
  index: true,
  position: true,
  compliance_summary: true,
  expert_commentary: true,
  source_type: true,
  regulatory_body: true,
  is_service_company_relevant: true,
  variant_section_override: true,
  section_id: true,
  document: {
    select: {
      id: true,
      document_number: true,
      title: true,
      slug: true,
      summary: true,
      kommentar: true,
    },
  },
} as const

/**
 * Get a single published template by slug with full section/item detail.
 * Handles both parent and variant templates.
 * Returns null if no matching published template found.
 * Wrapped with React cache() for request-level dedup (generateMetadata + page render).
 */
export const getPublishedTemplateBySlug = cache(
  getPublishedTemplateBySlugUncached
)

export async function getPublishedTemplateBySlugUncached(
  slug: string
): Promise<TemplateDetail | null> {
  const template = await prisma.lawListTemplate.findFirst({
    where: { slug, status: 'PUBLISHED' },
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
      updated_at: true,
      parent_template_id: true,
      parent: {
        select: {
          slug: true,
          id: true,
          sections: {
            select: {
              id: true,
              section_number: true,
            },
          },
          items: {
            where: { is_service_company_relevant: true },
            select: ITEM_SELECT,
            orderBy: { position: 'asc' },
          },
        },
      },
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
      sections: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          section_number: true,
          name: true,
          description: true,
          item_count: true,
          position: true,
          items: {
            orderBy: { position: 'asc' },
            select: ITEM_SELECT,
          },
        },
      },
    },
  })

  if (!template) return null

  let sections: TemplateDetailSection[]

  if (template.is_variant && template.parent) {
    // Variant: use variant's own sections, but map parent items filtered by is_service_company_relevant
    const parentSectionMap = new Map(
      template.parent.sections.map((s) => [s.id, s.section_number])
    )
    const variantSectionByNumber = new Map(
      template.sections.map((s) => [s.section_number, s.id])
    )

    // Build a map of variant section id → items
    const variantItemsMap = new Map<string, typeof template.parent.items>()
    for (const section of template.sections) {
      variantItemsMap.set(section.id, [])
    }

    for (const item of template.parent.items) {
      let targetSectionId: string | undefined

      if (item.variant_section_override) {
        // Explicit override: use variant section with matching section_number
        targetSectionId = variantSectionByNumber.get(
          item.variant_section_override
        )
      } else {
        // Default: map by matching section_number between parent and variant
        const parentSectionNumber = parentSectionMap.get(item.section_id)
        if (parentSectionNumber) {
          targetSectionId = variantSectionByNumber.get(parentSectionNumber)
        }
      }

      if (targetSectionId) {
        const existing = variantItemsMap.get(targetSectionId)
        if (existing) {
          existing.push(item)
        }
      }
    }

    sections = template.sections.map((s) => ({
      id: s.id,
      section_number: s.section_number,
      name: s.name,
      description: s.description,
      item_count: variantItemsMap.get(s.id)?.length ?? 0,
      position: s.position,
      items: (variantItemsMap.get(s.id) ?? []).map(mapItem),
    }))
  } else {
    // Non-variant: sections and items are directly on the template
    sections = template.sections.map((s) => ({
      id: s.id,
      section_number: s.section_number,
      name: s.name,
      description: s.description,
      item_count: s.item_count,
      position: s.position,
      items: s.items.map(mapItem),
    }))
  }

  return {
    id: template.id,
    name: template.name,
    slug: template.slug,
    description: template.description,
    domain: template.domain,
    target_audience: template.target_audience,
    document_count: template.document_count,
    section_count: template.section_count,
    primary_regulatory_bodies: template.primary_regulatory_bodies,
    is_variant: template.is_variant,
    updated_at: template.updated_at.toISOString(),
    parent_slug: template.parent?.slug ?? null,
    variants: template.children,
    sections,
  }
}

/**
 * Get all unique document IDs across published templates.
 * Used by the cron cache-warming job.
 */
export async function getAllPublishedTemplateDocumentIds(): Promise<string[]> {
  const items = await prisma.templateItem.findMany({
    where: { template: { status: 'PUBLISHED' } },
    select: { document_id: true },
    distinct: ['document_id'],
  })
  return items.map((i) => i.document_id)
}

function mapItem(item: {
  id: string
  index: string
  position: number
  compliance_summary: string | null
  expert_commentary: string | null
  source_type: string | null
  regulatory_body: string | null
  document: {
    id: string
    document_number: string
    title: string
    slug: string
    summary: string | null
    kommentar: string | null
  }
}): TemplateDetailItem {
  return {
    id: item.id,
    index: item.index,
    position: item.position,
    compliance_summary: item.compliance_summary ?? item.document.kommentar,
    expert_commentary: item.expert_commentary ?? item.document.summary,
    source_type: item.source_type,
    regulatory_body: item.regulatory_body,
    document: item.document,
  }
}
