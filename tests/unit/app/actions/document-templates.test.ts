import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindMany = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceDocumentTemplate: {
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

// Mock all Tiptap extensions (required by documents.ts module)
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

describe('getDocumentTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns active templates ordered by sort_order', async () => {
    const mockTemplates = [
      {
        id: '1',
        name: 'Arbetsmiljöpolicy',
        description: 'Desc',
        document_type: 'POLICY',
        content_json: {},
        sort_order: 1,
      },
      {
        id: '2',
        name: 'Riskbedömning',
        description: 'Desc',
        document_type: 'RISK_ASSESSMENT',
        content_json: {},
        sort_order: 2,
      },
    ]
    mockFindMany.mockResolvedValue(mockTemplates)

    const { getDocumentTemplates } = await import('@/app/actions/documents')
    const result = await getDocumentTemplates()

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
      })
    )
  })

  it('returns empty array when no templates exist', async () => {
    mockFindMany.mockResolvedValue([])

    const { getDocumentTemplates } = await import('@/app/actions/documents')
    const result = await getDocumentTemplates()

    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
  })
})
