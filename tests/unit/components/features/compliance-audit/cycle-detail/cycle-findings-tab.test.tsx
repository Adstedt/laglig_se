/** Story 21.7 — CycleFindingsTab component tests (AC 19). */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from '@testing-library/react'
import {
  ComplianceCycleStatus,
  FindingSeverity,
  FindingType,
} from '@prisma/client'
import type { CycleItemRow } from '@/app/actions/compliance-audit-item'
import type { FindingRow } from '@/app/actions/compliance-finding'

// Mock server actions + sonner BEFORE importing the component.
const closeFindingMock = vi.fn()
const reopenFindingMock = vi.fn()
const createFindingMock = vi.fn()
const updateFindingMock = vi.fn()
const spawnTaskForFindingMock = vi.fn()

vi.mock('@/app/actions/compliance-finding', () => ({
  closeFinding: (...args: unknown[]) => closeFindingMock(...args),
  reopenFinding: (...args: unknown[]) => reopenFindingMock(...args),
  createFinding: (...args: unknown[]) => createFindingMock(...args),
  updateFinding: (...args: unknown[]) => updateFindingMock(...args),
  spawnTaskForFinding: (...args: unknown[]) => spawnTaskForFindingMock(...args),
}))

const toastErrorMock = vi.fn()
const toastSuccessMock = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}))

import { CycleFindingsTab } from '@/components/features/compliance-audit/cycle-detail'

// ============================================================================
// Fixtures
// ============================================================================

const CYCLE_ID = 'c-1'

function makeFinding(overrides: Partial<FindingRow> = {}): FindingRow {
  return {
    id: 'f-1',
    cycleId: CYCLE_ID,
    type: FindingType.OBSERVATION,
    severity: null,
    title: 'Test finding',
    description: 'Body',
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
    createdAt: new Date('2026-04-22T10:00:00Z'),
    updatedAt: new Date('2026-04-22T10:00:00Z'),
    ...overrides,
  }
}

