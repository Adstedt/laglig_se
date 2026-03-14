/**
 * Tests for embedding generation
 * Story 14.3, Task 8 (AC: 17)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  generateEmbedding,
  generateEmbeddingsBatch,
  buildEmbeddingInput,
  vectorToString,
  setOpenAIClient,
} from '@/lib/chunks/embed-chunks'

const MOCK_EMBEDDING = new Array(1536).fill(0.1)

const mockEmbeddingsCreate = vi.fn()
const mockOpenAI = { embeddings: { create: mockEmbeddingsCreate } }

beforeEach(() => {
  vi.clearAllMocks()
  // Inject mock client directly (bypasses OpenAI constructor)
  setOpenAIClient(mockOpenAI as never)
})

afterEach(() => {
  setOpenAIClient(null)
})

describe('buildEmbeddingInput', () => {
  it('combines header + prefix + content with correct separators', () => {
    const result = buildEmbeddingInput(
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

  it('handles empty prefix', () => {
    const result = buildEmbeddingInput('Content only.', '', 'Header')
    expect(result).toBe('Header\n\nContent only.')
  })

  it('handles empty header and prefix', () => {
    const result = buildEmbeddingInput('Just content.', '', '')
    expect(result).toBe('Just content.')
  })
})

describe('generateEmbedding', () => {
  it('combines header + prefix + content and calls OpenAI', async () => {
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: MOCK_EMBEDDING, index: 0 }],
      usage: { total_tokens: 50 },
    })

    const result = await generateEmbedding(
      'Paragraf text',
      'Context prefix',
      'Header'
    )

    expect(result.embedding).toHaveLength(1536)
    expect(result.tokensUsed).toBe(50)
    expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: 'Header\nContext prefix\n\nParagraf text',
    })
  })

  it('returns 1536-dimensional vector', async () => {
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: MOCK_EMBEDDING, index: 0 }],
      usage: { total_tokens: 30 },
    })

    const result = await generateEmbedding('Text', '', '')
    expect(result.embedding).toHaveLength(1536)
    expect(result.embedding[0]).toBe(0.1)
  })

  it('throws descriptive error when API fails', async () => {
    mockEmbeddingsCreate.mockRejectedValue(new Error('Rate limit exceeded'))

    await expect(generateEmbedding('Text', '', '')).rejects.toThrow(
      /Failed to generate embedding.*Rate limit exceeded/
    )
  })
})

describe('generateEmbeddingsBatch', () => {
  it('sends all items in a single API call', async () => {
    const items = [
      { text: 'Chunk 1', contextPrefix: 'Prefix 1', contextualHeader: 'H1' },
      { text: 'Chunk 2', contextPrefix: 'Prefix 2', contextualHeader: 'H2' },
    ]
    mockEmbeddingsCreate.mockResolvedValue({
      data: [
        { embedding: MOCK_EMBEDDING, index: 0 },
        { embedding: MOCK_EMBEDDING.map(() => 0.2), index: 1 },
      ],
      usage: { total_tokens: 100 },
    })

    const result = await generateEmbeddingsBatch(items)

    expect(result.embeddings).toHaveLength(2)
    expect(result.totalTokensUsed).toBe(100)
    expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1)
    expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: ['H1\nPrefix 1\n\nChunk 1', 'H2\nPrefix 2\n\nChunk 2'],
    })
  })

  it('returns 100 embeddings in correct order for max batch', async () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      text: `Chunk ${i}`,
      contextPrefix: '',
      contextualHeader: '',
    }))

    const responseData = items.map((_, i) => ({
      embedding: MOCK_EMBEDDING,
      index: i,
    }))

    mockEmbeddingsCreate.mockResolvedValue({
      data: responseData,
      usage: { total_tokens: 5000 },
    })

    const result = await generateEmbeddingsBatch(items)

    expect(result.embeddings).toHaveLength(100)
    expect(result.totalTokensUsed).toBe(5000)
  })

  it('returns empty results for empty input', async () => {
    const result = await generateEmbeddingsBatch([])
    expect(result.embeddings).toHaveLength(0)
    expect(result.totalTokensUsed).toBe(0)
    expect(mockEmbeddingsCreate).not.toHaveBeenCalled()
  })

  it('throws when batch exceeds 100 items', async () => {
    const items = Array.from({ length: 101 }, () => ({
      text: 'x',
      contextPrefix: '',
      contextualHeader: '',
    }))

    await expect(generateEmbeddingsBatch(items)).rejects.toThrow(
      /exceeds OpenAI limit of 100/
    )
  })
})

describe('vectorToString', () => {
  it('converts number array to pgvector format', () => {
    expect(vectorToString([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]')
  })

  it('handles empty array', () => {
    expect(vectorToString([])).toBe('[]')
  })
})
