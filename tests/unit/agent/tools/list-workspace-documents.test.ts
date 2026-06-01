/**
 * Unit tests for the list_workspace_documents tool (Story 17.10, Task 3 + 7).
 *
 * Asserts:
 *   - workspace_id is always in `where` (workspace-scoped, AC 16).
 *   - optional filters are applied conditionally (type/status direct;
 *     linked_task_id / linked_list_item_id via the `some` relation operator).
 *   - ordering = updated_at desc, take = 25 (AC 15).
 *   - result mapping: versionCount from _count, createdBy from creator.name.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceDocument: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { createListWorkspaceDocumentsTool } from '@/lib/agent/tools/list-workspace-documents'

const mockFindMany = prisma.workspaceDocument.findMany as ReturnType<
  typeof vi.fn
>

type Input = {
  document_type?: string
  status?: string
  linked_list_item_id?: string
  linked_task_id?: string
}
type ToolWithExecute = {
  execute: (_args: Input, _opts?: unknown) => Promise<unknown>
}

function makeTool(workspaceId = 'ws-1') {
  return createListWorkspaceDocumentsTool(
    workspaceId
  ) as unknown as ToolWithExecute
}

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'wd-1',
    title: 'Dataskyddspolicy',
    document_type: 'POLICY',
    status: 'APPROVED',
    updated_at: new Date('2026-05-30T10:00:00.000Z'),
    creator: { name: 'Anna Adstedt' },
    _count: { versions: 3 },
    ...over,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('createListWorkspaceDocumentsTool', () => {
  it('always filters by workspace_id; orderBy updated_at desc; take = 25 (AC 15, 16)', async () => {
    mockFindMany.mockResolvedValue([])
    await makeTool('ws-XYZ').execute({})

    expect(mockFindMany).toHaveBeenCalledTimes(1)
    const call = mockFindMany.mock.calls[0][0]
    expect(call.where).toEqual({ workspace_id: 'ws-XYZ' })
    expect(call.orderBy).toEqual({ updated_at: 'desc' })
    expect(call.take).toBe(25)
  })

  it('applies document_type + status as direct where clauses', async () => {
    mockFindMany.mockResolvedValue([])
    await makeTool().execute({
      document_type: 'ROUTINE',
      status: 'DRAFT',
    })

    const where = mockFindMany.mock.calls[0][0].where
    expect(where).toMatchObject({
      workspace_id: 'ws-1',
      document_type: 'ROUTINE',
      status: 'DRAFT',
    })
  })

  it('applies linked_task_id via task_links.some', async () => {
    mockFindMany.mockResolvedValue([])
    await makeTool().execute({ linked_task_id: 't-42' })

    const where = mockFindMany.mock.calls[0][0].where
    expect(where).toMatchObject({
      workspace_id: 'ws-1',
      task_links: { some: { task_id: 't-42' } },
    })
    expect(where).not.toHaveProperty('list_item_links')
  })

  it('applies linked_list_item_id via list_item_links.some', async () => {
    mockFindMany.mockResolvedValue([])
    await makeTool().execute({ linked_list_item_id: 'lli-9' })

    const where = mockFindMany.mock.calls[0][0].where
    expect(where).toMatchObject({
      workspace_id: 'ws-1',
      list_item_links: { some: { list_item_id: 'lli-9' } },
    })
    expect(where).not.toHaveProperty('task_links')
  })

  it('combines all four filters when supplied together', async () => {
    mockFindMany.mockResolvedValue([])
    await makeTool().execute({
      document_type: 'POLICY',
      status: 'APPROVED',
      linked_task_id: 't-1',
      linked_list_item_id: 'lli-1',
    })

    const where = mockFindMany.mock.calls[0][0].where
    expect(where).toMatchObject({
      workspace_id: 'ws-1',
      document_type: 'POLICY',
      status: 'APPROVED',
      task_links: { some: { task_id: 't-1' } },
      list_item_links: { some: { list_item_id: 'lli-1' } },
    })
  })

  it('maps result rows to {documentId, title, documentType, status, versionCount, lastUpdated, createdBy}', async () => {
    mockFindMany.mockResolvedValue([row(), row({ id: 'wd-2', creator: null })])
    const out = (await makeTool().execute({})) as {
      data: Array<{
        documentId: string
        title: string
        documentType: string
        status: string
        versionCount: number
        lastUpdated: Date
        createdBy: string | null
      }>
    }

    expect(out.data).toHaveLength(2)
    expect(out.data[0]).toEqual({
      documentId: 'wd-1',
      title: 'Dataskyddspolicy',
      documentType: 'POLICY',
      status: 'APPROVED',
      versionCount: 3,
      lastUpdated: new Date('2026-05-30T10:00:00.000Z'),
      createdBy: 'Anna Adstedt',
    })
    expect(out.data[1]?.createdBy).toBeNull()
  })

  it('wraps a prisma throw as a Swedish ToolError', async () => {
    mockFindMany.mockRejectedValue(new Error('connection reset'))
    const out = (await makeTool().execute({})) as {
      error: true
      message: string
    }
    expect(out.error).toBe(true)
    expect(out.message).toContain('connection reset')
  })
})
