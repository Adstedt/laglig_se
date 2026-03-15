import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ContentType } from '@prisma/client'

// Mock dependencies before importing module
vi.mock('@/lib/prisma', () => ({
  prisma: {
    crossReference: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    legalDocument: {
      findFirst: vi.fn(),
    },
  },
}))

// Import after mocking
import {
  getImplementedEuDirectives,
  lookupLawBySfsNumber,
} from '@/app/actions/cross-references'
import { prisma } from '@/lib/prisma'

describe('Cross-Reference Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getImplementedEuDirectives', () => {
    it('should return EU directives that a law implements', async () => {
      const mockRefs = [
        {
          id: 'ref-1',
          context: 'Implements Article 5-7',
          target_document: {
            id: 'eu-1',
            title: 'GDPR',
            slug: 'gdpr-2016-679',
            eu_document: {
              celex_number: '32016R0679',
            },
          },
        },
        {
          id: 'ref-2',
          context: null,
          target_document: {
            id: 'eu-2',
            title: 'ePrivacy Directive',
            slug: 'eprivacy-2002-58',
            eu_document: {
              celex_number: '32002L0058',
            },
          },
        },
      ]

      vi.mocked(prisma.crossReference.findMany).mockResolvedValue(
        mockRefs as never
      )

      const result = await getImplementedEuDirectives('law-123')

      expect(result).toHaveLength(2)
      expect(result[0].title).toBe('GDPR')
      expect(result[0].celexNumber).toBe('32016R0679')
      expect(result[0].context).toBe('Implements Article 5-7')
      expect(result[1].title).toBe('ePrivacy Directive')
      expect(result[1].context).toBeNull()
    })

    it('should return empty array when law implements no EU directives', async () => {
      vi.mocked(prisma.crossReference.findMany).mockResolvedValue([])

      const result = await getImplementedEuDirectives('law-no-eu')

      expect(result).toEqual([])
    })

    it('should handle directives without CELEX number', async () => {
      const mockRefs = [
        {
          id: 'ref-1',
          context: null,
          target_document: {
            id: 'eu-1',
            title: 'Some Directive',
            slug: 'some-directive',
            eu_document: null, // No EU document relation
          },
        },
      ]

      vi.mocked(prisma.crossReference.findMany).mockResolvedValue(
        mockRefs as never
      )

      const result = await getImplementedEuDirectives('law-123')

      expect(result).toHaveLength(1)
      expect(result[0].celexNumber).toBeNull()
    })
  })

  describe('lookupLawBySfsNumber', () => {
    it('should find law by SFS number format "2018:218"', async () => {
      vi.mocked(prisma.legalDocument.findFirst).mockResolvedValue({
        slug: 'gdpr-lag-2018-218',
        title: 'Dataskyddslagen',
      } as never)

      const result = await lookupLawBySfsNumber('2018:218')

      expect(result).not.toBeNull()
      expect(result?.slug).toBe('gdpr-lag-2018-218')
      expect(result?.title).toBe('Dataskyddslagen')

      // Verify the query was called with correct normalized number
      expect(prisma.legalDocument.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            content_type: ContentType.SFS_LAW,
            OR: expect.arrayContaining([
              { document_number: 'SFS 2018:218' },
              { document_number: '2018:218' },
            ]),
          }),
        })
      )
    })

    it('should find law by SFS number format "SFS 2018:218"', async () => {
      vi.mocked(prisma.legalDocument.findFirst).mockResolvedValue({
        slug: 'gdpr-lag-2018-218',
        title: 'Dataskyddslagen',
      } as never)

      const result = await lookupLawBySfsNumber('SFS 2018:218')

      expect(result).not.toBeNull()
      // Should normalize input by removing "SFS " prefix
      expect(prisma.legalDocument.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { document_number: 'SFS 2018:218' },
              { document_number: '2018:218' },
            ]),
          }),
        })
      )
    })

    it('should handle lowercase "sfs" prefix', async () => {
      vi.mocked(prisma.legalDocument.findFirst).mockResolvedValue({
        slug: 'some-law',
        title: 'Some Law',
      } as never)

      await lookupLawBySfsNumber('sfs 2020:123')

      expect(prisma.legalDocument.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { document_number: 'SFS 2020:123' },
              { document_number: '2020:123' },
            ]),
          }),
        })
      )
    })

    it('should return null when law not found', async () => {
      vi.mocked(prisma.legalDocument.findFirst).mockResolvedValue(null)

      const result = await lookupLawBySfsNumber('9999:999')

      expect(result).toBeNull()
    })

    it('should trim whitespace from input', async () => {
      vi.mocked(prisma.legalDocument.findFirst).mockResolvedValue({
        slug: 'law',
        title: 'Law',
      } as never)

      await lookupLawBySfsNumber('  2018:218  ')

      expect(prisma.legalDocument.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([{ document_number: '2018:218' }]),
          }),
        })
      )
    })
  })
})
