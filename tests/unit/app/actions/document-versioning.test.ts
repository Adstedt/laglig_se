import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindFirst = vi.fn()
const mockFindMany = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockTransaction = vi.fn()
const mockUserFindMany = vi.fn()
const mockActivityLogCreate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceDocument: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    workspaceDocumentVersion: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
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

vi.mock('@tiptap/core', () => ({
  generateHTML: vi.fn(() => '<p>Restored content</p>'),
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

describe('getDocumentVersions (author resolution)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves author names from user lookup', async () => {
    // First call: document lookup
    mockFindFirst.mockResolvedValueOnce({ id: 'doc-1' })
    // findMany: versions
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'ver-1',
        version_number: 1,
        source: 'TIPTAP',
        change_summary: null,
        created_by: 'user-0001',
        created_at: new Date(),
      },
      {
        id: 'ver-2',
        version_number: 2,
        source: 'AGENT',
        change_summary: 'AI-genererad',
        created_by: 'agent',
        created_at: new Date(),
      },
    ])
    // user lookup
    mockUserFindMany.mockResolvedValueOnce([
      { id: 'user-0001', name: 'Test User', avatar_url: null },
    ])

    const { getDocumentVersions } = await import('@/app/actions/documents')
    const result = await getDocumentVersions('doc-1')

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(result.data![0].author.name).toBe('Test User')
    expect(result.data![1].author.name).toBe('AI-assistent')
    expect(result.data![1].author.id).toBe('agent')
  })

  it('returns error when document not found', async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const { getDocumentVersions } = await import('@/app/actions/documents')
    const result = await getDocumentVersions('nonexistent')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Dokument hittades inte')
  })
})

describe('getDocumentVersionContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns extracted_text for a specific version', async () => {
    // document lookup
    mockFindFirst.mockResolvedValueOnce({ id: 'doc-1' })
    // version lookup
    mockFindFirst.mockResolvedValueOnce({
      extracted_text: 'Hello world content',
    })

    const { getDocumentVersionContent } = await import(
      '@/app/actions/documents'
    )
    const result = await getDocumentVersionContent('doc-1', 'ver-1')

    expect(result.success).toBe(true)
    expect(result.data?.extracted_text).toBe('Hello world content')
  })

  it('returns empty string when extracted_text is null', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'doc-1' })
    mockFindFirst.mockResolvedValueOnce({ extracted_text: null })

    const { getDocumentVersionContent } = await import(
      '@/app/actions/documents'
    )
    const result = await getDocumentVersionContent('doc-1', 'ver-1')

    expect(result.success).toBe(true)
    expect(result.data?.extracted_text).toBe('')
  })

  it('returns error when version not found', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'doc-1' })
    mockFindFirst.mockResolvedValueOnce(null)

    const { getDocumentVersionContent } = await import(
      '@/app/actions/documents'
    )
    const result = await getDocumentVersionContent('doc-1', 'nonexistent')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Version hittades inte')
  })
})