function makeItems(): CycleItemRow[] {
  return [
    {
      id: 'ci-1',
      lawListItemId: 'li-1',
      lawTitle: 'Miljöbalken',
      lawDocumentNumber: 'SFS 1998:808',
      groupId: null,
      groupName: null,
      sourceComplianceStatus: 'EJ_PABORJAD',
      sourceResponsibleUser: null,
      efterlevnadsbedomning: null,
      motivering: null,
      reviewedAt: null,
      reviewedBy: null,
      signedOffAt: null,
      signedOffBy: null,
      kravpunkterSnapshot: null,
    } as unknown as CycleItemRow,
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

// ============================================================================
// Tests
// ============================================================================

describe('CycleFindingsTab', () => {
  it('renders all findings with type badge + title + status', () => {
    const findings = [
      makeFinding({
        id: 'f-1',
        type: FindingType.AVVIKELSE,
        severity: FindingSeverity.MAJOR,
        title: 'Saknad utbildningsplan',
      }),
      makeFinding({ id: 'f-2', title: 'Observation 2' }),
      makeFinding({
        id: 'f-3',
        type: FindingType.FORBATTRING,
        title: 'Förbättring 3',
      }),
    ]
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={findings}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={makeItems()}
        onFindingMutation={vi.fn()}
      />
    )
    expect(screen.getByText('Saknad utbildningsplan')).toBeInTheDocument()
    expect(screen.getByText('Observation 2')).toBeInTheDocument()
    expect(screen.getByText('Förbättring 3')).toBeInTheDocument()
    // Story 21.16 — FindingCard renders type pills; open findings don't carry
    // an explicit "Öppen" badge (closed is the exception). Assert type pills
    // instead.
    expect(screen.getAllByText('Avvikelse').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Observation').length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getAllByText('Förbättringsförslag').length
    ).toBeGreaterThanOrEqual(1)
  })

  it('empty state when findings is empty', () => {
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[]}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )
    expect(
      screen.getByText('Inga anmärkningar registrerade ännu.')
    ).toBeInTheDocument()
  })

  it('type filter narrows the list via useMemo (no refetch)', () => {
    const findings = [
      makeFinding({
        id: 'f-1',
        type: FindingType.AVVIKELSE,
        severity: FindingSeverity.MAJOR,
        title: 'A1',
      }),
      makeFinding({ id: 'f-2', title: 'O1' }),
    ]
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={findings}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )

    // Initially both visible.
    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.getByText('O1')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('finding-filter-type-AVVIKELSE'))

    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.queryByText('O1')).not.toBeInTheDocument()
  })

  it('severity filter appears only when type=Avvikelse', () => {
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[]}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )
    expect(
      screen.queryByTestId('finding-filter-severity-group')
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('finding-filter-type-AVVIKELSE'))

    expect(
      screen.getByTestId('finding-filter-severity-group')
    ).toBeInTheDocument()
  })

  it('"Lägg till finding" button hidden in read-only mode', () => {
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[]}
        readOnly
        cycleStatus={ComplianceCycleStatus.AVSLUTAD}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )
    expect(
      screen.queryByTestId('cycle-findings-add-button')
    ).not.toBeInTheDocument()
    // Banner copy is status-aware via getCycleReadOnlyReason — AVSLUTAD
    // surfaces revert guidance instead of the legacy "fastställd" string.
    expect(screen.getByText(/Kontrollen är avslutad/)).toBeInTheDocument()
  })

  it('Story 21.16 — clicking a finding card body fires onFindingClick with the finding', () => {
    const onFindingClick = vi.fn()
    const findings = [
      makeFinding({ id: 'f-1', title: 'First' }),
      makeFinding({ id: 'f-2', title: 'Second' }),
    ]
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={findings}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
        onFindingClick={onFindingClick}
      />
    )
    // Click the first card body via its data-testid.
    const firstCard = screen.getByTestId('finding-card-f-1')
    fireEvent.click(firstCard)
    expect(onFindingClick).toHaveBeenCalledTimes(1)
    expect(onFindingClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'f-1', title: 'First' })
    )
  })

  it('Story 21.16 — inline action buttons do NOT trigger onFindingClick', () => {
    const onFindingClick = vi.fn()
    closeFindingMock.mockResolvedValue({
      success: true,
      data: { finding: makeFinding({ id: 'f-1', closedAt: new Date() }) },
    })
    const findings = [makeFinding({ id: 'f-1', title: 'First' })]
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={findings}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
        onFindingClick={onFindingClick}
      />
    )
    // Clicking the close button (inline action) should NOT bubble to
    // onFindingClick.
    fireEvent.click(screen.getByTestId('cycle-finding-close-f-1'))
    expect(onFindingClick).not.toHaveBeenCalled()
  })

  it('virtualisation kicks in when findings.length > 50', () => {
    const findings = Array.from({ length: 51 }, (_, i) =>
      makeFinding({ id: `f-${i}`, title: `Title ${i}` })
    )
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={findings}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )
    expect(screen.getByTestId('virtualized-findings-list')).toBeInTheDocument()
  })

  it('close button triggers closeFinding action and onFindingMutation on success', async () => {
    const onFindingMutation = vi.fn()
    const finding = makeFinding({ title: 'To close' })
    closeFindingMock.mockResolvedValue({
      success: true,
      data: {
        finding: {
          ...finding,
          closedAt: new Date(),
        },
      },
    })

    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[finding]}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={onFindingMutation}
      />
    )

    fireEvent.click(screen.getByTestId(`cycle-finding-close-${finding.id}`))
    await vi.waitFor(() => {
      expect(closeFindingMock).toHaveBeenCalledWith({ findingId: finding.id })
      expect(onFindingMutation).toHaveBeenCalled()
    })
  })

  it('open finding row CTA reads "Markera som åtgärdat" (reframing)', () => {
    const finding = makeFinding({ title: 'Reframe label test' })
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[finding]}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )
    const btn = screen.getByTestId(`cycle-finding-close-${finding.id}`)
    expect(btn.textContent).toBe('Markera som åtgärdat')
    // Legacy text must NOT regress.
    expect(btn.textContent).not.toBe('Stäng')
  })

  it('150-finding microtest: initial render ≤ 1500ms (IV3)', () => {
    const findings = Array.from({ length: 150 }, (_, i) =>
      makeFinding({ id: `f-${i}`, title: `Title ${i}` })
    )
    const t0 = performance.now()
    const { container } = render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={findings}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )
    const elapsed = performance.now() - t0
    expect(
      container.querySelector('[data-testid="virtualized-findings-list"]')
    ).not.toBeNull()
    expect(elapsed).toBeLessThan(1500)
  })
})

