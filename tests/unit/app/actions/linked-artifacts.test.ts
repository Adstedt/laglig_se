import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockListItemFindFirst = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    lawListItem: {
      findFirst: (...args: unknown[]) => mockListItemFindFirst(...args),
    },
  },
}))

const MOCK_WORKSPACE_ID = 'ws-0001'
const MOCK_USER_ID = 'user-0001'

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(
    async (
      fn: (_ctx: { workspaceId: string; userId: string }) => Promise<unknown>
    ) => fn({ workspaceId: MOCK_WORKSPACE_ID, userId: MOCK_USER_ID })
  ),
}))

import { getLinkedArtifactsForListItem } from '@/app/actions/linked-artifacts'

const LIST_ITEM_ID = '00000000-0000-4000-8000-000000000001'

function emptyItem() {
  return {
    id: LIST_ITEM_ID,
    law_list: { workspace_id: MOCK_WORKSPACE_ID },
    file_links: [],
    workspace_document_links: [],
    requirements: [],
    task_links: [],
  }
}

function mkFile(id: string, filename = 'doc.pdf') {
  return { id, filename, mime_type: 'application/pdf', file_size: 1024 }
}

function mkDoc(id: string, title = 'Policy') {
  return {
    id,
    title,
    document_type: 'POLICY',
    status: 'APPROVED',
    current_version_number: 2,
  }
}

beforeEach(() => {
  mockListItemFindFirst.mockReset()
})

