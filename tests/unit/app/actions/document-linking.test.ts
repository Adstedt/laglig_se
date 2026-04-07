import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDocFindFirst = vi.fn()
const mockTaskFindFirst = vi.fn()
const mockListItemFindFirst = vi.fn()
const mockTaskLinkCreate = vi.fn()
const mockTaskLinkDeleteMany = vi.fn()
const mockTaskLinkFindMany = vi.fn()
const mockListItemLinkCreate = vi.fn()
const mockListItemLinkDeleteMany = vi.fn()
const mockListItemLinkFindMany = vi.fn()
const mockActivityLogCreate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceDocument: {
      findFirst: (...args: unknown[]) => mockDocFindFirst(...args),
    },
    task: {
      findFirst: (...args: unknown[]) => mockTaskFindFirst(...args),
    },
    lawListItem: {
      findFirst: (...args: unknown[]) => mockListItemFindFirst(...args),
    },
    workspaceDocumentTaskLink: {
      create: (...args: unknown[]) => mockTaskLinkCreate(...args),
      deleteMany: (...args: unknown[]) => mockTaskLinkDeleteMany(...args),
      findMany: (...args: unknown[]) => mockTaskLinkFindMany(...args),
    },
    workspaceDocumentListItemLink: {
      create: (...args: unknown[]) => mockListItemLinkCreate(...args),
      deleteMany: (...args: unknown[]) => mockListItemLinkDeleteMany(...args),
      findMany: (...args: unknown[]) => mockListItemLinkFindMany(...args),
    },
    activityLog: {
      create: (...args: unknown[]) => mockActivityLogCreate(...args),
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

// Mock Tiptap extensions (transitive imports from documents.ts)
vi.mock('@tiptap/core', () => ({
  generateHTML: vi.fn(() => '<p>Content</p>'),
}))
const ext = (name: string) => ({
  configure: () => name,
  extend: () => name,
  name,
})
vi.mock('@tiptap/starter-kit', () => ({ default: ext('starterKit') }))
vi.mock('@tiptap/extension-table', () => ({ Table: ext('table') }))
vi.mock('@tiptap/extension-table-row', () => ({ TableRow: ext('tableRow') }))
vi.mock('@tiptap/extension-table-cell', () => ({ TableCell: ext('tableCell') }))
vi.mock('@tiptap/extension-table-header', () => ({
  TableHeader: ext('tableHeader'),
}))
vi.mock('@tiptap/extension-image', () => ({ default: ext('image') }))
vi.mock('@tiptap/extension-text-align', () => ({ default: ext('textAlign') }))
vi.mock('@tiptap/extension-underline', () => ({ default: ext('underline') }))
vi.mock('@tiptap/extension-link', () => ({ default: ext('link') }))
vi.mock('@tiptap/extension-color', () => ({ default: ext('color') }))
vi.mock('@tiptap/extension-text-style', () => ({
  TextStyle: ext('textStyle'),
}))
vi.mock('@/lib/supabase/storage', () => ({
  getStorageClient: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  linkDocumentToTask,
  unlinkDocumentFromTask,
  linkDocumentToListItem,
  unlinkDocumentFromListItem,
  getDocumentLinks,
  getDocumentsForTask,
  getDocumentsForListItem,
} from '@/app/actions/documents'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DOC_ID = 'doc-001'
const TASK_ID = 'task-001'
const LIST_ITEM_ID = 'li-001'

function mockDocumentExists() {
  mockDocFindFirst.mockResolvedValue({
    id: DOC_ID,
    title: 'Policy',
    workspace_id: MOCK_WORKSPACE_ID,
  })
}

function mockTaskExists() {
  mockTaskFindFirst.mockResolvedValue({
    id: TASK_ID,
    title: 'Granska policy',
  })
}

function mockListItemExists() {
  mockListItemFindFirst.mockResolvedValue({
    id: LIST_ITEM_ID,
    document: { title: 'AFS 2001:1', document_number: 'AFS 2001:1' },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('linkDocumentToTask', () => {
  it('creates a link and logs activity', async () => {
    mockDocumentExists()
    mockTaskExists()
    mockTaskLinkCreate.mockResolvedValue({ id: 'link-1' })
    mockActivityLogCreate.mockResolvedValue({})

    const result = await linkDocumentToTask(DOC_ID, TASK_ID)

    expect(result.success).toBe(true)

    // Verify link created with correct data
    expect(mockTaskLinkCreate).toHaveBeenCalledWith({
      data: {
        document_id: DOC_ID,
        task_id: TASK_ID,
        linked_by: MOCK_USER_ID,
      },
    })

    // Verify activity log
    expect(mockActivityLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspace_id: MOCK_WORKSPACE_ID,
        user_id: MOCK_USER_ID,
        entity_type: 'workspace_document',
        entity_id: DOC_ID,
        action: 'document_linked_to_task',
      }),
    })
  })

  it('returns error when document not found', async () => {
    mockDocFindFirst.mockResolvedValue(null)

    const result = await linkDocumentToTask(DOC_ID, TASK_ID)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Dokument hittades inte')
    expect(mockTaskLinkCreate).not.toHaveBeenCalled()
  })

  it('returns error when task not found', async () => {
    mockDocumentExists()
    mockTaskFindFirst.mockResolvedValue(null)

    const result = await linkDocumentToTask(DOC_ID, TASK_ID)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Uppgift hittades inte')
    expect(mockTaskLinkCreate).not.toHaveBeenCalled()
  })

  it('returns error on duplicate link', async () => {
    mockDocumentExists()
    mockTaskExists()
    mockTaskLinkCreate.mockRejectedValue(
      new Error(
        'Unique constraint failed on the fields: (`document_id`,`task_id`)'
      )
    )

    const result = await linkDocumentToTask(DOC_ID, TASK_ID)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Dokumentet är redan länkat till denna uppgift')
  })
})

describe('unlinkDocumentFromTask', () => {
  it('deletes the link and logs activity', async () => {
    mockDocumentExists()
    mockTaskLinkDeleteMany.mockResolvedValue({ count: 1 })
    mockActivityLogCreate.mockResolvedValue({})

    const result = await unlinkDocumentFromTask(DOC_ID, TASK_ID)

    expect(result.success).toBe(true)

    expect(mockTaskLinkDeleteMany).toHaveBeenCalledWith({
      where: { document_id: DOC_ID, task_id: TASK_ID },
    })

    expect(mockActivityLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'document_unlinked_from_task',
        new_value: { task_id: TASK_ID },
      }),
    })
  })

  it('returns error when document not found', async () => {
    mockDocFindFirst.mockResolvedValue(null)

    const result = await unlinkDocumentFromTask(DOC_ID, TASK_ID)

    expect(result.success).toBe(false)
    expect(mockTaskLinkDeleteMany).not.toHaveBeenCalled()
  })
})

