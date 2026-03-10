import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    changeEvent: {
      findUnique: vi.fn(),
    },
    amendmentDocument: {
      findFirst: vi.fn(),
    },
    sectionChange: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { createGetChangeDetailsTool } from '@/lib/agent/tools/get-change-details'

const mockFindUnique = vi.mocked(prisma.changeEvent.findUnique)
const mockAmendmentFindFirst = vi.mocked(prisma.amendmentDocument.findFirst)
const mockSectionFindMany = vi.mocked(prisma.sectionChange.findMany)

describe('get_change_details tool', () => {
  const tool = createGetChangeDetailsTool()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns change event with affected sections via indirect join', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'ce-1',
      change_type: 'AMENDMENT',
      amendment_sfs: '2026:145',
      ai_summary: 'Ändring av 3 kap. 2 §',
      detected_at: new Date('2026-02-15'),
      changed_sections: ['3:2'],
      document: {
        id: 'doc-1',
        title: 'Arbetsmiljölag',
        document_number: 'SFS 1977:1160',
        slug: 'sfs-1977-1160',
      },
    } as never)

    mockAmendmentFindFirst.mockResolvedValue({
      id: 'amend-1',
      sfs_number: '2026:145',
    } as never)

    mockSectionFindMany.mockResolvedValue([
      {
        chapter: '3',
        section: '2',
        change_type: 'MODIFIED',
        description: 'Ändrad lydelse',
        old_text: 'Gammal text',
        new_text: 'Ny text',
      },
    ] as never)

    const result = await tool.execute(
      { changeEventId: 'ce-1' },
      {
        toolCallId: 'tc-1',
        messages: [],
        abortSignal: undefined as unknown as AbortSignal,
      }
    )

    expect(result).toHaveProperty('_meta')
    expect(result._meta.tool).toBe('get_change_details')

    const data = (result as { data: Record<string, unknown> }).data
    expect(data.changeType).toBe('AMENDMENT')
    expect(data.amendmentSfs).toBe('2026:145')
    expect(data.aiSummary).toBe('Ändring av 3 kap. 2 §')
    expect((data.baseLaw as Record<string, unknown>).documentNumber).toBe(
      'SFS 1977:1160'
    )

    const sections = data.affectedSections as Array<Record<string, unknown>>
    expect(sections).toHaveLength(1)
    expect(sections[0]).toMatchObject({
      chapter: '3',
      section: '2',
      changeType: 'MODIFIED',
    })

    // Verify indirect join path
    expect(mockAmendmentFindFirst).toHaveBeenCalledWith({
      where: { sfs_number: '2026:145' },
    })
    expect(mockSectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { amendment_id: 'amend-1' },
      })
    )
  })

  it('returns empty affectedSections when no amendment_sfs', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'ce-2',
      change_type: 'NEW_DOCUMENT',
      amendment_sfs: null,
      ai_summary: 'Ny lag publicerad',
      detected_at: new Date('2026-03-01'),
      changed_sections: null,
      document: {
        id: 'doc-2',
        title: 'Ny lag',
        document_number: 'SFS 2026:200',
        slug: 'sfs-2026-200',
      },
    } as never)

    const result = await tool.execute(
      { changeEventId: 'ce-2' },
      {
        toolCallId: 'tc-2',
        messages: [],
        abortSignal: undefined as unknown as AbortSignal,
      }
    )

    const data = (result as { data: Record<string, unknown> }).data
    expect(data.affectedSections).toEqual([])
    expect(mockAmendmentFindFirst).not.toHaveBeenCalled()
  })

  it('returns error with Swedish guidance when change event not found', async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await tool.execute(
      { changeEventId: 'nonexistent' },
      {
        toolCallId: 'tc-3',
        messages: [],
        abortSignal: undefined as unknown as AbortSignal,
      }
    )

    expect(result).toMatchObject({
      error: true,
      message: expect.stringContaining('nonexistent'),
      _meta: { tool: 'get_change_details', resultCount: 0 },
    })
    expect((result as { guidance: string }).guidance).toContain('ID')
  })
})
