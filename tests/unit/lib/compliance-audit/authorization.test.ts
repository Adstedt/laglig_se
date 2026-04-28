/**
 * Story 21.14: Unit tests for lib/compliance-audit/authorization.ts.
 * Story 21.26: `canSealCycle` removed alongside the SEAL collapse.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isLeadAuditor,
  canCompleteOrRevertCycle,
  canSignOffItem,
} from '@/lib/compliance-audit/authorization'
import type { Prisma, WorkspaceRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// ============================================================================
// Module mocks
// ============================================================================

vi.mock('@/lib/prisma', () => ({
  prisma: {
    complianceAuditCycle: {
      findFirst: vi.fn(),
    },
  },
}))

// ============================================================================
// Fixtures (RFC 4122 v4 UUIDs — version nibble = 4, variant nibble ∈ {8,9,a,b})
// ============================================================================

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_WORKSPACE_ID = '99999999-9999-4999-8999-999999999999'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_USER_ID = '33333333-3333-4333-8333-333333333333'
const CYCLE_ID = '44444444-4444-4444-8444-444444444444'
const OTHER_CYCLE_ID = '55555555-5555-4555-8555-555555555555'

// ============================================================================
// isLeadAuditor
// ============================================================================

describe('isLeadAuditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when userId matches lead_auditor_user_id on an active cycle in the given workspace', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue({
      id: CYCLE_ID,
    } as never)

    const result = await isLeadAuditor(prisma, {
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })

    expect(result).toBe(true)
    expect(prisma.complianceAuditCycle.findFirst).toHaveBeenCalledTimes(1)
  })

  it('returns false when userId does not match', async () => {
    // Simulates: `lead_auditor_user_id = OTHER_USER_ID` on the cycle, query
    // for USER_ID therefore matches zero rows → findFirst returns null.
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(null)

    const result = await isLeadAuditor(prisma, {
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })

    expect(result).toBe(false)
  })

  it('returns false when cycle belongs to a different workspace (tenant isolation)', async () => {
    // Simulates: the cycle exists with lead_auditor_user_id = USER_ID, but in
    // OTHER_WORKSPACE_ID. Our query filters by workspaceId = WORKSPACE_ID,
    // so findFirst returns null.
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(null)

    const result = await isLeadAuditor(prisma, {
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })

    expect(result).toBe(false)
  })

  it('returns false when cycle is soft-deleted (deleted_at !== null)', async () => {
    // The where-clause filters `deleted_at: null`, so soft-deleted cycles are
    // excluded even if user+workspace otherwise match.
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(null)

    const result = await isLeadAuditor(prisma, {
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })

    expect(result).toBe(false)

    // Assert the where-clause actually includes deleted_at: null — pinpoints
    // the soft-delete filter so a future refactor that drops it would fail here.
    const call = vi.mocked(prisma.complianceAuditCycle.findFirst).mock.calls[0]!
    expect(call[0]?.where).toMatchObject({ deleted_at: null })
  })

  it('uses minimal select ({ id: true }) to avoid over-fetching', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue({
      id: CYCLE_ID,
    } as never)

    await isLeadAuditor(prisma, {
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })

    const call = vi.mocked(prisma.complianceAuditCycle.findFirst).mock.calls[0]!
    expect(call[0]?.select).toEqual({ id: true })
  })
})

// Story 21.26 — canSealCycle describe block deleted alongside the SEAL collapse.
// canCompleteOrRevertCycle now uses an inline OWNER/ADMIN role check
// instead of canSealAuditCycle. Tests below cover the surviving helper.

// ============================================================================
// canCompleteOrRevertCycle — Story 21.6
// ============================================================================

describe('canCompleteOrRevertCycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('OWNER returns true without DB hit (role short-circuit)', async () => {
    const result = await canCompleteOrRevertCycle({
      role: 'OWNER',
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })

    expect(result).toBe(true)
    expect(prisma.complianceAuditCycle.findFirst).not.toHaveBeenCalled()
  })

  it('ADMIN returns true without DB hit', async () => {
    const result = await canCompleteOrRevertCycle({
      role: 'ADMIN',
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })

    expect(result).toBe(true)
    expect(prisma.complianceAuditCycle.findFirst).not.toHaveBeenCalled()
  })

  it('MEMBER who is lead_auditor returns true via isLeadAuditor fallback', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue({
      id: CYCLE_ID,
    } as never)

    const result = await canCompleteOrRevertCycle({
      role: 'MEMBER',
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })

    expect(result).toBe(true)
    expect(prisma.complianceAuditCycle.findFirst).toHaveBeenCalledTimes(1)
  })

  it('MEMBER who is NOT lead_auditor returns false', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(null)

    const result = await canCompleteOrRevertCycle({
      role: 'MEMBER',
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })

    expect(result).toBe(false)
  })

  it('soft-deleted cycle lead auditor returns false via the deleted_at filter', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(null)

    const result = await canCompleteOrRevertCycle({
      role: 'MEMBER',
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })

    expect(result).toBe(false)
    const call = vi.mocked(prisma.complianceAuditCycle.findFirst).mock.calls[0]!
    expect(call[0]?.where).toMatchObject({ deleted_at: null })
  })

  it('accepts a Prisma.TransactionClient as the optional second arg', async () => {
    const txStub = {
      complianceAuditCycle: {
        findFirst: vi.fn().mockResolvedValue({ id: CYCLE_ID }),
      },
    } as unknown as Prisma.TransactionClient

    const result = await canCompleteOrRevertCycle(
      {
        role: 'MEMBER',
        userId: USER_ID,
        cycleId: CYCLE_ID,
        workspaceId: WORKSPACE_ID,
      },
      txStub
    )

    expect(result).toBe(true)
    expect(prisma.complianceAuditCycle.findFirst).not.toHaveBeenCalled()
  })

  it('defaults to the module-level prisma client when no client arg provided', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue({
      id: CYCLE_ID,
    } as never)

    const result = await canCompleteOrRevertCycle({
      role: 'MEMBER',
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })

    expect(result).toBe(true)
    expect(prisma.complianceAuditCycle.findFirst).toHaveBeenCalledTimes(1)
  })
})

// ============================================================================
// canSignOffItem — pure synchronous helper, no DB
// ============================================================================

describe('canSignOffItem', () => {
  const LEAD = 'lead-auditor-id'
  const RESPONSIBLE = 'responsible-id'
  const RANDOM = 'random-user-id'

  function buildArgs(
    role: WorkspaceRole,
    userId: string,
    responsibleUserId: string | null
  ) {
    return {
      role,
      userId,
      leadAuditorUserId: LEAD,
      responsibleUserId,
    }
  }

  it('OWNER passes regardless of lead auditor / responsible user (escape hatch)', () => {
    expect(canSignOffItem(buildArgs('OWNER', RANDOM, null))).toBe(true)
    expect(canSignOffItem(buildArgs('OWNER', RANDOM, RESPONSIBLE))).toBe(true)
  })

  it('ADMIN passes regardless of lead auditor / responsible user (escape hatch)', () => {
    expect(canSignOffItem(buildArgs('ADMIN', RANDOM, null))).toBe(true)
  })

  it('user matching leadAuditorUserId passes regardless of role', () => {
    expect(canSignOffItem(buildArgs('MEMBER', LEAD, null))).toBe(true)
    expect(canSignOffItem(buildArgs('HR_MANAGER', LEAD, RESPONSIBLE))).toBe(
      true
    )
  })

  it('user matching responsibleUserId passes', () => {
    expect(canSignOffItem(buildArgs('MEMBER', RESPONSIBLE, RESPONSIBLE))).toBe(
      true
    )
    expect(
      canSignOffItem(buildArgs('HR_MANAGER', RESPONSIBLE, RESPONSIBLE))
    ).toBe(true)
  })

  it('null responsibleUserId blocks the responsible-user path', () => {
    expect(canSignOffItem(buildArgs('MEMBER', RESPONSIBLE, null))).toBe(false)
    expect(canSignOffItem(buildArgs('HR_MANAGER', RANDOM, null))).toBe(false)
  })

  it('non-admin / non-lead / non-responsible is blocked', () => {
    expect(canSignOffItem(buildArgs('MEMBER', RANDOM, RESPONSIBLE))).toBe(false)
    expect(canSignOffItem(buildArgs('HR_MANAGER', RANDOM, RESPONSIBLE))).toBe(
      false
    )
  })
})

// Reference the otherwise-unused fixtures so lint doesn't complain.
// These are kept for documentation value — future test authors may need them.
void OTHER_USER_ID
void OTHER_WORKSPACE_ID
void OTHER_CYCLE_ID