describe('CycleFindingsTab — spawn-task late-add (Epic 21 follow-up)', () => {
  it('+ Skapa åtgärdsuppgift button visible on open AVVIKELSE without a task', () => {
    const finding = makeFinding({
      id: 'fav',
      type: FindingType.AVVIKELSE,
      severity: FindingSeverity.MAJOR,
      correctiveActionTaskId: null,
    })
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[finding]}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )
    expect(
      screen.getByTestId(`cycle-finding-spawn-task-${finding.id}`)
    ).toBeInTheDocument()
  })

  it('+ Skapa åtgärdsuppgift button visible on open OBSERVATION without a task (any type)', () => {
    const finding = makeFinding({
      id: 'fobs',
      type: FindingType.OBSERVATION,
      correctiveActionTaskId: null,
    })
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[finding]}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )
    expect(
      screen.getByTestId(`cycle-finding-spawn-task-${finding.id}`)
    ).toBeInTheDocument()
  })

  it('+ Skapa åtgärdsuppgift button hidden when finding already has a task', () => {
    const finding = makeFinding({
      id: 'fhas',
      type: FindingType.AVVIKELSE,
      severity: FindingSeverity.MAJOR,
      correctiveActionTaskId: 'existing-task-id',
    })
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[finding]}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )
    expect(
      screen.queryByTestId(`cycle-finding-spawn-task-${finding.id}`)
    ).not.toBeInTheDocument()
  })

  it('+ Skapa åtgärdsuppgift button hidden in read-only mode', () => {
    const finding = makeFinding({
      id: 'fro',
      type: FindingType.AVVIKELSE,
      severity: FindingSeverity.MAJOR,
      correctiveActionTaskId: null,
    })
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[finding]}
        readOnly
        cycleStatus={ComplianceCycleStatus.AVSLUTAD}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )
    expect(
      screen.queryByTestId(`cycle-finding-spawn-task-${finding.id}`)
    ).not.toBeInTheDocument()
  })

  it('clicking + Skapa åtgärdsuppgift calls spawnTaskForFinding + fires onFindingMutation', async () => {
    const onFindingMutation = vi.fn()
    const finding = makeFinding({
      id: 'fclick',
      type: FindingType.AVVIKELSE,
      severity: FindingSeverity.MAJOR,
      correctiveActionTaskId: null,
    })
    spawnTaskForFindingMock.mockResolvedValue({
      success: true,
      data: {
        finding: { ...finding, correctiveActionTaskId: 'spawned-task-id' },
      },
    })

    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[finding]}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={onFindingMutation}
      />
    )

    fireEvent.click(
      screen.getByTestId(`cycle-finding-spawn-task-${finding.id}`)
    )

    await vi.waitFor(() => {
      expect(spawnTaskForFindingMock).toHaveBeenCalledWith({
        findingId: finding.id,
      })
      expect(onFindingMutation).toHaveBeenCalled()
    })
  })
})

describe('CycleFindingsTab — verify step (Epic 21 follow-up)', () => {
  it('ready-to-verify finding renders amber "Redo att verifiera" badge', () => {
    const finding = makeFinding({
      id: 'frtv',
      type: FindingType.AVVIKELSE,
      severity: FindingSeverity.MAJOR,
      correctiveActionTaskId: 'task-1',
      correctiveActionTask: {
        id: 'task-1',
        title: 'Fix',
        completedAt: new Date('2026-05-15T10:00:00Z'),
      },
    })
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[finding]}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )
    expect(screen.getByText('Redo att verifiera')).toBeInTheDocument()
    // No "Öppen" or "Stängd" badge.
    expect(screen.queryByText('Stängd')).not.toBeInTheDocument()
  })

  it('ready-to-verify row shows "Verifiera" button instead of "Stäng"', () => {
    const finding = makeFinding({
      id: 'frtv',
      type: FindingType.AVVIKELSE,
      severity: FindingSeverity.MAJOR,
      correctiveActionTaskId: 'task-1',
      correctiveActionTask: {
        id: 'task-1',
        title: 'Fix',
        completedAt: new Date('2026-05-15T10:00:00Z'),
      },
    })
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[finding]}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )
    expect(
      screen.getByTestId(`cycle-finding-verify-${finding.id}`)
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId(`cycle-finding-close-${finding.id}`)
    ).not.toBeInTheDocument()
  })

  it('clicking Verifiera opens dialog with finding + task context', () => {
    const finding = makeFinding({
      id: 'frtv',
      title: 'Saknar utbildningsplan',
      type: FindingType.AVVIKELSE,
      severity: FindingSeverity.MAJOR,
      correctiveActionTaskId: 'task-1',
      correctiveActionTask: {
        id: 'task-1',
        title: 'Skriv utbildningsplan',
        completedAt: new Date('2026-05-15T10:00:00Z'),
      },
    })
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[finding]}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId(`cycle-finding-verify-${finding.id}`))
    const context = screen.getByTestId('verify-finding-context')
    expect(context.textContent).toContain('Saknar utbildningsplan')
    expect(context.textContent).toContain('Skriv utbildningsplan')
  })

  it('confirming verify calls closeFinding with verificationNote when set', async () => {
    const onFindingMutation = vi.fn()
    const finding = makeFinding({
      id: 'frtv',
      type: FindingType.AVVIKELSE,
      severity: FindingSeverity.MAJOR,
      correctiveActionTaskId: 'task-1',
      correctiveActionTask: {
        id: 'task-1',
        title: 'Fix',
        completedAt: new Date('2026-05-15T10:00:00Z'),
      },
    })
    closeFindingMock.mockResolvedValue({
      success: true,
      data: { finding: { ...finding, closedAt: new Date() } },
    })

    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[finding]}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={onFindingMutation}
      />
    )
    fireEvent.click(screen.getByTestId(`cycle-finding-verify-${finding.id}`))
    fireEvent.change(screen.getByTestId('verify-finding-note'), {
      target: { value: 'Granskade brandövningsplan' },
    })
    fireEvent.click(screen.getByTestId('verify-finding-submit'))

    await vi.waitFor(() => {
      expect(closeFindingMock).toHaveBeenCalledWith({
        findingId: finding.id,
        verificationNote: 'Granskade brandövningsplan',
      })
      expect(onFindingMutation).toHaveBeenCalled()
    })
  })
})

