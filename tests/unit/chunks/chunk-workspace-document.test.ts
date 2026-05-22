/**
 * Tests for workspace-file chunking (Story 17.9, Task 1)
 * Pure unit — paragraph-merge, token cap/target, content_role, metadata, and the
 * write-side isolation invariant (no null workspace_id).
 */

import { describe, it, expect } from 'vitest'
import {
  chunkUserFile,
  buildFileHeader,
  type ChunkUserFileInput,
} from '@/lib/chunks/chunk-workspace-document'

function makeFile(
  overrides: Partial<ChunkUserFileInput> = {}
): ChunkUserFileInput {
  return {
    fileId: 'file-1',
    workspaceId: 'ws-1',
    filename: 'rutin.pdf',
    category: 'POLICY',
    markdown: 'Stycke ett med tillräckligt innehåll för en chunk.',
    contentHash: 'hash-abc',
    ...overrides,
  }
}

describe('chunkUserFile — source-type + isolation', () => {
  it('stamps USER_FILE, the file id, and a non-null workspace_id on every chunk', () => {
    const chunks = chunkUserFile(makeFile())
    expect(chunks.length).toBeGreaterThan(0)
    for (const c of chunks) {
      expect(c.source_type).toBe('USER_FILE')
      expect(c.source_id).toBe('file-1')
      expect(c.workspace_id).toBe('ws-1')
      expect(c.workspace_id).not.toBeNull()
    }
  })

  it('write-side invariant: throws rather than emit a chunk with a null/empty workspace_id', () => {
    expect(() => chunkUserFile(makeFile({ workspaceId: '' }))).toThrow(
      /workspace_id is required/
    )
  })

  it('sets contextual_header = filename + category and writes defensive metadata', () => {
    const chunks = chunkUserFile(makeFile())
    expect(chunks[0]!.contextual_header).toBe(
      buildFileHeader('rutin.pdf', 'POLICY')
    )
    expect(chunks[0]!.metadata).toMatchObject({
      filename: 'rutin.pdf',
      category: 'POLICY',
      content_hash: 'hash-abc',
    })
  })

  it('omits content_hash from metadata when not provided', () => {
    const chunks = chunkUserFile(makeFile({ contentHash: null }))
    expect(chunks[0]!.metadata).not.toHaveProperty('content_hash')
    expect(chunks[0]!.metadata).toMatchObject({ filename: 'rutin.pdf' })
  })
})

describe('chunkUserFile — paragraph-merge chunking', () => {
  it('merges small adjacent paragraphs into a single chunk (below the token target)', () => {
    const markdown =
      'Första korta stycket.\n\nAndra korta stycket.\n\nTredje stycket.'
    const chunks = chunkUserFile(makeFile({ markdown }))
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.content).toContain('Första')
    expect(chunks[0]!.content).toContain('Tredje')
  })

  it('splits an oversized block and caps each chunk at ~1000 tokens', () => {
    // ~6000 chars of sentences => >1000 tokens => splitOversized into multiple chunks.
    const sentence = 'Detta är en mening om arbetsmiljö och rutiner. '
    const big = sentence.repeat(130) // ~6240 chars
    const chunks = chunkUserFile(makeFile({ markdown: big }))
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.token_count).toBeLessThanOrEqual(1000)
    }
  })

  it('drops blocks below the minimum chunk size', () => {
    const chunks = chunkUserFile(makeFile({ markdown: 'kort' }))
    expect(chunks).toHaveLength(0)
  })

  it('returns no chunks for empty markdown', () => {
    expect(chunkUserFile(makeFile({ markdown: '' }))).toHaveLength(0)
    expect(chunkUserFile(makeFile({ markdown: '   \n\n  ' }))).toHaveLength(0)
  })
})

describe('chunkUserFile — content_role detection', () => {
  it('classifies a standalone heading as HEADING', () => {
    const markdown = '# Rubrik ett\n\n## Rubrik två med lite mer text här'
    const chunks = chunkUserFile(makeFile({ markdown }))
    // Each heading becomes its own block (merge never spans headings).
    expect(chunks.every((c) => c.content_role === 'HEADING')).toBe(true)
  })

  it('classifies a markdown table block as TABLE', () => {
    const markdown =
      '| Kolumn A | Kolumn B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |'
    const chunks = chunkUserFile(makeFile({ markdown }))
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.content_role).toBe('TABLE')
  })

  it('classifies prose as MARKDOWN_CHUNK', () => {
    const markdown =
      'Detta är ett vanligt stycke text som beskriver en rutin i verksamheten.'
    const chunks = chunkUserFile(makeFile({ markdown }))
    expect(chunks[0]!.content_role).toBe('MARKDOWN_CHUNK')
  })
})
