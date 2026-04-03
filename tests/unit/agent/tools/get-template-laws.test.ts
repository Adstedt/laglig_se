import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    lawListTemplate: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { createGetTemplateLawsTool } from '@/lib/agent/tools/get-template-laws'

const mockFindMany = vi.mocked(prisma.lawListTemplate.findMany)

function makeExecuteArgs() {
  return {
    toolCallId: 'tc-1',
    messages: [],
    abortSignal: undefined as unknown as AbortSignal,
  }
}

describe('get_template_laws tool', () => {
  const tool = createGetTemplateLawsTool()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns curated laws for a known area', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'tmpl-1',
        name: 'Arbetsmiljömallar',
        items: [
          {
            document_id: 'doc-1',
            compliance_summary: 'Grundläggande arbetsmiljökrav',
            document: {
              id: 'doc-1',
              title: 'Arbetsmiljölagen',
              document_number: 'SFS 1977:1160',
            },
          },
          {
            document_id: 'doc-2',
            compliance_summary: null,
            document: {
              id: 'doc-2',
              title: 'Arbetstidslagen',
              document_number: 'SFS 1982:673',
            },
          },
        ],
      },
    ] as never)

    const result = await tool.execute(
      { area: 'arbetsmiljö' },
      makeExecuteArgs()
    )

    expect(result).toMatchObject({
      data: {
        area: 'arbetsmiljö',
        laws: [
          {
            documentId: 'doc-1',
            title: 'Arbetsmiljölagen',
            sfsNumber: 'SFS 1977:1160',
            description: 'Grundläggande arbetsmiljökrav',
          },
          {
            documentId: 'doc-2',
            title: 'Arbetstidslagen',
            sfsNumber: 'SFS 1982:673',
            description: null,
          },
        ],
        templateName: 'Arbetsmiljömallar',
        itemCount: 2,
      },
      _meta: expect.objectContaining({
        tool: 'get_template_laws',
        resultCount: 2,
      }),
    })
  })

  it('returns empty array for unknown area', async () => {
    mockFindMany.mockResolvedValue([])

    const result = await tool.execute({ area: 'rymdteknik' }, makeExecuteArgs())

    expect(result).toMatchObject({
      data: {
        area: 'rymdteknik',
        laws: [],
        templateName: null,
        itemCount: 0,
      },
      _meta: expect.objectContaining({
        tool: 'get_template_laws',
        resultCount: 0,
      }),
    })
  })

  it('returns error on database failure', async () => {
    mockFindMany.mockRejectedValue(new Error('DB connection failed'))

    const result = await tool.execute(
      { area: 'arbetsmiljö' },
      makeExecuteArgs()
    )

    expect(result).toMatchObject({
      error: true,
      message: expect.stringContaining('DB connection failed'),
      guidance: expect.stringContaining('search_laws'),
    })
  })
})