describe('CycleFindingsTab — type badge assertion helper', () => {
  it('shows Avvikelse type label for AVVIKELSE rows', () => {
    const findings = [
      makeFinding({
        type: FindingType.AVVIKELSE,
        severity: FindingSeverity.MAJOR,
      }),
    ]
    const { container } = render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={findings}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )
    // Use `within` scoped to the row to avoid ambiguity with the filter chips.
    const row = within(
      container.querySelector(`[data-testid="cycle-finding-row-f-1"]`)!
    )
    expect(row.getByText('Avvikelse')).toBeInTheDocument()
    // Severity badge for MAJOR = 'Större'.
    expect(row.getByText('Större')).toBeInTheDocument()
  })
})

// ============================================================================
// Manual-close fallback (Epic 21 follow-up — surfacing FINDING_REQUIRES_TASK_CLOSURE)
// ============================================================================
// Server-side `closeFinding` rejects with `FINDING_REQUIRES_TASK_CLOSURE` when
// a finding has an unfinished linked task. Prior behavior: dead-end toast.
// New behavior: the rejection opens a `ManualCloseFindingDialog` so the auditor
// can supply a `closeReason` (manual-override rationale) without leaving the
// surface. The reason becomes audit evidence in the activity log.

describe('CycleFindingsTab — manual-close fallback', () => {
  it('FINDING_REQUIRES_TASK_CLOSURE error opens the manual-close dialog (no toast)', async () => {
    const finding = makeFinding({
      type: FindingType.AVVIKELSE,
      severity: FindingSeverity.MAJOR,
      correctiveActionTaskId: 'task-1',
      correctiveActionTask: {
        id: 'task-1',
        title: 'Skriv utbildningsplan',
        completedAt: null, // Task NOT done — server will gate.
      },
    })
    closeFindingMock.mockResolvedValueOnce({
      success: false,
      error:
        'FINDING_REQUIRES_TASK_CLOSURE: Den kopplade uppgiften är inte klar. Slutför uppgiften eller ange en manuell anledning.',
    })

    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[finding]}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId(`cycle-finding-close-${finding.id}`))

    await vi.waitFor(() => {
      // Dialog is mounted with the finding's context.
      expect(
        screen.getByTestId('manual-close-finding-context')
      ).toBeInTheDocument()
    })
    // The toast.error must NOT fire on this gate — the dialog replaces it.
    expect(toastErrorMock).not.toHaveBeenCalled()
    // First call carried no closeReason (the trigger).
    expect(closeFindingMock).toHaveBeenNthCalledWith(1, {
      findingId: finding.id,
    })
  })

  it('confirming manual-close calls closeFinding with closeReason and fires onFindingMutation', async () => {
    const onFindingMutation = vi.fn()
    const finding = makeFinding({
      type: FindingType.AVVIKELSE,
      correctiveActionTaskId: 'task-1',
      correctiveActionTask: {
        id: 'task-1',
        title: 'Skriv utbildningsplan',
        completedAt: null,
      },
    })

    closeFindingMock
      .mockResolvedValueOnce({
        success: false,
        error: 'FINDING_REQUIRES_TASK_CLOSURE: blocked',
      })
      .mockResolvedValueOnce({
        success: true,
        data: { finding: { ...finding, closedAt: new Date() } },
      })

    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[finding]}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={onFindingMutation}
      />
    )

    fireEvent.click(screen.getByTestId(`cycle-finding-close-${finding.id}`))
    await vi.waitFor(() => {
      expect(
        screen.getByTestId('manual-close-finding-reason')
      ).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('manual-close-finding-reason'), {
      target: {
        value: 'Verksamheten har förändrats; kravet gäller inte längre.',
      },
    })
    fireEvent.click(screen.getByTestId('manual-close-finding-submit'))

    await vi.waitFor(() => {
      expect(closeFindingMock).toHaveBeenLastCalledWith({
        findingId: finding.id,
        closeReason: 'Verksamheten har förändrats; kravet gäller inte längre.',
      })
      expect(onFindingMutation).toHaveBeenCalled()
      expect(toastSuccessMock).toHaveBeenCalledWith(
        'Anmärkning markerad som åtgärdad med manuell anledning'
      )
    })
  })

  it('empty closeReason disables submit (required field)', async () => {
    const finding = makeFinding({
      type: FindingType.AVVIKELSE,
      correctiveActionTaskId: 'task-1',
      correctiveActionTask: {
        id: 'task-1',
        title: 'Fix',
        completedAt: null,
      },
    })
    closeFindingMock.mockResolvedValueOnce({
      success: false,
      error: 'FINDING_REQUIRES_TASK_CLOSURE: blocked',
    })

    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[finding]}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId(`cycle-finding-close-${finding.id}`))
    await vi.waitFor(() => {
      expect(
        screen.getByTestId('manual-close-finding-submit')
      ).toBeInTheDocument()
    })
    const submitBtn = screen.getByTestId('manual-close-finding-submit')
    expect(submitBtn).toBeDisabled()

    // Whitespace-only also disabled (trim guard).
    fireEvent.change(screen.getByTestId('manual-close-finding-reason'), {
      target: { value: '   ' },
    })
    expect(submitBtn).toBeDisabled()

    // Real text → enabled.
    fireEvent.change(screen.getByTestId('manual-close-finding-reason'), {
      target: { value: 'Giltig anledning' },
    })
    expect(submitBtn).not.toBeDisabled()
  })

  it('non-gate errors still surface as toast (no dialog)', async () => {
    const finding = makeFinding({ type: FindingType.OBSERVATION })
    closeFindingMock.mockResolvedValueOnce({
      success: false,
      error: 'PERMISSION_DENIED: Du saknar behörighet.',
    })

    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[finding]}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId(`cycle-finding-close-${finding.id}`))

    await vi.waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        'Kunde inte stänga anmärkning',
        expect.objectContaining({
          description: 'PERMISSION_DENIED: Du saknar behörighet.',
        })
      )
    })
    expect(
      screen.queryByTestId('manual-close-finding-context')
    ).not.toBeInTheDocument()
  })

  it('manual-close dialog renders updated title + CTA copy', async () => {
    const finding = makeFinding({
      type: FindingType.AVVIKELSE,
      correctiveActionTaskId: 'task-1',
      correctiveActionTask: {
        id: 'task-1',
        title: 'Skriv utbildningsplan',
        completedAt: null,
      },
    })
    closeFindingMock.mockResolvedValueOnce({
      success: false,
      error: 'FINDING_REQUIRES_TASK_CLOSURE: blocked',
    })
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[finding]}
        readOnly={false}
        cycleStatus={ComplianceCycleStatus.PAGAENDE}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId(`cycle-finding-close-${finding.id}`))

    await vi.waitFor(() => {
      expect(
        screen.getByText('Markera som åtgärdat utan slutförd uppgift')
      ).toBeInTheDocument()
    })
    expect(screen.getByTestId('manual-close-finding-submit').textContent).toBe(
      'Markera ändå'
    )
    // Legacy copy must not regress.
    expect(
      screen.queryByText('Stäng anmärkning utan slutförd åtgärd')
    ).toBeNull()
  })
})
