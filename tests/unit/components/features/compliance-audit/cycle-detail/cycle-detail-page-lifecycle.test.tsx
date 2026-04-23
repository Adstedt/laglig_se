/**
 * Story 21.6 — CycleDetailPage lifecycle integration tests (AC 14).
 *
 * Tests the wiring between the dropdown, dialogs, server actions, and
 * localCycle state reconciliation — NOT the dropdown menu interaction itself
 * (that's covered by cycle-actions-dropdown.test.tsx; Radix DropdownMenu
 * pointer events are unreliable in happy-dom).
 *
 * Strategy: mock `CycleActionsDropdown` so tests can directly fire the
 * `onCompleteClick` / `onRevertClick` callbacks via exposed DOM markers,
 * then assert on the dialog visibility, server-action invocation, and
 * `localCycle` state re-rendering.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react'
import { SWRConfig } from 'swr'
import {
  ComplianceCycleStatus,
  ComplianceStatus,
  AuditType,
} from '@prisma/client'
import type { CycleDetail } from '@/app/actions/compliance-audit-cycle'
import type {
  CycleItemRow,
  CyclePartial,
} from '@/app/actions/compliance-audit-item'
import type { FindingRow } from '@/app/actions/compliance-finding'

// ============================================================================
// Mocks — MUST come before importing the module under test.
// ============================================================================

const completeCycleMock = vi.fn()
const revertCycleToPagaendeMock = vi.fn()
vi.mock('@/app/actions/compliance-audit-cycle', async () => {
  const actual = await vi.importActual<
    typeof import('@/app/actions/compliance-audit-cycle')
  >('@/app/actions/compliance-audit-cycle')
  return {
    ...actual,
    completeCycle: (...args: unknown[]) => completeCycleMock(...args),
    revertCycleToPagaende: (...args: unknown[]) =>
      revertCycleToPagaendeMock(...args),
  }
})

const getCycleItemsForCycleMock = vi.fn()
vi.mock('@/app/actions/compliance-audit-item', () => ({
  getCycleItemsForCycle: (...args: unknown[]) =>
    getCycleItemsForCycleMock(...args),
  updateItemBedomning: vi.fn(),
  updateItemMotivering: vi.fn(),
  signOffItem: vi.fn(),
  unsignOffItem: vi.fn(),
}))

const listFindingsForCycleMock = vi.fn()
vi.mock('@/app/actions/compliance-finding', () => ({
  listFindingsForCycle: (...args: unknown[]) =>
    listFindingsForCycleMock(...args),
  closeFinding: vi.fn(),
  reopenFinding: vi.fn(),
  createFinding: vi.fn(),
  updateFinding: vi.fn(),
}))

// Stub CycleItemsTab + CycleFindingsTab — not under test.
vi.mock(
  '@/components/features/compliance-audit/cycle-detail/cycle-items-tab',
  () => ({
    CycleItemsTab: () => <div data-testid="cycle-items-tab" />,
  })
)

vi.mock(
  '@/components/features/compliance-audit/cycle-detail/cycle-findings-tab',
  () => ({
    CycleFindingsTab: () => <div data-testid="cycle-findings-tab" />,
  })
)

// Stub the cycle-item modal — not under test for lifecycle flows.
vi.mock('@/components/features/compliance-audit/cycle-item-modal', () => ({
  CycleItemModal: () => null,
}))

// Stub the dropdown so we can invoke its click callbacks directly via simple
// button markers (avoids Radix DropdownMenu pointer-event issues in happy-dom).
vi.mock(
  '@/components/features/compliance-audit/cycle-detail/cycle-actions-dropdown',
  () => ({
    CycleActionsDropdown: ({
      cycle,
      canRevert,
      onCompleteClick,
      onRevertClick,
    }: {
      cycle: { status: ComplianceCycleStatus }
      canRevert: boolean
      onCompleteClick: () => void
      onRevertClick: () => void
    }) => (
      <div data-testid="stub-dropdown" data-status={cycle.status}>
        <button onClick={onCompleteClick}>stub-complete</button>
        <button onClick={onRevertClick} disabled={!canRevert}>
          stub-revert
        </button>
      </div>
    ),
  })
)

const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}))

// Component under test (imported AFTER mocks).
import { CycleDetailPage } from '@/components/features/compliance-audit/cycle-detail'

// ============================================================================
// Fixtures
// ============================================================================

const CYCLE_ID = '11111111-1111-4111-8111-111111111111'

function makeCycle(
  status: ComplianceCycleStatus,
  overrides: Partial<CycleDetail> = {}
): CycleDetail {
  return {
    id: CYCLE_ID,
    name: 'Q2 revision',
    status,
    auditType: AuditType.INTERN,
    scheduledStart: new Date(),
    scheduledEnd: new Date(),
    lawChangeCutoffDate: new Date(),
    leadAuditor: { id: 'u1', name: 'Alice' },
    lawList: { id: 'l1', name: 'Huvudlista' },
    itemCount: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    lawListId: 'l1',
    scopeDefinition: { kind: 'all' },
    sealHash: null,
    sealedAt: null,
    sealedBy: null,
    createdBy: { id: 'u0', name: 'Creator' },
    deletedAt: null,
    ...overrides,
  }
}

function makeItem(id: string, signed: boolean): CycleItemRow {
  return {
    id,
    lawListItemId: `lli-${id}`,
    lawTitle: `Law ${id}`,
    lawDocumentNumber: `SFS ${id}`,
    groupId: null,
    groupName: null,
    sourceComplianceStatus: ComplianceStatus.UPPFYLLD,
    sourceResponsibleUser: null,
    efterlevnadsbedomning: null,
    motivering: null,
    reviewedAt: null,
    reviewedBy: null,
    signedOffAt: signed ? new Date() : null,
    signedOffBy: signed ? { id: 'u1', name: 'Alice' } : null,
    kravpunkterSnapshot: null,
    businessContext: null,
  } as CycleItemRow
}

function makeCyclePartial(status: ComplianceCycleStatus): CyclePartial {
  return { id: CYCLE_ID, status, name: 'Q2 revision', sealHash: null }
}

function renderPage(
  opts: {
    status?: ComplianceCycleStatus
    items?: CycleItemRow[]
    findings?: FindingRow[]
    canRevert?: boolean
  } = {}
) {
  const status = opts.status ?? ComplianceCycleStatus.PAGAENDE
  const cycle = makeCycle(status)
  const items = opts.items ?? [makeItem('a', true), makeItem('b', true)]
  const findings = opts.findings ?? []

  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <CycleDetailPage
        cycle={cycle}
        items={items}
        initialFindings={findings}
        cyclePartial={makeCyclePartial(status)}
        readOnly={
          status === ComplianceCycleStatus.SEALED ||
          status === ComplianceCycleStatus.ARKIVERAD
        }
        canRevert={opts.canRevert ?? false}
      />
    </SWRConfig>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  // SWR fallbacks — the page fires these to pre-hydrate caches.
  getCycleItemsForCycleMock.mockResolvedValue({
    success: true,
    data: {
      items: [],
      cycle: makeCyclePartial(ComplianceCycleStatus.PAGAENDE),
    },
  })
  listFindingsForCycleMock.mockResolvedValue({
    success: true,
    data: { findings: [] },
  })
})

afterEach(() => {
  cleanup()
})

// ============================================================================
// Tests
// ============================================================================

describe('CycleDetailPage — lifecycle integration', () => {
  it('click "Slutför" → dialog opens → confirm calls completeCycle + toast + status update', async () => {
    completeCycleMock.mockResolvedValue({
      success: true,
      data: {
        cycle: makeCycle(ComplianceCycleStatus.AVSLUTAD),
      },
    })

    renderPage({ status: ComplianceCycleStatus.PAGAENDE })

    fireEvent.click(screen.getByText('stub-complete'))
    // Dialog should render — assert on title copy.
    expect(screen.getByText('Slutför kontrollen?')).toBeInTheDocument()

    // Confirm.
    fireEvent.click(screen.getByRole('button', { name: 'Slutför kontroll' }))

    await waitFor(() => {
      expect(completeCycleMock).toHaveBeenCalledWith(CYCLE_ID)
    })
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Kontrollen är avslutad')
    })

    // Stub-dropdown re-renders with the new status after localCycle update.
    await waitFor(() => {
      const dropdown = screen.getByTestId('stub-dropdown')
      expect(dropdown).toHaveAttribute(
        'data-status',
        ComplianceCycleStatus.AVSLUTAD
      )
    })
  })

  it('completeCycle error → toast.error + dialog stays open + cycle status unchanged', async () => {
    completeCycleMock.mockResolvedValue({
      success: false,
      error: 'Something broke',
    })

    renderPage({ status: ComplianceCycleStatus.PAGAENDE })

    fireEvent.click(screen.getByText('stub-complete'))
    fireEvent.click(screen.getByRole('button', { name: 'Slutför kontroll' }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        'Kunde inte slutföra kontrollen',
        { description: 'Something broke' }
      )
    })

    // Dialog still mounted + status unchanged.
    expect(screen.getByText('Slutför kontrollen?')).toBeInTheDocument()
    expect(screen.getByTestId('stub-dropdown')).toHaveAttribute(
      'data-status',
      ComplianceCycleStatus.PAGAENDE
    )
  })

  it('click "Återställ" (canRevert=true, AVSLUTAD) → dialog opens → confirm reverts', async () => {
    revertCycleToPagaendeMock.mockResolvedValue({
      success: true,
      data: {
        cycle: makeCycle(ComplianceCycleStatus.PAGAENDE),
      },
    })

    renderPage({
      status: ComplianceCycleStatus.AVSLUTAD,
      canRevert: true,
    })

    fireEvent.click(screen.getByText('stub-revert'))
    expect(screen.getByText('Återställ kontrollen?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Återställ' }))

    await waitFor(() => {
      expect(revertCycleToPagaendeMock).toHaveBeenCalledWith(CYCLE_ID)
    })
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(
        'Kontrollen är återställd till Pågående'
      )
    })
    await waitFor(() => {
      expect(screen.getByTestId('stub-dropdown')).toHaveAttribute(
        'data-status',
        ComplianceCycleStatus.PAGAENDE
      )
    })
  })

  it('canRevert=false + AVSLUTAD → revert stub button is disabled (no dialog open)', async () => {
    renderPage({
      status: ComplianceCycleStatus.AVSLUTAD,
      canRevert: false,
    })

    const revertBtn = screen.getByText('stub-revert')
    expect(revertBtn).toBeDisabled()

    // Clicking disabled button is a no-op (browser + React behavior).
    fireEvent.click(revertBtn)
    expect(screen.queryByText('Återställ kontrollen?')).toBeNull()
    expect(revertCycleToPagaendeMock).not.toHaveBeenCalled()
  })
})
