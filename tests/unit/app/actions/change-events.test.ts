import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChangeType } from '@prisma/client'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockQueryRaw = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}))

const MOCK_WORKSPACE_ID = 'ws-test-1'

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(
    async (
      fn: (_ctx: { workspaceId: string; userId: string }) => Promise<unknown>,
      _mode: string
    ) => fn({ workspaceId: MOCK_WORKSPACE_ID, userId: 'user-test-1' })
  ),
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const CHANGE_ROW = {
  id: 'ce-deep-1',
  document_id: 'doc-1',
  title: 'Arbetsmiljölagen (1977:1160)',
  document_number: 'SFS 1977:1160',
  content_type: 'SFS_LAW',
  change_type: ChangeType.AMENDMENT,
  amendment_sfs: 'SFS 2026:145',
  ai_summary: 'Ändring i kapitel 7.',
  detected_at: new Date('2026-02-17T04:30:00Z'),
  list_id: 'list-1',
  list_name: 'Arbetsmiljö',
  law_list_item_id: 'lli-1',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getUnacknowledgedChangeById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the change when found in workspace', async () => {
    mockQueryRaw.mockResolvedValue([CHANGE_ROW])

    const { getUnacknowledgedChangeById } = await import(
      '@/app/actions/change-events'
    )
    const result = await getUnacknowledgedChangeById('ce-deep-1')

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      id: 'ce-deep-1',
      documentTitle: 'Arbetsmiljölagen (1977:1160)',
      aiSummary: 'Ändring i kapitel 7.',
      priority: 'MEDIUM',
      lawListItemId: 'lli-1',
    })
  })

  it('returns null when change is not found', async () => {
    mockQueryRaw.mockResolvedValue([])

    const { getUnacknowledgedChangeById } = await import(
      '@/app/actions/change-events'
    )
    const result = await getUnacknowledgedChangeById('ce-nonexistent')

    expect(result.success).toBe(true)
    expect(result.data).toBeNull()
  })

  it('returns error on unexpected failure', async () => {
    mockQueryRaw.mockRejectedValue(new Error('DB down'))

    const { getUnacknowledgedChangeById } = await import(
      '@/app/actions/change-events'
    )
    const result = await getUnacknowledgedChangeById('ce-deep-1')

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})
