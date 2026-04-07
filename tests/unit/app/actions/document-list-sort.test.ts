import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindMany = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceDocument: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(
    async (
      fn: (_ctx: { workspaceId: string; userId: string }) => Promise<unknown>
    ) => fn({ workspaceId: 'ws-0001', userId: 'user-0001' })
  ),
}))

// Mock Tiptap extensions (required by documents.ts module)
vi.mock('@tiptap/core', () => ({ generateHTML: vi.fn(() => '') }))
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
vi.mock('@/lib/supabase/storage', () => ({ getStorageClient: vi.fn() }))

describe('getWorkspaceDocuments sort support', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindMany.mockResolvedValue([])
  })

  it('defaults to updated_at desc when no sort specified', async () => {
    const { getWorkspaceDocuments } = await import('@/app/actions/documents')
    await getWorkspaceDocuments({})

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { updated_at: 'desc' },
      })
    )
  })

  it('uses sortBy and sortOrder when provided', async () => {
    const { getWorkspaceDocuments } = await import('@/app/actions/documents')
    await getWorkspaceDocuments({ sortBy: 'title', sortOrder: 'asc' })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { title: 'asc' },
      })
    )
  })

  it('supports review_date sort', async () => {
    const { getWorkspaceDocuments } = await import('@/app/actions/documents')
    await getWorkspaceDocuments({ sortBy: 'review_date', sortOrder: 'desc' })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { review_date: 'desc' },
      })
    )
  })

  it('supports created_at sort', async () => {
    const { getWorkspaceDocuments } = await import('@/app/actions/documents')
    await getWorkspaceDocuments({ sortBy: 'created_at', sortOrder: 'asc' })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { created_at: 'asc' },
      })
    )
  })
})
