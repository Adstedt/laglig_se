/**
 * Story 21.9 — CycleDetailPage seal integration tests (AC 14).
 *
 * Pattern mirrors cycle-detail-page-lifecycle.test.tsx: stubs the dropdown
 * to expose click markers and asserts on the dialog → server-action →
 * localCycle-update pipeline.
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
  FindingType,
} from '@prisma/client'
import type { CycleDetail } from '@/app/actions/compliance-audit-cycle'
import type {
  CycleItemRow,
  CyclePartial,
} from '@/app/actions/compliance-audit-item'
import type { FindingRow } from '@/app/actions/compliance-finding'

// ============================================================================
// Mocks — before importing the module under test.
// ============================================================================

const sealCycleMock = vi.fn()
const getDraftEvidenceDocumentsMock = vi.fn()
vi.mock('@/app/actions/compliance-audit-cycle', async () => {
  const actual = await vi.importActual<
    typeof import('@/app/actions/compliance-audit-cycle')
  >('@/app/actions/compliance-audit-cycle')
  return {
    ...actual,
    sealCycle: (...args: unknown[]) => sealCycleMock(...args),
    getDraftEvidenceDocuments: (...args: unknown[]) =>
      getDraftEvidenceDocumentsMock(...args),
    completeCycle: vi.fn(),
    revertCycleToPagaende: vi.fn(),
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

vi.mock('@/components/features/compliance-audit/cycle-item-modal', () => ({
  CycleItemModal: () => null,
}))

// Stub the dropdown — expose click markers for each affordance.
vi.mock(
  '@/components/features/compliance-audit/cycle-detail/cycle-actions-dropdown',
  () => ({
    CycleActionsDropdown: ({
      canSeal,
      onSealClick,
    }: {
      canSeal: boolean
      onSealClick: () => void
      cycle: unknown
      canRevert: boolean
      onCompleteClick: () => void
      onRevertClick: () => void
    }) => (
      <button data-testid="stub-seal" onClick={onSealClick} disabled={!canSeal}>
        stub-seal
      </button>
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

function makeItem(id: string): CycleItemRow {
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
    signedOffAt: new Date(),
    signedOffBy: { id: 'u1', name: 'Alice' },
    kravpunkterSnapshot: null,
    businessContext: null,
  } as CycleItemRow
}

function makeFinding(
  id: string,
  type: FindingType,
  closed: boolean
): FindingRow {
  return {
    id,
    cycleId: CYCLE_ID,
    type,
    severity: type === FindingType.AVVIKELSE ? 'MINOR' : null,
    title: `Finding ${id}`,
    description: 'desc',
    rootCause: null,
    lawListItemId: null,
    requirementId: null,
    correctiveActionTaskId: null,
    dueDate: null,
    closedAt: closed ? new Date() : null,
    closedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as FindingRow
}

function makeCyclePartial(status: ComplianceCycleStatus): CyclePartial {
  return { id: CYCLE_ID, status, name: 'Q2 revision', sealHash: null }
}

function renderPage(
  opts: {
    status?: ComplianceCycleStatus
    findings?: FindingRow[]
    canSeal?: boolean
  } = {}
) {
  const status = opts.status ?? ComplianceCycleStatus.AVSLUTAD
  const cycle = makeCycle(status)
  const items = [makeItem('a'), makeItem('b')]
  const findings = opts.findings ?? []

  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <CycleDetailPage
        cycle={cycle}
        items={items}
        initialFindings={findings}
        cyclePartial={makeCyclePartial(status)}
        readOnly={false}
        canRevert={false}
        canSeal={opts.canSeal ?? true}
      />
    </SWRConfig>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getCycleItemsForCycleMock.mockResolvedValue({
    success: true,
    data: {
      items: [],
      cycle: makeCyclePartial(ComplianceCycleStatus.AVSLUTAD),
    },
  })
  listFindingsForCycleMock.mockResolvedValue({
    success: true,
    data: { findings: [] },
  })
  getDraftEvidenceDocumentsMock.mockResolvedValue({
    success: true,
    data: { draftDocuments: [] },
  })
})

afterEach(() => {
  cleanup()
})

// ============================================================================
// Tests
// ============================================================================

describe('CycleDetailPage — seal integration (Story 21.9)', () => {
  it('click stub-seal → dialog opens (no blocking → no textarea)', async () => {
    renderPage()
    fireEvent.click(screen.getByTestId('stub-seal'))
    expect(screen.getByText('Fastställ kontrollen?')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Motivering för fastställande/)).toBeNull()
  })

  it('happy path — no open avvikelser → sealCycle called with no overrideReason → SEALED', async () => {
    sealCycleMock.mockResolvedValue({
      success: true,
      data: {
        cycle: makeCycle(ComplianceCycleStatus.SEALED, {
          sealHash: 'x'.repeat(64),
          sealedAt: new Date(),
          sealedBy: { id: 'u1', name: 'Alice' },
        }),
      },
    })
    renderPage()
    fireEvent.click(screen.getByTestId('stub-seal'))
    // Type-to-confirm gate (added in QA polish pass) — required on every seal.
    const confirmInput = screen.getByLabelText(/Skriv .* för att bekräfta/)
    fireEvent.change(confirmInput, { target: { value: 'FASTSTÄLL' } })
    const primary = screen.getByRole('button', { name: /Fastställ kontroll/ })
    fireEvent.click(primary)

    await waitFor(() => expect(sealCycleMock).toHaveBeenCalledTimes(1))
    expect(sealCycleMock).toHaveBeenCalledWith({ cycleId: CYCLE_ID })
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith('Kontrollen är fastställd')
    )
    // Dialog should close
    await waitFor(() =>
      expect(screen.queryByText('Fastställ kontrollen?')).toBeNull()
    )
  })

  it('open avvikelse + valid override → sealCycle called WITH overrideReason', async () => {
    sealCycleMock.mockResolvedValue({
      success: true,
      data: {
        cycle: makeCycle(ComplianceCycleStatus.SEALED),
      },
    })
    const findings = [
      makeFinding('f1', FindingType.AVVIKELSE, false), // open avvikelse
    ]
    renderPage({ findings })
    fireEvent.click(screen.getByTestId('stub-seal'))

    // Override textarea is rendered (openAvvikelser non-empty)
    const textarea = screen.getByLabelText(
      /Motivera varför kontrollen fastställs/
    )
    const override = 'Åtgärdsplan pågår och hanteras i Q2-cykeln.'
    fireEvent.change(textarea, { target: { value: override } })
    // Type-to-confirm gate also required on the override path.
    const confirmInput = screen.getByLabelText(/Skriv .* för att bekräfta/)
    fireEvent.change(confirmInput, { target: { value: 'FASTSTÄLL' } })

    fireEvent.click(screen.getByRole('button', { name: /Fastställ kontroll/ }))
    await waitFor(() => expect(sealCycleMock).toHaveBeenCalledTimes(1))
    expect(sealCycleMock).toHaveBeenCalledWith({
      cycleId: CYCLE_ID,
      overrideReason: override,
    })
  })

  it('error path → sealCycle returns failure → error toast + dialog stays open', async () => {
    sealCycleMock.mockResolvedValue({
      success: false,
      error: 'Kontrollens status ändrades under fastställandet. Försök igen.',
    })
    renderPage()
    fireEvent.click(screen.getByTestId('stub-seal'))
    // Type-to-confirm gate.
    const confirmInput = screen.getByLabelText(/Skriv .* för att bekräfta/)
    fireEvent.change(confirmInput, { target: { value: 'FASTSTÄLL' } })
    fireEvent.click(screen.getByRole('button', { name: /Fastställ kontroll/ }))

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        'Kunde inte fastställa kontrollen',
        expect.objectContaining({
          description:
            'Kontrollens status ändrades under fastställandet. Försök igen.',
        })
      )
    )
    // Dialog stays open
    expect(screen.getByText('Fastställ kontrollen?')).toBeInTheDocument()
  })

  it('v0.5: DRAFT doc in scope + valid override → sealCycle called WITH overrideReason', async () => {
    getDraftEvidenceDocumentsMock.mockResolvedValue({
      success: true,
      data: {
        draftDocuments: [
          {
            id: 'doc-draft-1',
            title: 'Brandskyddsrutin v3 (utkast)',
            contextLabel: 'AFS 2020:1 Arbetsplatsens utformning',
          },
        ],
      },
    })
    sealCycleMock.mockResolvedValue({
      success: true,
      data: { cycle: makeCycle(ComplianceCycleStatus.SEALED) },
    })
    renderPage()
    fireEvent.click(screen.getByTestId('stub-seal'))

    // Draft doc title surfaces in DraftDocumentsOverridePanel (wait for SWR).
    await waitFor(() =>
      expect(
        screen.getByText('Brandskyddsrutin v3 (utkast)')
      ).toBeInTheDocument()
    )

    // Override textarea is rendered (draftDocuments non-empty) and its label
    // calls out utkast-styrdokument specifically.
    const textarea = screen.getByLabelText(
      /Motivera varför kontrollen fastställs trots ett utkast-styrdokument/
    )
    const override = 'Utkastet är referensmaterial utanför auditomfattningen.'
    fireEvent.change(textarea, { target: { value: override } })

    const confirmInput = screen.getByLabelText(/Skriv .* för att bekräfta/)
    fireEvent.change(confirmInput, { target: { value: 'FASTSTÄLL' } })

    fireEvent.click(screen.getByRole('button', { name: /Fastställ kontroll/ }))
    await waitFor(() => expect(sealCycleMock).toHaveBeenCalledTimes(1))
    expect(sealCycleMock).toHaveBeenCalledWith({
      cycleId: CYCLE_ID,
      overrideReason: override,
    })
  })

  it('canSeal=false → stub-seal button disabled; clicking does not open dialog', () => {
    renderPage({ canSeal: false })
    const stubButton = screen.getByTestId('stub-seal')
    expect(stubButton).toBeDisabled()
    fireEvent.click(stubButton)
    expect(screen.queryByText('Fastställ kontrollen?')).toBeNull()
    expect(sealCycleMock).not.toHaveBeenCalled()
  })
})
