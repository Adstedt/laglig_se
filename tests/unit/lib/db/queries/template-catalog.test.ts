import { vi, describe, beforeEach, it, expect } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    lawListTemplate: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import {
  getPublishedTemplates,
  getUniqueDomains,
} from '@/lib/db/queries/template-catalog'

const mockPrisma = vi.mocked(prisma, true)

describe('getPublishedTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns only PUBLISHED, non-variant templates with children mapped to variants', async () => {
    mockPrisma.lawListTemplate.findMany.mockResolvedValue([
      {
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
        children: [
          {
            id: 'uuid-2',
            name: 'Tjänsteföretag',
            slug: 'arbetsmiljo-tjansteforetag',
            document_count: 55,
            section_count: 7,
            target_audience: 'Tjänsteföretag',
          },
        ],
      },
    ] as never)

    const result = await getPublishedTemplates()

    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('Arbetsmiljö')
    expect(result[0]!.variants).toHaveLength(1)
    expect(result[0]!.variants[0]!.slug).toBe('arbetsmiljo-tjansteforetag')

    expect(mockPrisma.lawListTemplate.findMany).toHaveBeenCalledWith({
      where: {
        status: 'PUBLISHED',
        is_variant: false,
      },
      select: expect.objectContaining({
        id: true,
        name: true,
        slug: true,
        children: expect.objectContaining({
          where: { status: 'PUBLISHED' },
        }),
      }),
      orderBy: [{ domain: 'asc' }, { name: 'asc' }],
    })
  })

  it('returns empty array when no published templates exist', async () => {
    mockPrisma.lawListTemplate.findMany.mockResolvedValue([] as never)

    const result = await getPublishedTemplates()

    expect(result).toEqual([])
  })

  it('includes variant children on parent templates', async () => {
    mockPrisma.lawListTemplate.findMany.mockResolvedValue([
      {
        id: 'uuid-1',
        name: 'Test',
        slug: 'test',
        description: null,
        domain: 'test',
        target_audience: null,
        document_count: 10,
        section_count: 2,
        primary_regulatory_bodies: [],
        is_variant: false,
        children: [
          {
            id: 'v1',
            name: 'Variant A',
            slug: 'variant-a',
            document_count: 5,
            section_count: 1,
            target_audience: 'Group A',
          },
          {
            id: 'v2',
            name: 'Variant B',
            slug: 'variant-b',
            document_count: 3,
            section_count: 1,
            target_audience: 'Group B',
          },
        ],
      },
    ] as never)

    const result = await getPublishedTemplates()

    expect(result[0]!.variants).toHaveLength(2)
    expect(result[0]!.variants[0]!.name).toBe('Variant A')
    expect(result[0]!.variants[1]!.name).toBe('Variant B')
  })

  it('filters out DRAFT/ARCHIVED templates via query params', async () => {
    mockPrisma.lawListTemplate.findMany.mockResolvedValue([] as never)

    await getPublishedTemplates()

    expect(mockPrisma.lawListTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PUBLISHED',
          is_variant: false,
        },
      })
    )
  })
})

describe('getUniqueDomains', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns distinct domains from published templates', async () => {
    mockPrisma.lawListTemplate.findMany.mockResolvedValue([
      { domain: 'arbetsmiljo' },
      { domain: 'miljo' },
    ] as never)

    const result = await getUniqueDomains()

    expect(result).toEqual(['arbetsmiljo', 'miljo'])
    expect(mockPrisma.lawListTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PUBLISHED', is_variant: false },
        select: { domain: true },
        distinct: ['domain'],
        orderBy: { domain: 'asc' },
      })
    )
  })

  it('returns empty array when no published templates exist', async () => {
    mockPrisma.lawListTemplate.findMany.mockResolvedValue([] as never)

    const result = await getUniqueDomains()

    expect(result).toEqual([])
  })
})