describe('getLinkedArtifactsForListItem', () => {
  it('rejects non-UUID input', async () => {
    const result = await getLinkedArtifactsForListItem('not-a-uuid')
    expect(result).toEqual({ success: false, error: 'Ogiltigt ID' })
    expect(mockListItemFindFirst).not.toHaveBeenCalled()
  })

  it('returns error when list item not found', async () => {
    mockListItemFindFirst.mockResolvedValueOnce(null)
    const result = await getLinkedArtifactsForListItem(LIST_ITEM_ID)
    expect(result).toEqual({
      success: false,
      error: 'Laglistpost hittades inte',
    })
  })

  it('enforces workspace isolation', async () => {
    mockListItemFindFirst.mockResolvedValueOnce({
      ...emptyItem(),
      law_list: { workspace_id: 'ws-OTHER' },
    })
    const result = await getLinkedArtifactsForListItem(LIST_ITEM_ID)
    expect(result).toEqual({
      success: false,
      error: 'Laglistpost hittades inte',
    })
  })

  it('returns empty result when no links', async () => {
    mockListItemFindFirst.mockResolvedValueOnce(emptyItem())
    const result = await getLinkedArtifactsForListItem(LIST_ITEM_ID)
    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      artifacts: [],
      tasksWithoutAttachmentCount: 0,
    })
  })

  it('returns files-only when only direct file links exist', async () => {
    const file = mkFile('f-1', 'receipt.pdf')
    mockListItemFindFirst.mockResolvedValueOnce({
      ...emptyItem(),
      file_links: [{ id: 'fl-1', file }],
    })
    const result = await getLinkedArtifactsForListItem(LIST_ITEM_ID)
    expect(result.success).toBe(true)
    expect(result.data!.artifacts).toHaveLength(1)
    expect(result.data!.artifacts[0]).toMatchObject({
      kind: 'file',
      id: 'f-1',
      filename: 'receipt.pdf',
      directLink: true,
      requirements: [],
      tasks: [],
    })
  })

  it('returns documents-only when only direct document links exist', async () => {
    const doc = mkDoc('d-1', 'GDPR Policy')
    mockListItemFindFirst.mockResolvedValueOnce({
      ...emptyItem(),
      workspace_document_links: [{ id: 'dl-1', document: doc }],
    })
    const result = await getLinkedArtifactsForListItem(LIST_ITEM_ID)
    expect(result.success).toBe(true)
    expect(result.data!.artifacts).toHaveLength(1)
    expect(result.data!.artifacts[0]).toMatchObject({
      kind: 'document',
      id: 'd-1',
      title: 'GDPR Policy',
      documentType: 'POLICY',
      status: 'APPROVED',
      versionNumber: 2,
      directLink: true,
    })
  })

  it('deduplicates an artifact linked via all three pathways with merged back-refs', async () => {
    const file = mkFile('f-shared', 'shared.pdf')
    mockListItemFindFirst.mockResolvedValueOnce({
      ...emptyItem(),
      file_links: [{ id: 'fl-1', file }],
      requirements: [
        {
          id: 'r-1',
          text: 'Skyddsutrustning',
          evidence_links: [{ id: 'el-1', file, workspace_document: null }],
        },
      ],
      task_links: [
        {
          id: 'tl-1',
          task: {
            id: 't-1',
            title: 'Årlig inspektion',
            workspace_id: MOCK_WORKSPACE_ID,
            file_links: [{ id: 'ftl-1', file }],
            workspace_document_links: [],
          },
        },
      ],
    })
    const result = await getLinkedArtifactsForListItem(LIST_ITEM_ID)
    expect(result.success).toBe(true)
    expect(result.data!.artifacts).toHaveLength(1)
    const entry = result.data!.artifacts[0]!
    expect(entry.kind).toBe('file')
    expect(entry.id).toBe('f-shared')
    expect(entry.directLink).toBe(true)
    expect(entry.requirements).toEqual([
      { id: 'r-1', text: 'Skyddsutrustning' },
    ])
    expect(entry.tasks).toEqual([{ id: 't-1', title: 'Årlig inspektion' }])
  })

  it('merges multiple requirement back-refs on a single artifact', async () => {
    const doc = mkDoc('d-multi')
    mockListItemFindFirst.mockResolvedValueOnce({
      ...emptyItem(),
      requirements: [
        {
          id: 'r-1',
          text: 'Krav 1',
          evidence_links: [{ id: 'el-1', file: null, workspace_document: doc }],
        },
        {
          id: 'r-2',
          text: 'Krav 2',
          evidence_links: [{ id: 'el-2', file: null, workspace_document: doc }],
        },
      ],
    })
    const result = await getLinkedArtifactsForListItem(LIST_ITEM_ID)
    expect(result.data!.artifacts).toHaveLength(1)
    expect(result.data!.artifacts[0]!.requirements).toEqual([
      { id: 'r-1', text: 'Krav 1' },
      { id: 'r-2', text: 'Krav 2' },
    ])
    expect(result.data!.artifacts[0]!.directLink).toBe(false)
  })

  it('excludes task-side artifacts from other workspaces', async () => {
    const file = mkFile('f-cross', 'cross-workspace.pdf')
    mockListItemFindFirst.mockResolvedValueOnce({
      ...emptyItem(),
      task_links: [
        {
          id: 'tl-1',
          task: {
            id: 't-1',
            title: 'Task in other ws',
            workspace_id: 'ws-OTHER',
            file_links: [{ id: 'ftl-1', file }],
            workspace_document_links: [],
          },
        },
      ],
    })
    const result = await getLinkedArtifactsForListItem(LIST_ITEM_ID)
    expect(result.success).toBe(true)
    expect(result.data!.artifacts).toEqual([])
  })

  it('counts tasks linked to the list item that have zero attachments', async () => {
    mockListItemFindFirst.mockResolvedValueOnce({
      ...emptyItem(),
      task_links: [
        {
          id: 'tl-1',
          task: {
            id: 't-empty1',
            title: 'No attachments',
            workspace_id: MOCK_WORKSPACE_ID,
            file_links: [],
            workspace_document_links: [],
          },
        },
        {
          id: 'tl-2',
          task: {
            id: 't-empty2',
            title: 'Also empty',
            workspace_id: MOCK_WORKSPACE_ID,
            file_links: [],
            workspace_document_links: [],
          },
        },
        {
          id: 'tl-3',
          task: {
            id: 't-has-file',
            title: 'Has file',
            workspace_id: MOCK_WORKSPACE_ID,
            file_links: [{ id: 'ftl-1', file: mkFile('f-1') }],
            workspace_document_links: [],
          },
        },
      ],
    })
    const result = await getLinkedArtifactsForListItem(LIST_ITEM_ID)
    expect(result.success).toBe(true)
    expect(result.data!.tasksWithoutAttachmentCount).toBe(2)
  })
})
