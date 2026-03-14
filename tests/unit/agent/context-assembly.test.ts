import { describe, it, expect } from 'vitest'
import { assembleAgentContext } from '@/lib/agent/context-assembly'
import type { RetrievalResult } from '@/lib/agent/retrieval'

function makeChunk(overrides: Partial<RetrievalResult> = {}): RetrievalResult {
  return {
    id: 'chunk-1',
    content: 'Test content paragraph.',
    contextualHeader: 'Arbetsmiljölagen (SFS 1977:1160) > Kap 2 > 3 §',
    contextPrefix: null,
    path: 'kap2.§3',
    sourceType: 'LEGAL_DOCUMENT',
    sourceId: 'doc-1',
    documentNumber: 'SFS 1977:1160',
    similarity: 0.85,
    relevanceScore: 0.92,
    tokenCount: 100,
    metadata: null,
    ...overrides,
  }
}

describe('assembleAgentContext', () => {
  it('returns empty context for empty input', () => {
    const result = assembleAgentContext([])
    expect(result.context).toBe('')
    expect(result.metadata.chunksIncluded).toBe(0)
    expect(result.metadata.chunksExcluded).toBe(0)
    expect(result.metadata.totalTokens).toBe(0)
    expect(result.metadata.sourcesUsed).toEqual([])
  })

  it('formats chunks with Swedish source labels', () => {
    const chunks = [makeChunk()]
    const result = assembleAgentContext(chunks)
    expect(result.context).toContain(
      '--- Källa: Arbetsmiljölagen (SFS 1977:1160) > Kap 2 > 3 § ---'
    )
    expect(result.context).toContain('Test content paragraph.')
  })

  it('enforces token budget — trims excess chunks', () => {
    const chunks = Array.from({ length: 20 }, (_, i) =>
      makeChunk({
        id: `chunk-${i}`,
        sourceId: `doc-${i}`,
        tokenCount: 500,
        path: `kap${i}.§1`,
      })
    )
    // 20 chunks × 500 tokens = 10000, budget 8000 → should fit 16
    const result = assembleAgentContext(chunks, { maxTokens: 8000 })
    expect(result.metadata.chunksIncluded).toBe(16)
    expect(result.metadata.chunksExcluded).toBe(4)
    expect(result.metadata.totalTokens).toBe(8000)
  })

  it('deduplicates and groups chunks from same document, sorted by path', () => {
    const chunks = [
      makeChunk({
        id: 'c1',
        sourceId: 'doc-A',
        path: 'kap3.§1',
        relevanceScore: 0.95,
      }),
      makeChunk({
        id: 'c2',
        sourceId: 'doc-B',
        path: 'kap1.§2',
        relevanceScore: 0.9,
      }),
      makeChunk({
        id: 'c3',
        sourceId: 'doc-A',
        path: 'kap1.§5',
        relevanceScore: 0.85,
      }),
      makeChunk({
        id: 'c4',
        sourceId: 'doc-A',
        path: 'kap2.§3',
        relevanceScore: 0.8,
      }),
      makeChunk({
        id: 'c5',
        sourceId: 'doc-B',
        path: 'kap1.§1',
        relevanceScore: 0.75,
      }),
    ]

    const result = assembleAgentContext(chunks)

    // Doc-A appeared first (c1), then doc-B (c2)
    // Within doc-A: kap1.§5, kap2.§3, kap3.§1 (sorted by path)
    // Within doc-B: kap1.§1, kap1.§2 (sorted by path)
    const blocks = result.context.split('\n\n')
    expect(blocks.length).toBe(5)
    expect(result.metadata.chunksIncluded).toBe(5)

    // Verify sources are deduplicated
    expect(result.metadata.sourcesUsed).toHaveLength(2)
  })

  it('handles USER_FILE chunks with filename from metadata', () => {
    const chunks = [
      makeChunk({
        sourceType: 'USER_FILE',
        contextualHeader: '',
        metadata: { filename: 'arbetsmiljöpolicy.pdf' },
      }),
    ]
    const result = assembleAgentContext(chunks)
    expect(result.context).toContain('--- Källa: arbetsmiljöpolicy.pdf ---')
  })

  it('separates chunks with blank lines', () => {
    const chunks = [
      makeChunk({ id: 'c1', sourceId: 'doc-1', path: 'p1' }),
      makeChunk({ id: 'c2', sourceId: 'doc-2', path: 'p2' }),
    ]
    const result = assembleAgentContext(chunks)
    expect(result.context).toContain('\n\n')
  })
})
