import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockListItemFindFirst = vi.fn()
const mockListItemUpdate = vi.fn()
const mockWorkspaceMemberFindFirst = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    lawListItem: {
      findFirst: (...args: unknown[]) => mockListItemFindFirst(...args),
      update: (...args: unknown[]) => mockListItemUpdate(...args),
    },
    workspaceMember: {
      findFirst: (...args: unknown[]) => mockWorkspaceMemberFindFirst(...args),
    },
  },
}))

const mockLogActivity = vi.fn()
vi.mock('@/lib/services/activity-logger', () => ({
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
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

vi.mock('@/lib/cache/redis', () => ({
  redis: {
    del: vi.fn().mockResolvedValue(1),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const LLI_ID = '00000000-0000-4000-8000-000000000010'

const LIST_ITEM = {
  id: LLI_ID,
  compliance_status: 'EJ_PABORJAD',
  priority: 'MEDIUM',
  responsible_user_id: null,
  business_context: null,
  compliance_actions: null,
  law_list: { workspace_id: MOCK_WORKSPACE_ID },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Story 6.10: List Item Mutation Activity Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updateListItemComplianceStatus', () => {
    it('calls logActivity with action status_changed and old/new compliance_status', async () => {
      mockListItemFindFirst.mockResolvedValueOnce(LIST_ITEM)
      mockListItemUpdate.mockResolvedValueOnce({})
      mockLogActivity.mockResolvedValueOnce(undefined)

      const { updateListItemComplianceStatus } = await import(
        '@/app/actions/legal-document-modal'
      )
      const result = await updateListItemComplianceStatus(LLI_ID, 'UPPFYLLD')

      expect(result.success).toBe(true)

      expect(mockLogActivity).toHaveBeenCalledWith(
        MOCK_WORKSPACE_ID,
        MOCK_USER_ID,
        'list_item',
        LLI_ID,
        'status_changed',
        { compliance_status: 'EJ_PABORJAD' },
        { compliance_status: 'UPPFYLLD' }
      )
    })
  })

  describe('updateListItemPriority', () => {
    it('calls logActivity with action priority_changed and old/new priority', async () => {
      mockListItemFindFirst.mockResolvedValueOnce(LIST_ITEM)
      mockListItemUpdate.mockResolvedValueOnce({})
      mockLogActivity.mockResolvedValueOnce(undefined)

      const { updateListItemPriority } = await import(
        '@/app/actions/legal-document-modal'
      )
      const result = await updateListItemPriority(LLI_ID, 'HIGH')

      expect(result.success).toBe(true)

      expect(mockLogActivity).toHaveBeenCalledWith(
        MOCK_WORKSPACE_ID,
        MOCK_USER_ID,
        'list_item',
        LLI_ID,
        'priority_changed',
        { priority: 'MEDIUM' },
        { priority: 'HIGH' }
      )
    })
  })

  describe('updateListItemResponsible', () => {
    it('calls logActivity with action responsible_changed and old/new responsible_user_id', async () => {
      mockListItemFindFirst.mockResolvedValueOnce(LIST_ITEM)
      const targetUserId = '00000000-0000-4000-8000-000000000099'
      mockWorkspaceMemberFindFirst.mockResolvedValueOnce({
        id: 'member-1',
        workspace_id: MOCK_WORKSPACE_ID,
        user_id: targetUserId,
      })
      mockListItemUpdate.mockResolvedValueOnce({})
      mockLogActivity.mockResolvedValueOnce(undefined)

      const { updateListItemResponsible } = await import(
        '@/app/actions/legal-document-modal'
      )
      const result = await updateListItemResponsible(LLI_ID, targetUserId)

      expect(result.success).toBe(true)

      expect(mockLogActivity).toHaveBeenCalledWith(
        MOCK_WORKSPACE_ID,
        MOCK_USER_ID,
        'list_item',
        LLI_ID,
        'responsible_changed',
        { responsible_user_id: null },
        { responsible_user_id: targetUserId }
      )
    })
  })

  describe('updateListItemBusinessContext', () => {
    it('calls logActivity with action business_context_updated', async () => {
      mockListItemFindFirst.mockResolvedValueOnce(LIST_ITEM)
      mockListItemUpdate.mockResolvedValueOnce({})
      mockLogActivity.mockResolvedValueOnce(undefined)

      const { updateListItemBusinessContext } = await import(
        '@/app/actions/legal-document-modal'
      )
      const result = await updateListItemBusinessContext(
        LLI_ID,
        'New business context'
      )

      expect(result.success).toBe(true)

      expect(mockLogActivity).toHaveBeenCalledWith(
        MOCK_WORKSPACE_ID,
        MOCK_USER_ID,
        'list_item',
        LLI_ID,
        'business_context_updated',
        { changed: true },
        { changed: true }
      )
    })
  })

  describe('updateListItemComplianceActions', () => {
    it('calls logActivity with action compliance_actions_updated', async () => {
      mockListItemFindFirst.mockResolvedValueOnce(LIST_ITEM)
      mockListItemUpdate.mockResolvedValueOnce({})
      mockLogActivity.mockResolvedValueOnce(undefined)

      const { updateListItemComplianceActions } = await import(
        '@/app/actions/legal-document-modal'
      )
      const result = await updateListItemComplianceActions(
        LLI_ID,
        'We comply by doing X and Y'
      )

      expect(result.success).toBe(true)

      expect(mockLogActivity).toHaveBeenCalledWith(
        MOCK_WORKSPACE_ID,
        MOCK_USER_ID,
        'list_item',
        LLI_ID,
        'compliance_actions_updated',
        { changed: true },
        { changed: true }
      )
    })
  })
})
