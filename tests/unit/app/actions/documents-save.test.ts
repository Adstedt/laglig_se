import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindFirst = vi.fn()
const mockCreate = vi.fn()
const _mockUpdate = vi.fn()
const mockTransaction = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceDocument: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
    workspaceDocumentVersion: {
      create: (...args: unknown[]) => mockCreate(...args),
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

vi.mock('@tiptap/core', () => ({
  generateHTML: vi.fn(() => '<p>Hello world</p>'),
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

// Story 17.10b: saveDocumentVersion now schedules an indexWorkspaceDocument
// call via next/server's after(). Mock both so this older test doesn't try to
// run the real after() / hit the RAG sync.
vi.mock('next/server', () => ({
  after: vi.fn(),
}))
vi.mock('@/lib/chunks/workspace-document-reindex', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/lib/chunks/workspace-document-reindex')
    >()
  return {
    ...actual,
    indexWorkspaceDocument: vi.fn().mockResolvedValue(undefined),
    deindexWorkspaceDocument: vi.fn().mockResolvedValue(undefined),
    markWorkspaceDocumentDirty: vi.fn().mockResolvedValue(undefined),
    updateWorkspaceDocumentStatusMetadata: vi.fn().mockResolvedValue(undefined),
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('saveDocumentVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a new version and updates document in a transaction', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'doc-1',
      current_version_number: 2,
      workspace_id: MOCK_WORKSPACE_ID,
    })

    const mockVer = { id: 'ver-3', version_number: 3 }
    mockTransaction.mockImplementation(
      async (fn: (_tx: unknown) => Promise<unknown>) => {
        const tx = {
          workspaceDocumentVersion: {
            create: vi.fn().mockResolvedValue(mockVer),
            findFirst: vi.fn().mockResolvedValue({ version_number: 2 }),
          },
          workspaceDocument: {
            update: vi.fn().mockResolvedValue({}),
          },
          activityLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        }
        return fn(tx)
      }
    )

    const { saveDocumentVersion } = await import('@/app/actions/documents')

    const result = await saveDocumentVersion('doc-1', {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    })

    expect(result.success).toBe(true)
    expect(result.data?.versionNumber).toBe(3)
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1', workspace_id: MOCK_WORKSPACE_ID },
      })
    )
  })

  it('returns error when document not found', async () => {
    mockFindFirst.mockResolvedValue(null)

    const { saveDocumentVersion } = await import('@/app/actions/documents')

    const result = await saveDocumentVersion('nonexistent', {
      type: 'doc',
      content: [],
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Dokument hittades inte')
  })

  it('uses provided contentHtml instead of generating server-side', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'doc-1',
      current_version_number: 1,
      workspace_id: MOCK_WORKSPACE_ID,
    })

    let capturedHtml: string | undefined
    mockTransaction.mockImplementation(
      async (fn: (_tx: unknown) => Promise<unknown>) => {
        const tx = {
          workspaceDocumentVersion: {
            create: vi
              .fn()
              .mockImplementation(
                (args: { data: { content_html: string } }) => {
                  capturedHtml = args.data.content_html
                  return { id: 'ver-2', version_number: 2 }
                }
              ),
            findFirst: vi.fn().mockResolvedValue({ version_number: 1 }),
          },
          workspaceDocument: { update: vi.fn().mockResolvedValue({}) },
          activityLog: { create: vi.fn().mockResolvedValue({}) },
        }
        return fn(tx)
      }
    )

    const { saveDocumentVersion } = await import('@/app/actions/documents')

    await saveDocumentVersion(
      'doc-1',
      { type: 'doc', content: [] },
      undefined,
      undefined,
      '<p>Client HTML</p>'
    )

    expect(capturedHtml).toBe('<p>Client HTML</p>')
  })

  it('includes title update when title is provided', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'doc-1',
      current_version_number: 1,
      workspace_id: MOCK_WORKSPACE_ID,
    })

    let capturedDocUpdate: Record<string, unknown> | null = null
    mockTransaction.mockImplementation(
      async (fn: (_tx: unknown) => Promise<unknown>) => {
        const tx = {
          workspaceDocumentVersion: {
            create: vi
              .fn()
              .mockResolvedValue({ id: 'ver-2', version_number: 2 }),
            findFirst: vi.fn().mockResolvedValue({ version_number: 1 }),
          },
          workspaceDocument: {
            update: vi
              .fn()
              .mockImplementation((args: { data: Record<string, unknown> }) => {
                capturedDocUpdate = args.data
                return {}
              }),
          },
          activityLog: { create: vi.fn().mockResolvedValue({}) },
        }
        return fn(tx)
      }
    )

    const { saveDocumentVersion } = await import('@/app/actions/documents')

    await saveDocumentVersion(
      'doc-1',
      { type: 'doc', content: [] },
      undefined,
      'New Title'
    )

    expect(capturedDocUpdate).toHaveProperty('title', 'New Title')
  })
})

describe('uploadDocumentImageAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects files with invalid MIME type', async () => {
    mockFindFirst.mockResolvedValue({ id: 'doc-1' })

    const { uploadDocumentImageAction } = await import(
      '@/app/actions/documents'
    )

    const formData = new FormData()
    const file = new File(['data'], 'test.exe', {
      type: 'application/x-msdownload',
    })
    formData.append('file', file)
    formData.append('documentId', 'doc-1')

    const result = await uploadDocumentImageAction(formData)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Ogiltigt filformat')
  })

  it('rejects files over 10MB', async () => {
    mockFindFirst.mockResolvedValue({ id: 'doc-1' })

    const { uploadDocumentImageAction } = await import(
      '@/app/actions/documents'
    )

    const bigBuffer = new ArrayBuffer(11 * 1024 * 1024)
    const file = new File([bigBuffer], 'huge.png', { type: 'image/png' })

    const formData = new FormData()
    formData.append('file', file)
    formData.append('documentId', 'doc-1')

    const result = await uploadDocumentImageAction(formData)

    expect(result.success).toBe(false)
    expect(result.error).toContain('för stor')
  })

  it('returns error when missing file or documentId', async () => {
    const { uploadDocumentImageAction } = await import(
      '@/app/actions/documents'
    )

    const formData = new FormData()
    const result = await uploadDocumentImageAction(formData)

    expect(result.success).toBe(false)
    expect(result.error).toContain('krävs')
  })
})
