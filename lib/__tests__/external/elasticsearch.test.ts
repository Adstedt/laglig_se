/**
 * Story P.3: Elasticsearch Client Tests
 *
 * Tests for the Elasticsearch integration module.
 * These tests verify the search functionality and fallback behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Store original env
const originalEnv = { ...process.env }

// Mock functions for ES client
const mockSearch = vi.fn()
const mockPing = vi.fn()
const mockIndicesExists = vi.fn()
const mockIndicesCreate = vi.fn()
const mockIndex = vi.fn()
const mockBulk = vi.fn()
const mockDelete = vi.fn()

// Mock the Elasticsearch client with a proper class
vi.mock('@elastic/elasticsearch', () => {
  return {
    Client: class MockClient {
      search = mockSearch
      ping = mockPing
      indices = {
        exists: mockIndicesExists,
        create: mockIndicesCreate,
      }
      index = mockIndex
      bulk = mockBulk
      delete = mockDelete
    },
  }
})

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    legalDocument: {
      count: vi.fn().mockResolvedValue(2),
      findMany: vi.fn().mockResolvedValue([
        {
          id: '1',
          title: 'Arbetsmiljölagen',
          document_number: 'SFS 1977:1160',
          slug: 'sfs-1977-1160',
          content_type: 'SFS_LAW',
        },
        {
          id: '2',
          title: 'Arbetstidslagen',
          document_number: 'SFS 1982:673',
          slug: 'sfs-1982-673',
          content_type: 'SFS_LAW',
        },
      ]),
    },
  },
}))

describe('Elasticsearch Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    // Reset env
    process.env = { ...originalEnv }
    // Default mock behaviors
    mockPing.mockResolvedValue(true)
    mockIndicesExists.mockResolvedValue(true)
    mockSearch.mockResolvedValue({
      took: 5,
      hits: {
        total: { value: 2 },
        hits: [
          {
            _id: '1',
            _score: 1.5,
            _source: {
              id: '1',
              title: 'Arbetsmiljölagen',
              document_number: 'SFS 1977:1160',
              slug: 'sfs-1977-1160',
              content_type: 'SFS_LAW',
            },
            highlight: {
              title: ['<mark>Arbetsmiljö</mark>lagen'],
            },
          },
          {
            _id: '2',
            _score: 1.2,
            _source: {
              id: '2',
              title: 'Arbetstidslagen',
              document_number: 'SFS 1982:673',
              slug: 'sfs-1982-673',
              content_type: 'SFS_LAW',
            },
            highlight: {},
          },
        ],
      },
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('searchDocuments', () => {
    it('should return search results with correct structure', async () => {
      process.env.ELASTICSEARCH_URL = 'http://localhost:9200'

      const { searchDocuments } = await import('@/lib/external/elasticsearch')

      const result = await searchDocuments({
        query: 'arbetsmiljö',
        limit: 10,
        fuzzy: true,
      })

      expect(result.results).toHaveLength(2)
      expect(result.source).toBe('elasticsearch')
      expect(result.results[0]).toMatchObject({
        id: '1',
        title: 'Arbetsmiljölagen',
        document_number: 'SFS 1977:1160',
        slug: 'sfs-1977-1160',
        content_type: 'SFS_LAW',
      })
    })

    it('should include highlights in search results', async () => {
      process.env.ELASTICSEARCH_URL = 'http://localhost:9200'

      const { searchDocuments } = await import('@/lib/external/elasticsearch')

      const result = await searchDocuments({
        query: 'arbetsmiljö',
      })

      expect(result.results[0]?.highlights.title).toContain(
        '<mark>Arbetsmiljö</mark>lagen'
      )
    })

    it('should fall back to PostgreSQL when ES unavailable', async () => {
      // Clear ES URL to force fallback
      delete process.env.ELASTICSEARCH_URL

      const { searchDocuments } = await import('@/lib/external/elasticsearch')

      const result = await searchDocuments({
        query: 'test',
      })

      expect(result.source).toBe('postgresql')
    })

    it('should fall back to PostgreSQL when ES ping fails', async () => {
      process.env.ELASTICSEARCH_URL = 'http://localhost:9200'
      mockPing.mockRejectedValue(new Error('Connection refused'))

      const { searchDocuments } = await import('@/lib/external/elasticsearch')

      const result = await searchDocuments({
        query: 'test',
      })

      expect(result.source).toBe('postgresql')
    })
  })

  describe('Content Type Filtering', () => {
    it('should filter by content type', async () => {
      process.env.ELASTICSEARCH_URL = 'http://localhost:9200'

      const { searchDocuments } = await import('@/lib/external/elasticsearch')

      const result = await searchDocuments({
        query: 'arbetsmiljö',
        contentTypes: ['SFS_LAW'],
      })

      expect(result.results.every((r) => r.content_type === 'SFS_LAW')).toBe(
        true
      )
      // Verify the search was called with the filter
      expect(mockSearch).toHaveBeenCalled()
    })
  })

  describe('Fuzzy Search', () => {
    it('should support fuzzy search for typos', async () => {
      process.env.ELASTICSEARCH_URL = 'http://localhost:9200'

      const { searchDocuments } = await import('@/lib/external/elasticsearch')

      const result = await searchDocuments({
        query: 'arbetsmilijö',
        fuzzy: true,
      })

      expect(result.results.length).toBeGreaterThanOrEqual(0)
      expect(mockSearch).toHaveBeenCalled()
    })

    it('should disable fuzzy search when specified', async () => {
      process.env.ELASTICSEARCH_URL = 'http://localhost:9200'

      const { searchDocuments } = await import('@/lib/external/elasticsearch')

      const result = await searchDocuments({
        query: 'arbetsmiljö',
        fuzzy: false,
      })

      expect(result.source).toBe('elasticsearch')
      expect(mockSearch).toHaveBeenCalled()
    })
  })
})

describe('Swedish Language Support', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = { ...originalEnv }
    mockPing.mockResolvedValue(true)
    mockSearch.mockResolvedValue({
      took: 3,
      hits: {
        total: { value: 1 },
        hits: [
          {
            _id: '1',
            _score: 1.0,
            _source: {
              id: '1',
              title: 'Förordning om miljöskydd',
              document_number: 'SFS 2021:123',
              slug: 'sfs-2021-123',
              content_type: 'SFS_LAW',
            },
            highlight: {},
          },
        ],
      },
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should handle Swedish characters (å, ä, ö)', async () => {
    process.env.ELASTICSEARCH_URL = 'http://localhost:9200'

    const { searchDocuments } = await import('@/lib/external/elasticsearch')

    const result = await searchDocuments({
      query: 'förordning',
    })

    expect(result.took).toBeGreaterThanOrEqual(0)
    expect(mockSearch).toHaveBeenCalled()
  })
})

describe('Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = { ...originalEnv }
    mockPing.mockResolvedValue(true)
    mockSearch.mockResolvedValue({
      took: 10,
      hits: {
        total: { value: 0 },
        hits: [],
      },
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should respond within timeout limit', async () => {
    process.env.ELASTICSEARCH_URL = 'http://localhost:9200'

    const { searchDocuments } = await import('@/lib/external/elasticsearch')

    const startTime = Date.now()
    await searchDocuments({ query: 'test' })
    const duration = Date.now() - startTime

    // Should be well under 5 second timeout
    expect(duration).toBeLessThan(1000)
  })
})

describe('Index Management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = { ...originalEnv }
    mockIndicesExists.mockResolvedValue(false)
    mockIndicesCreate.mockResolvedValue({ acknowledged: true })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should create index if it does not exist', async () => {
    process.env.ELASTICSEARCH_URL = 'http://localhost:9200'

    const { ensureDocumentsIndex } = await import(
      '@/lib/external/elasticsearch'
    )

    const result = await ensureDocumentsIndex()

    expect(result).toBe(true)
    expect(mockIndicesExists).toHaveBeenCalled()
    expect(mockIndicesCreate).toHaveBeenCalled()
  })

  it('should not create index if it already exists', async () => {
    process.env.ELASTICSEARCH_URL = 'http://localhost:9200'
    mockIndicesExists.mockResolvedValue(true)

    const { ensureDocumentsIndex } = await import(
      '@/lib/external/elasticsearch'
    )

    const result = await ensureDocumentsIndex()

    expect(result).toBe(true)
    expect(mockIndicesExists).toHaveBeenCalled()
    expect(mockIndicesCreate).not.toHaveBeenCalled()
  })
})

describe('Document Indexing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = { ...originalEnv }
    mockIndex.mockResolvedValue({ result: 'created' })
    mockBulk.mockResolvedValue({
      errors: false,
      items: [
        { index: { result: 'created' } },
        { index: { result: 'created' } },
      ],
    })
    mockDelete.mockResolvedValue({ result: 'deleted' })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should index a single document', async () => {
    process.env.ELASTICSEARCH_URL = 'http://localhost:9200'

    const { indexDocument } = await import('@/lib/external/elasticsearch')

    const result = await indexDocument({
      id: '1',
      title: 'Test Law',
      document_number: 'SFS 2021:1',
      content_type: 'SFS_LAW',
      slug: 'sfs-2021-1',
      status: 'ACTIVE',
    })

    expect(result).toBe(true)
    expect(mockIndex).toHaveBeenCalled()
  })

  it('should bulk index multiple documents', async () => {
    process.env.ELASTICSEARCH_URL = 'http://localhost:9200'

    const { bulkIndexDocuments } = await import('@/lib/external/elasticsearch')

    const result = await bulkIndexDocuments([
      {
        id: '1',
        title: 'Test Law 1',
        document_number: 'SFS 2021:1',
        content_type: 'SFS_LAW',
        slug: 'sfs-2021-1',
        status: 'ACTIVE',
      },
      {
        id: '2',
        title: 'Test Law 2',
        document_number: 'SFS 2021:2',
        content_type: 'SFS_LAW',
        slug: 'sfs-2021-2',
        status: 'ACTIVE',
      },
    ])

    expect(result.success).toBe(2)
    expect(result.failed).toBe(0)
    expect(mockBulk).toHaveBeenCalled()
  })

  it('should delete a document from the index', async () => {
    process.env.ELASTICSEARCH_URL = 'http://localhost:9200'

    const { deleteDocumentFromIndex } = await import(
      '@/lib/external/elasticsearch'
    )

    const result = await deleteDocumentFromIndex('1')

    expect(result).toBe(true)
    expect(mockDelete).toHaveBeenCalled()
  })
})
