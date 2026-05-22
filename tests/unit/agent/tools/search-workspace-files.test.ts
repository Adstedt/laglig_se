/**
 * Unit tests for the search_workspace_files tool (Story 17.9c, Task 1 + 6).
 * Mocks retrieveContext — these assert result mapping, the empty-result error path,
 * and that the tool calls retrieveContext with EXACTLY sourceTypes: ['USER_FILE']
 * (never LEGAL_DOCUMENT).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/agent/retrieval', () => ({
  retrieveContext: vi.fn(),
}))

import { retrieveContext } from '@/lib/agent/retrieval'
import { createSearchWorkspaceFilesTool } from '@/lib/agent/tools/search-workspace-files'

const mockRetrieve = retrieveContext as ReturnType<typeof vi.fn>

// The AI SDK `tool()` wraps execute; call it via the tool's `execute` directly.
type ToolWithExecute = {
  execute: (
    _args: { query: string; limit?: number },
    _opts?: unknown
  ) => Promise<unknown>
}

function makeTool(workspaceId = 'ws-1') {
  return createSearchWorkspaceFilesTool(
    workspaceId
  ) as unknown as ToolWithExecute
}

function resultRow(over: Record<string, unknown> = {}) {
  return {
    id: 'chunk-1',
    content: 'Vår dataskyddspolicy kräver kryptering av personuppgifter.',
    contextualHeader: 'dataskyddspolicy.pdf (POLICY)',
    contextPrefix: null,
    path: 'file.chunk1',
    sourceType: 'USER_FILE',
    sourceId: 'file-42',
    documentNumber: null,
    slug: null,
    similarity: 0.91,
    relevanceScore: 0.876543,
    tokenCount: 120,
    metadata: { filename: 'dataskyddspolicy.pdf', category: 'POLICY' },
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('search_workspace_files — retrieveContext invocation', () => {
  it('calls retrieveContext with exactly sourceTypes: [USER_FILE] and the workspace + limit', async () => {
    mockRetrieve.mockResolvedValue({ results: [resultRow()] })
    const tool = makeTool('ws-77')

    await tool.execute({ query: 'dataskydd', limit: 7 })

    expect(mockRetrieve).toHaveBeenCalledTimes(1)
    const [query, workspaceId, options] = mockRetrieve.mock.calls[0]!
    expect(query).toBe('dataskydd')
    expect(workspaceId).toBe('ws-77')
    expect(options).toEqual({ sourceTypes: ['USER_FILE'], topK: 7 })
  })

  it('NEVER passes sourceType: LEGAL_DOCUMENT (or any legal source type)', async () => {
    mockRetrieve.mockResolvedValue({ results: [resultRow()] })
    const tool = makeTool()

    await tool.execute({ query: 'q', limit: 5 })

    const options = mockRetrieve.mock.calls[0]![2] as Record<string, unknown>
    expect(options.sourceType).toBeUndefined()
    expect(options.sourceTypes).toEqual(['USER_FILE'])
    expect(JSON.stringify(options)).not.toContain('LEGAL_DOCUMENT')
  })
})

describe('search_workspace_files — result mapping (AC 4)', () => {
  it('maps a chunk to fileId/filename/category/snippet/relevanceScore/citationKey', async () => {
    mockRetrieve.mockResolvedValue({ results: [resultRow()] })
    const tool = makeTool()

    const out = (await tool.execute({ query: 'dataskydd', limit: 5 })) as {
      data: Array<Record<string, unknown>>
    }

    expect(out.data).toHaveLength(1)
    expect(out.data[0]).toEqual({
      fileId: 'file-42',
      filename: 'dataskyddspolicy.pdf',
      category: 'POLICY',
      snippet: 'Vår dataskyddspolicy kräver kryptering av personuppgifter.',
      relevanceScore: 0.877, // rounded to 3 decimals
      citationKey: 'dataskyddspolicy.pdf',
    })
  })

  it('citationKey equals the filename (so [Källa: <filename>] resolves)', async () => {
    mockRetrieve.mockResolvedValue({ results: [resultRow()] })
    const tool = makeTool()

    const out = (await tool.execute({ query: 'q', limit: 5 })) as {
      data: Array<{ filename: string; citationKey: string }>
    }
    expect(out.data[0]!.citationKey).toBe(out.data[0]!.filename)
  })

  it('falls back to contextualHeader, then sourceId, when metadata.filename is absent', async () => {
    mockRetrieve.mockResolvedValue({
      results: [
        resultRow({ metadata: null, contextualHeader: 'rutin.pdf (OVRIGT)' }),
        resultRow({
          sourceId: 'file-99',
          metadata: {},
          contextualHeader: '',
        }),
      ],
    })
    const tool = makeTool()

    const out = (await tool.execute({ query: 'q', limit: 5 })) as {
      data: Array<{ filename: string; category: string | null }>
    }
    expect(out.data[0]!.filename).toBe('rutin.pdf (OVRIGT)')
    expect(out.data[0]!.category).toBeNull()
    expect(out.data[1]!.filename).toBe('file-99')
  })
})

describe('search_workspace_files — empty + error paths (AC 5)', () => {
  it('returns a Swedish wrapToolError with a rephrase hint when there are no results', async () => {
    mockRetrieve.mockResolvedValue({ results: [] })
    const tool = makeTool()

    const out = (await tool.execute({ query: 'okänt', limit: 5 })) as {
      error: boolean
      message: string
      guidance: string
    }
    expect(out.error).toBe(true)
    expect(out.message).toMatch(/inga resultat/i)
    expect(out.guidance).toMatch(/omformulera|bredare/i)
  })

  it('wraps a thrown retrieval error rather than throwing', async () => {
    mockRetrieve.mockRejectedValue(new Error('pgvector exploded'))
    const tool = makeTool()

    const out = (await tool.execute({ query: 'q', limit: 5 })) as {
      error: boolean
      message: string
    }
    expect(out.error).toBe(true)
    expect(out.message).toMatch(/misslyckades.*pgvector exploded/i)
  })
})
