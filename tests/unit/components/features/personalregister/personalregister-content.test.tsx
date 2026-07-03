/**
 * Story 7.2 (QA TEST-001): component tests for the Personalregister client
 * island — `?anstalld=` URL wiring at the component boundary, the `'ny'`
 * sentinel, optimistic group-move rollback (per-row, QA REL-002) and the
 * groups-load-failure notice (QA REL-001).
 *
 * Story 7.3: extended for the Personalkort modal mount — modal receives the
 * selected row from island state (no refetch), stale/foreign `?anstalld=`
 * ids clear with a toast, and `onEmployeeChange` applies the optimistic
 * insert (sorted) / update to the row state.
 *
 * The heavy table child (dnd-kit + Radix) and the Personalkort modal are
 * stubbed with minimal fakes exposing the same props contract; hook-level
 * open/close/back-forward behavior is covered in use-anstalld-param.test.tsx,
 * and the real table's rendering in employee-list-table.test.tsx.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PersonalregisterContent } from '@/components/features/personalregister/personalregister-content'
import type { EmployeeRow } from '@/components/features/personalregister/employee-row'
import type { EmployeeGroupSummary } from '@/app/actions/employees'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}))

const mockMoveEmployeeToGroup = vi.fn()
vi.mock('@/app/actions/employees', () => ({
  moveEmployeeToGroup: (...args: unknown[]) => mockMoveEmployeeToGroup(...args),
}))

const mockToastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args) },
}))

vi.mock('@/components/features/personalregister/manage-groups-popover', () => ({
  ManageGroupsPopover: () => <div data-testid="manage-groups-popover" />,
}))

// Story 7.3: Personalkort modal stub at its props contract — renders the
// received id/row and buttons that fire onEmployeeChange/onClose so the
// island's optimistic insert/update wiring is observable.
vi.mock('@/components/features/personalregister/personalkort-modal', () => ({
  PersonalkortModal: ({
    anstalldId,
    row,
    onEmployeeChange,
    onClose,
  }: {
    anstalldId: string | null
    row: EmployeeRow | null
    onEmployeeChange: (_row: EmployeeRow, _mode: 'created' | 'updated') => void
    onClose: () => void
  }) => (
    <div data-testid="personalkort-modal">
      <span data-testid="modal-anstalld-id">{anstalldId ?? 'closed'}</span>
      <span data-testid="modal-row-id">{row?.id ?? 'none'}</span>
      <button
        onClick={() =>
          onEmployeeChange(
            {
              id: 'emp-created',
              first_name: 'Cesar',
              last_name: 'Aa',
              employee_id_ref: null,
              personnummer: null,
              personnummer_masked: false,
              personel_type: null,
              employment_form: null,
              salary_form: null,
              inactive: false,
              group_id: null,
              group: null,
              collective_agreement: null,
            } as unknown as EmployeeRow,
            'created'
          )
        }
      >
        modal-create
      </button>
      <button
        onClick={() =>
          row &&
          onEmployeeChange({ ...row, first_name: 'Uppdaterad' }, 'updated')
        }
      >
        modal-update
      </button>
      <button onClick={onClose}>modal-close</button>
    </div>
  ),
}))

// Minimal fake table: same props contract, renders each row's CURRENT group
// (from the parent's state) and buttons wired to the parent callbacks.
vi.mock('@/components/features/personalregister/employee-list-table', () => ({
  EmployeeListTable: ({
    allEmployees,
    employees,
    onRowClick,
    onMoveToGroup,
    onAddEmployee,
  }: {
    allEmployees: EmployeeRow[]
    employees: EmployeeRow[]
    onRowClick: (_id: string) => void
    onMoveToGroup: (_id: string, _groupId: string | null) => Promise<boolean>
    onAddEmployee?: () => void
  }) => (
    <div data-testid="employee-table">
      <span data-testid="visible-count">{employees.length}</span>
      {allEmployees.map((row) => (
        <div key={row.id}>
          <span data-testid={`group-of-${row.id}`}>
            {row.group?.name ?? 'Ogrupperad'}
          </span>
          <span data-testid={`name-of-${row.id}`}>{row.first_name}</span>
          <button onClick={() => onRowClick(row.id)}>open-{row.id}</button>
          <button onClick={() => onMoveToGroup(row.id, 'grp-2')}>
            move-{row.id}-to-grp-2
          </button>
        </div>
      ))}
      {onAddEmployee && <button onClick={onAddEmployee}>add-employee</button>}
    </div>
  ),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GROUPS: EmployeeGroupSummary[] = [
  { id: 'grp-1', name: 'Lager', position: 0, employeeCount: 1 },
  { id: 'grp-2', name: 'Huvudkontor', position: 1, employeeCount: 0 },
]

function makeRow(
  overrides: Partial<EmployeeRow> & { id: string }
): EmployeeRow {
  return {
    first_name: 'Anna',
    last_name: 'Svensson',
    employee_id_ref: 'A-1',
    personnummer: null,
    personnummer_masked: false,
    personel_type: null,
    employment_form: null,
    salary_form: null,
    inactive: false,
    group_id: null,
    group: null,
    collective_agreement: null,
    ...overrides,
  } as EmployeeRow
}

const ROWS: EmployeeRow[] = [
  makeRow({
    id: 'emp-1',
    group_id: 'grp-1',
    group: { id: 'grp-1', name: 'Lager' },
  }),
  makeRow({ id: 'emp-2', first_name: 'Bo', last_name: 'Ek' }),
]

function renderContent(
  props: Partial<React.ComponentProps<typeof PersonalregisterContent>> = {}
) {
  return render(
    <PersonalregisterContent
      initialRows={ROWS}
      groups={GROUPS}
      canManage
      {...props}
    />
  )
}

/** A promise whose resolution the test controls. */
function deferred<T>() {
  let resolve!: (_value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

let pushStateSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  mockSearchParams = new URLSearchParams()
  mockMoveEmployeeToGroup.mockReset()
  mockToastError.mockReset()
  window.history.replaceState(null, '', '/personalregister')
  pushStateSpy = vi.spyOn(window.history, 'pushState')
})

