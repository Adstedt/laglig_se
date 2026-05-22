import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindFirst = vi.fn()
const mockUpdate = vi.fn()
const mockTransaction = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceDocument: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    workspaceDocumentVersion: {
      create: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    $transaction: (fn: (_tx: unknown) => Promise<unknown>) =>
      mockTransaction(fn),
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

// Story 17.9b: createDraftFromApproved now schedules a WORKSPACE_DOCUMENT de-index via
// next/server's `after()` (valid only inside a request scope — throws in the test env).
// Mock as a no-op so the action's success path isn't masked by an out-of-scope throw.
vi.mock('next/server', () => ({
  after: vi.fn(),
}))

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
vi.mock('@tiptap/extension-text-style', () => ({ TextStyle: ext('textStyle') }))
vi.mock('@tiptap/extension-highlight', () => ({ default: ext('highlight') }))
vi.mock('@/lib/supabase/storage', () => ({
  getStorageClient: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('updateDocumentStatus (with comment + ActivityLog)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates ActivityLog entry with old/new status and comment', async () => {
    mockFindFirst.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'DRAFT',
      workspace_id: MOCK_WORKSPACE_ID,
    })

    let capturedLogData: Record<string, unknown> | null = null
    mockTransaction.mockImplementation(
      async (fn: (_tx: unknown) => Promise<unknown>) => {
        const tx = {
          workspaceDocument: {
            update: vi.fn().mockResolvedValue({
              id: '550e8400-e29b-41d4-a716-446655440000',
              status: 'IN_REVIEW',
            }),
          },
          activityLog: {
            create: vi
              .fn()
              .mockImplementation((args: { data: Record<string, unknown> }) => {
                capturedLogData = args.data
                return {}
              }),
          },
        }
        return fn(tx)
      }
    )

    const { updateDocumentStatus } = await import('@/app/actions/documents')
    const result = await updateDocumentStatus({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      newStatus: 'IN_REVIEW' as never,
      comment: 'Ready for review',
    })

    expect(result.success).toBe(true)
    expect(capturedLogData).toMatchObject({
      action: 'document_status_changed',
      entity_type: 'workspace_document',
      entity_id: '550e8400-e29b-41d4-a716-446655440000',
      old_value: { status: 'DRAFT' },
    })
    expect((capturedLogData!.new_value as Record<string, unknown>).status).toBe(
      'IN_REVIEW'
    )
    expect(
      (capturedLogData!.new_value as Record<string, unknown>).comment
    ).toBe('Ready for review')
  })

  it('stores null comment when not provided', async () => {
    mockFindFirst.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'DRAFT',
      workspace_id: MOCK_WORKSPACE_ID,
    })

    let capturedLogData: Record<string, unknown> | null = null
    mockTransaction.mockImplementation(
      async (fn: (_tx: unknown) => Promise<unknown>) => {
        const tx = {
          workspaceDocument: {
            update: vi.fn().mockResolvedValue({
              id: '550e8400-e29b-41d4-a716-446655440000',
              status: 'IN_REVIEW',
            }),
          },
          activityLog: {
            create: vi
              .fn()
              .mockImplementation((args: { data: Record<string, unknown> }) => {
                capturedLogData = args.data
                return {}
              }),
          },
        }
        return fn(tx)
      }
    )

    const { updateDocumentStatus } = await import('@/app/actions/documents')
    await updateDocumentStatus({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      newStatus: 'IN_REVIEW' as never,
    })

    expect(
      (capturedLogData!.new_value as Record<string, unknown>).comment
    ).toBeNull()
  })

  it('rejects invalid transitions', async () => {
    mockFindFirst.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'DRAFT',
      workspace_id: MOCK_WORKSPACE_ID,
    })

    const { updateDocumentStatus } = await import('@/app/actions/documents')
    const result = await updateDocumentStatus({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      newStatus: 'APPROVED' as never,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Ogiltig statusövergång')
  })
})

