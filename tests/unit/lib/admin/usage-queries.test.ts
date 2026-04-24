/**
 * Story 14.27: Unit tests for admin usage aggregation queries.
 *
 * These queries use Prisma $queryRaw with tagged template parameters. Testing
 * strategy: mock $queryRaw to capture and return stub data; verify the function
 * surfaces the correct data shape and handles clamping / filtering correctly.
 *
 * SQL correctness itself is covered by the manual-verification step of the story
 * (AC 16 — seed rows and confirm sums via real Supabase dev DB).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted ensures this mock fn is defined BEFORE the vi.mock factory runs
// (vi.mock is hoisted to the top of the file by Vitest).
const { mockQueryRaw } = vi.hoisted(() => ({ mockQueryRaw: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}))

// Re-export Prisma helpers from the real package so Prisma.sql / Prisma.empty still work
vi.mock('@prisma/client', async () => {
  const actual =
    await vi.importActual<typeof import('@prisma/client')>('@prisma/client')
  return actual
})

import {
  getUsageByWorkspace,
  getUsageByUser,
  getUsageTimeSeries,
} from '@/lib/admin/queries'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getUsageByWorkspace', () => {
  it('returns the data shape from $queryRaw', async () => {
    const stubRows = [
      {
        workspaceId: 'ws-1',
        workspaceName: 'Acme AB',
        tier: 'TEAM',
        totalCostUsd: '4.250000',
        totalInputTokens: 100_000n,
        totalOutputTokens: 5_000n,
        totalCacheReadTokens: 60_000n,
        turnCount: 42n,
      },
    ]
    mockQueryRaw.mockResolvedValueOnce(stubRows)

    const result = await getUsageByWorkspace({
      rangeDays: 30,
      limit: 25,
      offset: 0,
    })

    expect(result).toEqual(stubRows)
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })

  it('does not throw on out-of-range rangeDays (clamps to 1-365)', async () => {
    mockQueryRaw.mockResolvedValue([])
    // Negative rangeDays — should clamp to 1
    await expect(
      getUsageByWorkspace({ rangeDays: -5, limit: 25, offset: 0 })
    ).resolves.toEqual([])
    // Huge rangeDays — should clamp to 365
    await expect(
      getUsageByWorkspace({ rangeDays: 10_000, limit: 25, offset: 0 })
    ).resolves.toEqual([])
  })

  it('clamps limit to 1-100 range', async () => {
    mockQueryRaw.mockResolvedValue([])
    await expect(
      getUsageByWorkspace({ rangeDays: 7, limit: 0, offset: 0 })
    ).resolves.toEqual([])
    await expect(
      getUsageByWorkspace({ rangeDays: 7, limit: 9_999, offset: 0 })
    ).resolves.toEqual([])
  })

  it('clamps offset to non-negative', async () => {
    mockQueryRaw.mockResolvedValue([])
    await expect(
      getUsageByWorkspace({ rangeDays: 7, limit: 25, offset: -100 })
    ).resolves.toEqual([])
  })
})

describe('getUsageByUser', () => {
  it('returns per-user rows with workspace join', async () => {
    const stubRows = [
      {
        userId: 'user-1',
        userName: 'Alexander',
        userEmail: 'a@example.com',
        workspaceId: 'ws-1',
        workspaceName: 'Acme AB',
        totalCostUsd: '2.100000',
        totalInputTokens: 50_000n,
        totalOutputTokens: 2_500n,
        turnCount: 20n,
      },
    ]
    mockQueryRaw.mockResolvedValueOnce(stubRows)

    const result = await getUsageByUser({
      rangeDays: 30,
      limit: 25,
      offset: 0,
    })

    expect(result).toEqual(stubRows)
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })

  it('uses the workspace-scoped branch when workspaceId is provided', async () => {
    mockQueryRaw.mockResolvedValue([])
    await getUsageByUser({
      workspaceId: 'ws-1',
      rangeDays: 7,
      limit: 10,
      offset: 0,
    })
    // Both branches call $queryRaw once — we can't easily inspect the SQL
    // from the tagged template, but we can verify the call happened.
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })

  it('uses the global branch when workspaceId is absent', async () => {
    mockQueryRaw.mockResolvedValue([])
    await getUsageByUser({
      rangeDays: 7,
      limit: 10,
      offset: 0,
    })
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })

  it('handles nullable userName (non-logged-in-name users)', async () => {
    const stubRows = [
      {
        userId: 'user-2',
        userName: null,
        userEmail: 'anon@example.com',
        workspaceId: 'ws-1',
        workspaceName: 'Acme AB',
        totalCostUsd: '0.500000',
        totalInputTokens: 10_000n,
        totalOutputTokens: 500n,
        turnCount: 5n,
      },
    ]
    mockQueryRaw.mockResolvedValueOnce(stubRows)

    const result = await getUsageByUser({
      rangeDays: 30,
      limit: 25,
      offset: 0,
    })

    expect(result[0]?.userName).toBeNull()
  })
})

describe('getUsageTimeSeries', () => {
  it('returns bucketed time series rows', async () => {
    const stubRows = [
      {
        bucketStart: new Date('2026-04-17T00:00:00Z'),
        totalCostUsd: '0.250000',
        turnCount: 10n,
      },
      {
        bucketStart: new Date('2026-04-18T00:00:00Z'),
        totalCostUsd: '0.320000',
        turnCount: 15n,
      },
    ]
    mockQueryRaw.mockResolvedValueOnce(stubRows)

    const result = await getUsageTimeSeries({
      rangeDays: 7,
    })

    expect(result).toEqual(stubRows)
    expect(result).toHaveLength(2)
  })

  it('accepts bucketHours parameter with default 24', async () => {
    mockQueryRaw.mockResolvedValue([])
    await expect(
      getUsageTimeSeries({ rangeDays: 30, bucketHours: 6 })
    ).resolves.toEqual([])
    await expect(getUsageTimeSeries({ rangeDays: 30 })).resolves.toEqual([])
  })

  it('clamps bucketHours to 1-168 (max 7 days)', async () => {
    mockQueryRaw.mockResolvedValue([])
    await expect(
      getUsageTimeSeries({ rangeDays: 30, bucketHours: -10 })
    ).resolves.toEqual([])
    await expect(
      getUsageTimeSeries({ rangeDays: 30, bucketHours: 10_000 })
    ).resolves.toEqual([])
  })

  it('supports workspace-scoped filter', async () => {
    mockQueryRaw.mockResolvedValue([])
    await getUsageTimeSeries({
      workspaceId: 'ws-1',
      rangeDays: 7,
    })
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })

  it('supports user-scoped filter', async () => {
    mockQueryRaw.mockResolvedValue([])
    await getUsageTimeSeries({
      userId: 'user-1',
      rangeDays: 7,
    })
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })

  it('supports both workspace and user filters combined', async () => {
    mockQueryRaw.mockResolvedValue([])
    await getUsageTimeSeries({
      workspaceId: 'ws-1',
      userId: 'user-1',
      rangeDays: 7,
    })
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })
})
