/** Story 21.7 — CycleFindingsTab component tests (AC 19). */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from '@testing-library/react'
import { FindingSeverity, FindingType } from '@prisma/client'
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
        items={makeItems()}
        onFindingMutation={vi.fn()}
      />
    )
    expect(screen.getByText('Saknad utbildningsplan')).toBeInTheDocument()
    expect(screen.getByText('Observation 2')).toBeInTheDocument()
    expect(screen.getByText('Förbättring 3')).toBeInTheDocument()
    // Every open finding shows the "Öppen" status badge.
    expect(screen.getAllByText('Öppen').length).toBe(3)
  })

  it('empty state when findings is empty', () => {
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={[]}
        readOnly={false}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )
    expect(
      screen.getByText('Inga findings registrerade ännu.')
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
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )
    expect(
      screen.queryByTestId('cycle-findings-add-button')
    ).not.toBeInTheDocument()
    expect(screen.getByText(/Denna kontroll är förseglad/)).toBeInTheDocument()
  })

  it('single-open accordion: expanding row B collapses row A', () => {
    const findings = [
      makeFinding({ id: 'f-1', title: 'First' }),
      makeFinding({ id: 'f-2', title: 'Second' }),
    ]
    render(
      <CycleFindingsTab
        cycleId={CYCLE_ID}
        findings={findings}
        readOnly={false}
        items={[]}
        onFindingMutation={vi.fn()}
      />
    )
    const buttons = screen.getAllByRole('button', { name: 'Visa detaljer' })
    fireEvent.click(buttons[0]!)
    // After expanding row 1, its chevron flips.
    let hiddenButtons = screen.getAllByRole('button', {
      name: 'Dölj detaljer',
    })
    expect(hiddenButtons.length).toBe(1)

    // Expand row 2: row 1 collapses.
    const nextButtons = screen.getAllByRole('button', {
      name: 'Visa detaljer',
    })
    fireEvent.click(nextButtons[0]!)
    hiddenButtons = screen.getAllByRole('button', { name: 'Dölj detaljer' })
    expect(hiddenButtons.length).toBe(1)
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