describe('linkDocumentToListItem', () => {
  it('creates a link and logs activity', async () => {
    mockDocumentExists()
    mockListItemExists()
    mockListItemLinkCreate.mockResolvedValue({ id: 'link-2' })
    mockActivityLogCreate.mockResolvedValue({})

    const result = await linkDocumentToListItem(DOC_ID, LIST_ITEM_ID)

    expect(result.success).toBe(true)

    expect(mockListItemLinkCreate).toHaveBeenCalledWith({
      data: {
        document_id: DOC_ID,
        list_item_id: LIST_ITEM_ID,
        linked_by: MOCK_USER_ID,
      },
    })

    expect(mockActivityLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'document_linked_to_list_item',
      }),
    })
  })

  it('returns error when list item not found', async () => {
    mockDocumentExists()
    mockListItemFindFirst.mockResolvedValue(null)

    const result = await linkDocumentToListItem(DOC_ID, LIST_ITEM_ID)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Lagkrav hittades inte')
  })

  it('returns error on duplicate link', async () => {
    mockDocumentExists()
    mockListItemExists()
    mockListItemLinkCreate.mockRejectedValue(
      new Error(
        'Unique constraint failed on the fields: (`document_id`,`list_item_id`)'
      )
    )

    const result = await linkDocumentToListItem(DOC_ID, LIST_ITEM_ID)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Dokumentet är redan länkat till detta lagkrav')
  })
})

