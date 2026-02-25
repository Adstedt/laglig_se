/**
 * Tests for LLM context prefix generation
 * Story 14.3, Task 8 (AC: 17)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  generateContextPrefixes,
  setAnthropicClient,
  type DocumentForContext,
  type ChunkForContext,
} from '@/lib/chunks/generate-context-prefixes'

function makeDocument(
  overrides: Partial<DocumentForContext> = {}
): DocumentForContext {
  return {
    markdown: '# Testlag\n\n## 1 kap.\n\n### 1 §\n\nDenna lag gäller för alla.',
    title: 'Testlag',
    documentNumber: 'SFS 2025:1',
    ...overrides,
  }
}

function makeChunks(count: number = 2): ChunkForContext[] {
  const chunks: ChunkForContext[] = []
  for (let i = 1; i <= count; i++) {
    chunks.push({
      path: `kap1.§${i}`,
      content: `Paragraf ${i} handlar om testinnehåll nummer ${i}.`,
    })
  }
  return chunks
}

const mockCreate = vi.fn()
const mockAnthropicClient = { messages: { create: mockCreate } }

function mockHaikuResponse(prefixes: Record<string, string>): void {
  mockCreate.mockResolvedValue({
    content: [
      {
        type: 'text',
        text: JSON.stringify({ prefixes }),
      },
    ],
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Inject mock client directly (bypasses Anthropic constructor)
  setAnthropicClient(mockAnthropicClient as never)
})

afterEach(() => {
  setAnthropicClient(null)
})

describe('generateContextPrefixes', () => {
  it('generates prefixes for all chunks in a normal document', async () => {
    const doc = makeDocument()
    const chunks = makeChunks(2)
    mockHaikuResponse({
      'kap1.§1': 'Inledande bestämmelse om lagens tillämpningsområde.',
      'kap1.§2': 'Andra paragrafen behandlar definitioner.',
    })

    const result = await generateContextPrefixes(doc, chunks)

    expect(result.size).toBe(2)
    expect(result.get('kap1.§1')).toBe(
      'Inledande bestämmelse om lagens tillämpningsområde.'
    )
    expect(result.get('kap1.§2')).toBe(
      'Andra paragrafen behandlar definitioner.'
    )
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8192,
      })
    )
  })

  it('returns empty map for empty chunks array', async () => {
    const result = await generateContextPrefixes(makeDocument(), [])
    expect(result.size).toBe(0)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('correctly parses JSON response wrapped in code block', async () => {
    const doc = makeDocument()
    const chunks = makeChunks(1)
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '```json\n{"prefixes":{"kap1.§1":"Kontext för paragraf ett."}}\n```',
        },
      ],
    })

    const result = await generateContextPrefixes(doc, chunks)

    expect(result.size).toBe(1)
    expect(result.get('kap1.§1')).toBe('Kontext för paragraf ett.')
  })

  it('retries once on transient failure then succeeds', async () => {
    const doc = makeDocument()
    const chunks = makeChunks(1)
    mockCreate
      .mockRejectedValueOnce(new Error('API timeout'))
      .mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '{"prefixes":{"kap1.§1":"Kontext efter retry."}}',
          },
        ],
      })

    const result = await generateContextPrefixes(doc, chunks)

    expect(result.size).toBe(1)
    expect(result.get('kap1.§1')).toBe('Kontext efter retry.')
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it('throws on persistent failure after retries', async () => {
    const doc = makeDocument()
    const chunks = makeChunks(1)
    mockCreate.mockRejectedValue(new Error('Persistent API error'))

    await expect(generateContextPrefixes(doc, chunks)).rejects.toThrow(
      'Persistent API error'
    )
    expect(mockCreate).toHaveBeenCalledTimes(2) // initial + 1 retry
  })

  it('handles chunks with special characters in paths', async () => {
    const doc = makeDocument()
    const chunks: ChunkForContext[] = [
      {
        path: 'overgangsbest.1',
        content: 'Övergångsbestämmelser från 2025:100.',
      },
      { path: 'bilaga.1', content: 'Bilaga med tabeller.' },
    ]
    mockHaikuResponse({
      'overgangsbest.1': 'Övergångsbestämmelse kopplad till ändrings-SFS.',
      'bilaga.1': 'Bilaga till lagen som specificerar avgifter.',
    })

    const result = await generateContextPrefixes(doc, chunks)

    expect(result.size).toBe(2)
    expect(result.get('overgangsbest.1')).toBe(
      'Övergångsbestämmelse kopplad till ändrings-SFS.'
    )
  })

  it('splits large documents at division level (>200K tokens)', async () => {
    // Create a markdown string > 200K tokens (>800K chars at 4 chars/token)
    const longMarkdown =
      '# Avdelning 1: Första\n\n## 1 kap.\n\n' +
      'A'.repeat(500_000) +
      '\n\n# Avdelning 2: Andra\n\n## 2 kap.\n\n' +
      'B'.repeat(500_000)

    const doc = makeDocument({ markdown: longMarkdown })
    const chunks: ChunkForContext[] = [
      { path: 'kap1.§1', content: 'Chunk i kapitel 1' },
      { path: 'kap2.§1', content: 'Chunk i kapitel 2' },
    ]

    // Each division call returns its own prefix
    mockCreate
      .mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '{"prefixes":{"kap1.§1":"Kontext i avd 1."}}',
          },
        ],
      })
      .mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '{"prefixes":{"kap2.§1":"Kontext i avd 2."}}',
          },
        ],
      })

    const result = await generateContextPrefixes(doc, chunks)

    expect(result.size).toBe(2)
    expect(result.get('kap1.§1')).toBe('Kontext i avd 1.')
    expect(result.get('kap2.§1')).toBe('Kontext i avd 2.')
    // Should have made 2 API calls (one per division)
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })
})
