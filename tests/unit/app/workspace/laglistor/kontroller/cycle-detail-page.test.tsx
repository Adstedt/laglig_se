/**
 * Story 21.5 — RSC gating test for /laglistor/kontroller/[cycleId]/page.tsx.
 *
 * Server Components cannot be mounted in jsdom/happy-dom. Instead we call
 * the RSC function directly, mock the data dependencies, and assert on the
 * redirect() side effect or the returned element tree shape. This matches
 * the pattern documented in the story's Task 9.6.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ComplianceCycleStatus,
  AuditType,
  type WorkspaceRole,
} from '@prisma/client'
import type { Permission } from '@/lib/auth/permissions'

// ============================================================================
// Mocks — MUST come before importing the module under test.
// ============================================================================

const redirectMock = vi.fn((path: string) => {
  // Next.js's real redirect() throws a special error. Mimic that so the
  // route function's execution is halted, matching the production contract.
  const err = new Error(`NEXT_REDIRECT: ${path}`)
  ;(err as { digest?: string }).digest = 'NEXT_REDIRECT'
  throw err
})

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}))

const getWorkspaceContextMock = vi.fn()
vi.mock('@/lib/auth/workspace-context', () => ({
  getWorkspaceContext: () => getWorkspaceContextMock(),
}))

const hasPermissionMock = vi.fn()
vi.mock('@/lib/auth/permissions', () => ({
  hasPermission: (role: WorkspaceRole, permission: Permission) =>
    hasPermissionMock(role, permission),
}))

const getCycleByIdMock = vi.fn()
vi.mock('@/app/actions/compliance-audit-cycle', () => ({
  getCycleById: (...args: unknown[]) => getCycleByIdMock(...args),
}))

const getCycleItemsForCycleMock = vi.fn()
vi.mock('@/app/actions/compliance-audit-item', () => ({
  getCycleItemsForCycle: (...args: unknown[]) =>
    getCycleItemsForCycleMock(...args),
}))

// Story 21.7: the RSC page also pre-fetches findings for the header chip +
// initialFindings prop.
const listFindingsForCycleMock = vi.fn()
vi.mock('@/app/actions/compliance-finding', () => ({
  listFindingsForCycle: (...args: unknown[]) =>
    listFindingsForCycleMock(...args),
}))

// Story 21.6 — canRevert prop resolved server-side only when cycle is AVSLUTAD.
// Story 21.26 — canSealCycle helper removed alongside the SEAL collapse; only
// canCompleteOrRevertCycle remains.
const canCompleteOrRevertCycleMock = vi.fn()
vi.mock('@/lib/compliance-audit/authorization', () => ({
  canCompleteOrRevertCycle: (...args: unknown[]) =>
    canCompleteOrRevertCycleMock(...args),
}))

// Stub the client component so we don't try to render its internals.
// Story 21.27 — only `itemsReadOnly` survives. Findings have no cycle-status
// read-only mode any more.
vi.mock('@/components/features/compliance-audit/cycle-detail', async () => {
  const React = await import('react')
  return {
    CycleDetailPage: (props: Record<string, unknown>) =>
      React.createElement('div', {
        'data-testid': 'cycle-detail-page',
        'data-items-read-only': props.itemsReadOnly ? 'true' : 'false',
      }),
  }
})

// Component under test (imported AFTER mocks).
import CycleDetailRoute from '@/app/(workspace)/laglistor/kontroller/[cycleId]/page'

// ============================================================================
// Fixtures
// ============================================================================

const CYCLE_ID = '55555555-5555-4555-8555-555555555555'

function makeCycle(
  status: ComplianceCycleStatus = ComplianceCycleStatus.PAGAENDE
) {
  return {
    id: CYCLE_ID,
    name: 'Q2 compliance review',
    status,
    auditType: AuditType.INTERN,
    scheduledStart: new Date(),
    scheduledEnd: new Date(),
    lawChangeCutoffDate: new Date(),
    leadAuditor: { id: 'u1', name: 'Alice' },
    lawList: { id: 'l1', name: 'Huvudlista' },
    itemCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    lawListId: 'l1',
    scopeDefinition: { kind: 'all' as const },
    sealedAt: null,
    sealedBy: null,
    createdBy: { id: 'u0', name: 'Creator' },
    deletedAt: null,
    description: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getWorkspaceContextMock.mockResolvedValue({
    userId: 'u1',
    workspaceId: 'w1',
    role: 'OWNER' as WorkspaceRole,
  })
  hasPermissionMock.mockReturnValue(true)
  getCycleByIdMock.mockResolvedValue({
    success: true,
    data: { cycle: makeCycle() },
  })
  getCycleItemsForCycleMock.mockResolvedValue({
    success: true,
    data: {
      items: [],
      cycle: {
        id: CYCLE_ID,
        status: ComplianceCycleStatus.PAGAENDE,
        name: 'Q2',
      },
    },
  })
  listFindingsForCycleMock.mockResolvedValue({
    success: true,
    data: { findings: [] },
  })
  canCompleteOrRevertCycleMock.mockResolvedValue(true)
})

// ============================================================================
// Tests
// ============================================================================

describe('CycleDetailRoute — RSC gating', () => {
  it('redirects unauthorised users (no activity:view + no tasks:edit) to /laglistor', async () => {
    hasPermissionMock.mockReturnValue(false)

    await expect(
      CycleDetailRoute({
        params: Promise.resolve({ cycleId: CYCLE_ID }),
      })
    ).rejects.toThrow(/NEXT_REDIRECT/)
    expect(redirectMock).toHaveBeenCalledWith('/laglistor')
  })

  it('redirects when cycle is not found to /laglistor/kontroller (list hub)', async () => {
    getCycleByIdMock.mockResolvedValue({
      success: false,
      error: 'Kontrollen hittades inte',
    })

    await expect(
      CycleDetailRoute({
        params: Promise.resolve({ cycleId: CYCLE_ID }),
      })
    ).rejects.toThrow(/NEXT_REDIRECT/)
    expect(redirectMock).toHaveBeenCalledWith('/laglistor/kontroller')
  })

  // Story 21.27 — `findingsReadOnly` plumbing dropped alongside ARKIVERAD
  // collapse. Only `itemsReadOnly` survives; it's true on AVSLUTAD only.

  it('renders with itemsReadOnly=true when cycle is AVSLUTAD', async () => {
    getCycleByIdMock.mockResolvedValue({
      success: true,
      data: { cycle: makeCycle(ComplianceCycleStatus.AVSLUTAD) },
    })
    getCycleItemsForCycleMock.mockResolvedValue({
      success: true,
      data: {
        items: [],
        cycle: {
          id: CYCLE_ID,
          status: ComplianceCycleStatus.AVSLUTAD,
          name: 'Q2',
        },
      },
    })

    const element = await CycleDetailRoute({
      params: Promise.resolve({ cycleId: CYCLE_ID }),
    })
    const json = JSON.stringify(element)
    expect(json).toContain('"itemsReadOnly":true')
  })

  it('renders with itemsReadOnly=false for PAGAENDE cycles', async () => {
    const element = await CycleDetailRoute({
      params: Promise.resolve({ cycleId: CYCLE_ID }),
    })
    const json = JSON.stringify(element)
    expect(json).toContain('"itemsReadOnly":false')
  })

  it('fails open (items=[]) when items fetch fails but cycle loaded', async () => {
    getCycleItemsForCycleMock.mockResolvedValue({
      success: false,
      error: 'timeout',
    })
    const element = await CycleDetailRoute({
      params: Promise.resolve({ cycleId: CYCLE_ID }),
    })
    // The CycleDetailPage mock is still rendered (not redirected away).
    expect(element).toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  // Story 21.7: findings pre-fetch (AC 14 + Task 7.1 + Task 8.6).
  it('pre-fetches findings via listFindingsForCycle and forwards them as initialFindings', async () => {
    listFindingsForCycleMock.mockResolvedValue({
      success: true,
      data: {
        findings: [
          {
            id: 'f-1',
            cycleId: CYCLE_ID,
            type: 'AVVIKELSE',
            severity: 'MAJOR',
            title: 'Sample',
            description: 'body',
            rootCause: null,
            dueDate: null,
            closedAt: null,
            closedBy: null,
            lawListItemId: null,
            lawListItem: null,
            requirementId: null,
            requirement: null,
            correctiveActionTaskId: null,
            correctiveActionTask: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    })

    await CycleDetailRoute({
      params: Promise.resolve({ cycleId: CYCLE_ID }),
    })

    expect(listFindingsForCycleMock).toHaveBeenCalledWith({
      cycleId: CYCLE_ID,
    })
  })

  it('fails open (initialFindings=[]) when findings fetch fails', async () => {
    listFindingsForCycleMock.mockResolvedValue({
      success: false,
      error: 'timeout',
    })

    const element = await CycleDetailRoute({
      params: Promise.resolve({ cycleId: CYCLE_ID }),
    })
    // Page still renders — fail-open pattern matches the existing items path.
    expect(element).toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  // Story 21.6 — canRevert prop resolution (AC 11).
  it('canRevert=false + canCompleteOrRevertCycle NOT called when cycle is PAGAENDE', async () => {
    await CycleDetailRoute({
      params: Promise.resolve({ cycleId: CYCLE_ID }),
    })
    // DB lookup must be skipped for non-AVSLUTAD cycles to avoid wasted RTT.
    expect(canCompleteOrRevertCycleMock).not.toHaveBeenCalled()
  })

  it('canRevert resolved via canCompleteOrRevertCycle when cycle is AVSLUTAD', async () => {
    getCycleByIdMock.mockResolvedValue({
      success: true,
      data: { cycle: makeCycle(ComplianceCycleStatus.AVSLUTAD) },
    })
    getCycleItemsForCycleMock.mockResolvedValue({
      success: true,
      data: {
        items: [],
        cycle: {
          id: CYCLE_ID,
          status: ComplianceCycleStatus.AVSLUTAD,
          name: 'Q2',
        },
      },
    })
    canCompleteOrRevertCycleMock.mockResolvedValue(true)

    await CycleDetailRoute({
      params: Promise.resolve({ cycleId: CYCLE_ID }),
    })

    expect(canCompleteOrRevertCycleMock).toHaveBeenCalledTimes(1)
    expect(canCompleteOrRevertCycleMock).toHaveBeenCalledWith({
      role: 'OWNER',
      userId: 'u1',
      cycleId: CYCLE_ID,
      workspaceId: 'w1',
    })
  })

  // Story 21.26 — canSealCycle helper + the parallel `canSeal` lookup were
  // removed alongside the SEAL collapse. Cycle completion + revert are the
  // only post-PAGAENDE transitions.
})
