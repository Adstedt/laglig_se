/**
 * Story 21.2: Cycle CRUD server-action unit tests.
 * Mocks Prisma, workspace-context, activity logger, and next/cache.
 * Pattern mirrors app/actions/__tests__/law-list-item-requirements.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createCycle,
  listCyclesForWorkspace,
  getCycleById,
  updateCycleMetadata,
  softDeleteCycle,
  type ScopeDefinition,
} from '../compliance-audit-cycle'
import { prisma } from '@/lib/prisma'
import * as workspaceContext from '@/lib/auth/workspace-context'
import * as activityLogger from '@/lib/services/activity-logger'
import { revalidatePath } from 'next/cache'
import type { Permission } from '@/lib/auth/permissions'
import {
  AuditType,
  ComplianceCycleStatus,
  type WorkspaceRole,
} from '@prisma/client'

// ============================================================================
// Module mocks
// ============================================================================

vi.mock('@/lib/prisma', () => ({
  prisma: {
    complianceAuditCycle: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    complianceAuditItem: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    lawList: { findFirst: vi.fn() },
    lawListItem: { findMany: vi.fn() },
    lawListItemRequirement: { findMany: vi.fn() },
    workspaceMember: { findFirst: vi.fn() },
    // $transaction runs its callback with the prisma object itself as `tx`.
    // Story 21.4 mocks rely on this — any call to `tx.<model>.<method>` routes
    // through the same module-level mocks as a direct `prisma.<model>.<method>`.
    $transaction: vi.fn(),
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

// RFC 4122 v4 UUIDs.
const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const LAW_LIST_ID = '33333333-3333-4333-8333-333333333333'
const LEAD_AUDITOR_ID = '44444444-4444-4444-8444-444444444444'
const CYCLE_ID = '55555555-5555-4555-8555-555555555555'
const LAW_LIST_GROUP_ID = '66666666-6666-4666-8666-666666666666'
const LAW_LIST_ITEM_ID = '77777777-7777-4777-8777-777777777777'

const ROLE_PERMISSIONS: Record<WorkspaceRole, readonly Permission[]> = {
  OWNER: [
    'workspace:delete',
    'workspace:billing',
    'workspace:settings',
    'members:invite',
    'members:remove',
    'members:change_role',
    'lists:create',
    'lists:delete',
    'documents:add',
    'documents:remove',
    'tasks:edit',
    'changes:acknowledge',
    'employees:view',
    'employees:manage',
    'activity:view',
    'ai:chat',
    'read',
  ],
  ADMIN: [
    'workspace:settings',
    'members:invite',
    'members:remove',
    'members:change_role',
    'lists:create',
    'lists:delete',
    'documents:add',
    'documents:remove',
    'tasks:edit',
    'changes:acknowledge',
    'activity:view',
    'ai:chat',
    'read',
  ],
  HR_MANAGER: [
    'members:invite',
    'members:remove',
    'lists:create',
    'lists:delete',
    'documents:add',
    'documents:remove',
    'tasks:edit',
    'changes:acknowledge',
    'employees:view',
    'employees:manage',
    'ai:chat',
    'read',
  ],
  MEMBER: ['tasks:edit', 'changes:acknowledge', 'ai:chat', 'read'],
  AUDITOR: ['activity:view', 'ai:chat', 'read'],
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

const VALID_CREATE_INPUT = {
  lawListId: LAW_LIST_ID,
  name: 'Q2 compliance review',
  auditType: AuditType.INTERN,
  scheduledStart: new Date('2026-05-01T00:00:00Z'),
  scheduledEnd: new Date('2026-05-31T00:00:00Z'),
  lawChangeCutoffDate: new Date('2026-04-30T00:00:00Z'),
  leadAuditorUserId: LEAD_AUDITOR_ID,
  scopeDefinition: { kind: 'all' } as ScopeDefinition,
}

function makeCycleRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: CYCLE_ID,
    workspace_id: WORKSPACE_ID,
    law_list_id: LAW_LIST_ID,
    name: 'Q2 compliance review',
    scope_definition: { kind: 'all' },
    audit_type: AuditType.INTERN,
    scheduled_start: new Date('2026-05-01T00:00:00Z'),
    scheduled_end: new Date('2026-05-31T00:00:00Z'),
    law_change_cutoff_date: new Date('2026-04-30T00:00:00Z'),
    status: ComplianceCycleStatus.PLANERAD,
    lead_auditor_user_id: LEAD_AUDITOR_ID,
    sealed_at: null,
    sealed_by_user_id: null,
    seal_hash: null,
    created_at: new Date('2026-04-22T10:00:00Z'),
    updated_at: new Date('2026-04-22T10:00:00Z'),
    deleted_at: null,
    created_by_user_id: USER_ID,
    ...overrides,
  }
}

function makeCycleRowWithIncludes(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    ...makeCycleRow(overrides),
    lead_auditor: { id: LEAD_AUDITOR_ID, name: 'Lead Auditor' },
    law_list: { id: LAW_LIST_ID, name: 'Huvudlista' },
    created_by: { id: USER_ID, name: 'Creator' },
    sealed_by: null,
    _count: { items: 0 },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockWorkspaceCtx({ role: 'OWNER' })
})

// ============================================================================
// createCycle
// ============================================================================

describe('createCycle', () => {
  it('happy path — persists in PLANERAD + logs activity + revalidates path', async () => {
    vi.mocked(prisma.lawList.findFirst).mockResolvedValue({
      id: LAW_LIST_ID,
    } as never)
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
      id: 'member-id',
    } as never)
    vi.mocked(prisma.complianceAuditCycle.create).mockResolvedValue(
      makeCycleRow()
    )

    const result = await createCycle(VALID_CREATE_INPUT)

    expect(result.success).toBe(true)
    expect(prisma.complianceAuditCycle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: ComplianceCycleStatus.PLANERAD,
        workspace_id: WORKSPACE_ID,
        created_by_user_id: USER_ID,
        scope_definition: { kind: 'all' },
      }),
    })
    expect(activityLogger.logActivity).toHaveBeenCalledWith(
      WORKSPACE_ID,
      USER_ID,
      'compliance_audit_cycle',
      CYCLE_ID,
      'cycle_created',
      null,
      expect.objectContaining({ name: 'Q2 compliance review' })
    )
    expect(revalidatePath).toHaveBeenCalledTimes(1)
    expect(revalidatePath).toHaveBeenCalledWith('/laglistor/kontroller')
  })

  it('validation — missing name returns error without Prisma call', async () => {
    const result = await createCycle({
      ...VALID_CREATE_INPUT,
      name: '',
    })
    expect(result).toEqual({ success: false, error: 'Namn krävs' })
    expect(prisma.complianceAuditCycle.create).not.toHaveBeenCalled()
  })

  it('validation — non-uuid lawListId returns error', async () => {
    const result = await createCycle({
      ...VALID_CREATE_INPUT,
      lawListId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
    expect(prisma.complianceAuditCycle.create).not.toHaveBeenCalled()
  })

  it('validation — scheduledEnd < scheduledStart returns error', async () => {
    const result = await createCycle({
      ...VALID_CREATE_INPUT,
      scheduledStart: new Date('2026-06-01T00:00:00Z'),
      scheduledEnd: new Date('2026-05-01T00:00:00Z'),
    })
    expect(result).toEqual({
      success: false,
      error: 'Slutdatum måste vara lika med eller efter startdatum',
    })
    expect(prisma.complianceAuditCycle.create).not.toHaveBeenCalled()
  })

  it('validation — invalid scopeDefinition.kind returns error', async () => {
    const result = await createCycle({
      ...VALID_CREATE_INPUT,
      // @ts-expect-error intentionally testing invalid discriminated-union shape
      scopeDefinition: { kind: 'invalid' },
    })
    expect(result.success).toBe(false)
    expect(prisma.complianceAuditCycle.create).not.toHaveBeenCalled()
  })

  it('validation — scopeDefinition groups with empty groupIds returns error', async () => {
    const result = await createCycle({
      ...VALID_CREATE_INPUT,
      scopeDefinition: { kind: 'groups', groupIds: [] },
    })
    expect(result.success).toBe(false)
    expect(prisma.complianceAuditCycle.create).not.toHaveBeenCalled()
  })

  it.each([
    {
      label: 'all',
      scope: { kind: 'all' } as ScopeDefinition,
    },
    {
      label: 'groups',
      scope: {
        kind: 'groups',
        groupIds: [LAW_LIST_GROUP_ID],
      } as ScopeDefinition,
    },
    {
      label: 'items',
      scope: {
        kind: 'items',
        itemIds: [LAW_LIST_ITEM_ID],
      } as ScopeDefinition,
    },
  ])(
    'scope shape "$label" persists verbatim into scope_definition',
    async ({ scope }) => {
      vi.mocked(prisma.lawList.findFirst).mockResolvedValue({
        id: LAW_LIST_ID,
      } as never)
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
        id: 'member-id',
      } as never)
      vi.mocked(prisma.complianceAuditCycle.create).mockResolvedValue(
        makeCycleRow()
      )

      const result = await createCycle({
        ...VALID_CREATE_INPUT,
        scopeDefinition: scope,
      })

      expect(result.success).toBe(true)
      expect(prisma.complianceAuditCycle.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ scope_definition: scope }),
      })
    }
  )

  it('permission denied — withWorkspace throws → structured error', async () => {
    // Role without tasks:edit: AUDITOR.
    mockWorkspaceCtx({ role: 'AUDITOR' })

    const result = await createCycle(VALID_CREATE_INPUT)

    expect(result).toEqual({
      success: false,
      error: 'Kunde inte skapa kontrollen',
    })
    expect(prisma.complianceAuditCycle.create).not.toHaveBeenCalled()
  })

  it('cross-tenant — lawList not in workspace → structured error, no create', async () => {
    vi.mocked(prisma.lawList.findFirst).mockResolvedValue(null)

    const result = await createCycle(VALID_CREATE_INPUT)

    expect(result).toEqual({
      success: false,
      error: 'Laglistan hittades inte',
    })
    expect(prisma.complianceAuditCycle.create).not.toHaveBeenCalled()
  })

  it('cross-tenant — lead auditor not member → structured error, no create', async () => {
    vi.mocked(prisma.lawList.findFirst).mockResolvedValue({
      id: LAW_LIST_ID,
    } as never)
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null)

    const result = await createCycle(VALID_CREATE_INPUT)

    expect(result).toEqual({
      success: false,
      error: 'Ansvarig användare är inte medlem i arbetsytan',
    })
    expect(prisma.complianceAuditCycle.create).not.toHaveBeenCalled()
  })

  it('duplicate name — two creates with same workspace + lawList + name both succeed', async () => {
    vi.mocked(prisma.lawList.findFirst).mockResolvedValue({
      id: LAW_LIST_ID,
    } as never)
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
      id: 'member-id',
    } as never)
    vi.mocked(prisma.complianceAuditCycle.create)
      .mockResolvedValueOnce(makeCycleRow({ id: CYCLE_ID }))
      .mockResolvedValueOnce(
        makeCycleRow({ id: '88888888-8888-4888-8888-888888888888' })
      )

    const first = await createCycle(VALID_CREATE_INPUT)
    const second = await createCycle(VALID_CREATE_INPUT)

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(prisma.complianceAuditCycle.create).toHaveBeenCalledTimes(2)
  })

  it('p95 microtest — 20 invocations complete under 500ms (IV3 soft guard)', async () => {
    // CI-generous threshold. Real perf ceiling is NFR1 (Story 21.4, real DB).
    // Mocks resolve synchronously; this is a regression guard against
    // accidental N+1s or heavy synchronous work inside the action.
    vi.mocked(prisma.lawList.findFirst).mockResolvedValue({
      id: LAW_LIST_ID,
    } as never)
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
      id: 'member-id',
    } as never)
    vi.mocked(prisma.complianceAuditCycle.create).mockResolvedValue(
      makeCycleRow()
    )

    // Warmup.
    await createCycle(VALID_CREATE_INPUT)

    const samples: number[] = []
    for (let i = 0; i < 20; i++) {
      const start = performance.now()
      await createCycle(VALID_CREATE_INPUT)
      samples.push(performance.now() - start)
    }
    samples.sort((a, b) => a - b)
    const p95 =
      samples[Math.floor(samples.length * 0.95) - 1] ??
      samples[samples.length - 1]!
    expect(p95).toBeLessThan(500)
  })
})

// ============================================================================
// listCyclesForWorkspace
// ============================================================================

describe('listCyclesForWorkspace', () => {
  it('happy path — returns cycles ordered + filters deleted by default', async () => {
    vi.mocked(prisma.complianceAuditCycle.findMany).mockResolvedValue([
      makeCycleRowWithIncludes(),
    ] as unknown as never)

    const result = await listCyclesForWorkspace()

    expect(result.success).toBe(true)
    expect(prisma.complianceAuditCycle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspace_id: WORKSPACE_ID,
          deleted_at: null,
        }),
        orderBy: { created_at: 'desc' },
      })
    )
    expect(result.data?.cycles[0]?.id).toBe(CYCLE_ID)
    expect(result.data?.nextCursor).toBeNull()
  })

  it('status filter — single value passed to Prisma', async () => {
    vi.mocked(prisma.complianceAuditCycle.findMany).mockResolvedValue(
      [] as unknown as never
    )

    await listCyclesForWorkspace({
      status: ComplianceCycleStatus.PAGAENDE,
    })

    expect(prisma.complianceAuditCycle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ComplianceCycleStatus.PAGAENDE,
        }),
      })
    )
  })

  it('status filter — array value passed as { in: [...] }', async () => {
    vi.mocked(prisma.complianceAuditCycle.findMany).mockResolvedValue(
      [] as unknown as never
    )

    await listCyclesForWorkspace({
      status: [ComplianceCycleStatus.PLANERAD, ComplianceCycleStatus.PAGAENDE],
    })

    expect(prisma.complianceAuditCycle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [
              ComplianceCycleStatus.PLANERAD,
              ComplianceCycleStatus.PAGAENDE,
            ],
          },
        }),
      })
    )
  })

  it('includeDeleted true — omits deleted_at filter', async () => {
    vi.mocked(prisma.complianceAuditCycle.findMany).mockResolvedValue(
      [] as unknown as never
    )

    await listCyclesForWorkspace({ includeDeleted: true })

    const call = vi.mocked(prisma.complianceAuditCycle.findMany).mock
      .calls[0]![0] as { where: Record<string, unknown> }
    expect(call.where).not.toHaveProperty('deleted_at')
  })

  it('pagination — returns nextCursor when more rows available', async () => {
    // Request take: 2, DB returns 3 (take+1 pattern) → hasMore = true.
    const row1 = makeCycleRowWithIncludes({ id: CYCLE_ID })
    const row2 = makeCycleRowWithIncludes({
      id: '88888888-8888-4888-8888-888888888888',
    })
    const row3 = makeCycleRowWithIncludes({
      id: '99999999-9999-4999-8999-999999999999',
    })
    vi.mocked(prisma.complianceAuditCycle.findMany).mockResolvedValue([
      row1,
      row2,
      row3,
    ] as unknown as never)

    const result = await listCyclesForWorkspace({ take: 2 })

    expect(result.success).toBe(true)
    expect(result.data?.cycles).toHaveLength(2)
    expect(result.data?.nextCursor).toBe('88888888-8888-4888-8888-888888888888')
  })

  it('permission OR-check — role with only "read" (neither activity:view nor tasks:edit) is blocked', async () => {
    mockWorkspaceCtx({ role: 'OWNER', permissions: ['read'] })
    vi.mocked(prisma.complianceAuditCycle.findMany).mockResolvedValue(
      [] as unknown as never
    )

    const result = await listCyclesForWorkspace()

    expect(result).toEqual({ success: false, error: 'Behörighet saknas' })
    expect(prisma.complianceAuditCycle.findMany).not.toHaveBeenCalled()
  })

  it('permission OR-check — AUDITOR (activity:view only) passes', async () => {
    mockWorkspaceCtx({ role: 'AUDITOR' })
    vi.mocked(prisma.complianceAuditCycle.findMany).mockResolvedValue(
      [] as unknown as never
    )

    const result = await listCyclesForWorkspace()

    expect(result.success).toBe(true)
  })

  it('permission OR-check — MEMBER (tasks:edit only) passes', async () => {
    mockWorkspaceCtx({ role: 'MEMBER' })
    vi.mocked(prisma.complianceAuditCycle.findMany).mockResolvedValue(
      [] as unknown as never
    )

    const result = await listCyclesForWorkspace()

    expect(result.success).toBe(true)
  })
})

// ============================================================================
// getCycleById
// ============================================================================

describe('getCycleById', () => {
  it('happy path — returns cycle detail with relations', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
      makeCycleRowWithIncludes() as unknown as never
    )

    const result = await getCycleById(CYCLE_ID)

    expect(result.success).toBe(true)
    expect(result.data?.cycle.id).toBe(CYCLE_ID)
    expect(result.data?.cycle.lawListId).toBe(LAW_LIST_ID)
    expect(result.data?.cycle.leadAuditor.id).toBe(LEAD_AUDITOR_ID)
    expect(result.data?.cycle.createdBy.id).toBe(USER_ID)
  })

  it('not found — returns generic error', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(null)

    const result = await getCycleById(CYCLE_ID)

    expect(result).toEqual({
      success: false,
      error: 'Kontrollen hittades inte',
    })
  })

  it('cross-workspace — findFirst scoped to ctx.workspaceId returns null → same generic error', async () => {
    // Simulate: cycle exists in OTHER_WORKSPACE_ID but not WORKSPACE_ID.
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(null)

    const result = await getCycleById(CYCLE_ID)

    expect(result).toEqual({
      success: false,
      error: 'Kontrollen hittades inte',
    })
    // Verify tenant isolation: query MUST include workspace_id filter.
    expect(prisma.complianceAuditCycle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: CYCLE_ID,
          workspace_id: WORKSPACE_ID,
        }),
      })
    )
  })

  it('invalid cycleId — Zod rejects, no Prisma call', async () => {
    const result = await getCycleById('not-a-uuid')

    expect(result.success).toBe(false)
    expect(prisma.complianceAuditCycle.findFirst).not.toHaveBeenCalled()
  })

  it('permission OR-check — role without activity:view or tasks:edit blocked', async () => {
    mockWorkspaceCtx({ role: 'OWNER', permissions: ['read'] })

    const result = await getCycleById(CYCLE_ID)

    expect(result).toEqual({ success: false, error: 'Behörighet saknas' })
    expect(prisma.complianceAuditCycle.findFirst).not.toHaveBeenCalled()
  })
})

// ============================================================================
// updateCycleMetadata
// ============================================================================

describe('updateCycleMetadata', () => {
  beforeEach(() => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
      makeCycleRow()
    )
    vi.mocked(prisma.complianceAuditCycle.update).mockResolvedValue(
      makeCycleRow()
    )
  })

  it('happy path — partial update (name only) persists + logs old/new', async () => {
    const result = await updateCycleMetadata(CYCLE_ID, { name: 'Renamed' })

    expect(result.success).toBe(true)
    expect(prisma.complianceAuditCycle.update).toHaveBeenCalledWith({
      where: { id: CYCLE_ID },
      data: { name: 'Renamed' },
    })
    expect(activityLogger.logActivity).toHaveBeenCalledWith(
      WORKSPACE_ID,
      USER_ID,
      'compliance_audit_cycle',
      CYCLE_ID,
      'cycle_metadata_updated',
      { name: 'Q2 compliance review' },
      { name: 'Renamed' }
    )
    expect(revalidatePath).toHaveBeenCalledWith('/laglistor/kontroller')
  })

  it('empty update — Zod rejects', async () => {
    const result = await updateCycleMetadata(CYCLE_ID, {})

    expect(result.success).toBe(false)
    expect(prisma.complianceAuditCycle.update).not.toHaveBeenCalled()
  })

  it('non-member lead auditor — structured error, no update', async () => {
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null)

    const result = await updateCycleMetadata(CYCLE_ID, {
      leadAuditorUserId: LEAD_AUDITOR_ID,
    })

    expect(result).toEqual({
      success: false,
      error: 'Ansvarig användare är inte medlem i arbetsytan',
    })
    expect(prisma.complianceAuditCycle.update).not.toHaveBeenCalled()
  })

  it('date refine — update scheduledEnd earlier than stored scheduledStart → error', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
      makeCycleRow({
        scheduled_start: new Date('2026-05-01T00:00:00Z'),
        scheduled_end: new Date('2026-05-31T00:00:00Z'),
      })
    )

    const result = await updateCycleMetadata(CYCLE_ID, {
      scheduledEnd: new Date('2026-04-15T00:00:00Z'),
    })

    expect(result).toEqual({
      success: false,
      error: 'Slutdatum måste vara lika med eller efter startdatum',
    })
    expect(prisma.complianceAuditCycle.update).not.toHaveBeenCalled()
  })

  it('not found — returns generic error', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(null)

    const result = await updateCycleMetadata(CYCLE_ID, { name: 'X' })

    expect(result).toEqual({
      success: false,
      error: 'Kontrollen hittades inte',
    })
  })
})

// ============================================================================
// softDeleteCycle
// ============================================================================

describe('softDeleteCycle', () => {
  it('allowed on PLANERAD — sets deleted_at + logs + revalidates', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
      makeCycleRow({ status: ComplianceCycleStatus.PLANERAD })
    )
    vi.mocked(prisma.complianceAuditCycle.update).mockResolvedValue(
      makeCycleRow({ deleted_at: new Date() })
    )

    const result = await softDeleteCycle(CYCLE_ID)

    expect(result.success).toBe(true)
    expect(prisma.complianceAuditCycle.update).toHaveBeenCalledWith({
      where: { id: CYCLE_ID },
      data: { deleted_at: expect.any(Date) },
    })
    expect(activityLogger.logActivity).toHaveBeenCalledWith(
      WORKSPACE_ID,
      USER_ID,
      'compliance_audit_cycle',
      CYCLE_ID,
      'cycle_soft_deleted',
      { status: ComplianceCycleStatus.PLANERAD },
      null
    )
    expect(revalidatePath).toHaveBeenCalledWith('/laglistor/kontroller')
  })

  it.each([
    ComplianceCycleStatus.PAGAENDE,
    ComplianceCycleStatus.AVSLUTAD,
    ComplianceCycleStatus.SEALED,
    ComplianceCycleStatus.ARKIVERAD,
  ])('blocked on status %s — no write, no log', async (status) => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
      makeCycleRow({ status })
    )

    const result = await softDeleteCycle(CYCLE_ID)

    expect(result).toEqual({
      success: false,
      error: 'Kontrollen kan bara tas bort i status Planerad',
    })
    expect(prisma.complianceAuditCycle.update).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  it('already-deleted — idempotent error, no write', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
      makeCycleRow({
        status: ComplianceCycleStatus.PLANERAD,
        deleted_at: new Date('2026-04-20T00:00:00Z'),
      })
    )

    const result = await softDeleteCycle(CYCLE_ID)

    expect(result).toEqual({
      success: false,
      error: 'Kontrollen är redan borttagen',
    })
    expect(prisma.complianceAuditCycle.update).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  it('not found — returns generic error', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(null)

    const result = await softDeleteCycle(CYCLE_ID)

    expect(result).toEqual({
      success: false,
      error: 'Kontrollen hittades inte',
    })
  })

  it('invalid cycleId — Zod rejects', async () => {
    const result = await softDeleteCycle('not-a-uuid')

    expect(result.success).toBe(false)
    expect(prisma.complianceAuditCycle.findFirst).not.toHaveBeenCalled()
  })
})

// ============================================================================
// materialiseCycleItems (Story 21.4)
// ============================================================================

/**
 * Mock `$transaction` so its callback runs with the prisma mock itself as `tx`.
 * Every `tx.<model>.<method>` call then routes to the same vi.fn we've already
 * configured on the module-level prisma mock.
 */
