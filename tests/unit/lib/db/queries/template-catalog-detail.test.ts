import { vi, describe, beforeEach, it, expect } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    lawListTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { getPublishedTemplateBySlug } from '@/lib/db/queries/template-catalog'

const mockPrisma = vi.mocked(prisma, true)

const makeTemplate = (overrides: Record<string, unknown> = {}) => ({
  id: 'uuid-1',
  name: 'Arbetsmiljö',
  slug: 'arbetsmiljo',
  description: 'Arbetsmiljölagstiftning.',
  domain: 'arbetsmiljo',
  target_audience: 'Alla arbetsgivare',
  document_count: 112,
  section_count: 9,
  primary_regulatory_bodies: ['Arbetsmiljöverket'],
  is_variant: false,
  updated_at: new Date('2026-02-10T00:00:00.000Z'),
  parent_template_id: null,
  parent: null,
  children: [],
  sections: [
    {
      id: 'section-1',
      section_number: '01',
      name: 'Grundläggande regelverk',
      description: 'Övergripande lagar.',
      item_count: 2,
      position: 1,
      items: [
        {
          id: 'item-1',
          index: '0100',
          position: 1,
          compliance_summary: 'Compliance summary 1',
          expert_commentary: null,
          source_type: 'lag',
          regulatory_body: 'Riksdagen',
          is_service_company_relevant: true,
          variant_section_override: null,
          section_id: 'section-1',
          document: {
            id: 'doc-1',
            document_number: 'SFS 1977:1160',
            title: 'Arbetsmiljölag',
            slug: 'sfs-1977-1160',
          },
        },
        {
          id: 'item-2',
          index: '0101',
          position: 2,
          compliance_summary: null,
          expert_commentary: null,
          source_type: 'foreskrift',
          regulatory_body: 'Arbetsmiljöverket',
          is_service_company_relevant: true,
          variant_section_override: null,
          section_id: 'section-1',
          document: {
            id: 'doc-2',
            document_number: 'AFS 2023:1',
            title: 'Systematiskt arbetsmiljöarbete',
            slug: 'afs-2023-1',
          },
        },
      ],
    },
    {
      id: 'section-2',
      section_number: '02',
      name: 'Fysisk arbetsmiljö',
      description: null,
      item_count: 1,
      position: 2,
      items: [
        {
          id: 'item-3',
          index: '0200',
          position: 1,
          compliance_summary: 'Summary for physical env',
          expert_commentary: null,
          source_type: 'eu-forordning',
          regulatory_body: 'EU',
          is_service_company_relevant: false,
          variant_section_override: null,
          section_id: 'section-2',
          document: {
            id: 'doc-3',
            document_number: 'EU 2016/425',
            title: 'Personlig skyddsutrustning',
            slug: 'eu-2016-425',
          },
        },
      ],
    },
  ],
  ...overrides,
})

