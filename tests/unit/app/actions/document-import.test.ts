import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindFirst = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockTransaction = vi.fn()
const mockActivityLogCreate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceDocument: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    workspaceDocumentVersion: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
    activityLog: {
      create: (...args: unknown[]) => mockActivityLogCreate(...args),
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

vi.mock('@/lib/documents/docx-to-tiptap', () => ({
  convertDocxToTiptap: vi.fn().mockResolvedValue({
    json: { type: 'doc', content: [{ type: 'paragraph' }] },
    html: '<p>Converted</p>',
    extractedText: 'Converted',
    messages: [],
  }),
}))

vi.mock('@/lib/supabase/storage', () => ({
  getStorageClient: vi.fn(() => ({
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://storage.test/file.docx' },
        }),
      }),
    },
  })),
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
vi.mock('@tiptap/extension-text-style', () => ({
  TextStyle: ext('textStyle'),
}))
vi.mock('@tiptap/extension-highlight', () => ({ default: ext('highlight') }))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function createDocxFormData(overrides?: {
  title?: string
  type?: string
  mime?: string
  size?: number
}): FormData {
  const fd = new FormData()
  const content = new ArrayBuffer(overrides?.size ?? 100)
  const file = new File([content], 'test.docx', {
    type: overrides?.mime ?? DOCX_MIME,
  })
  fd.append('file', file)
  fd.append('title', overrides?.title ?? 'Test Document')
  fd.append('documentType', overrides?.type ?? 'POLICY')
  return fd
}

describe('importDocxDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates document and version with source IMPORT', async () => {
    let capturedVersionData: Record<string, unknown> | null = null
    mockTransaction.mockImplementation(
      async (fn: (_tx: unknown) => Promise<unknown>) => {
        const tx = {
          workspaceDocument: {
            create: vi.fn().mockResolvedValue({
              id: 'doc-1',
              title: 'Test Document',
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          workspaceDocumentVersion: {
            create: vi
              .fn()
              .mockImplementation((args: { data: Record<string, unknown> }) => {
                capturedVersionData = args.data
                return { id: 'ver-1' }
              }),
          },
          activityLog: { create: vi.fn().mockResolvedValue({}) },
        }
        return fn(tx)
      }
    )

    const { importDocxDocument } = await import('@/app/actions/documents')
    const result = await importDocxDocument(createDocxFormData())

    expect(result.success).toBe(true)
    expect(result.data?.versionNumber).toBe(1)
    expect(capturedVersionData).toMatchObject({
      source: 'IMPORT',
      change_summary: 'Importerad från .docx',
    })
    expect(capturedVersionData!.storage_path).toBeTruthy()
  })

  it('creates ActivityLog entry for import', async () => {
    let capturedLogData: Record<string, unknown> | null = null
    mockTransaction.mockImplementation(
      async (fn: (_tx: unknown) => Promise<unknown>) => {
        const tx = {
          workspaceDocument: {
            create: vi.fn().mockResolvedValue({ id: 'doc-1', title: 'Test' }),
            update: vi.fn().mockResolvedValue({}),
          },
          workspaceDocumentVersion: {
            create: vi.fn().mockResolvedValue({ id: 'ver-1' }),
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

    const { importDocxDocument } = await import('@/app/actions/documents')
    await importDocxDocument(createDocxFormData())

    expect(capturedLogData).toMatchObject({
      action: 'document_imported',
      entity_type: 'workspace_document',
    })
  })

  it('rejects non-.docx MIME type', async () => {
    const { importDocxDocument } = await import('@/app/actions/documents')
    const result = await importDocxDocument(
      createDocxFormData({ mime: 'application/pdf' })
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('.docx')
  })

  it('rejects files over 25MB', async () => {
    const { importDocxDocument } = await import('@/app/actions/documents')
    const result = await importDocxDocument(
      createDocxFormData({ size: 26 * 1024 * 1024 })
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('25 MB')
  })

  it('returns error when file or title is missing', async () => {
    const { importDocxDocument } = await import('@/app/actions/documents')
    const fd = new FormData()
    const result = await importDocxDocument(fd)

    expect(result.success).toBe(false)
    expect(result.error).toContain('krävs')
  })
})
