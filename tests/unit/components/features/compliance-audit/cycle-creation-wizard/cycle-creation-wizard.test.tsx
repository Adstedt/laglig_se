/**
 * Story 21.4 — CycleCreationWizard component tests.
 * Covers AC 13 wizard block + a11y + stale-scope escape hatch (SF-1).
 *
 * Mock strategy: stub ScopeSelector with a minimal button-only component so
 * the test focuses on wizard orchestration, not ScopeSelector internals
 * (Story 21.3 has its own 50-test suite for that).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuditType } from '@prisma/client'
import type {
  DocumentListSummary,
  WorkspaceMemberOption,
} from '@/app/actions/document-list'
import type { ScopeDefinition } from '@/app/actions/compliance-audit-cycle'

// ============================================================================
// Mocks
// ============================================================================

const routerPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, refresh: vi.fn() }),
}))

const createCycleMock = vi.fn()
const materialiseCycleItemsMock = vi.fn()
const softDeleteCycleMock = vi.fn()
vi.mock('@/app/actions/compliance-audit-cycle', () => ({
  createCycle: (...args: unknown[]) => createCycleMock(...args),
  materialiseCycleItems: (...args: unknown[]) =>
    materialiseCycleItemsMock(...args),
  softDeleteCycle: (...args: unknown[]) => softDeleteCycleMock(...args),
}))

// Stub DatePicker — Story 22.6 swapped native <input type="date"> for a popover
// + Calendar trigger, which can't be driven by user.type. Mock with a plain
// date input so fillStep1 can fireEvent.change the ISO string directly.
vi.mock('@/components/ui/date-picker', async () => {
  const React = await import('react')
  function MockDatePicker(props: {
    id?: string
    value: Date | null
    onChange: (_d: Date | null) => void
    invalid?: boolean
  }) {
    return React.createElement('input', {
      type: 'date',
      id: props.id,
      'aria-invalid': props.invalid ? 'true' : 'false',
      value: props.value ? props.value.toISOString().slice(0, 10) : '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value
        props.onChange(v ? new Date(`${v}T00:00:00`) : null)
      },
    })
  }
  return {
    DatePicker: MockDatePicker,
    parseISODate: (s: string | null | undefined) =>
      s ? new Date(`${s}T00:00:00`) : null,
    toISODate: (d: Date | null) => (d ? d.toISOString().slice(0, 10) : ''),
  }
})

// Stub ScopeSelector — wizard test only cares about the orchestration flow.
vi.mock('@/components/features/compliance-audit/scope-selector', async () => {
  const React = await import('react')
  function MockScopeSelector(props: {
    listId: string
    value?: ScopeDefinition
    onChange: (_s: ScopeDefinition) => void
  }) {
    return React.createElement(
      'div',
      { 'data-testid': 'mock-scope-selector' },
      React.createElement('span', null, `list:${props.listId}`),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => props.onChange({ kind: 'all' }),
        },
        'Emit all'
      )
    )
  }
  return { ScopeSelector: MockScopeSelector }
})

// ============================================================================
// Component under test (imported AFTER mocks)
// ============================================================================

import { CycleCreationWizard } from '@/components/features/compliance-audit/cycle-creation-wizard/CycleCreationWizard'

// ============================================================================
// Fixtures
// ============================================================================

const LAW_LIST_ID = '33333333-3333-4333-8333-333333333333'
const LEAD_AUDITOR_ID = '44444444-4444-4444-8444-444444444444'
const CYCLE_ID = '55555555-5555-4555-8555-555555555555'

const LAW_LISTS: DocumentListSummary[] = [
  {
    id: LAW_LIST_ID,
    name: 'Huvudlista',
    description: null,
    isDefault: true,
    itemCount: 42,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
]

const MEMBERS: WorkspaceMemberOption[] = [
  {
    id: LEAD_AUDITOR_ID,
    name: 'Anna Andersson',
    email: 'anna@example.com',
    avatarUrl: null,
  },
]

async function fillStep1(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Namn'), 'Årsrevision 2026')
  await user.click(screen.getByRole('combobox', { name: /Laglista/i }))
  await user.click(screen.getByRole('option', { name: /Huvudlista/i }))
  // auditType pre-populated to INTERN in INITIAL_STATE; no toggle click needed.

  const startInput = screen.getByLabelText('Startdatum')
  const endInput = screen.getByLabelText('Slutdatum')
  const cutoffInput = screen.getByLabelText(/Brytdatum/i)
  fireEvent.change(startInput, { target: { value: '2026-05-01' } })
  fireEvent.change(endInput, { target: { value: '2026-05-31' } })
  fireEvent.change(cutoffInput, { target: { value: '2026-04-30' } })

  await user.click(screen.getByRole('combobox', { name: /Ansvarig revisor/i }))
  await user.click(screen.getByRole('option', { name: /Anna Andersson/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  createCycleMock.mockResolvedValue({
    success: true,
    data: { cycle: { id: CYCLE_ID } },
  })
  materialiseCycleItemsMock.mockResolvedValue({
    success: true,
    data: { itemCount: 42 },
  })
  softDeleteCycleMock.mockResolvedValue({ success: true })
})

// ============================================================================
// Tests
// ============================================================================

describe('CycleCreationWizard', () => {
  it('step indicator uses role="status" aria-live="polite" (a11y AC 12)', () => {
    render(<CycleCreationWizard lawLists={LAW_LISTS} members={MEMBERS} />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent(/Steg 1 av 3/i)
  })

  it('step-1 Nästa disabled until all required fields set (a11y + validation)', () => {
    render(<CycleCreationWizard lawLists={LAW_LISTS} members={MEMBERS} />)
    const next = screen.getByRole('button', { name: /Nästa/i })
    expect(next).toBeDisabled()
  })

  it('step-1 Name field has programmatic label + aria-invalid wiring slot', () => {
    render(<CycleCreationWizard lawLists={LAW_LISTS} members={MEMBERS} />)
    const input = screen.getByLabelText('Namn')
    // No error at initial render
    expect(input).toHaveAttribute('aria-invalid', 'false')
  })

  it('happy path: fill → Nästa → emit scope → Nästa → submit → redirects', async () => {
    const user = userEvent.setup()
    render(<CycleCreationWizard lawLists={LAW_LISTS} members={MEMBERS} />)

    await fillStep1(user)
    await user.click(screen.getByRole('button', { name: /Nästa/i }))

    // Step 2: ScopeSelector stub emits {kind: 'all'}
    expect(screen.getByTestId('mock-scope-selector')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Emit all/i }))
    await user.click(screen.getByRole('button', { name: /Nästa/i }))

    // Step 3: confirm + submit
    expect(screen.getByText(/Omfattning/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Skapa kontroll/i }))

    expect(createCycleMock).toHaveBeenCalledTimes(1)
    expect(createCycleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lawListId: LAW_LIST_ID,
        name: 'Årsrevision 2026',
        auditType: AuditType.INTERN,
        leadAuditorUserId: LEAD_AUDITOR_ID,
        scopeDefinition: { kind: 'all' },
      })
    )
    expect(materialiseCycleItemsMock).toHaveBeenCalledWith(CYCLE_ID)
    expect(routerPush).toHaveBeenCalledWith(`/laglistor/kontroller/${CYCLE_ID}`)
  })

  it('step-2 Nästa disabled until scope emitted', async () => {
    const user = userEvent.setup()
    render(<CycleCreationWizard lawLists={LAW_LISTS} members={MEMBERS} />)

    await fillStep1(user)
    await user.click(screen.getByRole('button', { name: /Nästa/i }))

    // On Step 2 before emission
    const nextBtn = screen.getByRole('button', { name: /Nästa/i })
    expect(nextBtn).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Emit all/i }))
    expect(screen.getByRole('button', { name: /Nästa/i })).toBeEnabled()
  })

  it('createCycle failure → error shown, no redirect, retry re-runs both', async () => {
    createCycleMock
      .mockResolvedValueOnce({
        success: false,
        error: 'Kunde inte skapa kontrollen',
      })
      .mockResolvedValueOnce({
        success: true,
        data: { cycle: { id: CYCLE_ID } },
      })

    const user = userEvent.setup()
    render(<CycleCreationWizard lawLists={LAW_LISTS} members={MEMBERS} />)
    await fillStep1(user)
    await user.click(screen.getByRole('button', { name: /Nästa/i }))
    await user.click(screen.getByRole('button', { name: /Emit all/i }))
    await user.click(screen.getByRole('button', { name: /Nästa/i }))
    await user.click(screen.getByRole('button', { name: /Skapa kontroll/i }))

    expect(
      await screen.findByText(/Kunde inte skapa kontrollen/i)
    ).toBeInTheDocument()
    expect(routerPush).not.toHaveBeenCalled()

    // Click Försök igen — re-runs both actions
    await user.click(screen.getByRole('button', { name: /Försök igen/i }))
    expect(createCycleMock).toHaveBeenCalledTimes(2)
    expect(materialiseCycleItemsMock).toHaveBeenCalledTimes(1)
  })

  it('materialise failure (non-empty-scope) → retry calls ONLY materialise, not createCycle', async () => {
    materialiseCycleItemsMock
      .mockResolvedValueOnce({
        success: false,
        error: 'Något gick fel',
      })
      .mockResolvedValueOnce({
        success: true,
        data: { itemCount: 42 },
      })

    const user = userEvent.setup()
    render(<CycleCreationWizard lawLists={LAW_LISTS} members={MEMBERS} />)
    await fillStep1(user)
    await user.click(screen.getByRole('button', { name: /Nästa/i }))
    await user.click(screen.getByRole('button', { name: /Emit all/i }))
    await user.click(screen.getByRole('button', { name: /Nästa/i }))
    await user.click(screen.getByRole('button', { name: /Skapa kontroll/i }))

    expect(await screen.findByText(/Något gick fel/i)).toBeInTheDocument()

    // Click retry — should NOT re-create the cycle
    await user.click(screen.getByRole('button', { name: /Försök igen/i }))
    expect(createCycleMock).toHaveBeenCalledTimes(1) // not re-called
    expect(materialiseCycleItemsMock).toHaveBeenCalledTimes(2)
    expect(routerPush).toHaveBeenCalledWith(`/laglistor/kontroller/${CYCLE_ID}`)
  })

  it('stale-scope escape hatch (SF-1): empty-scope error shows BOTH buttons, "Ta bort och börja om" soft-deletes + returns to Step 2', async () => {
    materialiseCycleItemsMock.mockResolvedValueOnce({
      success: false,
      error: 'Omfattningen matchar inga dokument',
    })

    const user = userEvent.setup()
    render(<CycleCreationWizard lawLists={LAW_LISTS} members={MEMBERS} />)
    await fillStep1(user)
    await user.click(screen.getByRole('button', { name: /Nästa/i }))
    await user.click(screen.getByRole('button', { name: /Emit all/i }))
    await user.click(screen.getByRole('button', { name: /Nästa/i }))
    await user.click(screen.getByRole('button', { name: /Skapa kontroll/i }))

    // Both retry AND discard buttons visible
    expect(
      await screen.findByRole('button', { name: /Försök igen/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Ta bort och börja om/i })
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /Ta bort och börja om/i })
    )

    expect(softDeleteCycleMock).toHaveBeenCalledWith(CYCLE_ID)
    // Back to Step 2 — scope-selector mock visible again; name metadata preserved
    expect(await screen.findByTestId('mock-scope-selector')).toBeInTheDocument()
  })

  it('stale-scope escape hatch (SF-1): softDeleteCycle failure → both buttons stay available', async () => {
    materialiseCycleItemsMock.mockResolvedValueOnce({
      success: false,
      error: 'Omfattningen matchar inga dokument',
    })
    softDeleteCycleMock.mockResolvedValueOnce({
      success: false,
      error: 'Kunde inte ta bort kontrollen',
    })

    const user = userEvent.setup()
    render(<CycleCreationWizard lawLists={LAW_LISTS} members={MEMBERS} />)
    await fillStep1(user)
    await user.click(screen.getByRole('button', { name: /Nästa/i }))
    await user.click(screen.getByRole('button', { name: /Emit all/i }))
    await user.click(screen.getByRole('button', { name: /Nästa/i }))
    await user.click(screen.getByRole('button', { name: /Skapa kontroll/i }))

    await user.click(
      await screen.findByRole('button', { name: /Ta bort och börja om/i })
    )

    expect(
      await screen.findByText(/Kunde inte ta bort kontrollen/i)
    ).toBeInTheDocument()
    // Both buttons still rendered
    expect(
      screen.getByRole('button', { name: /Försök igen/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Ta bort och börja om/i })
    ).toBeInTheDocument()
  })

  it('empty state: zero law lists → blocking empty-state + link to /laglistor', () => {
    render(<CycleCreationWizard lawLists={[]} members={MEMBERS} />)
    expect(screen.getByText(/Skapa först en laglista/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Till laglistor/i })
    expect(link).toHaveAttribute('href', '/laglistor')
  })
})
