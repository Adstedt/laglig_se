import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    legalDocument: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { buildSlugMap } from '@/lib/linkify/build-slug-map'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('buildSlugMap', () => {
  it('builds a map keyed by document_number', async () => {
    vi.mocked(prisma.legalDocument.findMany).mockResolvedValue([
      {
        id: 'id-1',
        document_number: 'SFS 2012:295',
        slug: 'some-law-2012-295',
        content_type: 'SFS_LAW',
        title: 'Some Law (2012:295)',
      },
      {
        id: 'id-2',
        document_number: 'AFS 2001:1',
        slug: 'afs-2001-1',
        content_type: 'AGENCY_REGULATION',
        title: 'Systematiskt arbetsmiljöarbete',
      },
    ] as never)

    const map = await buildSlugMap()

    expect(map.size).toBe(2)
    expect(map.get('SFS 2012:295')).toEqual({
      slug: 'some-law-2012-295',
      contentType: 'SFS_LAW',
      title: 'Some Law (2012:295)',
      id: 'id-1',
    })
    expect(map.get('AFS 2001:1')).toEqual({
      slug: 'afs-2001-1',
      contentType: 'AGENCY_REGULATION',
      title: 'Systematiskt arbetsmiljöarbete',
      id: 'id-2',
    })
  })

  it('returns empty map when no documents exist', async () => {
    vi.mocked(prisma.legalDocument.findMany).mockResolvedValue([] as never)

    const map = await buildSlugMap()
    expect(map.size).toBe(0)
  })

  it('fetches only required fields via select', async () => {
    vi.mocked(prisma.legalDocument.findMany).mockResolvedValue([] as never)

    await buildSlugMap()

    expect(prisma.legalDocument.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        document_number: true,
        slug: true,
        content_type: true,
        title: true,
      },
    })
  })

  it('is called only once (single query)', async () => {
    vi.mocked(prisma.legalDocument.findMany).mockResolvedValue([] as never)

    await buildSlugMap()

    expect(prisma.legalDocument.findMany).toHaveBeenCalledTimes(1)
  })
})
