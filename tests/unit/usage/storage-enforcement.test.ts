/**
 * Story 5.5b — integration tests for storage enforcement.
 *
 * Mocks Prisma per the existing pattern in tests/unit/usage/seat-enforcement.test.ts.
 * Covers:
 *   - assertWithinStorageQuota across tier × usage permutations
 *   - getStorageUsage shape for paid + Enterprise + trial workspaces
 *   - StorageQuotaExceededError fields
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------- mock setup --------------------------------------------

const mockWorkspace = {
  findUniqueOrThrow: vi.fn(),
}
const mockWorkspaceFile = {
  aggregate: vi.fn(),
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: mockWorkspace,
    workspaceFile: mockWorkspaceFile,
  },
}))

const BYTES_PER_GB = 1_073_741_824

const setWorkspace = (
  tier: 'TRIAL' | 'SOLO' | 'TEAM' | 'ENTERPRISE',
  trial_picked_tier: 'TRIAL' | 'SOLO' | 'TEAM' | 'ENTERPRISE' | null = null
) => {
  mockWorkspace.findUniqueOrThrow.mockResolvedValue({
    subscription_tier: tier,
    trial_picked_tier,
  })
}

const setUsedBytes = (bytes: number) => {
  mockWorkspaceFile.aggregate.mockResolvedValue({
    _sum: { file_size: bytes },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ============================================================================
// assertWithinStorageQuota
// ============================================================================

describe('assertWithinStorageQuota', () => {
  it('Solo at 50% usage → allows upload, no warning', async () => {
    setWorkspace('SOLO')
    setUsedBytes(0.5 * BYTES_PER_GB)
    const { assertWithinStorageQuota } = await import('@/lib/usage/storage')
    const result = await assertWithinStorageQuota('ws_x', 0.1 * BYTES_PER_GB)
    expect(result.warning).toBeUndefined()
  })

  it('Solo at 80% usage → returns warning payload (still allowed)', async () => {
    setWorkspace('SOLO')
    setUsedBytes(0.7 * BYTES_PER_GB)
    const { assertWithinStorageQuota } = await import('@/lib/usage/storage')
    const result = await assertWithinStorageQuota('ws_x', 0.15 * BYTES_PER_GB)
    expect(result.warning).toBeDefined()
    expect(result.warning?.percentUsed).toBeGreaterThanOrEqual(0.8)
    expect(result.warning?.limitBytes).toBe(BYTES_PER_GB)
  })

  it('Solo upload that would exceed 1 GB → throws StorageQuotaExceededError', async () => {
    setWorkspace('SOLO')
    setUsedBytes(0.9 * BYTES_PER_GB)
    const { assertWithinStorageQuota, StorageQuotaExceededError } =
      await import('@/lib/usage/storage')
    await expect(
      assertWithinStorageQuota('ws_x', 0.2 * BYTES_PER_GB)
    ).rejects.toBeInstanceOf(StorageQuotaExceededError)
  })

  it('Team workspace has 5 GB cap', async () => {
    setWorkspace('TEAM')
    setUsedBytes(4 * BYTES_PER_GB)
    const { assertWithinStorageQuota, StorageQuotaExceededError } =
      await import('@/lib/usage/storage')
    // 4 + 0.5 GB = 4.5 GB, within 5 GB cap
    const result = await assertWithinStorageQuota('ws_x', 0.5 * BYTES_PER_GB)
    expect(result.warning).toBeDefined() // 90% used, soft warn

    // 4 + 2 GB = 6 GB, exceeds 5 GB cap
    setUsedBytes(4 * BYTES_PER_GB)
    await expect(
      assertWithinStorageQuota('ws_x', 2 * BYTES_PER_GB)
    ).rejects.toBeInstanceOf(StorageQuotaExceededError)
  })

  it('Enterprise has 100 GB default cap (NOT bypassed)', async () => {
    setWorkspace('ENTERPRISE')
    setUsedBytes(50 * BYTES_PER_GB)
    const { assertWithinStorageQuota } = await import('@/lib/usage/storage')
    // 50 + 10 GB = 60 GB, within 100 GB cap, under 80% threshold
    const result = await assertWithinStorageQuota('ws_x', 10 * BYTES_PER_GB)
    expect(result.warning).toBeUndefined()
  })

  it('Enterprise upload that would exceed 100 GB still throws', async () => {
    setWorkspace('ENTERPRISE')
    setUsedBytes(99 * BYTES_PER_GB)
    const { assertWithinStorageQuota, StorageQuotaExceededError } =
      await import('@/lib/usage/storage')
    await expect(
      assertWithinStorageQuota('ws_x', 2 * BYTES_PER_GB)
    ).rejects.toBeInstanceOf(StorageQuotaExceededError)
  })

  it('Trial workspace with trial_picked_tier=TEAM uses 5 GB cap', async () => {
    setWorkspace('TRIAL', 'TEAM')
    setUsedBytes(4 * BYTES_PER_GB)
    const { assertWithinStorageQuota, StorageQuotaExceededError } =
      await import('@/lib/usage/storage')
    // 4 + 1.5 = 5.5 GB → over Team's 5 GB cap
    await expect(
      assertWithinStorageQuota('ws_x', 1.5 * BYTES_PER_GB)
    ).rejects.toBeInstanceOf(StorageQuotaExceededError)
  })

  it('aggregate filters folders (is_folder: false in WHERE)', async () => {
    setWorkspace('SOLO')
    setUsedBytes(0)
    const { assertWithinStorageQuota } = await import('@/lib/usage/storage')
    await assertWithinStorageQuota('ws_x', 100)

    const aggregateCall = mockWorkspaceFile.aggregate.mock.calls[0]?.[0]
    expect(aggregateCall).toBeDefined()
    expect(aggregateCall.where).toMatchObject({
      workspace_id: 'ws_x',
      is_folder: false,
    })
  })

  it('aggregate _sum.file_size null defaults to 0 (empty workspace)', async () => {
    setWorkspace('SOLO')
    mockWorkspaceFile.aggregate.mockResolvedValue({ _sum: { file_size: null } })
    const { assertWithinStorageQuota } = await import('@/lib/usage/storage')
    const result = await assertWithinStorageQuota('ws_x', 1024)
    expect(result.warning).toBeUndefined()
  })

  it('StorageQuotaExceededError carries the structured fields', async () => {
    // Use integer byte counts (file_size is Int in Prisma) to avoid float
    // precision noise — 0.95 GiB has fractional bytes.
    const usedBytes = 1_000_000_000 // ~931 MiB
    const incomingBytes = 200_000_000 // ~191 MiB; together exceed 1 GiB cap
    setWorkspace('SOLO')
    setUsedBytes(usedBytes)
    const { assertWithinStorageQuota, StorageQuotaExceededError } =
      await import('@/lib/usage/storage')
    try {
      await assertWithinStorageQuota('ws_x', incomingBytes)
      expect.fail('expected throw')
    } catch (error) {
      expect(error).toBeInstanceOf(StorageQuotaExceededError)
      const err = error as InstanceType<typeof StorageQuotaExceededError>
      expect(err.currentBytes).toBe(usedBytes)
      expect(err.incomingBytes).toBe(incomingBytes)
      expect(err.limitBytes).toBe(BYTES_PER_GB)
      expect(err.tier).toBe('SOLO')
    }
  })
})

// ============================================================================
// getStorageUsage
// ============================================================================

describe('getStorageUsage', () => {
  it('Solo returns { usedBytes, limitBytes=1GB, percentUsed, tier }', async () => {
    setWorkspace('SOLO')
    setUsedBytes(0.5 * BYTES_PER_GB)
    const { getStorageUsage } = await import('@/lib/usage/storage')
    const usage = await getStorageUsage('ws_x')
    expect(usage.usedBytes).toBe(0.5 * BYTES_PER_GB)
    expect(usage.limitBytes).toBe(BYTES_PER_GB)
    expect(usage.percentUsed).toBe(0.5)
    expect(usage.tier).toBe('SOLO')
  })

  it('Team returns 5 GB limitBytes', async () => {
    setWorkspace('TEAM')
    setUsedBytes(2 * BYTES_PER_GB)
    const { getStorageUsage } = await import('@/lib/usage/storage')
    const usage = await getStorageUsage('ws_x')
    expect(usage.limitBytes).toBe(5 * BYTES_PER_GB)
    expect(usage.tier).toBe('TEAM')
  })

  it('Enterprise returns 100 GB limitBytes (NOT null)', async () => {
    setWorkspace('ENTERPRISE')
    setUsedBytes(20 * BYTES_PER_GB)
    const { getStorageUsage } = await import('@/lib/usage/storage')
    const usage = await getStorageUsage('ws_x')
    expect(usage.limitBytes).toBe(100 * BYTES_PER_GB)
    expect(usage.percentUsed).toBe(0.2)
    expect(usage.tier).toBe('ENTERPRISE')
  })

  it('Trial with trial_picked_tier=TEAM reports tier=TEAM and 5 GB cap', async () => {
    setWorkspace('TRIAL', 'TEAM')
    setUsedBytes(BYTES_PER_GB)
    const { getStorageUsage } = await import('@/lib/usage/storage')
    const usage = await getStorageUsage('ws_x')
    expect(usage.tier).toBe('TEAM')
    expect(usage.limitBytes).toBe(5 * BYTES_PER_GB)
  })

  it('Empty workspace (0 bytes) reports percentUsed=0', async () => {
    setWorkspace('SOLO')
    mockWorkspaceFile.aggregate.mockResolvedValue({ _sum: { file_size: null } })
    const { getStorageUsage } = await import('@/lib/usage/storage')
    const usage = await getStorageUsage('ws_x')
    expect(usage.usedBytes).toBe(0)
    expect(usage.percentUsed).toBe(0)
  })
})