describe('getPublishedTemplateBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns full template with sections and items for valid published slug', async () => {
    mockPrisma.lawListTemplate.findFirst.mockResolvedValue(
      makeTemplate() as never
    )

    const result = await getPublishedTemplateBySlug('arbetsmiljo')

    expect(result).not.toBeNull()
    expect(result!.name).toBe('Arbetsmiljö')
    expect(result!.slug).toBe('arbetsmiljo')
    expect(result!.sections).toHaveLength(2)
    expect(result!.sections[0]!.items).toHaveLength(2)
    expect(result!.sections[1]!.items).toHaveLength(1)
  })

  it('returns null for non-existent slug', async () => {
    mockPrisma.lawListTemplate.findFirst.mockResolvedValue(null as never)

    const result = await getPublishedTemplateBySlug('nonexistent')

    expect(result).toBeNull()
  })

  it('queries with slug and PUBLISHED status filter', async () => {
    mockPrisma.lawListTemplate.findFirst.mockResolvedValue(null as never)

    await getPublishedTemplateBySlug('test-slug')

    expect(mockPrisma.lawListTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'test-slug', status: 'PUBLISHED' },
      })
    )
  })

  it('returns sections ordered by position', async () => {
    mockPrisma.lawListTemplate.findFirst.mockResolvedValue(
      makeTemplate() as never
    )

    const result = await getPublishedTemplateBySlug('arbetsmiljo')

    expect(result!.sections[0]!.position).toBe(1)
    expect(result!.sections[1]!.position).toBe(2)
  })

  it('includes document relation with document_number, title, slug', async () => {
    mockPrisma.lawListTemplate.findFirst.mockResolvedValue(
      makeTemplate() as never
    )

    const result = await getPublishedTemplateBySlug('arbetsmiljo')

    const firstItem = result!.sections[0]!.items[0]!
    expect(firstItem.document.document_number).toBe('SFS 1977:1160')
    expect(firstItem.document.title).toBe('Arbetsmiljölag')
    expect(firstItem.document.slug).toBe('sfs-1977-1160')
  })

  it('converts updated_at to ISO string', async () => {
    mockPrisma.lawListTemplate.findFirst.mockResolvedValue(
      makeTemplate() as never
    )

    const result = await getPublishedTemplateBySlug('arbetsmiljo')

    expect(result!.updated_at).toBe('2026-02-10T00:00:00.000Z')
  })

  it('returns parent_slug as null for non-variant templates', async () => {
    mockPrisma.lawListTemplate.findFirst.mockResolvedValue(
      makeTemplate() as never
    )

    const result = await getPublishedTemplateBySlug('arbetsmiljo')

    expect(result!.parent_slug).toBeNull()
  })

  it('returns parent_slug for variant templates', async () => {
    mockPrisma.lawListTemplate.findFirst.mockResolvedValue(
      makeTemplate({
        is_variant: true,
        parent: {
          slug: 'arbetsmiljo',
          id: 'parent-id',
          sections: [{ id: 'parent-section-1', section_number: '01' }],
          items: [
            {
              id: 'item-1',
              index: '0100',
              position: 1,
              compliance_summary: 'Summary',
              expert_commentary: null,
              source_type: 'lag',
              regulatory_body: 'Riksdagen',
              is_service_company_relevant: true,
              variant_section_override: null,
              section_id: 'parent-section-1',
              document: {
                id: 'doc-1',
                document_number: 'SFS 1977:1160',
                title: 'Arbetsmiljölag',
                slug: 'sfs-1977-1160',
              },
            },
          ],
        },
        sections: [
          {
            id: 'variant-section-1',
            section_number: '01',
            name: 'Variant Section',
            description: null,
            item_count: 0,
            position: 1,
            items: [],
          },
        ],
      }) as never
    )

    const result = await getPublishedTemplateBySlug('variant-slug')

    expect(result!.parent_slug).toBe('arbetsmiljo')
    expect(result!.is_variant).toBe(true)
  })

  it('maps parent items to variant sections by section_number', async () => {
    mockPrisma.lawListTemplate.findFirst.mockResolvedValue(
      makeTemplate({
        is_variant: true,
        parent: {
          slug: 'parent',
          id: 'parent-id',
          sections: [
            { id: 'ps-1', section_number: '01' },
            { id: 'ps-2', section_number: '02' },
          ],
          items: [
            {
              id: 'pi-1',
              index: '0100',
              position: 1,
              compliance_summary: null,
              expert_commentary: null,
              source_type: 'lag',
              regulatory_body: null,
              is_service_company_relevant: true,
              variant_section_override: null,
              section_id: 'ps-1',
              document: {
                id: 'd1',
                document_number: 'SFS 1',
                title: 'Law 1',
                slug: 'law-1',
              },
            },
            {
              id: 'pi-2',
              index: '0200',
              position: 2,
              compliance_summary: null,
              expert_commentary: null,
              source_type: 'lag',
              regulatory_body: null,
              is_service_company_relevant: true,
              variant_section_override: null,
              section_id: 'ps-2',
              document: {
                id: 'd2',
                document_number: 'SFS 2',
                title: 'Law 2',
                slug: 'law-2',
              },
            },
          ],
        },
        sections: [
          {
            id: 'vs-1',
            section_number: '01',
            name: 'Variant S1',
            description: null,
            item_count: 0,
            position: 1,
            items: [],
          },
        ],
      }) as never
    )

    const result = await getPublishedTemplateBySlug('variant')

    // Only section 01 exists in variant → only item from parent section 01 is mapped
    expect(result!.sections).toHaveLength(1)
    expect(result!.sections[0]!.items).toHaveLength(1)
    expect(result!.sections[0]!.items[0]!.document.title).toBe('Law 1')
  })

  it('uses variant_section_override when present', async () => {
    mockPrisma.lawListTemplate.findFirst.mockResolvedValue(
      makeTemplate({
        is_variant: true,
        parent: {
          slug: 'parent',
          id: 'parent-id',
          sections: [{ id: 'ps-1', section_number: '01' }],
          items: [
            {
              id: 'pi-1',
              index: '0100',
              position: 1,
              compliance_summary: null,
              expert_commentary: null,
              source_type: 'lag',
              regulatory_body: null,
              is_service_company_relevant: true,
              variant_section_override: '02',
              section_id: 'ps-1',
              document: {
                id: 'd1',
                document_number: 'SFS 1',
                title: 'Overridden Law',
                slug: 'law-1',
              },
            },
          ],
        },
        sections: [
          {
            id: 'vs-1',
            section_number: '01',
            name: 'S1',
            description: null,
            item_count: 0,
            position: 1,
            items: [],
          },
          {
            id: 'vs-2',
            section_number: '02',
            name: 'S2',
            description: null,
            item_count: 0,
            position: 2,
            items: [],
          },
        ],
      }) as never
    )

    const result = await getPublishedTemplateBySlug('variant')

    // Item from parent section 01 overridden to variant section 02
    expect(result!.sections[0]!.items).toHaveLength(0)
    expect(result!.sections[1]!.items).toHaveLength(1)
    expect(result!.sections[1]!.items[0]!.document.title).toBe('Overridden Law')
  })

  it('includes children as variants for non-variant templates', async () => {
    mockPrisma.lawListTemplate.findFirst.mockResolvedValue(
      makeTemplate({
        children: [
          {
            id: 'child-1',
            name: 'Variant',
            slug: 'variant-slug',
            document_count: 55,
            section_count: 7,
            target_audience: 'Tjänsteföretag',
          },
        ],
      }) as never
    )

    const result = await getPublishedTemplateBySlug('arbetsmiljo')

    expect(result!.variants).toHaveLength(1)
    expect(result!.variants[0]!.slug).toBe('variant-slug')
  })
})
