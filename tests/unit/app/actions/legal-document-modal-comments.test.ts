import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockListItemFindFirst = vi.fn()
const mockCommentFindFirst = vi.fn()
const mockCommentFindMany = vi.fn()
const mockCommentFindUnique = vi.fn()
const mockCommentCreate = vi.fn()
const mockCommentUpdate = vi.fn()
const mockCommentDelete = vi.fn()
const mockActivityLogCreate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    lawListItem: {
      findFirst: (...args: unknown[]) => mockListItemFindFirst(...args),
    },
    comment: {
      findMany: (...args: unknown[]) => mockCommentFindMany(...args),
      findFirst: (...args: unknown[]) => mockCommentFindFirst(...args),
      findUnique: (...args: unknown[]) => mockCommentFindUnique(...args),
      create: (...args: unknown[]) => mockCommentCreate(...args),
      update: (...args: unknown[]) => mockCommentUpdate(...args),
      delete: (...args: unknown[]) => mockCommentDelete(...args),
    },
    activityLog: {
      create: (...args: unknown[]) => mockActivityLogCreate(...args),
    },
  },
}))

const MOCK_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001'
const MOCK_USER_ID = '00000000-0000-4000-8000-000000000002'

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(
    async (
      fn: (_ctx: { workspaceId: string; userId: string }) => Promise<unknown>,
      _mode?: string
    ) => fn({ workspaceId: MOCK_WORKSPACE_ID, userId: MOCK_USER_ID })
  ),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const LLI_ID = '00000000-0000-4000-8000-000000000010'
const COMMENT_ID = '00000000-0000-4000-8000-000000000020'
const PARENT_COMMENT_ID = '00000000-0000-4000-8000-000000000021'
const DEEP_COMMENT_ID = '00000000-0000-4000-8000-000000000022'

const LIST_ITEM = {
  id: LLI_ID,
  law_list: { workspace_id: MOCK_WORKSPACE_ID },
}