describe('restoreDocumentVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a new version from old content in a transaction', async () => {
    // Document lookup
    mockFindFirst.mockResolvedValueOnce({
      id: 'doc-1',
      current_version_number: 5,
      workspace_id: MOCK_WORKSPACE_ID,
    })
    // Old version lookup
    mockFindFirst.mockResolvedValueOnce({
      content_json: { type: 'doc', content: [{ type: 'paragraph' }] },
    })

    const mockVer = { id: 'ver-6', version_number: 6 }
    mockTransaction.mockImplementation(
      async (fn: (_tx: unknown) => Promise<unknown>) => {
        const tx = {
          workspaceDocumentVersion: {
            create: vi.fn().mockResolvedValue(mockVer),
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

    const { restoreDocumentVersion } = await import('@/app/actions/documents')
    const result = await restoreDocumentVersion('doc-1', 3)

    expect(result.success).toBe(true)
    expect(result.data?.versionNumber).toBe(6)

    // Verify transaction was called
    expect(mockTransaction).toHaveBeenCalled()
  })

  it('sets change_summary to restoration message', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'doc-1',
      current_version_number: 3,
      workspace_id: MOCK_WORKSPACE_ID,
    })
    mockFindFirst.mockResolvedValueOnce({
      content_json: { type: 'doc', content: [] },
    })

    let capturedVersionData: Record<string, unknown> | null = null
    mockTransaction.mockImplementation(
      async (fn: (_tx: unknown) => Promise<unknown>) => {
        const tx = {
          workspaceDocumentVersion: {
            create: vi
              .fn()
              .mockImplementation((args: { data: Record<string, unknown> }) => {
                capturedVersionData = args.data
                return { id: 'ver-4', version_number: 4 }
              }),
          },
          workspaceDocument: { update: vi.fn().mockResolvedValue({}) },
          activityLog: { create: vi.fn().mockResolvedValue({}) },
        }
        return fn(tx)
      }
    )

    const { restoreDocumentVersion } = await import('@/app/actions/documents')
    await restoreDocumentVersion('doc-1', 2)

    expect(capturedVersionData).toHaveProperty(
      'change_summary',
      'Återställning från version 2'
    )
  })

  it('creates an ActivityLog entry for restore', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'doc-1',
      current_version_number: 3,
      workspace_id: MOCK_WORKSPACE_ID,
    })
    mockFindFirst.mockResolvedValueOnce({
      content_json: { type: 'doc', content: [] },
    })

    let capturedLogData: Record<string, unknown> | null = null
    mockTransaction.mockImplementation(
      async (fn: (_tx: unknown) => Promise<unknown>) => {
        const tx = {
          workspaceDocumentVersion: {
            create: vi
              .fn()
              .mockResolvedValue({ id: 'ver-4', version_number: 4 }),
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

    const { restoreDocumentVersion } = await import('@/app/actions/documents')
    await restoreDocumentVersion('doc-1', 2)

    expect(capturedLogData).toMatchObject({
      workspace_id: MOCK_WORKSPACE_ID,
      user_id: MOCK_USER_ID,
      entity_type: 'workspace_document',
      entity_id: 'doc-1',
      action: 'document_version_restored',
    })
  })

  it('returns error when document not found', async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const { restoreDocumentVersion } = await import('@/app/actions/documents')
    const result = await restoreDocumentVersion('nonexistent', 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Dokument hittades inte')
  })

  it('returns error when old version not found', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'doc-1',
      current_version_number: 3,
      workspace_id: MOCK_WORKSPACE_ID,
    })
    mockFindFirst.mockResolvedValueOnce(null)

    const { restoreDocumentVersion } = await import('@/app/actions/documents')
    const result = await restoreDocumentVersion('doc-1', 99)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Version hittades inte')
  })

  // ==========================================================================
  // Story 17.16 QA CONCERN-001 fix — three-path routing tests
  // (mirrors saveDocumentVersion AC 5; adds Path D for terminal-state refusal)
  // ==========================================================================

  it('Path A — draft in progress: advances draft pointer, FREEZES alias on approved (load-bearing)', async () => {
    // Dual-state doc: status=APPROVED with draft in progress. Restore must
    // target the draft pointer; alias must NOT be advanced (the load-bearing
    // CRIT-1 invariant; restore was the matching alias-leak vector to the
    // autosave bug surfaced during Story 17.16 live smoke).
    mockFindFirst.mockResolvedValueOnce({
      id: 'doc-1',
      status: 'APPROVED',
      current_version_number: 4,
      current_draft_version_id: 'v_draft',
      current_approved_version_id: 'v_approved',
      workspace_id: MOCK_WORKSPACE_ID,
    })
    mockFindFirst.mockResolvedValueOnce({
      content_json: { type: 'doc', content: [] },
    })

    let capturedDocUpdate: Record<string, unknown> | null = null
    mockTransaction.mockImplementation(
      async (fn: (_tx: unknown) => Promise<unknown>) => {
        const tx = {
          workspaceDocumentVersion: {
            create: vi
              .fn()
              .mockResolvedValue({ id: 'v_new', version_number: 5 }),
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

    const { restoreDocumentVersion } = await import('@/app/actions/documents')
    const result = await restoreDocumentVersion('doc-1', 2)

    expect(result.success).toBe(true)
    expect(capturedDocUpdate).toMatchObject({
      current_draft_version_id: 'v_new',
      current_version_number: 5,
    })
    // CRITICAL: alias MUST NOT be in the update payload (frozen on approved).
    expect(capturedDocUpdate!.current_version_id).toBeUndefined()
    expect(capturedDocUpdate!.current_approved_version_id).toBeUndefined()
    expect(capturedDocUpdate!.status).toBeUndefined()
  })

  it('Path B — never-approved DRAFT: advances both alias and draft pointer together', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'doc-1',
      status: 'DRAFT',
      current_version_number: 3,
      current_draft_version_id: null,
      current_approved_version_id: null,
      workspace_id: MOCK_WORKSPACE_ID,
    })
    mockFindFirst.mockResolvedValueOnce({
      content_json: { type: 'doc', content: [] },
    })

    let capturedDocUpdate: Record<string, unknown> | null = null
    mockTransaction.mockImplementation(
      async (fn: (_tx: unknown) => Promise<unknown>) => {
        const tx = {
          workspaceDocumentVersion: {
            create: vi
              .fn()
              .mockResolvedValue({ id: 'v_new', version_number: 4 }),
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

    const { restoreDocumentVersion } = await import('@/app/actions/documents')
    const result = await restoreDocumentVersion('doc-1', 1)

    expect(result.success).toBe(true)
    // Both alias AND draft pointer advance (no approved to protect).
    expect(capturedDocUpdate).toMatchObject({
      current_draft_version_id: 'v_new',
      current_version_id: 'v_new',
      current_version_number: 4,
    })
  })

  it('Path C — APPROVED with no draft: refuse with branch-first guidance', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'doc-1',
      status: 'APPROVED',
      current_version_number: 3,
      current_draft_version_id: null, // no draft
      current_approved_version_id: 'v_approved',
      workspace_id: MOCK_WORKSPACE_ID,
    })

    const { restoreDocumentVersion } = await import('@/app/actions/documents')
    const result = await restoreDocumentVersion('doc-1', 1)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/godkända dokumentet kan inte ändras/i)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it.each(['ARCHIVED', 'SUPERSEDED'] as const)(
    'Path D — refuses on terminal state %s',
    async (status) => {
      mockFindFirst.mockResolvedValueOnce({
        id: 'doc-1',
        status,
        current_version_number: 3,
        current_draft_version_id: null,
        current_approved_version_id: 'v_old',
        workspace_id: MOCK_WORKSPACE_ID,
      })

      const { restoreDocumentVersion } = await import('@/app/actions/documents')
      const result = await restoreDocumentVersion('doc-1', 1)

      expect(result.success).toBe(false)
      expect(result.error).toMatch(/arkiverat|upphävt/i)
      expect(mockTransaction).not.toHaveBeenCalled()
    }
  )
})

describe('saveDocumentVersion (ActivityLog)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates an ActivityLog entry when saving a version', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'doc-1',
      current_version_number: 2,
      workspace_id: MOCK_WORKSPACE_ID,
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

    const { saveDocumentVersion } = await import('@/app/actions/documents')
    await saveDocumentVersion('doc-1', { type: 'doc', content: [] })

    expect(capturedLogData).toMatchObject({
      workspace_id: MOCK_WORKSPACE_ID,
      user_id: MOCK_USER_ID,
      entity_type: 'workspace_document',
      entity_id: 'doc-1',
      action: 'document_version_saved',
    })
  })
})
