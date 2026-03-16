import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockActivityLogCreate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    activityLog: {
      create: (...args: unknown[]) => mockActivityLogCreate(...args),
    },
  },
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('logActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates correct Prisma record with all fields', async () => {
    mockActivityLogCreate.mockResolvedValueOnce({})

    const { logActivity } = await import('@/lib/services/activity-logger')

    await logActivity(
      'ws-1',
      'user-1',
      'list_item',
      'entity-123',
      'status_changed',
      { compliance_status: 'EJ_PABORJAD' },
      { compliance_status: 'UPPFYLLD' }
    )

    expect(mockActivityLogCreate).toHaveBeenCalledOnce()
    expect(mockActivityLogCreate).toHaveBeenCalledWith({
      data: {
        workspace_id: 'ws-1',
        user_id: 'user-1',
        entity_type: 'list_item',
        entity_id: 'entity-123',
        action: 'status_changed',
        old_value: { compliance_status: 'EJ_PABORJAD' },
        new_value: { compliance_status: 'UPPFYLLD' },
      },
    })
  })

  it('serializes old/new values via JSON.parse(JSON.stringify())', async () => {
    mockActivityLogCreate.mockResolvedValueOnce({})

    const { logActivity } = await import('@/lib/services/activity-logger')

    const dateObj = new Date('2026-01-15T12:00:00Z')
    await logActivity(
      'ws-1',
      'user-1',
      'list_item',
      'entity-123',
      'updated',
      { date: dateObj },
      { date: dateObj }
    )

    // JSON.parse(JSON.stringify(date)) converts Date to ISO string
    expect(mockActivityLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        old_value: { date: '2026-01-15T12:00:00.000Z' },
        new_value: { date: '2026-01-15T12:00:00.000Z' },
      }),
    })
  })

  it('handles undefined old/new values (sets null)', async () => {
    mockActivityLogCreate.mockResolvedValueOnce({})

    const { logActivity } = await import('@/lib/services/activity-logger')

    await logActivity(
      'ws-1',
      'user-1',
      'list_item',
      'entity-123',
      'comment_added',
      undefined,
      undefined
    )

    expect(mockActivityLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        old_value: null,
        new_value: null,
      }),
    })
  })
})