describe('unlinkDocumentFromListItem', () => {
  it('deletes the link and logs activity', async () => {
    mockDocumentExists()
    mockListItemLinkDeleteMany.mockResolvedValue({ count: 1 })
    mockActivityLogCreate.mockResolvedValue({})

    const result = await unlinkDocumentFromListItem(DOC_ID, LIST_ITEM_ID)

    expect(result.success).toBe(true)

    expect(mockListItemLinkDeleteMany).toHaveBeenCalledWith({
      where: { document_id: DOC_ID, list_item_id: LIST_ITEM_ID },
    })

    expect(mockActivityLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'document_unlinked_from_list_item',
      }),
    })
  })
})

describe('getDocumentLinks', () => {
  it('returns linked tasks and list items', async () => {
    mockDocFindFirst.mockResolvedValue({ id: DOC_ID })
    mockTaskLinkFindMany.mockResolvedValue([
      {
        id: 'link-1',
        task: { id: TASK_ID, title: 'Granska policy' },
      },
    ])
    mockListItemLinkFindMany.mockResolvedValue([
      {
        id: 'link-2',
        list_item: {
          id: LIST_ITEM_ID,
          document: { title: 'AFS 2001:1', document_number: 'AFS 2001:1' },
        },
      },
    ])

    const result = await getDocumentLinks(DOC_ID)

    expect(result.success).toBe(true)
    expect(result.data?.tasks).toHaveLength(1)
    expect(result.data?.tasks[0]).toEqual({
      id: TASK_ID,
      title: 'Granska policy',
      linkId: 'link-1',
    })
    expect(result.data?.listItems).toHaveLength(1)
    expect(result.data?.listItems[0]).toEqual({
      id: LIST_ITEM_ID,
      title: 'AFS 2001:1',
      documentNumber: 'AFS 2001:1',
      linkId: 'link-2',
    })
  })

  it('returns error when document not found', async () => {
    mockDocFindFirst.mockResolvedValue(null)

    const result = await getDocumentLinks(DOC_ID)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Dokument hittades inte')
  })
})

describe('getDocumentsForTask', () => {
  it('returns documents linked to a task', async () => {
    mockTaskFindFirst.mockResolvedValue({ id: TASK_ID })
    mockTaskLinkFindMany.mockResolvedValue([
      {
        id: 'link-1',
        document: {
          id: DOC_ID,
          title: 'Arbetsmiljöpolicy',
          document_type: 'POLICY',
          status: 'DRAFT',
          current_version_number: 2,
        },
      },
    ])

    const result = await getDocumentsForTask(TASK_ID)

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data![0]).toEqual({
      id: DOC_ID,
      title: 'Arbetsmiljöpolicy',
      documentType: 'POLICY',
      status: 'DRAFT',
      versionNumber: 2,
      linkId: 'link-1',
    })
  })

  it('returns error when task not found', async () => {
    mockTaskFindFirst.mockResolvedValue(null)

    const result = await getDocumentsForTask(TASK_ID)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Uppgift hittades inte')
  })
})

describe('getDocumentsForListItem', () => {
  it('returns documents linked to a list item', async () => {
    mockListItemFindFirst.mockResolvedValue({ id: LIST_ITEM_ID })
    mockListItemLinkFindMany.mockResolvedValue([
      {
        id: 'link-2',
        document: {
          id: DOC_ID,
          title: 'Riskbedömning',
          document_type: 'RISK_ASSESSMENT',
          status: 'APPROVED',
          current_version_number: 3,
        },
      },
    ])

    const result = await getDocumentsForListItem(LIST_ITEM_ID)

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data![0]).toEqual({
      id: DOC_ID,
      title: 'Riskbedömning',
      documentType: 'RISK_ASSESSMENT',
      status: 'APPROVED',
      versionNumber: 3,
      linkId: 'link-2',
    })
  })

  it('returns error when list item not found', async () => {
    mockListItemFindFirst.mockResolvedValue(null)

    const result = await getDocumentsForListItem(LIST_ITEM_ID)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Lagkrav hittades inte')
  })
})
