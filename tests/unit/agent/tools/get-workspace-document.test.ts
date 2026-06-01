/**
 * Unit tests for the get_workspace_document tool (Story 17.10, Task 2 + 7).
 *
 * Asserts:
 *   - Reads content from `htmlToMarkdown(current_version.content_html)`,
 *     NOT from `extracted_text` (C3 from 2026-05-22 PO review).
 *   - 20,000-char truncation with the Swedish "[Trunkerat — …]" hint.
 *   - Workspace-scoped: a doc from another workspace returns "hittades inte"
 *     (Prisma's `where.workspace_id` makes findFirst return null).
 *   - Maps linkedTasks + linkedLawListItems shapes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceDocument: { findFirst: vi.fn() },
  },
}))

// `vi.mock` factory is hoisted; `vi.hoisted` ensures our mock fn is too.
const { mockHtmlToMarkdown } = vi.hoisted(() => ({
  mockHtmlToMarkdown: vi.fn((html: string) => `MD:${html}`),
}))
vi.mock('@/lib/transforms/html-to-markdown', () => ({
  htmlToMarkdown: mockHtmlToMarkdown,
}))

import { prisma } from '@/lib/prisma'
import { createGetWorkspaceDocumentTool } from '@/lib/agent/tools/get-workspace-document'

const mockFindFirst = prisma.workspaceDocument.findFirst as ReturnType<
  typeof vi.fn
>

type ToolWithExecute = {
  execute: (_args: { document_id: string }, _opts?: unknown) => Promise<unknown>
}

function makeTool(workspaceId = 'ws-1') {
  return createGetWorkspaceDocumentTool(
    workspaceId
  ) as unknown as ToolWithExecute
}

const FULL_DOC = {
  id: 'wd-1',
  title: 'Dataskyddspolicy',
  document_type: 'POLICY',
  status: 'APPROVED',
  document_number: 'POL-001',
  review_date: new Date('2027-01-15T00:00:00.000Z'),
  approved_at: new Date('2026-01-15T00:00:00.000Z'),
  current_version_number: 3,
  approver: { name: 'Anna Adstedt' },
  current_version: { content_html: '<p>Innehåll</p>', version_number: 3 },
  task_links: [
    { task: { id: 't-1', title: 'Granska kryptering' } },
    { task: { id: 't-2', title: 'Uppdatera rutin' } },
  ],
  list_item_links: [
    {
      list_item: {
        id: 'lli-1',
        document: {
          title: 'Dataskyddsförordningen',
          document_number: 'EU 2016/679',
        },
      },
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockHtmlToMarkdown.mockImplementation((html: string) => `MD:${html}`)
})

describe('createGetWorkspaceDocumentTool', () => {
  it('queries with workspace_id constraint (workspace-scoped, AC 11)', async () => {
    mockFindFirst.mockResolvedValue(FULL_DOC)
    await makeTool('ws-XYZ').execute({ document_id: 'wd-1' })

    expect(mockFindFirst).toHaveBeenCalledTimes(1)
    const call = mockFindFirst.mock.calls[0][0]
    expect(call.where).toEqual({ id: 'wd-1', workspace_id: 'ws-XYZ' })
  })

  it('reads content from htmlToMarkdown(content_html), NOT extracted_text', async () => {
    mockFindFirst.mockResolvedValue(FULL_DOC)
    const out = (await makeTool().execute({ document_id: 'wd-1' })) as {
      data: { content: string }
    }
    expect(mockHtmlToMarkdown).toHaveBeenCalledWith('<p>Innehåll</p>')
    expect(out.data.content).toContain('MD:<p>Innehåll</p>')
    // Belt-and-suspenders: the select must not pull extracted_text either.
    const call = mockFindFirst.mock.calls[0][0]
    const versionSelect = call.select?.current_version?.select ?? {}
    expect(versionSelect).not.toHaveProperty('extracted_text')
    expect(versionSelect).toHaveProperty('content_html', true)
  })

  it('truncates content past 20,000 chars and appends the Swedish length hint', async () => {
    // Make htmlToMarkdown return a giant string so truncation kicks in.
    const giant = 'X'.repeat(25_000)
    mockHtmlToMarkdown.mockReturnValueOnce(giant)
    mockFindFirst.mockResolvedValue(FULL_DOC)

    const out = (await makeTool().execute({ document_id: 'wd-1' })) as {
      data: { content: string }
    }
    // The truncateMarkdown helper inserts its own truncation marker; our hint
    // is appended on top when total chars > visible chars.
    expect(out.data.content).toMatch(/Trunkerat.*25000 tecken totalt/)
    expect(out.data.content.length).toBeLessThan(25_000)
  })

  it('maps linkedTasks and linkedLawListItems shapes', async () => {
    mockFindFirst.mockResolvedValue(FULL_DOC)
    const out = (await makeTool().execute({ document_id: 'wd-1' })) as {
      data: {
        linkedTasks: Array<{ id: string; title: string }>
        linkedLawListItems: Array<{
          id: string
          lawTitle: string
          documentNumber: string | null
        }>
      }
    }
    expect(out.data.linkedTasks).toEqual([
      { id: 't-1', title: 'Granska kryptering' },
      { id: 't-2', title: 'Uppdatera rutin' },
    ])
    expect(out.data.linkedLawListItems).toEqual([
      {
        id: 'lli-1',
        lawTitle: 'Dataskyddsförordningen',
        documentNumber: 'EU 2016/679',
      },
    ])
  })

  it('returns a Swedish ToolError when the doc is not in the workspace (cross-tenant rejection, AC 11)', async () => {
    // Prisma's where: { id, workspace_id } returns null when the doc is in a
    // different workspace — same code path as "doc does not exist".
    mockFindFirst.mockResolvedValue(null)

    const out = (await makeTool().execute({ document_id: 'wd-foreign' })) as {
      error: true
      message: string
    }
    expect(out.error).toBe(true)
    expect(out.message).toMatch(/hittades inte/i)
  })

  it('falls back to empty content + no truncation hint when current_version is missing', async () => {
    mockFindFirst.mockResolvedValue({ ...FULL_DOC, current_version: null })
    const out = (await makeTool().execute({ document_id: 'wd-1' })) as {
      data: { content: string }
    }
    expect(out.data.content).toBe('')
    expect(out.data.content).not.toMatch(/Trunkerat/)
  })

  it('exposes approvedBy as the approver display name (or null)', async () => {
    mockFindFirst.mockResolvedValue({ ...FULL_DOC, approver: null })
    const out = (await makeTool().execute({ document_id: 'wd-1' })) as {
      data: { approvedBy: string | null }
    }
    expect(out.data.approvedBy).toBeNull()
  })
})
