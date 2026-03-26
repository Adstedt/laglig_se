import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma before importing the module under test
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

  it('includes citationKeys derived from json_content chapters/paragrafer', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'doc-1',
      title: 'Arbetsmiljölag',
      document_number: 'SFS 1977:1160',
      content_type: 'SFS_LAW',
      status: 'ACTIVE',
      summary: 'Lag om arbetsmiljö',
      kommentar: null,
      markdown_content: '# Arbetsmiljölag\n...',
      json_content: {
        chapters: [
          {
            number: '3',
            paragrafer: [{ number: '1' }, { number: '2' }, { number: '2a' }],
          },
          {
            number: '5',
            paragrafer: [{ number: '3' }],
          },
        ],
      },
      effective_date: new Date('1978-01-01'),
      slug: 'sfs-1977-1160',
    } as never)

    const result = (await tool.execute(
      { documentNumber: 'SFS 1977:1160' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as never }
    )) as { data: { citationKeys: string[] } }

    expect(result.data.citationKeys).toEqual([
      'SFS 1977:1160, Kap 3, 1 §',
      'SFS 1977:1160, Kap 3, 2 §',
      'SFS 1977:1160, Kap 3, 2a §',
      'SFS 1977:1160, Kap 5, 3 §',
    ])
  })

  it('returns empty citationKeys when json_content is null', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'doc-2',
      title: 'Some law',
      document_number: 'SFS 1982:80',
      content_type: 'SFS_LAW',
      status: 'ACTIVE',
      summary: null,
      kommentar: null,
      markdown_content: '# LAS',
      json_content: null,
      effective_date: null,
      slug: 'sfs-1982-80',
    } as never)

    const result = (await tool.execute(
      { documentNumber: 'SFS 1982:80' },
      { toolCallId: 'tc-2', messages: [], abortSignal: undefined as never }
    )) as { data: { citationKeys: string[] } }

    expect(result.data.citationKeys).toEqual([])
  })

  it('handles flat docs (chapter 0) in citationKeys', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'doc-3',
      title: 'Flat law',
      document_number: 'SFS 1982:80',
      content_type: 'SFS_LAW',
      status: 'ACTIVE',
      summary: null,
      kommentar: null,
      markdown_content: '# LAS',
      json_content: {
        chapters: [
          {
            number: '0',
            paragrafer: [{ number: '7' }, { number: '8' }],
          },
        ],
      },
      effective_date: null,
      slug: 'sfs-1982-80',
    } as never)

    const result = (await tool.execute(
      { documentNumber: 'SFS 1982:80' },
      { toolCallId: 'tc-3', messages: [], abortSignal: undefined as never }
    )) as { data: { citationKeys: string[] } }

    expect(result.data.citationKeys).toEqual([
      'SFS 1982:80, 7 §',
      'SFS 1982:80, 8 §',
    ])
  })
})