afterEach(() => {
  pushStateSpy.mockRestore()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PersonalregisterContent — ?anstalld= wiring (AC8)', () => {
  test('row click writes ?anstalld=<id> via pushState', () => {
    renderContent()

    fireEvent.click(screen.getByText('open-emp-1'))

    expect(pushStateSpy).toHaveBeenCalledWith(null, '', '?anstalld=emp-1')
    expect(window.location.search).toBe('?anstalld=emp-1')
  })

  test("add-employee writes the 'ny' sentinel and never triggers a lookup/action", () => {
    renderContent()

    fireEvent.click(screen.getByText('add-employee'))

    expect(window.location.search).toBe('?anstalld=ny')
    // 'ny' is stored verbatim — no row lookup, no server action fired.
    expect(mockMoveEmployeeToGroup).not.toHaveBeenCalled()
  })

  test('URL-driven param change (back/forward) does not write the URL back', () => {
    const { rerender } = renderContent()

    mockSearchParams = new URLSearchParams('anstalld=emp-2')
    rerender(
      <PersonalregisterContent initialRows={ROWS} groups={GROUPS} canManage />
    )

    expect(pushStateSpy).not.toHaveBeenCalled()
  })
})

describe('PersonalregisterContent — optimistic move & per-row rollback', () => {
  test('optimistically moves the row, then rolls back ONLY that row on failure', async () => {
    const move = deferred<{ success: boolean; error?: string }>()
    mockMoveEmployeeToGroup.mockReturnValueOnce(move.promise)

    renderContent()
    expect(screen.getByTestId('group-of-emp-1').textContent).toBe('Lager')

    fireEvent.click(screen.getByText('move-emp-1-to-grp-2'))

    // Optimistic: the row shows the target group before the action resolves.
    expect(screen.getByTestId('group-of-emp-1').textContent).toBe('Huvudkontor')
    expect(mockMoveEmployeeToGroup).toHaveBeenCalledWith('emp-1', 'grp-2')

    await act(async () => {
      move.resolve({ success: false, error: 'Serverfel' })
    })

    // Rolled back to the previous group; user informed.
    expect(screen.getByTestId('group-of-emp-1').textContent).toBe('Lager')
    expect(mockToastError).toHaveBeenCalledWith('Serverfel')
  })

  test('a failed move does not revert another already-persisted move (QA REL-002)', async () => {
    const firstMove = deferred<{ success: boolean }>()
    const secondMove = deferred<{ success: boolean; error?: string }>()
    mockMoveEmployeeToGroup
      .mockReturnValueOnce(firstMove.promise)
      .mockReturnValueOnce(secondMove.promise)

    renderContent()

    // Two rapid moves: emp-1 → grp-2 (will succeed), emp-2 → grp-2 (will fail).
    fireEvent.click(screen.getByText('move-emp-1-to-grp-2'))
    fireEvent.click(screen.getByText('move-emp-2-to-grp-2'))
    expect(screen.getByTestId('group-of-emp-1').textContent).toBe('Huvudkontor')
    expect(screen.getByTestId('group-of-emp-2').textContent).toBe('Huvudkontor')

    await act(async () => {
      firstMove.resolve({ success: true })
    })
    await act(async () => {
      secondMove.resolve({ success: false, error: 'Serverfel' })
    })

    // emp-2 rolled back to Ogrupperad; emp-1's persisted move survives.
    await waitFor(() => {
      expect(screen.getByTestId('group-of-emp-2').textContent).toBe(
        'Ogrupperad'
      )
    })
    expect(screen.getByTestId('group-of-emp-1').textContent).toBe('Huvudkontor')
  })
})

