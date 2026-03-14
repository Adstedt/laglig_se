/**
 * Tests for Cohere Rerank v4 integration
 * Story 14.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { rerank, buildRerankText } from '@/lib/search/rerank'

// ── Helpers ──────────────────────────────────────────────────────────────

function mockDoc(text: string, id: number) {
  return { text, id }
}

function cohereResponse(
  results: Array<{ index: number; relevance_score: number }>
) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ results }),
    text: async () => '',
  }
}

// ── Setup ────────────────────────────────────────────────────────────────

const originalEnv = process.env.COHERE_API_KEY

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  if (originalEnv !== undefined) {
    process.env.COHERE_API_KEY = originalEnv
  } else {
    delete process.env.COHERE_API_KEY
  }
  vi.restoreAllMocks()
})

// ── buildRerankText ──────────────────────────────────────────────────────

describe('buildRerankText', () => {
  it('combines header + prefix + content with correct separators', () => {
    const result = buildRerankText(
      'Denna lag gäller alla.',
      'Inledande bestämmelse om tillämpning.',
      'Testlag (SFS 2025:1) > Kap 1 > 1 §'
    )

    expect(result).toBe(
      'Testlag (SFS 2025:1) > Kap 1 > 1 §\n' +
        'Inledande bestämmelse om tillämpning.\n\n' +
        'Denna lag gäller alla.'
    )
  })

  it('handles null prefix', () => {
    const result = buildRerankText('Content only.', null, 'Header')
    expect(result).toBe('Header\n\nContent only.')
  })

  it('handles empty prefix', () => {
    const result = buildRerankText('Content only.', '', 'Header')
    expect(result).toBe('Header\n\nContent only.')
  })

  it('handles empty header and null prefix', () => {
    const result = buildRerankText('Just content.', null, '')
    expect(result).toBe('Just content.')
  })

  it('handles all empty fields', () => {
    const result = buildRerankText('Content.', '', '')
    expect(result).toBe('Content.')
  })
})

// ── rerank — passthrough guards ──────────────────────────────────────────

describe('rerank passthrough', () => {
  it('returns original order when no API key is set', async () => {
    delete process.env.COHERE_API_KEY

    const docs = [mockDoc('A', 1), mockDoc('B', 2)]
    const result = await rerank('query', docs)

    expect(result.reranked).toBe(false)
    expect(result.results).toHaveLength(2)
    expect(result.results[0]!.id).toBe(1)
    expect(result.results[1]!.id).toBe(2)
    expect(result.results[0]!.relevanceScore).toBe(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns original order for single document', async () => {
    process.env.COHERE_API_KEY = 'test-key'

    const docs = [mockDoc('A', 1)]
    const result = await rerank('query', docs)

    expect(result.reranked).toBe(false)
    expect(result.results).toHaveLength(1)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns original order for empty documents', async () => {
    process.env.COHERE_API_KEY = 'test-key'

    const result = await rerank('query', [])

    expect(result.reranked).toBe(false)
    expect(result.results).toHaveLength(0)
    expect(fetch).not.toHaveBeenCalled()
  })
})

// ── rerank — API call ────────────────────────────────────────────────────

describe('rerank API call', () => {
  it('sends correct request to Cohere', async () => {
    process.env.COHERE_API_KEY = 'test-key-123'
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(
      cohereResponse([
        { index: 0, relevance_score: 0.9 },
        { index: 1, relevance_score: 0.7 },
      ]) as Response
    )

    const docs = [mockDoc('Document A', 1), mockDoc('Document B', 2)]
    await rerank('my query', docs)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, options] = mockFetch.mock.calls[0]!
    expect(url).toBe('https://api.cohere.com/v2/rerank')

    const init = options as RequestInit
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer test-key-123'
    )
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json'
    )

    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('rerank-v4.0-pro')
    expect(body.query).toBe('my query')
    expect(body.documents).toEqual(['Document A', 'Document B'])
    expect(body.top_n).toBe(2)
  })

  it('uses custom model when specified', async () => {
    process.env.COHERE_API_KEY = 'test-key'
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(
      cohereResponse([
        { index: 0, relevance_score: 0.9 },
        { index: 1, relevance_score: 0.7 },
      ]) as Response
    )

    const docs = [mockDoc('A', 1), mockDoc('B', 2)]
    await rerank('query', docs, { model: 'rerank-v4.0-fast' })

    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body as string
    )
    expect(body.model).toBe('rerank-v4.0-fast')
  })

  it('reorders documents by relevance score', async () => {
    process.env.COHERE_API_KEY = 'test-key'
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(
      cohereResponse([
        { index: 1, relevance_score: 0.95 },
        { index: 0, relevance_score: 0.42 },
      ]) as Response
    )

    const docs = [mockDoc('Low relevance', 1), mockDoc('High relevance', 2)]
    const result = await rerank('query', docs)

    expect(result.reranked).toBe(true)
    expect(result.results[0]!.id).toBe(2) // originally second, now first
    expect(result.results[0]!.relevanceScore).toBe(0.95)
    expect(result.results[1]!.id).toBe(1)
    expect(result.results[1]!.relevanceScore).toBe(0.42)
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('respects topN option', async () => {
    process.env.COHERE_API_KEY = 'test-key'
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(
      cohereResponse([{ index: 2, relevance_score: 0.95 }]) as Response
    )

    const docs = [mockDoc('A', 1), mockDoc('B', 2), mockDoc('C', 3)]
    const result = await rerank('query', docs, { topN: 1 })

    const body = JSON.parse(
      (mockFetch.mock.calls[0]![1] as RequestInit).body as string
    )
    expect(body.top_n).toBe(1)
    expect(result.results).toHaveLength(1)
    expect(result.results[0]!.id).toBe(3)
  })
})

// ── rerank — error handling ──────────────────────────────────────────────

describe('rerank error handling', () => {
  it('returns passthrough on HTTP 500', async () => {
    process.env.COHERE_API_KEY = 'test-key'
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as Response)

    const docs = [mockDoc('A', 1), mockDoc('B', 2)]
    const result = await rerank('query', docs)

    expect(result.reranked).toBe(false)
    expect(result.results[0]!.id).toBe(1)
    expect(result.results[1]!.id).toBe(2)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cohere rerank failed (500)')
    )

    consoleSpy.mockRestore()
  })

  it('returns passthrough on network failure', async () => {
    process.env.COHERE_API_KEY = 'test-key'
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockRejectedValue(new Error('Network unreachable'))

    const docs = [mockDoc('A', 1), mockDoc('B', 2)]
    const result = await rerank('query', docs)

    expect(result.reranked).toBe(false)
    expect(result.results[0]!.id).toBe(1)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Network unreachable')
    )

    consoleSpy.mockRestore()
  })
})
