import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the dependencies before importing the module
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    legalDocument: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

vi.mock('@/lib/cache/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
  isRedisConfigured: vi.fn().mockReturnValue(false),
}))

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('127.0.0.1'),
  }),
}))

vi.mock('@vercel/analytics/server', () => ({
  track: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/analytics', () => ({
  safeTrack: vi.fn().mockResolvedValue(undefined),
}))

// Import after mocking
import {
  searchDocumentsAction,
  searchAutocompleteAction,
  type SearchInput,
} from '@/app/actions/search'
import { prisma } from '@/lib/prisma'

describe('Search Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('searchDocumentsAction', () => {
    it('should return empty results for empty query', async () => {
      vi.mocked(prisma.legalDocument.findMany).mockResolvedValue([])
      vi.mocked(prisma.legalDocument.count).mockResolvedValue(0)

      const input: SearchInput = {
        query: '',
        page: 1,
        limit: 20,
      }

      const result = await searchDocumentsAction(input)

      expect(result.success).toBe(true)
      expect(result.results).toEqual([])
      expect(result.total).toBe(0)
    })

    it('should validate search input schema', async () => {
      const invalidInput = {
        query: 'a'.repeat(300), // Too long
        page: 1,
        limit: 20,
      }

      const result = await searchDocumentsAction(
        invalidInput as unknown as SearchInput
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Ogiltiga sokparametrar')
    })

    it('should return results for valid query', async () => {
      const mockResults = [
        {
          id: '1',
          title: 'Test Law',
          document_number: 'SFS 2024:1',
          content_type: 'SFS_LAW',
          summary: 'Test summary',
          effective_date: new Date('2024-01-01'),
          status: 'ACTIVE',
          slug: 'test-law',
          category: 'Test Category',
          rank: 0.5,
          snippet: 'Test <mark>query</mark> result',
          total_count: BigInt(1),
        },
      ]

      vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue(mockResults)

      const input: SearchInput = {
        query: 'test',
        page: 1,
        limit: 20,
      }

      const result = await searchDocumentsAction(input)

      expect(result.success).toBe(true)
      expect(result.results.length).toBe(1)
      expect(result.results[0].title).toBe('Test Law')
      expect(result.results[0].documentNumber).toBe('SFS 2024:1')
      expect(result.total).toBe(1)
    })

    it('should apply content type filters', async () => {
      vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([])

      const input: SearchInput = {
        query: 'test',
        contentTypes: ['SFS_LAW', 'EU_REGULATION'],
        page: 1,
        limit: 20,
      }

      await searchDocumentsAction(input)

      expect(prisma.$queryRawUnsafe).toHaveBeenCalled()
      const queryCall = vi.mocked(prisma.$queryRawUnsafe).mock.calls[0]
      expect(queryCall[0]).toContain('content_type')
    })

    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.$queryRawUnsafe).mockRejectedValue(
        new Error('Database connection failed')
      )

      const input: SearchInput = {
        query: 'test',
        page: 1,
        limit: 20,
      }

      const result = await searchDocumentsAction(input)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Soktjansten ar tillfalligt otillganglig')
    })

    it('should apply pagination correctly', async () => {
      vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([])

      const input: SearchInput = {
        query: 'test',
        page: 3,
        limit: 10,
      }

      await searchDocumentsAction(input)

      expect(prisma.$queryRawUnsafe).toHaveBeenCalled()
      const queryCall = vi.mocked(prisma.$queryRawUnsafe).mock.calls[0]
      expect(queryCall[0]).toContain('OFFSET 20') // (3-1) * 10 = 20
    })
  })

  describe('searchAutocompleteAction', () => {
    it('should return empty array for short query', async () => {
      const result = await searchAutocompleteAction('a')

      expect(result.suggestions).toEqual([])
      expect(prisma.legalDocument.findMany).not.toHaveBeenCalled()
    })

    it('should return suggestions for valid query', async () => {
      vi.mocked(prisma.legalDocument.findMany).mockResolvedValue([
        {
          id: '1',
          title: 'Arbetsmiljolagen',
          slug: 'arbetsmiljolagen',
          content_type: 'SFS_LAW',
          document_number: 'SFS 1977:1160',
          summary: null,
          full_text: null,
          html_content: null,
          effective_date: null,
          publication_date: null,
          status: 'ACTIVE',
          source_url: 'https://example.com',
          metadata: null,
          search_vector: null,
          embedding: null,
          created_at: new Date(),
          updated_at: new Date(),
          subjects: [{ subject_name: 'Arbetsratt' }],
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.legalDocument.findMany>>)

      const result = await searchAutocompleteAction('arbetsmiljo')

      expect(result.suggestions.length).toBe(1)
      expect(result.suggestions[0].title).toBe('Arbetsmiljolagen')
      expect(result.suggestions[0].type).toBe('SFS_LAW')
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(prisma.legalDocument.findMany).mockRejectedValue(
        new Error('Database error')
      )

      const result = await searchAutocompleteAction('test')

      expect(result.suggestions).toEqual([])
    })
  })
})