function mockTransactionPassthrough() {
  vi.mocked(prisma.$transaction).mockImplementation(
    async (arg: unknown, _opts?: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (_tx: typeof prisma) => Promise<unknown>)(prisma)
      }
      return arg
    }
  )
}

const LAW_LIST_ITEM_ID_2 = '77777777-7777-4777-8777-777777777aaa'
const LAW_LIST_ITEM_ID_3 = '77777777-7777-4777-8777-777777777bbb'
const REQUIREMENT_ID_1 = '88888888-8888-4888-8888-888888888001'
const REQUIREMENT_ID_2 = '88888888-8888-4888-8888-888888888002'

describe('materialiseCycleItems', () => {
  beforeEach(() => {
    mockTransactionPassthrough()
  })

  it('happy path {kind:"all"} — creates items, transitions to PAGAENDE, logs, revalidates', async () => {
    const { materialiseCycleItems } = await import('../compliance-audit-cycle')

    const sourceItems = [
      { id: LAW_LIST_ITEM_ID, compliance_status: 'UPPFYLLD' as const },
      { id: LAW_LIST_ITEM_ID_2, compliance_status: 'PAGAENDE' as const },
      { id: LAW_LIST_ITEM_ID_3, compliance_status: 'EJ_UPPFYLLD' as const },
    ]
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
      makeCycleRow({ scope_definition: { kind: 'all' } }) as never
    )
    vi.mocked(prisma.lawListItem.findMany)
      // first call resolves scope → id list
      .mockResolvedValueOnce(sourceItems.map((it) => ({ id: it.id })) as never)
      // second call fetches compliance_status for the resolved ids
      .mockResolvedValueOnce(sourceItems as never)
    vi.mocked(prisma.lawListItemRequirement.findMany).mockResolvedValue(
      [] as never
    )
    vi.mocked(prisma.complianceAuditItem.createMany).mockResolvedValue({
      count: 3,
    } as never)
    vi.mocked(prisma.complianceAuditCycle.update).mockResolvedValue({} as never)

    const result = await materialiseCycleItems(CYCLE_ID)

    expect(result).toEqual({ success: true, data: { itemCount: 3 } })
    expect(prisma.complianceAuditItem.createMany).toHaveBeenCalledTimes(1)
    const createManyArg = vi.mocked(prisma.complianceAuditItem.createMany).mock
      .calls[0]![0] as { data: Array<Record<string, unknown>> }
    expect(createManyArg.data).toHaveLength(3)
    expect(prisma.complianceAuditCycle.update).toHaveBeenCalledWith({
      where: { id: CYCLE_ID },
      data: { status: ComplianceCycleStatus.PAGAENDE },
    })
    expect(activityLogger.logActivity).toHaveBeenCalledWith(
      WORKSPACE_ID,
      USER_ID,
      'compliance_audit_cycle',
      CYCLE_ID,
      'cycle_materialised',
      null,
      expect.objectContaining({ itemCount: 3 })
    )
    expect(revalidatePath).toHaveBeenCalledWith('/laglistor/kontroller')
  })

  it('happy path {kind:"groups"} — resolves via group_id filter', async () => {
    const { materialiseCycleItems } = await import('../compliance-audit-cycle')

    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
      makeCycleRow({
        scope_definition: { kind: 'groups', groupIds: [LAW_LIST_GROUP_ID] },
      }) as never
    )
    vi.mocked(prisma.lawListItem.findMany)
      .mockResolvedValueOnce([{ id: LAW_LIST_ITEM_ID }] as never)
      .mockResolvedValueOnce([
        { id: LAW_LIST_ITEM_ID, compliance_status: 'EJ_TILLAMPLIG' as const },
      ] as never)
    vi.mocked(prisma.lawListItemRequirement.findMany).mockResolvedValue(
      [] as never
    )
    vi.mocked(prisma.complianceAuditItem.createMany).mockResolvedValue({
      count: 1,
    } as never)

    const result = await materialiseCycleItems(CYCLE_ID)

    expect(result.success).toBe(true)
    // First `findMany` call should have used the group_id filter.
    const firstFind = vi.mocked(prisma.lawListItem.findMany).mock.calls[0]![0]
    expect(firstFind).toMatchObject({
      where: {
        law_list_id: LAW_LIST_ID,
        group_id: { in: [LAW_LIST_GROUP_ID] },
      },
    })
  })

  it('happy path {kind:"items"} — resolves exactly the listed items', async () => {
    const { materialiseCycleItems } = await import('../compliance-audit-cycle')

    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
      makeCycleRow({
        scope_definition: {
          kind: 'items',
          itemIds: [LAW_LIST_ITEM_ID, LAW_LIST_ITEM_ID_2],
        },
      }) as never
    )
    vi.mocked(prisma.lawListItem.findMany)
      .mockResolvedValueOnce([
        { id: LAW_LIST_ITEM_ID },
        { id: LAW_LIST_ITEM_ID_2 },
      ] as never)
      .mockResolvedValueOnce([
        { id: LAW_LIST_ITEM_ID, compliance_status: 'UPPFYLLD' as const },
        { id: LAW_LIST_ITEM_ID_2, compliance_status: 'UPPFYLLD' as const },
      ] as never)
    vi.mocked(prisma.lawListItemRequirement.findMany).mockResolvedValue(
      [] as never
    )
    vi.mocked(prisma.complianceAuditItem.createMany).mockResolvedValue({
      count: 2,
    } as never)

    const result = await materialiseCycleItems(CYCLE_ID)

    expect(result).toEqual({ success: true, data: { itemCount: 2 } })
  })

  describe.each([
    { status: 'UPPFYLLD', expected: 'UPPFYLLD' },
    { status: 'EJ_UPPFYLLD', expected: 'EJ_UPPFYLLD' },
    { status: 'EJ_TILLAMPLIG', expected: 'EJ_TILLAMPLIG' },
    { status: 'PAGAENDE', expected: null },
    { status: 'EJ_PABORJAD', expected: null },
  ] as const)(
    'bedömning mapping: $status → $expected',
    ({ status, expected }) => {
      it('writes the mapped efterlevnadsbedomning value (or omits the field when null)', async () => {
        const { materialiseCycleItems } = await import(
          '../compliance-audit-cycle'
        )
        vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
          makeCycleRow({ scope_definition: { kind: 'all' } }) as never
        )
        vi.mocked(prisma.lawListItem.findMany)
          .mockResolvedValueOnce([{ id: LAW_LIST_ITEM_ID }] as never)
          .mockResolvedValueOnce([
            { id: LAW_LIST_ITEM_ID, compliance_status: status },
          ] as never)
        vi.mocked(prisma.lawListItemRequirement.findMany).mockResolvedValue(
          [] as never
        )
        vi.mocked(prisma.complianceAuditItem.createMany).mockResolvedValue({
          count: 1,
        } as never)

        await materialiseCycleItems(CYCLE_ID)

        const arg = vi.mocked(prisma.complianceAuditItem.createMany).mock
          .calls[0]![0] as { data: Array<Record<string, unknown>> }
        const row = arg.data[0]!
        if (expected === null) {
          // Story 21.4 AC 9: PAGAENDE and EJ_PABORJAD produce null bedömning.
          // We verify the field is either absent (conditional spread omitted it)
          // or explicitly null — both satisfy the contract.
          expect(
            row.efterlevnadsbedomning === undefined ||
              row.efterlevnadsbedomning === null
          ).toBe(true)
        } else {
          expect(row.efterlevnadsbedomning).toBe(expected)
        }
      })
    }
  )

  it('kravpunkter snapshot — contains source requirements verbatim + ISO frozen_at', async () => {
    const { materialiseCycleItems } = await import('../compliance-audit-cycle')

    const reqs = [
      {
        list_item_id: LAW_LIST_ITEM_ID,
        id: REQUIREMENT_ID_1,
        text: 'Kravpunkt 1',
        comment: null,
        is_fulfilled: false,
        bevis_required: false,
        position: 1,
        responsible_user_id: null,
        created_by: USER_ID,
      },
      {
        list_item_id: LAW_LIST_ITEM_ID,
        id: REQUIREMENT_ID_2,
        text: 'Kravpunkt 2',
        comment: 'kommentar',
        is_fulfilled: true,
        bevis_required: true,
        position: 2,
        responsible_user_id: LEAD_AUDITOR_ID,
        created_by: USER_ID,
      },
    ]
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
      makeCycleRow({ scope_definition: { kind: 'all' } }) as never
    )
    vi.mocked(prisma.lawListItem.findMany)
      .mockResolvedValueOnce([{ id: LAW_LIST_ITEM_ID }] as never)
      .mockResolvedValueOnce([
        { id: LAW_LIST_ITEM_ID, compliance_status: 'UPPFYLLD' as const },
      ] as never)
    vi.mocked(prisma.lawListItemRequirement.findMany).mockResolvedValue(
      reqs as never
    )
    vi.mocked(prisma.complianceAuditItem.createMany).mockResolvedValue({
      count: 1,
    } as never)

    const before = Date.now()
    await materialiseCycleItems(CYCLE_ID)
    const after = Date.now()

    const arg = vi.mocked(prisma.complianceAuditItem.createMany).mock
      .calls[0]![0] as { data: Array<{ kravpunkter_snapshot: unknown }> }
    const snapshot = arg.data[0]!.kravpunkter_snapshot as {
      frozen_at: string
      requirements: typeof reqs
    }
    expect(snapshot.requirements).toHaveLength(2)
    expect(snapshot.requirements[0]!.id).toBe(REQUIREMENT_ID_1)
    expect(snapshot.requirements[1]!.text).toBe('Kravpunkt 2')
    const frozenTs = Date.parse(snapshot.frozen_at)
    expect(frozenTs).toBeGreaterThanOrEqual(before)
    expect(frozenTs).toBeLessThanOrEqual(after + 100) // tolerate tiny drift
  })

  it('idempotency — second call on PAGAENDE cycle returns structured error, no writes', async () => {
    const { materialiseCycleItems } = await import('../compliance-audit-cycle')

    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
      makeCycleRow({ status: ComplianceCycleStatus.PAGAENDE }) as never
    )

    const result = await materialiseCycleItems(CYCLE_ID)

    expect(result).toEqual({
      success: false,
      error:
        'Kontrollen har redan materialiserats eller är inte i status Planerad',
    })
    expect(prisma.complianceAuditItem.createMany).not.toHaveBeenCalled()
    expect(prisma.complianceAuditCycle.update).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  it('tx rollback — createMany failure leaves cycle untouched and logs nothing', async () => {
    const { materialiseCycleItems } = await import('../compliance-audit-cycle')

    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
      makeCycleRow({ scope_definition: { kind: 'all' } }) as never
    )
    vi.mocked(prisma.lawListItem.findMany)
      .mockResolvedValueOnce([{ id: LAW_LIST_ITEM_ID }] as never)
      .mockResolvedValueOnce([
        { id: LAW_LIST_ITEM_ID, compliance_status: 'UPPFYLLD' as const },
      ] as never)
    vi.mocked(prisma.lawListItemRequirement.findMany).mockResolvedValue(
      [] as never
    )
    vi.mocked(prisma.complianceAuditItem.createMany).mockRejectedValue(
      new Error('P2002: unique constraint violation')
    )

    const result = await materialiseCycleItems(CYCLE_ID)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Kunde inte materialisera kontrollen')
    expect(prisma.complianceAuditCycle.update).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  it('empty-scope edge case — resolved set is empty, returns Swedish error', async () => {
    const { materialiseCycleItems } = await import('../compliance-audit-cycle')

    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
      makeCycleRow({
        scope_definition: {
          kind: 'items',
          itemIds: ['99999999-9999-4999-8999-999999999999'],
        },
      }) as never
    )
    vi.mocked(prisma.lawListItem.findMany).mockResolvedValueOnce([] as never)

    const result = await materialiseCycleItems(CYCLE_ID)

    expect(result).toEqual({
      success: false,
      error: 'Omfattningen matchar inga dokument',
    })
    expect(prisma.complianceAuditItem.createMany).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  it('subset warning — resolved < requested, success with warnings populated', async () => {
    const { materialiseCycleItems } = await import('../compliance-audit-cycle')

    const requestedIds = [
      LAW_LIST_ITEM_ID,
      '99999999-9999-4999-8999-999999999999',
    ]
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
      makeCycleRow({
        scope_definition: { kind: 'items', itemIds: requestedIds },
      }) as never
    )
    vi.mocked(prisma.lawListItem.findMany)
      .mockResolvedValueOnce([{ id: LAW_LIST_ITEM_ID }] as never)
      .mockResolvedValueOnce([
        { id: LAW_LIST_ITEM_ID, compliance_status: 'UPPFYLLD' as const },
      ] as never)
    vi.mocked(prisma.lawListItemRequirement.findMany).mockResolvedValue(
      [] as never
    )
    vi.mocked(prisma.complianceAuditItem.createMany).mockResolvedValue({
      count: 1,
    } as never)

    const result = await materialiseCycleItems(CYCLE_ID)

    expect(result.success).toBe(true)
    expect(result.warnings).toEqual([
      '1 valt dokument kunde inte materialiseras (borttagna eller inte längre i laglistan)',
    ])
  })

  it('permission denied — caller without tasks:edit returns structured error', async () => {
    const { materialiseCycleItems } = await import('../compliance-audit-cycle')
    // Synthetic role with only `read` — lacks tasks:edit.
    mockWorkspaceCtx({ role: 'AUDITOR' }) // AUDITOR has no tasks:edit

    const result = await materialiseCycleItems(CYCLE_ID)

    expect(result.success).toBe(false)
    expect(prisma.complianceAuditCycle.findFirst).not.toHaveBeenCalled()
  })

  it('cross-tenant — cycle not in workspace returns generic not-found error', async () => {
    const { materialiseCycleItems } = await import('../compliance-audit-cycle')

    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(null)

    const result = await materialiseCycleItems(CYCLE_ID)

    expect(result).toEqual({
      success: false,
      error: 'Kontrollen hittades inte',
    })
  })

  it('invalid cycleId — Zod rejects without any Prisma call', async () => {
    const { materialiseCycleItems } = await import('../compliance-audit-cycle')

    const result = await materialiseCycleItems('not-a-uuid')

    expect(result.success).toBe(false)
    expect(prisma.complianceAuditCycle.findFirst).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  // ===========================================================================
  // p95 microtest (IV2 — NFR1: 500-item materialisation < 3s)
  // ===========================================================================
  // 20 warmup + 20 measured invocations against a 500-item mocked laglista.
  // Threshold: 3000ms p95 on CI (generous; target <3s real prod per NFR1).
  it('performance — 500-item materialisation completes within the NFR1 ceiling (p95 < 3000ms)', async () => {
    const { materialiseCycleItems } = await import('../compliance-audit-cycle')

    const fiveHundredIds = Array.from({ length: 500 }, (_, i) =>
      `${i.toString(16).padStart(8, '0')}-${i.toString(16).padStart(4, '0')}-4${i.toString(16).padStart(3, '0')}-8${i.toString(16).padStart(3, '0')}-${i.toString(16).padStart(12, '0')}`.slice(
        0,
        36
      )
    )
    const validIds = fiveHundredIds.map(
      (_, i) => `aaaaaaaa-bbbb-4ccc-8ddd-${i.toString(16).padStart(12, '0')}`
    )
    const sourceItems = validIds.map((id) => ({
      id,
      compliance_status: 'UPPFYLLD' as const,
    }))

    const runOnce = async () => {
      vi.clearAllMocks()
      mockWorkspaceCtx({ role: 'OWNER' })
      mockTransactionPassthrough()
      vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
        makeCycleRow({ scope_definition: { kind: 'all' } }) as never
      )
      vi.mocked(prisma.lawListItem.findMany)
        .mockResolvedValueOnce(validIds.map((id) => ({ id })) as never)
        .mockResolvedValueOnce(sourceItems as never)
      vi.mocked(prisma.lawListItemRequirement.findMany).mockResolvedValue(
        [] as never
      )
      vi.mocked(prisma.complianceAuditItem.createMany).mockResolvedValue({
        count: 500,
      } as never)

      const t0 = performance.now()
      const result = await materialiseCycleItems(CYCLE_ID)
      const elapsed = performance.now() - t0
      expect(result.success).toBe(true)
      return elapsed
    }

    // warmup
    for (let i = 0; i < 20; i++) {
      await runOnce()
    }
    const samples: number[] = []
    for (let i = 0; i < 20; i++) {
      samples.push(await runOnce())
    }
    samples.sort((a, b) => a - b)
    const p95Index = Math.ceil(samples.length * 0.95) - 1
    const p95 = samples[p95Index]!
    // CI-generous ceiling: 3000ms. Real-browser/prod DB target is <3s (NFR1).
    // This microtest catches egregious regressions (N² logic, accidental
    // serialisation) — it does NOT validate real DB latency (Prisma fully mocked).
    expect(p95).toBeLessThan(3000)
  })
})

// ============================================================================
// Story 21.14 — AUDITOR read-access regression pins (AC 14)
// ============================================================================

describe('Story 21.14 — AUDITOR read-access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkspaceCtx({ role: 'AUDITOR' })
  })

  it('listCyclesForWorkspace returns data for AUDITOR (activity:view || tasks:edit OR-check)', async () => {
    vi.mocked(prisma.complianceAuditCycle.findMany).mockResolvedValue([
      makeCycleRowWithIncludes(),
    ] as unknown as never)

    const result = await listCyclesForWorkspace()

    expect(result.success).toBe(true)
    expect(result.data?.cycles[0]?.id).toBe(CYCLE_ID)
  })

  it('getCycleById returns data for AUDITOR (activity:view || tasks:edit OR-check)', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(
      makeCycleRowWithIncludes() as unknown as never
    )

    const result = await getCycleById(CYCLE_ID)

    expect(result.success).toBe(true)
    expect(result.data?.cycle.id).toBe(CYCLE_ID)
  })
})

