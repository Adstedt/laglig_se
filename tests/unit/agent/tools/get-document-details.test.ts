import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    legalDocument: {
      findFirst: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { createGetDocumentDetailsTool } from '@/lib/agent/tools/get-document-details'

const mockFindFirst = vi.mocked(prisma.legalDocument.findFirst)

describe('get_document_details tool', () => {
  const tool = createGetDocumentDetailsTool()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns document by documentNumber with _meta', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'doc-1',
      title: 'Arbetsmiljölag',
      document_number: 'SFS 1977:1160',
      content_type: 'SFS_LAW',
      status: 'ACTIVE',
      summary: 'Reglerar arbetsmiljön.',
      kommentar: 'Vi ska följa arbetsmiljölagen.',
      markdown_content: '# Arbetsmiljölag\n\nKapitel 1...',
      effective_date: new Date('1978-07-01'),
      slug: 'sfs-1977-1160',
    } as never)

    const result = await tool.execute(
      { documentNumber: 'SFS 1977:1160' },
      {
        toolCallId: 'tc-1',
        messages: [],
        abortSignal: undefined as unknown as AbortSignal,
      }
    )

    expect(result).toHaveProperty('_meta')
    expect(result._meta.tool).toBe('get_document_details')
    expect(result._meta.resultCount).toBe(1)

    const data = (result as { data: Record<string, unknown> }).data
    expect(data.title).toBe('Arbetsmiljölag')
    expect(data.documentNumber).toBe('SFS 1977:1160')
    expect(data.path).toBe('/lagar/sfs-1977-1160')
  })

  it('returns document by documentId', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'doc-1',
      title: 'Test',
      document_number: 'SFS 2020:1',
      content_type: 'SFS_LAW',
      status: 'ACTIVE',
      summary: null,
      kommentar: null,
      markdown_content: null,
      effective_date: null,
      slug: 'sfs-2020-1',
    } as never)

    await tool.execute(
      { documentId: 'doc-1' },
      {
        toolCallId: 'tc-2',
        messages: [],
        abortSignal: undefined as unknown as AbortSignal,
      }
    )

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
      })
    )
  })

  it('returns error with Swedish guidance when neither ID nor number provided', async () => {
    const result = await tool.execute(
      {},
      {
        toolCallId: 'tc-3',
        messages: [],
        abortSignal: undefined as unknown as AbortSignal,
      }
    )

    expect(result).toMatchObject({
      error: true,
      _meta: { tool: 'get_document_details' },
    })
    expect((result as { guidance: string }).guidance).toContain(
      'dokumentnummer'
    )
  })

  it('returns error with Swedish guidance when document not found', async () => {
    mockFindFirst.mockResolvedValue(null)

    const result = await tool.execute(
      { documentNumber: 'SFS 9999:9999' },
      {
        toolCallId: 'tc-4',
        messages: [],
        abortSignal: undefined as unknown as AbortSignal,
      }
    )

    expect(result).toMatchObject({
      error: true,
      message: expect.stringContaining('SFS 9999:9999'),
      _meta: { tool: 'get_document_details', resultCount: 0 },
    })
    expect((result as { guidance: string }).guidance).toContain('SFS 1977:1160')
  })

  it('truncates long markdown content', async () => {
    const longContent = 'A'.repeat(20000) // ~5000 tokens, exceeds 4000 default
    mockFindFirst.mockResolvedValue({
      id: 'doc-1',
      title: 'Long',
      document_number: 'SFS 2020:1',
      content_type: 'SFS_LAW',
      status: 'ACTIVE',
      summary: null,
      kommentar: null,
      markdown_content: longContent,
      effective_date: null,
      slug: 'sfs-2020-1',
    } as never)

    const result = await tool.execute(
      { documentId: 'doc-1' },
      {
        toolCallId: 'tc-5',
        messages: [],
        abortSignal: undefined as unknown as AbortSignal,
      }
    )

    const data = (result as { data: Record<string, unknown> }).data
    const md = data.markdownContent as string
    expect(md.length).toBeLessThan(longContent.length)
    expect(md).toContain('[... innehållet trunkerat]')
  })
})