describe('PersonalregisterContent — Personalkort modal mount (Story 7.3)', () => {
  test('modal receives the selected row from the already-loaded island state', () => {
    mockSearchParams = new URLSearchParams('anstalld=emp-1')
    renderContent()

    expect(screen.getByTestId('modal-anstalld-id').textContent).toBe('emp-1')
    expect(screen.getByTestId('modal-row-id').textContent).toBe('emp-1')
    expect(mockToastError).not.toHaveBeenCalled()
  })

  test("'ny' sentinel opens create mode — no row lookup, no error", () => {
    mockSearchParams = new URLSearchParams('anstalld=ny')
    renderContent()

    expect(screen.getByTestId('modal-anstalld-id').textContent).toBe('ny')
    expect(screen.getByTestId('modal-row-id').textContent).toBe('none')
    expect(mockToastError).not.toHaveBeenCalled()
  })

  test('stale/foreign ?anstalld= id → toast + param cleared (no server helper call)', async () => {
    mockSearchParams = new URLSearchParams('anstalld=emp-unknown')
    window.history.replaceState(
      null,
      '',
      '/personalregister?anstalld=emp-unknown'
    )
    renderContent()

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Anställd hittades inte')
    })
    expect(window.location.search).toBe('')
    // No action fired — prefill only ever comes from island state.
    expect(mockMoveEmployeeToGroup).not.toHaveBeenCalled()
  })

  test('onEmployeeChange(created) inserts the new row in sorted position', () => {
    renderContent()

    fireEvent.click(screen.getByText('modal-create'))

    expect(screen.getByTestId('name-of-emp-created')).toBeInTheDocument()
    // 'Aa' sorts before Ek and Svensson (server ordering: last_name, first_name).
    const openButtons = screen.getAllByText(/^open-emp/)
    expect(openButtons[0]?.textContent).toBe('open-emp-created')
    expect(openButtons).toHaveLength(3)
  })

  test('onEmployeeChange(updated) replaces the row without duplicating it', () => {
    mockSearchParams = new URLSearchParams('anstalld=emp-1')
    renderContent()

    fireEvent.click(screen.getByText('modal-update'))

    expect(screen.getByTestId('name-of-emp-1').textContent).toBe('Uppdaterad')
    expect(screen.getAllByText(/^open-emp/)).toHaveLength(2)
  })
})

describe('PersonalregisterContent — completeness stats & tab (Story 7.4)', () => {
  const completeRow = makeRow({
    id: 'emp-complete',
    first_name: 'Doris',
    last_name: 'Dahl',
    personnummer: '890503-2556',
    personnummer_masked: false,
    employment_date: new Date('2020-01-01'),
    employment_form: 'TV',
    personel_type: 'ARB',
  } as Partial<EmployeeRow> & { id: string })

  test('header stat "Kompletta" derives from UNFILTERED rows', () => {
    renderContent({ initialRows: [completeRow, ...ROWS] })

    expect(screen.getByText('Kompletta')).toBeInTheDocument()
    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  test('stat does NOT change when a tab filter hides rows (UX-001)', async () => {
    const user = userEvent.setup()
    renderContent({ initialRows: [completeRow, ...ROWS] })

    await user.click(screen.getByRole('tab', { name: /Ej kompletta/ }))

    // Visible rows shrink to the incomplete ones; the global stat stays.
    expect(screen.getByTestId('visible-count').textContent).toBe('2')
    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  test('"Ej kompletta" tab passes only incomplete rows to the table', async () => {
    const user = userEvent.setup()
    renderContent({ initialRows: [completeRow, ...ROWS] })

    expect(screen.getByTestId('visible-count').textContent).toBe('3')
    await user.click(screen.getByRole('tab', { name: /Ej kompletta/ }))
    expect(screen.getByTestId('visible-count').textContent).toBe('2')
  })

  test('workspace kollektivavtal flag feeds the rule (agreement-less row turns incomplete)', () => {
    renderContent({
      initialRows: [completeRow, ...ROWS],
      workspaceHasCollectiveAgreement: true,
    })

    // completeRow has no agreement → 0/3 once the workspace requires one.
    expect(screen.getByText('0/3')).toBeInTheDocument()
  })

  test('stat updates optimistically after a Personalkort save (onEmployeeChange)', () => {
    renderContent({ initialRows: [completeRow, ...ROWS] })
    expect(screen.getByText('1/3')).toBeInTheDocument()

    // The modal stub inserts an (incomplete) created row → denominator grows.
    fireEvent.click(screen.getByText('modal-create'))
    expect(screen.getByText('1/4')).toBeInTheDocument()
  })

  test('no stat is rendered for an empty register (no "0/0")', () => {
    renderContent({ initialRows: [] })
    expect(screen.queryByText('Kompletta')).toBeNull()
  })
})

describe('PersonalregisterContent — groups load failure (QA REL-001)', () => {
  test('renders an inline notice when the groups fetch failed', () => {
    renderContent({ groupsLoadFailed: true })

    expect(screen.getByText(/Grupper kunde inte laddas/)).toBeInTheDocument()
    // Rows are still shown (ungrouped register remains usable).
    expect(screen.getByTestId('employee-table')).toBeInTheDocument()
  })

  test('no notice in the normal case', () => {
    renderContent()
    expect(screen.queryByText(/Grupper kunde inte laddas/)).toBeNull()
  })
})
