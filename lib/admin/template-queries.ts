import { prisma } from '@/lib/prisma'
import type {
  Prisma,
  TemplateItemContentStatus,
  TemplateStatus,
} from '@prisma/client'

// ============================================================================
// Types
// ============================================================================

export interface TemplateListItem {
  id: string
  name: string
  slug: string
  domain: string
  status: TemplateStatus
  document_count: number
  section_count: number
  published_at: Date | null
  updated_at: Date
  is_variant: boolean
  parent: { name: string } | null
}

export interface TemplateListParams {
  search?: string | undefined
  status?: TemplateStatus | undefined
  sortBy?: string | undefined
  sortDir?: 'asc' | 'desc' | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

export interface TemplateListResult {
  data: TemplateListItem[]
  total: number
  page: number
  pageSize: number
}

export interface TemplateDetail {
  id: string
  name: string
  slug: string
  description: string | null
  domain: string
  target_audience: string | null
  status: TemplateStatus
  version: number
  document_count: number
  section_count: number
  primary_regulatory_bodies: string[]
  is_variant: boolean
  parent: { id: string; name: string } | null
  published_at: Date | null
  created_at: Date
  updated_at: Date
  sections: {
    id: string
    section_number: string
    name: string
    description: string | null
    position: number
    item_count: number
    _count: { items: number }
  }[]
}

export interface TemplateSectionItem {
  id: string
  index: string
  position: number
  compliance_summary: string | null
  content_status: TemplateItemContentStatus
  source_type: string | null
  regulatory_body: string | null
  document: {
    id: string
    title: string
    document_number: string | null
  }
}

// ============================================================================
// Queries
// ============================================================================

const TEMPLATE_SORTABLE_FIELDS = new Set([
  'name',
  'domain',
  'status',
  'updated_at',
  'published_at',
])

export async function getTemplateList(
  params: TemplateListParams
): Promise<TemplateListResult> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 25
  const skip = (page - 1) * pageSize

  const where: Prisma.LawListTemplateWhereInput = {}
  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { slug: { contains: params.search, mode: 'insensitive' } },
    ]
  }
  if (params.status) where.status = params.status

  const sortField = TEMPLATE_SORTABLE_FIELDS.has(params.sortBy ?? '')
    ? params.sortBy!
    : 'updated_at'
  const sortDir = params.sortDir ?? 'desc'
  const orderBy: Prisma.LawListTemplateOrderByWithRelationInput = {
    [sortField]: sortDir,
  }

  const [data, total] = await Promise.all([
    prisma.lawListTemplate.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        status: true,
        document_count: true,
        section_count: true,
        published_at: true,
        updated_at: true,
        is_variant: true,
        parent: { select: { name: true } },
      },
    }),
    prisma.lawListTemplate.count({ where }),
  ])

  return { data, total, page, pageSize }
}

export async function getTemplateDetail(
  id: string
): Promise<TemplateDetail | null> {
  return prisma.lawListTemplate.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      domain: true,
      target_audience: true,
      status: true,
      version: true,
      document_count: true,
      section_count: true,
      primary_regulatory_bodies: true,
      is_variant: true,
      parent: { select: { id: true, name: true } },
      published_at: true,
      created_at: true,
      updated_at: true,
      sections: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          section_number: true,
          name: true,
          description: true,
          position: true,
          item_count: true,
          _count: { select: { items: true } },
        },
      },
    },
  })
}

export async function getTemplateSectionItems(
  sectionId: string
): Promise<TemplateSectionItem[]> {
  return prisma.templateItem.findMany({
    where: { section_id: sectionId },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      index: true,
      position: true,
      compliance_summary: true,
      content_status: true,
      source_type: true,
      regulatory_body: true,
      document: {
        select: {
          id: true,
          title: true,
          document_number: true,
        },
      },
    },
  })
}
