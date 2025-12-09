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
  getCourtCasesCitingLaw,
  getImplementedEuDirectives,
  lookupLawBySfsNumber,
} from '@/app/actions/cross-references'
import { prisma } from '@/lib/prisma'

describe('Cross-Reference Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCourtCasesCitingLaw', () => {
    it('should return court cases citing a law', async () => {
      const mockRefs = [
        {
          id: 'ref-1',
          context: 'Cited in paragraph 15',
          source_document: {
            id: 'case-1',
            title: 'HD 2023 ref. 45',
            slug: 'hd-2023-ref-45',
            content_type: ContentType.COURT_CASE_HD,
            publication_date: new Date('2023-06-15'),
            court_case: {
              case_number: 'T 1234-22',
              decision_date: new Date('2023-06-15'),
              court_name: 'Högsta domstolen',
            },
          },
        },
        {
          id: 'ref-2',
          context: null,
          source_document: {
            id: 'case-2',
            title: 'AD 2022 nr 50',
            slug: 'ad-2022-nr-50',
            content_type: ContentType.COURT_CASE_AD,
            publication_date: new Date('2022-10-20'),
            court_case: {
              case_number: 'A 123-21',
              decision_date: new Date('2022-10-20'),
              court_name: 'Arbetsdomstolen',
            },
          },
        },
      ]

      vi.mocked(prisma.crossReference.findMany).mockResolvedValue(mockRefs as never)
      vi.mocked(prisma.crossReference.count).mockResolvedValue(2)

      const result = await getCourtCasesCitingLaw('law-123', 10)

      expect(result.totalCount).toBe(2)
      expect(result.cases).toHaveLength(2)
      // Should be sorted by decision_date DESC (2023 before 2022)
      expect(result.cases[0].title).toBe('HD 2023 ref. 45')
      expect(result.cases[0].caseNumber).toBe('T 1234-22')
      expect(result.cases[0].context).toBe('Cited in paragraph 15')
      expect(result.cases[1].title).toBe('AD 2022 nr 50')
      expect(result.cases[1].context).toBeNull()
    })

    it('should return empty array when no court cases cite the law', async () => {
      vi.mocked(prisma.crossReference.findMany).mockResolvedValue([])
      vi.mocked(prisma.crossReference.count).mockResolvedValue(0)

      const result = await getCourtCasesCitingLaw('law-without-refs', 10)

      expect(result.cases).toEqual([])
      expect(result.totalCount).toBe(0)
    })

    it('should sort cases by decision_date DESC', async () => {
      const mockRefs = [
        {
          id: 'ref-1',
          context: null,
          source_document: {
            id: 'case-old',
            title: 'Old Case',
            slug: 'old-case',
            content_type: ContentType.COURT_CASE_HD,
            publication_date: new Date('2020-01-01'),
            court_case: {
              case_number: 'T 111-19',
              decision_date: new Date('2020-01-01'),
              court_name: 'HD',
            },
          },
        },
        {
          id: 'ref-2',
          context: null,
          source_document: {
            id: 'case-new',
            title: 'New Case',
            slug: 'new-case',
            content_type: ContentType.COURT_CASE_HD,
            publication_date: new Date('2024-01-01'),
            court_case: {
              case_number: 'T 222-23',
              decision_date: new Date('2024-01-01'),
              court_name: 'HD',
            },
          },
        },
        {
          id: 'ref-3',
          context: null,
          source_document: {
            id: 'case-mid',
            title: 'Mid Case',
            slug: 'mid-case',
            content_type: ContentType.COURT_CASE_HD,
            publication_date: new Date('2022-06-15'),
            court_case: {
              case_number: 'T 333-21',
              decision_date: new Date('2022-06-15'),
              court_name: 'HD',
            },
          },
        },
      ]

      vi.mocked(prisma.crossReference.findMany).mockResolvedValue(mockRefs as never)
      vi.mocked(prisma.crossReference.count).mockResolvedValue(3)

      const result = await getCourtCasesCitingLaw('law-123', 10)

      // Should be sorted DESC: 2024, 2022, 2020
      expect(result.cases[0].title).toBe('New Case')
      expect(result.cases[1].title).toBe('Mid Case')
      expect(result.cases[2].title).toBe('Old Case')
    })

    it('should respect the limit parameter', async () => {
      const mockRefs = Array.from({ length: 15 }, (_, i) => ({
        id: `ref-${i}`,
        context: null,
        source_document: {
          id: `case-${i}`,
          title: `Case ${i}`,
          slug: `case-${i}`,
          content_type: ContentType.COURT_CASE_HD,
          publication_date: new Date(2024, 0, i + 1),
          court_case: {
            case_number: `T ${i}-23`,
            decision_date: new Date(2024, 0, i + 1),
            court_name: 'HD',
          },
        },
      }))

      vi.mocked(prisma.crossReference.findMany).mockResolvedValue(mockRefs as never)
      vi.mocked(prisma.crossReference.count).mockResolvedValue(15)

      const result = await getCourtCasesCitingLaw('law-123', 5)

      expect(result.cases).toHaveLength(5)
      expect(result.totalCount).toBe(15) // Total count should be full count
    })

    it('should handle cases without decision_date (sort to end)', async () => {
      const mockRefs = [
        {
          id: 'ref-1',
          context: null,
          source_document: {
            id: 'case-no-date',
            title: 'Case No Date',
            slug: 'case-no-date',
            content_type: ContentType.COURT_CASE_HD,
            publication_date: null,
            court_case: {
              case_number: 'T 111-23',
              decision_date: null,
              court_name: 'HD',
            },
          },
        },
        {
          id: 'ref-2',
          context: null,
          source_document: {
            id: 'case-with-date',
            title: 'Case With Date',
            slug: 'case-with-date',
            content_type: ContentType.COURT_CASE_HD,
            publication_date: new Date('2024-01-01'),
            court_case: {
              case_number: 'T 222-23',
              decision_date: new Date('2024-01-01'),
              court_name: 'HD',
            },
          },
        },
      ]

      vi.mocked(prisma.crossReference.findMany).mockResolvedValue(mockRefs as never)
      vi.mocked(prisma.crossReference.count).mockResolvedValue(2)

      const result = await getCourtCasesCitingLaw('law-123', 10)

      // Case with date should come first (higher timestamp than 0)
      expect(result.cases[0].title).toBe('Case With Date')
      expect(result.cases[1].title).toBe('Case No Date')
    })
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

      vi.mocked(prisma.crossReference.findMany).mockResolvedValue(mockRefs as never)

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

      vi.mocked(prisma.crossReference.findMany).mockResolvedValue(mockRefs as never)

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
            OR: expect.arrayContaining([
              { document_number: '2018:218' },
            ]),
          }),
        })
      )
    })
  })
})