// ============================================================================
// Story 21.14 — mutation permission-denied regression pins (AC 14)
// Defensive: breaks only if someone weakens `withWorkspace(cb, 'tasks:edit')`
// on a cycle-mutation action. The inline `mockWorkspaceCtx` helper's built-in
// requiredPermission check already throws 'Permission denied: tasks:edit'
// when called with { role: 'AUDITOR' }; we pin the outer-catch error-string
// contract so a future weakening (e.g., dropping the second argument) is
// caught at this test boundary.
// ============================================================================

describe('Story 21.14 — mutation permission-denied regression pins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // AUDITOR lacks 'tasks:edit' → withWorkspace(cb, 'tasks:edit') throws.
    mockWorkspaceCtx({ role: 'AUDITOR' })
  })

  it('createCycle rejects AUDITOR with outer-catch error string', async () => {
    const result = await createCycle(VALID_CREATE_INPUT)

    expect(result).toEqual({
      success: false,
      error: 'Kunde inte skapa kontrollen',
    })
    expect(prisma.complianceAuditCycle.create).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  it('updateCycleMetadata rejects AUDITOR with outer-catch error string', async () => {
    const result = await updateCycleMetadata(CYCLE_ID, { name: 'Renamed' })

    expect(result).toEqual({
      success: false,
      error: 'Kunde inte uppdatera kontrollen',
    })
    expect(prisma.complianceAuditCycle.update).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  it('softDeleteCycle rejects AUDITOR with outer-catch error string', async () => {
    const result = await softDeleteCycle(CYCLE_ID)

    expect(result).toEqual({
      success: false,
      error: 'Kunde inte ta bort kontrollen',
    })
    expect(prisma.complianceAuditCycle.update).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })
})