const COMMENT = {
  id: COMMENT_ID,
  content: 'Test kommentar',
  author_id: MOCK_USER_ID,
  workspace_id: MOCK_WORKSPACE_ID,
  law_list_item_id: LLI_ID,
  parent_id: null,
  depth: 0,
  mentions: [],
  created_at: new Date('2026-03-14T10:00:00Z'),
  edited_at: null,
  author: {
    id: MOCK_USER_ID,
    name: 'Test User',
    email: 'test@test.com',
    avatar_url: null,
  },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Story 6.9: List Item Comment Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createListItemComment', () => {
    it('creates a root comment on a list item', async () => {
      // First call: lawListItem.findFirst (workspace check)
      // Second call: comment.findFirst (not used for create)
      mockListItemFindFirst.mockResolvedValueOnce(LIST_ITEM)
      mockCommentCreate.mockResolvedValueOnce(COMMENT)
      mockActivityLogCreate.mockResolvedValueOnce({})

      const { createListItemComment } = await import(
        '@/app/actions/legal-document-modal'
      )
      const result = await createListItemComment(LLI_ID, 'Test kommentar')

      expect(result.success).toBe(true)
      expect(result.data).toMatchObject({
        id: COMMENT_ID,
        content: 'Test kommentar',
        depth: 0,
      })

      // Verify comment was created with law_list_item_id
      expect(mockCommentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            law_list_item_id: LLI_ID,
            workspace_id: MOCK_WORKSPACE_ID,
            author_id: MOCK_USER_ID,
            depth: 0,
          }),
        })
      )

      // Verify activity log was created
      expect(mockActivityLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entity_type: 'list_item',
            entity_id: LLI_ID,
            action: 'comment_added',
          }),
        })
      )
    })

    it('creates a reply with correct depth', async () => {
      mockListItemFindFirst.mockResolvedValueOnce(LIST_ITEM)
      mockCommentFindUnique.mockResolvedValueOnce({ depth: 0 })
      mockCommentCreate.mockResolvedValueOnce({
        ...COMMENT,
        depth: 1,
        parent_id: PARENT_COMMENT_ID,
      })
      mockActivityLogCreate.mockResolvedValueOnce({})

      const { createListItemComment } = await import(
        '@/app/actions/legal-document-modal'
      )
      const result = await createListItemComment(
        LLI_ID,
        'Svar',
        PARENT_COMMENT_ID
      )

      expect(result.success).toBe(true)
      expect(mockCommentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            depth: 1,
            parent_id: PARENT_COMMENT_ID,
          }),
        })
      )
    })

    it('rejects reply beyond max depth (depth >= 2)', async () => {
      mockListItemFindFirst.mockResolvedValueOnce(LIST_ITEM)
      mockCommentFindUnique.mockResolvedValueOnce({ depth: 2 })

      const { createListItemComment } = await import(
        '@/app/actions/legal-document-modal'
      )
      const result = await createListItemComment(
        LLI_ID,
        'Too deep',
        DEEP_COMMENT_ID
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('3 nivåer')
      expect(mockCommentCreate).not.toHaveBeenCalled()
    })

    it('rejects empty content', async () => {
      const { createListItemComment } = await import(
        '@/app/actions/legal-document-modal'
      )
      const result = await createListItemComment(LLI_ID, '')

      expect(result.success).toBe(false)
    })

    it('rejects content over 5000 chars', async () => {
      const { createListItemComment } = await import(
        '@/app/actions/legal-document-modal'
      )
      const result = await createListItemComment(LLI_ID, 'x'.repeat(5001))

      expect(result.success).toBe(false)
    })

    it('rejects when list item not in workspace', async () => {
      mockListItemFindFirst.mockResolvedValueOnce({
        id: LLI_ID,
        law_list: { workspace_id: 'other-workspace' },
      })

      const { createListItemComment } = await import(
        '@/app/actions/legal-document-modal'
      )
      const result = await createListItemComment(LLI_ID, 'Comment')

      expect(result.success).toBe(false)
      expect(result.error).toContain('hittades inte')
    })

    it('extracts @mentions from content', async () => {
      mockListItemFindFirst.mockResolvedValueOnce(LIST_ITEM)
      mockCommentCreate.mockResolvedValueOnce({
        ...COMMENT,
        mentions: ['user-id-1'],
      })
      mockActivityLogCreate.mockResolvedValueOnce({})

      const { createListItemComment } = await import(
        '@/app/actions/legal-document-modal'
      )
      await createListItemComment(LLI_ID, 'Hej @[Anna](user-id-1) kolla detta')

      expect(mockCommentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mentions: ['user-id-1'],
          }),
        })
      )
    })
  })

  describe('updateListItemComment', () => {
    it('updates own comment and sets edited_at', async () => {
      mockCommentFindFirst.mockResolvedValueOnce(COMMENT)
      mockCommentUpdate.mockResolvedValueOnce({})

      const { updateListItemComment } = await import(
        '@/app/actions/legal-document-modal'
      )
      const result = await updateListItemComment(COMMENT_ID, 'Updated text')

      expect(result.success).toBe(true)
      expect(mockCommentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: 'Updated text',
            edited_at: expect.any(Date),
          }),
        })
      )
    })

    it('rejects edit by non-author', async () => {
      mockCommentFindFirst.mockResolvedValueOnce(null) // author_id doesn't match

      const { updateListItemComment } = await import(
        '@/app/actions/legal-document-modal'
      )
      const result = await updateListItemComment(COMMENT_ID, 'Hacked')

      expect(result.success).toBe(false)
      expect(result.error).toContain('behörighet')
    })
  })

  describe('deleteListItemComment', () => {
    it('deletes own comment', async () => {
      mockCommentFindFirst.mockResolvedValueOnce(COMMENT)
      mockCommentDelete.mockResolvedValueOnce({})

      const { deleteListItemComment } = await import(
        '@/app/actions/legal-document-modal'
      )
      const result = await deleteListItemComment(COMMENT_ID)

      expect(result.success).toBe(true)
      expect(mockCommentDelete).toHaveBeenCalledWith({
        where: { id: COMMENT_ID },
      })
    })

    it('rejects delete by non-author', async () => {
      mockCommentFindFirst.mockResolvedValueOnce(null)

      const { deleteListItemComment } = await import(
        '@/app/actions/legal-document-modal'
      )
      const result = await deleteListItemComment(COMMENT_ID)

      expect(result.success).toBe(false)
      expect(result.error).toContain('behörighet')
    })
  })

  describe('getListItemComments', () => {
    it('returns nested comments for a list item', async () => {
      mockListItemFindFirst.mockResolvedValueOnce(LIST_ITEM)
      mockCommentFindMany.mockResolvedValueOnce([{ ...COMMENT, replies: [] }])

      const { getListItemComments } = await import(
        '@/app/actions/legal-document-modal'
      )
      const result = await getListItemComments(LLI_ID)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
      expect(result.data![0]!.id).toBe(COMMENT_ID)
    })

    it('rejects when list item not in workspace', async () => {
      mockListItemFindFirst.mockResolvedValueOnce({
        id: LLI_ID,
        law_list: { workspace_id: 'other-workspace' },
      })

      const { getListItemComments } = await import(
        '@/app/actions/legal-document-modal'
      )
      const result = await getListItemComments(LLI_ID)

      expect(result.success).toBe(false)
    })
  })
})
