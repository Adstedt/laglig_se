/**
 * Story 21.14: Unit tests for lib/compliance-audit/authorization.ts.
 * Mocks Prisma; pure logic for canSealCycle + isLeadAuditor.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Prisma } from '@prisma/client'
import {
  isLeadAuditor,
  canSealCycle,
} from '@/lib/compliance-audit/authorization'
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

// ============================================================================
// canSealCycle
// ============================================================================

describe('canSealCycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('OWNER returns true without DB hit', async () => {
    const result = await canSealCycle(prisma, {
      role: 'OWNER',
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })

    expect(result).toBe(true)
    expect(prisma.complianceAuditCycle.findFirst).not.toHaveBeenCalled()
  })

  it('ADMIN returns true without DB hit', async () => {
    const result = await canSealCycle(prisma, {
      role: 'ADMIN',
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })

    expect(result).toBe(true)
    expect(prisma.complianceAuditCycle.findFirst).not.toHaveBeenCalled()
  })

  it('MEMBER who is lead_auditor returns true', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue({
      id: CYCLE_ID,
    } as never)

    const result = await canSealCycle(prisma, {
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

    const result = await canSealCycle(prisma, {
      role: 'MEMBER',
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })

    expect(result).toBe(false)
    expect(prisma.complianceAuditCycle.findFirst).toHaveBeenCalledTimes(1)
  })

  it('AUDITOR who is NOT lead_auditor returns false', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(null)

    const result = await canSealCycle(prisma, {
      role: 'AUDITOR',
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })

    expect(result).toBe(false)
  })

  // This is a theoretical edge case — AUDITOR role being made lead-auditor is
  // not a common flow but the authorization logic must still be coherent.
  // Product may want a separate policy later — see the story's "Not-in-scope"
  // section ("AUDITOR-as-lead-auditor policy") for the product-level stance.
  it('AUDITOR who happens to be lead_auditor returns true', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue({
      id: CYCLE_ID,
    } as never)

    const result = await canSealCycle(prisma, {
      role: 'AUDITOR',
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })

    expect(result).toBe(true)
  })

  it('accepts a top-level Prisma client (outside transaction)', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue({
      id: CYCLE_ID,
    } as never)

    const result = await canSealCycle(prisma, {
      role: 'MEMBER',
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })

    expect(result).toBe(true)
  })

  it('accepts a Prisma.TransactionClient (inside transaction)', async () => {
    // Double-cast is required under strict TS: Prisma.TransactionClient has
    // 30+ model properties and this helper only touches one.
    const txStub = {
      complianceAuditCycle: {
        findFirst: vi.fn().mockResolvedValue({ id: CYCLE_ID }),
      },
    } as unknown as Prisma.TransactionClient

    const result = await canSealCycle(txStub, {
      role: 'MEMBER',
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })

    expect(result).toBe(true)
    // The top-level prisma mock must NOT have been called — proves the helper
    // used the passed-in transaction client, not the module-level client.
    expect(prisma.complianceAuditCycle.findFirst).not.toHaveBeenCalled()
  })

  // IV3 regression pin: no cache staleness on lead-auditor demotion.
  it('reads live DB state on every invocation (no caching)', async () => {
    // First call: user IS lead auditor → returns true.
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValueOnce({
      id: CYCLE_ID,
    } as never)
    const first = await canSealCycle(prisma, {
      role: 'MEMBER',
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })
    expect(first).toBe(true)

    // Simulate demotion: lead_auditor_user_id updated to OTHER_USER_ID via
    // updateCycleMetadata. Subsequent lookup for USER_ID returns null.
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValueOnce(null)
    const second = await canSealCycle(prisma, {
      role: 'MEMBER',
      userId: USER_ID,
      cycleId: CYCLE_ID,
      workspaceId: WORKSPACE_ID,
    })
    expect(second).toBe(false)

    // Proves the helper did NOT cache the first result.
    expect(prisma.complianceAuditCycle.findFirst).toHaveBeenCalledTimes(2)
  })
})

// Reference the otherwise-unused fixtures so lint doesn't complain.
// These are kept for documentation value — future test authors may need them.
void OTHER_USER_ID
void OTHER_WORKSPACE_ID
void OTHER_CYCLE_ID