describe('createDraftFromApproved', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates new version and sets DRAFT status', async () => {
    mockFindFirst.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'APPROVED',
      current_version_number: 3,
      workspace_id: MOCK_WORKSPACE_ID,
      current_version: {
        content_json: { type: 'doc', content: [{ type: 'paragraph' }] },
      },
    })

    const mockVer = { id: 'ver-4', version_number: 4 }
    let capturedDocUpdate: Record<string, unknown> | null = null
    mockTransaction.mockImplementation(
      async (fn: (_tx: unknown) => Promise<unknown>) => {
        const tx = {
          workspaceDocumentVersion: {
            create: vi.fn().mockResolvedValue(mockVer),
          },
          workspaceDocument: {
            update: vi
              .fn()
              .mockImplementation((args: { data: Record<string, unknown> }) => {
                capturedDocUpdate = args.data
                return {}
              }),
          },
          activityLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        }
        return fn(tx)
      }
    )

    const { createDraftFromApproved } = await import('@/app/actions/documents')
    const result = await createDraftFromApproved('doc-1')

    expect(result.success).toBe(true)
    expect(result.data?.versionNumber).toBe(4)
    expect(capturedDocUpdate).toMatchObject({
      status: 'DRAFT',
      approved_by: null,
      approved_at: null,
      current_version_number: 4,
    })
  })

  it('rejects non-approved documents', async () => {
    mockFindFirst.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'DRAFT',
      current_version_number: 1,
      workspace_id: MOCK_WORKSPACE_ID,
      current_version: null,
    })

    const { createDraftFromApproved } = await import('@/app/actions/documents')
    const result = await createDraftFromApproved('doc-1')

    expect(result.success).toBe(false)
    expect(result.error).toContain('godkända dokument')
  })

  it('creates ActivityLog entry for status change', async () => {
    mockFindFirst.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'APPROVED',
      current_version_number: 2,
      workspace_id: MOCK_WORKSPACE_ID,
      current_version: {
        content_json: { type: 'doc', content: [] },
      },
    })

    let capturedLogData: Record<string, unknown> | null = null
    mockTransaction.mockImplementation(
      async (fn: (_tx: unknown) => Promise<unknown>) => {
        const tx = {
          workspaceDocumentVersion: {
            create: vi
              .fn()
              .mockResolvedValue({ id: 'ver-3', version_number: 3 }),
          },
          workspaceDocument: { update: vi.fn().mockResolvedValue({}) },
          activityLog: {
            create: vi
              .fn()
              .mockImplementation((args: { data: Record<string, unknown> }) => {
                capturedLogData = args.data
                return {}
              }),
          },
        }
        return fn(tx)
      }
    )

    const { createDraftFromApproved } = await import('@/app/actions/documents')
    await createDraftFromApproved('doc-1')

    expect(capturedLogData).toMatchObject({
      action: 'document_status_changed',
      entity_type: 'workspace_document',
      old_value: { status: 'APPROVED' },
    })
    expect((capturedLogData!.new_value as Record<string, unknown>).status).toBe(
      'DRAFT'
    )
  })
})

describe('updateDocumentMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates metadata fields on the document', async () => {
    mockFindFirst.mockResolvedValue({ id: 'doc-1' })
    mockUpdate.mockResolvedValue({ id: 'doc-1' })

    const { updateDocumentMetadata } = await import('@/app/actions/documents')
    const result = await updateDocumentMetadata({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      documentNumber: 'POL-2026-001',
      reviewDate: '2026-06-15T00:00:00.000Z',
      retentionUntil: null,
    })

    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          document_number: 'POL-2026-001',
          review_date: expect.any(Date),
          retention_until: null,
        }),
      })
    )
  })

  it('returns error for missing document', async () => {
    mockFindFirst.mockResolvedValue(null)

    const { updateDocumentMetadata } = await import('@/app/actions/documents')
    const result = await updateDocumentMetadata({
      documentId: '00000000-0000-0000-0000-000000000000',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Dokument hittades inte')
  })
})

describe('getValidNextStatuses', () => {
  it('returns correct transitions for each status', async () => {
    const { getValidNextStatuses } = await import('@/lib/validation/documents')

    expect(getValidNextStatuses('DRAFT' as never)).toEqual(
      expect.arrayContaining(['IN_REVIEW', 'ARCHIVED'])
    )
    expect(getValidNextStatuses('IN_REVIEW' as never)).toEqual(
      expect.arrayContaining(['APPROVED', 'DRAFT'])
    )
    expect(getValidNextStatuses('APPROVED' as never)).toEqual(
      expect.arrayContaining(['SUPERSEDED', 'ARCHIVED'])
    )
    expect(getValidNextStatuses('SUPERSEDED' as never)).toEqual(
      expect.arrayContaining(['ARCHIVED'])
    )
    expect(getValidNextStatuses('ARCHIVED' as never)).toEqual([])
  })
})
