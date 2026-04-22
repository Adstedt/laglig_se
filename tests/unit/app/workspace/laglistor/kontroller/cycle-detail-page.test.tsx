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

// Stub the client component so we don't try to render its internals.
vi.mock('@/components/features/compliance-audit/cycle-detail', async () => {
  const React = await import('react')
  return {
    CycleDetailPage: (props: Record<string, unknown>) =>
      React.createElement('div', {
        'data-testid': 'cycle-detail-page',
        'data-read-only': props.readOnly ? 'true' : 'false',
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
    sealHash: null,
    sealedAt: null,
    sealedBy: null,
    createdBy: { id: 'u0', name: 'Creator' },
    deletedAt: null,
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
        sealHash: null,
      },
    },
  })
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

  it('redirects when cycle is not found to /laglistor/kontroller/skapa', async () => {
    getCycleByIdMock.mockResolvedValue({
      success: false,
      error: 'Kontrollen hittades inte',
    })

    await expect(
      CycleDetailRoute({
        params: Promise.resolve({ cycleId: CYCLE_ID }),
      })
    ).rejects.toThrow(/NEXT_REDIRECT/)
    expect(redirectMock).toHaveBeenCalledWith('/laglistor/kontroller/skapa')
  })

  it('renders with readOnly=true when cycle is SEALED', async () => {
    const sealedCycle = makeCycle(ComplianceCycleStatus.SEALED)
    getCycleByIdMock.mockResolvedValue({
      success: true,
      data: { cycle: sealedCycle },
    })
    getCycleItemsForCycleMock.mockResolvedValue({
      success: true,
      data: {
        items: [],
        cycle: {
          id: CYCLE_ID,
          status: ComplianceCycleStatus.SEALED,
          name: 'Q2',
          sealHash: 'abc123',
        },
      },
    })

    const element = await CycleDetailRoute({
      params: Promise.resolve({ cycleId: CYCLE_ID }),
    })
    // The returned element tree is our stubbed CycleDetailPage mock;
    // its props surface via data attributes.
    const json = JSON.stringify(element)
    expect(json).toContain('"readOnly":true')
  })

  it('renders with readOnly=true when cycle is ARKIVERAD', async () => {
    getCycleByIdMock.mockResolvedValue({
      success: true,
      data: { cycle: makeCycle(ComplianceCycleStatus.ARKIVERAD) },
    })
    getCycleItemsForCycleMock.mockResolvedValue({
      success: true,
      data: {
        items: [],
        cycle: {
          id: CYCLE_ID,
          status: ComplianceCycleStatus.ARKIVERAD,
          name: 'Q2',
          sealHash: null,
        },
      },
    })

    const element = await CycleDetailRoute({
      params: Promise.resolve({ cycleId: CYCLE_ID }),
    })
    const json = JSON.stringify(element)
    expect(json).toContain('"readOnly":true')
  })

  it('renders readOnly=false for PAGAENDE cycles', async () => {
    const element = await CycleDetailRoute({
      params: Promise.resolve({ cycleId: CYCLE_ID }),
    })
    const json = JSON.stringify(element)
    expect(json).toContain('"readOnly":false')
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
})
