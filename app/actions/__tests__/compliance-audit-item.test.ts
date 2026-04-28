/**
 * Story 21.5: Cycle item read + mutation server-action unit tests.
 * Mocks Prisma, workspace-context, activity logger, next/cache.
 * Pattern mirrors app/actions/__tests__/compliance-audit-cycle.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getCycleItemsForCycle,
  updateItemBedomning,
  updateItemMotivering,
  signOffItem,
  unsignOffItem,
} from '../compliance-audit-item'
import { prisma } from '@/lib/prisma'
import * as workspaceContext from '@/lib/auth/workspace-context'
import * as activityLogger from '@/lib/services/activity-logger'
import { revalidatePath } from 'next/cache'
import type { Permission } from '@/lib/auth/permissions'
import {
  ComplianceCycleStatus,
  ComplianceStatus,
  EfterlevnadsBedomning,
  type WorkspaceRole,
} from '@prisma/client'

// ============================================================================
// Module mocks
// ============================================================================

vi.mock('@/lib/prisma', () => ({
  prisma: {
    complianceAuditCycle: {
      findFirst: vi.fn(),
    },
    complianceAuditItem: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(),
}))

vi.mock('@/lib/services/activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// ============================================================================
// Helpers + constants
// ============================================================================

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const CYCLE_ID = '33333333-3333-4333-8333-333333333333'
const ITEM_ID = '44444444-4444-4444-8444-444444444444'
const ITEM_ID_2 = '55555555-5555-4555-8555-555555555555'
const LAW_LIST_ITEM_ID = '66666666-6666-4666-8666-666666666666'
const GROUP_ID = '88888888-8888-4888-8888-888888888888'
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999'
const LEAD_AUDITOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const ROLE_PERMISSIONS: Record<WorkspaceRole, readonly Permission[]> = {
  OWNER: ['tasks:edit', 'activity:view', 'read'],
  ADMIN: ['tasks:edit', 'activity:view', 'read'],
  HR_MANAGER: ['tasks:edit', 'read'],
  MEMBER: ['tasks:edit', 'read'],
  AUDITOR: ['activity:view', 'read'],
}

function mockWorkspaceCtx(
  opts: { role?: WorkspaceRole; permissions?: readonly Permission[] } = {}
): void {
  const perms = opts.permissions ?? ROLE_PERMISSIONS[opts.role ?? 'OWNER']
  vi.mocked(workspaceContext.withWorkspace).mockImplementation(
    async (callback, requiredPermission) => {
      const ctx = {
        userId: USER_ID,
        workspaceId: WORKSPACE_ID,
        workspaceName: 'Test Workspace',
        workspaceSlug: 'test',
        workspaceStatus: 'ACTIVE' as const,
        role: opts.role ?? 'OWNER',
        hasPermission: (p: Permission) => perms.includes(p),
      }
      if (requiredPermission && !ctx.hasPermission(requiredPermission)) {
        throw new Error(`Permission denied: ${requiredPermission}`)
      }
      return callback(ctx)
    }
  )
}

function makeItemRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: ITEM_ID,
    cycle_id: CYCLE_ID,
    law_list_item_id: LAW_LIST_ITEM_ID,
    efterlevnadsbedomning: null,
    motivering: null,
    reviewed_at: null,
    reviewed_by_user_id: null,
    signed_off_at: null,
    signed_off_by_user_id: null,
    kravpunkter_snapshot: null,
    law_list_item: {
      id: LAW_LIST_ITEM_ID,
      position: 1,
      compliance_status: ComplianceStatus.EJ_PABORJAD,
      group_id: GROUP_ID,
      // Story 21.16 follow-up: businessContext is now projected from
      // LawListItem. Default to null in fixtures; tests overriding this
      // verify the non-null path.
      business_context: null,
      document: {
        title: 'Miljöbalken',
        document_number: 'SFS 1998:808',
      },
      group: { id: GROUP_ID, name: 'Miljö', position: 1 },
      responsible_user: { id: USER_ID, name: 'Alice' },
    },
    reviewed_by: null,
    signed_off_by: null,
    cycle: {
      id: CYCLE_ID,
      status: ComplianceCycleStatus.PAGAENDE,
      lead_auditor_user_id: USER_ID,
    },
    ...overrides,
  }
}

function makeCycleRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: CYCLE_ID,
    status: ComplianceCycleStatus.PAGAENDE,
    name: 'Q2 compliance review',
    seal_hash: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockWorkspaceCtx({ role: 'OWNER' })
})

// ============================================================================
// getCycleItemsForCycle
// ============================================================================

describe('getCycleItemsForCycle', () => {
  it('happy path — returns items + cycle partial, ordered by group→position→id', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
      makeCycleRow() as never
    )
    const rows = [
      makeItemRow({
        id: ITEM_ID_2,
        law_list_item: {
          ...makeItemRow().law_list_item,
          position: 2,
        },
      }),
      makeItemRow({ id: ITEM_ID }),
    ]
    vi.mocked(prisma.complianceAuditItem.findMany).mockResolvedValue(
      rows as never
    )

    const result = await getCycleItemsForCycle(CYCLE_ID)
    expect(result.success).toBe(true)
    expect(result.data?.items.length).toBe(2)
    // Sort by (group.position asc, item.position asc, id asc).
    // Both rows share group.position=1 → sort by item.position asc:
    // ITEM_ID (pos 1) < ITEM_ID_2 (pos 2).
    expect(result.data?.items[0]?.id).toBe(ITEM_ID)
    expect(result.data?.items[1]?.id).toBe(ITEM_ID_2)
    expect(result.data?.cycle.status).toBe(ComplianceCycleStatus.PAGAENDE)
    expect(result.data?.cycle.name).toBe('Q2 compliance review')
  })

  it('not found → generic Swedish error', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(null)
    const result = await getCycleItemsForCycle(CYCLE_ID)
    expect(result).toEqual({
      success: false,
      error: 'Kontrollen hittades inte',
    })
  })

  it('cross-workspace returns the same generic error (no leakage)', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(null)
    const result = await getCycleItemsForCycle(CYCLE_ID)
    expect(result.error).toBe('Kontrollen hittades inte')
  })

  it('permission denied — neither activity:view nor tasks:edit', async () => {
    mockWorkspaceCtx({ permissions: ['read'] })
    const result = await getCycleItemsForCycle(CYCLE_ID)
    expect(result).toEqual({
      success: false,
      error: 'Behörighet saknas',
    })
  })

  it('invalid uuid rejects without Prisma call', async () => {
    const result = await getCycleItemsForCycle('not-a-uuid')
    expect(result.success).toBe(false)
    expect(prisma.complianceAuditCycle.findFirst).not.toHaveBeenCalled()
  })

  // Story 21.16 follow-up: businessContext projection.
  it('Story 21.16 — projects LawListItem.business_context onto CycleItemRow.businessContext', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
      makeCycleRow() as never
    )
    const rowWithContext = makeItemRow({
      law_list_item: {
        ...makeItemRow().law_list_item,
        business_context:
          'Vi hanterar kemikalier dagligen — riskbedömning krävs kvartalsvis.',
      },
    })
    const rowWithNullContext = makeItemRow({
      id: ITEM_ID_2,
      law_list_item: {
        ...makeItemRow().law_list_item,
        position: 2,
        business_context: null,
      },
    })
    vi.mocked(prisma.complianceAuditItem.findMany).mockResolvedValue([
      rowWithContext,
      rowWithNullContext,
    ] as never)

    const result = await getCycleItemsForCycle(CYCLE_ID)
    expect(result.success).toBe(true)
    expect(result.data?.items[0]?.businessContext).toBe(
      'Vi hanterar kemikalier dagligen — riskbedömning krävs kvartalsvis.'
    )
    expect(result.data?.items[1]?.businessContext).toBeNull()
  })
})

// ============================================================================
// updateItemBedomning
// ============================================================================

describe('updateItemBedomning', () => {
  it('happy path — persists + logs + revalidates + returns full row', async () => {
    // Post-DEBT-001 refactor: update({ include }) returns the full shaped row
    // in one call, so the second findFirst is gone. Mock update to return the
    // refreshed shape.
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValueOnce(
      makeItemRow({ efterlevnadsbedomning: null }) as never
    )
    vi.mocked(prisma.complianceAuditItem.update).mockResolvedValue(
      makeItemRow({
        efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
      }) as never
    )

    const result = await updateItemBedomning({
      itemId: ITEM_ID,
      efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
    })

    expect(result.success).toBe(true)
    expect(result.data?.item.efterlevnadsbedomning).toBe(
      EfterlevnadsBedomning.UPPFYLLD
    )
    expect(prisma.complianceAuditItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ITEM_ID },
        data: expect.objectContaining({
          efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
          reviewed_by_user_id: USER_ID,
        }),
      })
    )
    expect(activityLogger.logActivity).toHaveBeenCalledWith(
      WORKSPACE_ID,
      USER_ID,
      'compliance_audit_item',
      ITEM_ID,
      'cycle_item_bedomning_updated',
      { efterlevnadsbedomning: null },
      { efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD }
    )
    expect(revalidatePath).toHaveBeenCalledWith(
      `/laglistor/kontroller/${CYCLE_ID}`
    )
  })

  it('clears bedömning when next === null', async () => {
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValueOnce(
      makeItemRow({
        efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
      }) as never
    )
    vi.mocked(prisma.complianceAuditItem.update).mockResolvedValue(
      makeItemRow({ efterlevnadsbedomning: null }) as never
    )

    const result = await updateItemBedomning({
      itemId: ITEM_ID,
      efterlevnadsbedomning: null,
    })

    expect(result.success).toBe(true)
    expect(prisma.complianceAuditItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ITEM_ID },
        data: expect.objectContaining({ efterlevnadsbedomning: null }),
      })
    )
  })

  it('idempotent — unchanged value is a no-op (no update, no log)', async () => {
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(
      makeItemRow({
        efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
      }) as never
    )

    const result = await updateItemBedomning({
      itemId: ITEM_ID,
      efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
    })

    expect(result.success).toBe(true)
    expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  it('cross-workspace — generic not-found error', async () => {
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(null)
    const result = await updateItemBedomning({
      itemId: ITEM_ID,
      efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
    })
    expect(result.error).toBe('Kontrollposten hittades inte')
    expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
  })

  it('invalid uuid rejects without DB', async () => {
    const result = await updateItemBedomning({
      itemId: 'not-a-uuid',
      efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
    })
    expect(result.success).toBe(false)
    expect(prisma.complianceAuditItem.findFirst).not.toHaveBeenCalled()
  })
})

// ============================================================================
// updateItemMotivering
// ============================================================================

describe('updateItemMotivering', () => {
  it('happy path — length validation + log payload is lengths-only (not text)', async () => {
    const nextText = 'Vi uppfyller genom årlig revision.'
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValueOnce(
      makeItemRow({ motivering: 'Old text' }) as never
    )
    vi.mocked(prisma.complianceAuditItem.update).mockResolvedValue(
      makeItemRow({ motivering: nextText }) as never
    )

    const result = await updateItemMotivering({
      itemId: ITEM_ID,
      motivering: nextText,
    })

    expect(result.success).toBe(true)
    expect(activityLogger.logActivity).toHaveBeenCalledWith(
      WORKSPACE_ID,
      USER_ID,
      'compliance_audit_item',
      ITEM_ID,
      'cycle_item_motivering_updated',
      { old_length: 'Old text'.length },
      { new_length: nextText.length }
    )
    // Ensure raw text was NEVER in the log call.
    const logCalls = vi.mocked(activityLogger.logActivity).mock.calls
    const lastArgs = logCalls[0]
    expect(JSON.stringify(lastArgs)).not.toContain('Old text')
    expect(JSON.stringify(lastArgs)).not.toContain(nextText)
  })

  it('rejects 5001-char motivering with Zod error; no write; no log', async () => {
    const tooLong = 'x'.repeat(5001)
    const result = await updateItemMotivering({
      itemId: ITEM_ID,
      motivering: tooLong,
    })
    expect(result.success).toBe(false)
    expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  it('accepts 5000-char motivering', async () => {
    const maxText = 'x'.repeat(5000)
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValueOnce(
      makeItemRow({ motivering: null }) as never
    )
    vi.mocked(prisma.complianceAuditItem.update).mockResolvedValue(
      makeItemRow({ motivering: maxText }) as never
    )

    const result = await updateItemMotivering({
      itemId: ITEM_ID,
      motivering: maxText,
    })
    expect(result.success).toBe(true)
  })

  it('idempotent — unchanged text is a no-op', async () => {
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(
      makeItemRow({ motivering: 'Same' }) as never
    )
    const result = await updateItemMotivering({
      itemId: ITEM_ID,
      motivering: 'Same',
    })
    expect(result.success).toBe(true)
    expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })
})

// ============================================================================
// signOffItem
// ============================================================================

describe('signOffItem', () => {
  it('happy path — sets timestamp + user, logs activity, revalidates path', async () => {
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValueOnce(
      makeItemRow({
        efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
        motivering: 'Policy implementerad, årlig intern revision genomförd.',
        signed_off_at: null,
      }) as never
    )
    vi.mocked(prisma.complianceAuditItem.update).mockResolvedValue(
      makeItemRow({
        efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
        motivering: 'Policy implementerad, årlig intern revision genomförd.',
        signed_off_at: new Date(),
        signed_off_by_user_id: USER_ID,
        signed_off_by: { id: USER_ID, name: 'Alice' },
      }) as never
    )

    const result = await signOffItem(ITEM_ID)
    expect(result.success).toBe(true)
    expect(result.data?.item.signedOffAt).not.toBeNull()
    expect(prisma.complianceAuditItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ITEM_ID },
        data: expect.objectContaining({
          signed_off_by_user_id: USER_ID,
        }),
      })
    )
    expect(activityLogger.logActivity).toHaveBeenCalledWith(
      WORKSPACE_ID,
      USER_ID,
      'compliance_audit_item',
      ITEM_ID,
      'cycle_item_signed_off',
      null,
      expect.objectContaining({ signedByUserId: USER_ID })
    )
    expect(revalidatePath).toHaveBeenCalledWith(
      `/laglistor/kontroller/${CYCLE_ID}`
    )
  })

  it('idempotent — already signed returns success without writes or logs', async () => {
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(
      makeItemRow({
        efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
        signed_off_at: new Date('2026-04-20T10:00:00Z'),
      }) as never
    )

    const result = await signOffItem(ITEM_ID)
    expect(result.success).toBe(true)
    expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  it('blocked when bedömning is null — exact Swedish error', async () => {
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(
      makeItemRow({
        efterlevnadsbedomning: null,
        motivering: 'Har en motivering men ingen bedömning.',
        signed_off_at: null,
      }) as never
    )

    const result = await signOffItem(ITEM_ID)
    expect(result).toEqual({
      success: false,
      error: 'Ange bedömning innan signering',
    })
    expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  // Audit-rigor gate: every signed bedömning must carry a written
  // motivering. Feeds both the audit record + future AI cross-cycle
  // reasoning.
  it('blocked when motivering is null — exact Swedish error', async () => {
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(
      makeItemRow({
        efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
        motivering: null,
        signed_off_at: null,
      }) as never
    )

    const result = await signOffItem(ITEM_ID)
    expect(result).toEqual({
      success: false,
      error: 'Skriv en motivering innan signering',
    })
    expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  it('blocked when motivering is whitespace-only', async () => {
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(
      makeItemRow({
        efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
        motivering: '   \n\t  ',
        signed_off_at: null,
      }) as never
    )

    const result = await signOffItem(ITEM_ID)
    expect(result).toEqual({
      success: false,
      error: 'Skriv en motivering innan signering',
    })
    expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
  })

  it('bedömning-null check runs before motivering-null — ordering invariant', async () => {
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(
      makeItemRow({
        efterlevnadsbedomning: null,
        motivering: null,
        signed_off_at: null,
      }) as never
    )

    const result = await signOffItem(ITEM_ID)
    expect(result.error).toBe('Ange bedömning innan signering')
  })
})

// ============================================================================
// unsignOffItem
// ============================================================================

describe('unsignOffItem', () => {
  it('happy path — clears timestamp + user, logs activity', async () => {
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValueOnce(
      makeItemRow({
        signed_off_at: new Date('2026-04-20T10:00:00Z'),
        signed_off_by_user_id: USER_ID,
      }) as never
    )
    vi.mocked(prisma.complianceAuditItem.update).mockResolvedValue(
      makeItemRow({
        signed_off_at: null,
        signed_off_by_user_id: null,
      }) as never
    )

    const result = await unsignOffItem(ITEM_ID)
    expect(result.success).toBe(true)
    expect(result.data?.item.signedOffAt).toBeNull()
    expect(activityLogger.logActivity).toHaveBeenCalledWith(
      WORKSPACE_ID,
      USER_ID,
      'compliance_audit_item',
      ITEM_ID,
      'cycle_item_unsigned',
      expect.any(Object),
      null
    )
  })

  it('idempotent — already unsigned returns success without writes or logs', async () => {
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(
      makeItemRow({ signed_off_at: null }) as never
    )

    const result = await unsignOffItem(ITEM_ID)
    expect(result.success).toBe(true)
    expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })
})

// ============================================================================
// Sign-off authorization — lead auditor + responsible user + admin escape hatch
// ============================================================================

const AUTHZ_SIGN_ERROR =
  'Endast ansvarig revisor, dokumentets ansvarige eller administratörer kan signera.'
const AUTHZ_UNSIGN_ERROR =
  'Endast ansvarig revisor, dokumentets ansvarige eller administratörer kan ångra signering.'

describe('signOffItem — authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks MEMBER who is neither lead auditor nor responsible user', async () => {
    mockWorkspaceCtx({ role: 'MEMBER' })
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(
      makeItemRow({
        cycle: {
          id: CYCLE_ID,
          status: ComplianceCycleStatus.PAGAENDE,
          lead_auditor_user_id: LEAD_AUDITOR_ID,
        },
        law_list_item: {
          id: LAW_LIST_ITEM_ID,
          position: 1,
          compliance_status: ComplianceStatus.EJ_PABORJAD,
          group_id: GROUP_ID,
          business_context: null,
          document: { title: 'Miljöbalken', document_number: 'SFS 1998:808' },
          group: { id: GROUP_ID, name: 'Miljö', position: 1 },
          responsible_user: { id: OTHER_USER_ID, name: 'Bob' },
        },
      }) as never
    )

    const result = await signOffItem(ITEM_ID)

    expect(result).toEqual({ success: false, error: AUTHZ_SIGN_ERROR })
    expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  it('allows MEMBER who IS the responsible user', async () => {
    mockWorkspaceCtx({ role: 'MEMBER' })
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(
      makeItemRow({
        efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
        motivering: 'Kraven uppfylls.',
        cycle: {
          id: CYCLE_ID,
          status: ComplianceCycleStatus.PAGAENDE,
          lead_auditor_user_id: LEAD_AUDITOR_ID,
        },
        // makeItemRow's default fixture has responsible_user.id = USER_ID,
        // and the actor is USER_ID — so the responsible-user path hits.
      }) as never
    )
    vi.mocked(prisma.complianceAuditItem.update).mockResolvedValue(
      makeItemRow({
        efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
        motivering: 'Kraven uppfylls.',
        signed_off_at: new Date(),
        signed_off_by_user_id: USER_ID,
      }) as never
    )

    const result = await signOffItem(ITEM_ID)

    expect(result.success).toBe(true)
    expect(prisma.complianceAuditItem.update).toHaveBeenCalledOnce()
  })

  it('allows OWNER who is neither lead auditor nor responsible user (escape hatch)', async () => {
    mockWorkspaceCtx({ role: 'OWNER' })
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(
      makeItemRow({
        efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
        motivering: 'Kraven uppfylls.',
        cycle: {
          id: CYCLE_ID,
          status: ComplianceCycleStatus.PAGAENDE,
          lead_auditor_user_id: LEAD_AUDITOR_ID,
        },
        law_list_item: {
          id: LAW_LIST_ITEM_ID,
          position: 1,
          compliance_status: ComplianceStatus.EJ_PABORJAD,
          group_id: GROUP_ID,
          business_context: null,
          document: { title: 'Miljöbalken', document_number: 'SFS 1998:808' },
          group: { id: GROUP_ID, name: 'Miljö', position: 1 },
          responsible_user: { id: OTHER_USER_ID, name: 'Bob' },
        },
      }) as never
    )
    vi.mocked(prisma.complianceAuditItem.update).mockResolvedValue(
      makeItemRow({ signed_off_at: new Date() }) as never
    )

    const result = await signOffItem(ITEM_ID)

    expect(result.success).toBe(true)
  })

  it('blocks MEMBER on item with null responsible_user (only lead auditor + admin remain)', async () => {
    mockWorkspaceCtx({ role: 'MEMBER' })
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(
      makeItemRow({
        cycle: {
          id: CYCLE_ID,
          status: ComplianceCycleStatus.PAGAENDE,
          lead_auditor_user_id: LEAD_AUDITOR_ID,
        },
        law_list_item: {
          id: LAW_LIST_ITEM_ID,
          position: 1,
          compliance_status: ComplianceStatus.EJ_PABORJAD,
          group_id: GROUP_ID,
          business_context: null,
          document: { title: 'Miljöbalken', document_number: 'SFS 1998:808' },
          group: { id: GROUP_ID, name: 'Miljö', position: 1 },
          responsible_user: null,
        },
      }) as never
    )

    const result = await signOffItem(ITEM_ID)

    expect(result).toEqual({ success: false, error: AUTHZ_SIGN_ERROR })
  })

  it('allows lead auditor on item with null responsible_user', async () => {
    mockWorkspaceCtx({ role: 'MEMBER' })
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(
      makeItemRow({
        efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
        motivering: 'Kraven uppfylls.',
        cycle: {
          id: CYCLE_ID,
          status: ComplianceCycleStatus.PAGAENDE,
          lead_auditor_user_id: USER_ID, // actor IS the lead auditor
        },
        law_list_item: {
          id: LAW_LIST_ITEM_ID,
          position: 1,
          compliance_status: ComplianceStatus.EJ_PABORJAD,
          group_id: GROUP_ID,
          business_context: null,
          document: { title: 'Miljöbalken', document_number: 'SFS 1998:808' },
          group: { id: GROUP_ID, name: 'Miljö', position: 1 },
          responsible_user: null,
        },
      }) as never
    )
    vi.mocked(prisma.complianceAuditItem.update).mockResolvedValue(
      makeItemRow({ signed_off_at: new Date() }) as never
    )

    const result = await signOffItem(ITEM_ID)

    expect(result.success).toBe(true)
  })
})

describe('unsignOffItem — authorization (symmetric with sign)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks MEMBER who is neither lead auditor nor responsible user', async () => {
    mockWorkspaceCtx({ role: 'MEMBER' })
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(
      makeItemRow({
        signed_off_at: new Date(),
        signed_off_by_user_id: OTHER_USER_ID,
        cycle: {
          id: CYCLE_ID,
          status: ComplianceCycleStatus.PAGAENDE,
          lead_auditor_user_id: LEAD_AUDITOR_ID,
        },
        law_list_item: {
          id: LAW_LIST_ITEM_ID,
          position: 1,
          compliance_status: ComplianceStatus.EJ_PABORJAD,
          group_id: GROUP_ID,
          business_context: null,
          document: { title: 'Miljöbalken', document_number: 'SFS 1998:808' },
          group: { id: GROUP_ID, name: 'Miljö', position: 1 },
          responsible_user: { id: OTHER_USER_ID, name: 'Bob' },
        },
      }) as never
    )

    const result = await unsignOffItem(ITEM_ID)

    expect(result).toEqual({ success: false, error: AUTHZ_UNSIGN_ERROR })
    expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
  })

  it('allows lead auditor to unsign even if someone else signed', async () => {
    mockWorkspaceCtx({ role: 'MEMBER' })
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(
      makeItemRow({
        signed_off_at: new Date(),
        signed_off_by_user_id: OTHER_USER_ID,
        cycle: {
          id: CYCLE_ID,
          status: ComplianceCycleStatus.PAGAENDE,
          lead_auditor_user_id: USER_ID, // actor IS lead auditor
        },
      }) as never
    )
    vi.mocked(prisma.complianceAuditItem.update).mockResolvedValue(
      makeItemRow({ signed_off_at: null, signed_off_by_user_id: null }) as never
    )

    const result = await unsignOffItem(ITEM_ID)

    expect(result.success).toBe(true)
  })
})

// ============================================================================
// AVSLUTAD guard — cross-action via describe.each
// Story 21.26 + 21.27 — SEALED + ARKIVERAD collapsed; AVSLUTAD is the only
// terminal state that locks items.
// ============================================================================

const READONLY_ERROR =
  'Kontrollen är avslutad — ändringar är inte tillåtna. Återställ till pågående för att redigera.'

describe.each([{ status: ComplianceCycleStatus.AVSLUTAD, label: 'AVSLUTAD' }])(
  'editable guard — all four mutation actions reject on $label cycles',
  ({ status }) => {
    beforeEach(() => {
      vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(
        makeItemRow({
          cycle: { id: CYCLE_ID, status },
        }) as never
      )
    })

    it('updateItemBedomning blocked', async () => {
      const result = await updateItemBedomning({
        itemId: ITEM_ID,
        efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
      })
      expect(result).toEqual({ success: false, error: READONLY_ERROR })
      expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
      expect(activityLogger.logActivity).not.toHaveBeenCalled()
    })

    it('updateItemMotivering blocked', async () => {
      const result = await updateItemMotivering({
        itemId: ITEM_ID,
        motivering: 'Some text',
      })
      expect(result).toEqual({ success: false, error: READONLY_ERROR })
      expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
      expect(activityLogger.logActivity).not.toHaveBeenCalled()
    })

    it('signOffItem blocked', async () => {
      const result = await signOffItem(ITEM_ID)
      expect(result).toEqual({ success: false, error: READONLY_ERROR })
      expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
      expect(activityLogger.logActivity).not.toHaveBeenCalled()
    })

    it('unsignOffItem blocked', async () => {
      const result = await unsignOffItem(ITEM_ID)
      expect(result).toEqual({ success: false, error: READONLY_ERROR })
      expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
      expect(activityLogger.logActivity).not.toHaveBeenCalled()
    })
  }
)

// ============================================================================
// Story 21.14 — AUDITOR read-access regression pin (AC 14)
// ============================================================================

describe('Story 21.14 — AUDITOR read-access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkspaceCtx({ role: 'AUDITOR' })
  })

  it('getCycleItemsForCycle returns data for AUDITOR (activity:view || tasks:edit OR-check)', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
      makeCycleRow() as never
    )
    vi.mocked(prisma.complianceAuditItem.findMany).mockResolvedValue([
      makeItemRow(),
    ] as never)

    const result = await getCycleItemsForCycle(CYCLE_ID)

    expect(result.success).toBe(true)
    expect(result.data?.items.length).toBe(1)
    expect(result.data?.cycle.status).toBe(ComplianceCycleStatus.PAGAENDE)
  })
})

// ============================================================================
// Story 21.14 — mutation permission-denied regression pins (AC 14)
// Defensive: breaks only if someone weakens `withWorkspace(cb, 'tasks:edit')`
// on a cycle-item-mutation action. AUDITOR lacks 'tasks:edit' → the inline
// mockWorkspaceCtx helper throws 'Permission denied: tasks:edit' → outer
// try/catch in each action returns its per-action error string.
// ============================================================================

describe('Story 21.14 — mutation permission-denied regression pins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkspaceCtx({ role: 'AUDITOR' })
  })

  it('updateItemBedomning rejects AUDITOR with outer-catch error string', async () => {
    const result = await updateItemBedomning({
      itemId: ITEM_ID,
      efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
    })

    expect(result).toEqual({
      success: false,
      error: 'Kunde inte uppdatera bedömning',
    })
    expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  it('updateItemMotivering rejects AUDITOR with outer-catch error string', async () => {
    const result = await updateItemMotivering({
      itemId: ITEM_ID,
      motivering: 'test',
    })

    expect(result).toEqual({
      success: false,
      error: 'Kunde inte uppdatera motivering',
    })
    expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  it('signOffItem rejects AUDITOR with outer-catch error string', async () => {
    const result = await signOffItem(ITEM_ID)

    expect(result).toEqual({
      success: false,
      error: 'Kunde inte signera kontrollposten',
    })
    expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  it('unsignOffItem rejects AUDITOR with outer-catch error string', async () => {
    const result = await unsignOffItem(ITEM_ID)

    expect(result).toEqual({
      success: false,
      error: 'Kunde inte ångra signering',
    })
    expect(prisma.complianceAuditItem.update).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })
})
