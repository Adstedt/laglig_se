/**
 * Story 7.2 (QA UX-001): group section counts and the empty-group hint must
 * reflect UNFILTERED rows — filtering affects visible rows, not a group's
 * emptiness semantics.
 *
 * Story 7.4: group headers now show a "{n}/{m} kompletta" rollup (same
 * unfiltered source), the Status column carries an amber "Ej komplett"
 * badge for incomplete rows, and Task 3b design parity (two-line Anställd
 * cell, ÅÅMMDD-XXXX personnummer display, Visa alla / Dölj alla).
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useState, type ComponentProps } from 'react'
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Epic 28: the DataTable core's renderer switch is container-width-driven;
// happy-dom has no layout (width 0 → card view). Report a wide container so
// these tests exercise the TABLE renderer they pin.
vi.mock('@/components/ui/data-table/use-container-width', () => ({
  useContainerWidth: () => ({ ref: () => {}, width: 1400 }),
}))
import type {
  ColumnSizingState,
  Updater,
  VisibilityState,
} from '@tanstack/react-table'
import { EmployeeListTable } from '@/components/features/personalregister/employee-list-table'
import { PersonalregisterContent } from '@/components/features/personalregister/personalregister-content'
import { filterEmployees } from '@/components/features/personalregister/filter-employees'
import type { EmployeeRow } from '@/components/features/personalregister/employee-row'
import type { EmployeeGroupSummary } from '@/app/actions/employees'

// ---------------------------------------------------------------------------
// The column-state OWNERSHIP moved to the island (`personalregister-content`)
// in the user-checkpoint layout round, so the Story 7.4b column tests render
// the real island (which mounts the real table). These mocks stub only the
// island's peripheral toolbar/modal deps — the table + column state + the
// Kolumner control are all exercised for real.
// ---------------------------------------------------------------------------
let mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}))
vi.mock('@/app/actions/employees', () => ({
  moveEmployeeToGroup: vi.fn(async () => ({ success: true })),
}))
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))
vi.mock('@/components/features/personalregister/manage-groups-popover', () => ({
  ManageGroupsPopover: () => <div data-testid="manage-groups-popover" />,
}))
vi.mock(
  '@/components/features/kollektivavtal/kollektivavtal-manager-dialog',
  () => ({
    KollektivavtalManagerDialog: () => (
      <div data-testid="kollektivavtal-manager-dialog" />
    ),
  })
)
vi.mock('@/components/features/personalregister/personalkort-modal', () => ({
  PersonalkortModal: () => null,
}))

/**
 * The table is now a CONTROLLED consumer of column state. For the standalone
 * table tests (group counts, badges, design parity) this thin stateful harness
 * supplies that state locally — Lön seeds hidden to mirror the real default.
 */
type ControlledTableProps = Omit<
  ComponentProps<typeof EmployeeListTable>,
  | 'columnVisibility'
  | 'columnSizing'
  | 'onColumnVisibilityChange'
  | 'onColumnSizingChange'
>

function ControlledTable(props: ControlledTableProps) {
  const [visibility, setVisibility] = useState<VisibilityState>({
    salary: false,
  })
  const [sizing, setSizing] = useState<ColumnSizingState>({})
  return (
    <EmployeeListTable
      {...props}
      columnVisibility={visibility}
      columnSizing={sizing}
      onColumnVisibilityChange={setVisibility}
      onColumnSizingChange={(updater: Updater<ColumnSizingState>) =>
        setSizing((prev) =>
          typeof updater === 'function' ? updater(prev) : updater
        )
      }
    />
  )
}

const GROUPS: EmployeeGroupSummary[] = [
  { id: 'grp-1', name: 'Lager', position: 0, employeeCount: 2 },
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

const ALL_ROWS: EmployeeRow[] = [
  makeRow({
    id: 'emp-1',
    first_name: 'Anna',
    group_id: 'grp-1',
    group: { id: 'grp-1', name: 'Lager' },
  }),
  makeRow({
    id: 'emp-2',
    first_name: 'Bo',
    last_name: 'Ek',
    group_id: 'grp-1',
    group: { id: 'grp-1', name: 'Lager' },
  }),
  makeRow({ id: 'emp-3', first_name: 'Cia', last_name: 'Alm' }),
]

const noop = () => undefined
const noopMove = vi.fn(async () => true)

function renderTable({
  employees,
  allEmployees = ALL_ROWS,
  canManage = true,
  workspaceHasCollectiveAgreement = false,
}: {
  employees: EmployeeRow[]
  allEmployees?: EmployeeRow[]
  canManage?: boolean
  workspaceHasCollectiveAgreement?: boolean
}) {
  return render(
    <ControlledTable
      employees={employees}
      allEmployees={allEmployees}
      groups={GROUPS}
      canManage={canManage}
      totalCount={allEmployees.length}
      workspaceHasCollectiveAgreement={workspaceHasCollectiveAgreement}
      onRowClick={noop}
      onMoveToGroup={noopMove}
    />
  )
}

/**
 * The section container for a given group heading. Group names also appear
 * inside per-row group-editor triggers, so pick the SECTION HEADER occurrence
 * (the flex-1 heading span) and walk up to the section wrapper.
 */
function sectionOf(name: string): HTMLElement {
  const heading = screen
    .getAllByText(name)
    .find((el) => el.className.includes('flex-1'))
  // Epic 28: in GroupedDataTable the rounded-md droppable wrapper holds
  // ONLY the trigger; the section content (table / empty slot) is its
  // SIBLING inside the Collapsible root — climb one level higher so
  // within(section) sees both.
  const section = heading?.closest('div.rounded-md')?.parentElement
  if (!(section instanceof HTMLElement)) {
    throw new Error(`Section wrapper not found for "${name}"`)
  }
  return section
}

describe('EmployeeListTable — unfiltered group counts (QA UX-001)', () => {
  test('group header counts come from UNFILTERED rows even when a filter hides them', () => {
    // Active search matched nothing — all rows filtered out.
    renderTable({ employees: [] })

    // Lager still shows its true size (2), Ogrupperad its true size (1).
    // Story 7.4: counts render as the "{n}/{m} kompletta" rollup (all
    // fixture rows lack LAS-critical fields → 0 kompletta); an empty group
    // keeps a plain 0.
    expect(
      within(sectionOf('Lager')).getByText('0/2 kompletta')
    ).toBeInTheDocument()
    expect(
      within(sectionOf('Ogrupperad')).getByText('0/1 kompletta')
    ).toBeInTheDocument()
    expect(within(sectionOf('Huvudkontor')).getByText('0')).toBeInTheDocument()
  })

  test('a filtered-out (but non-empty) group says "Inga träffar", not "Dra anställda hit."', () => {
    renderTable({ employees: [] })

    const lager = sectionOf('Lager')
    expect(
      within(lager).getByText('Inga träffar i denna grupp.')
    ).toBeInTheDocument()
    expect(within(lager).queryByText('Dra anställda hit.')).toBeNull()
  })

  test('a truly empty group still shows the drag-here hint for manage roles', () => {
    // No filter active — all rows visible; Huvudkontor genuinely has no rows.
    renderTable({ employees: ALL_ROWS })

    const huvudkontor = sectionOf('Huvudkontor')
    expect(
      within(huvudkontor).getByText('Dra anställda hit.')
    ).toBeInTheDocument()
  })

  test('a truly empty group shows the read-only message without manage', () => {
    renderTable({ employees: ALL_ROWS, canManage: false })

    const huvudkontor = sectionOf('Huvudkontor')
    expect(
      within(huvudkontor).getByText('Inga anställda i denna grupp.')
    ).toBeInTheDocument()
  })

  test('visible rows render under their group when no filter hides them', () => {
    renderTable({ employees: ALL_ROWS })

    const lager = sectionOf('Lager')
    expect(within(lager).getByText(/Anna/)).toBeInTheDocument()
    expect(within(lager).getByText(/Bo/)).toBeInTheDocument()
    const ogrupperad = sectionOf('Ogrupperad')
    expect(within(ogrupperad).getByText(/Cia/)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Story 7.4
// ---------------------------------------------------------------------------

/** A row satisfying every LAS-critical criterion (flag-off workspaces). */
function makeCompleteRow(
  overrides: Partial<EmployeeRow> & { id: string }
): EmployeeRow {
  return makeRow({
    personnummer: '890503-2556',
    employment_date: new Date('2020-01-01'),
    employment_form: 'TV',
    personel_type: 'ARB',
    ...overrides,
  } as Partial<EmployeeRow> & { id: string })
}

describe('EmployeeListTable — completeness surfacing (Story 7.4)', () => {
  test('group rollup counts complete rows from UNFILTERED rows', () => {
    const rows = [
      makeCompleteRow({
        id: 'emp-1',
        group_id: 'grp-1',
        group: { id: 'grp-1', name: 'Lager' },
      }),
      makeRow({
        id: 'emp-2',
        first_name: 'Bo',
        last_name: 'Ek',
        group_id: 'grp-1',
        group: { id: 'grp-1', name: 'Lager' },
      }),
    ]
    // Filter hides everything — the rollup must not change.
    renderTable({ employees: [], allEmployees: rows })

    expect(
      within(sectionOf('Lager')).getByText('1/2 kompletta')
    ).toBeInTheDocument()
  })

  test('amber "Ej komplett" badge renders ONLY for incomplete rows, alongside Aktiv', () => {
    const rows = [
      makeCompleteRow({ id: 'emp-1' }),
      makeRow({ id: 'emp-2', first_name: 'Bo', last_name: 'Ek' }),
    ]
    renderTable({ employees: rows, allEmployees: rows })

    // Both rows are active; only the incomplete one carries the extra badge.
    expect(screen.getAllByText('Aktiv')).toHaveLength(2)
    expect(screen.getAllByText('Ej komplett')).toHaveLength(1)
  })

  test('incomplete ≠ inactive: an inactive incomplete row shows BOTH badges', () => {
    const rows = [
      makeRow({ id: 'emp-1', inactive: true }),
      makeCompleteRow({ id: 'emp-2', first_name: 'Bo', inactive: true }),
    ]
    renderTable({ employees: rows, allEmployees: rows })

    expect(screen.getAllByText('Inaktiv')).toHaveLength(2)
    expect(screen.getAllByText('Ej komplett')).toHaveLength(1)
  })

  test('kollektivavtal criterion follows the workspace flag', () => {
    const rows = [makeCompleteRow({ id: 'emp-1', collective_agreement: null })]

    const { unmount } = renderTable({ employees: rows, allEmployees: rows })
    expect(screen.queryByText('Ej komplett')).toBeNull()
    unmount()

    renderTable({
      employees: rows,
      allEmployees: rows,
      workspaceHasCollectiveAgreement: true,
    })
    expect(screen.getByText('Ej komplett')).toBeInTheDocument()
  })
})

describe('EmployeeListTable — law-table design parity (Task 3b)', () => {
  test('Anställd cell shows a muted job-title second line when set — no "Ej ifylld" fallback line', () => {
    const rows = [
      makeCompleteRow({ id: 'emp-1', job_title: 'Snickare' }),
      makeCompleteRow({
        id: 'emp-2',
        first_name: 'Bo',
        last_name: 'Ek',
        employee_id_ref: 'B-2',
        job_title: null,
      }),
    ]
    renderTable({ employees: rows, allEmployees: rows })

    // Second line renders inside the same cell as the name (emp-1).
    const annaName = screen.getByText('Anna Svensson')
    expect(annaName.className).toContain('font-medium')
    expect(annaName.parentElement).toContainElement(
      screen.getByText('Snickare')
    )

    // Without a job title the line is OMITTED — one line, no "Ej ifylld"
    // fallback inside the primary identity cell (emp-2).
    const boName = screen.getByText('Bo Ek')
    expect(boName.parentElement?.children).toHaveLength(1)
    expect(boName.closest('td')?.textContent).toBe('Bo Ek')
  })

  test('personnummer DISPLAY formats digit-only values as ÅÅMMDD-XXXX; stored value untouched', () => {
    const rows = [
      makeCompleteRow({ id: 'emp-1', personnummer: '8905032556' }),
      makeCompleteRow({
        id: 'emp-2',
        first_name: 'Bo',
        last_name: 'Ek',
        personnummer: '198905032556',
      }),
    ]
    renderTable({ employees: rows, allEmployees: rows })

    // 10 digits → hyphen inserted; 12 digits → century dropped for display.
    expect(screen.getAllByText('890503-2556')).toHaveLength(2)
    // Display-only: the raw values never render, the row objects are intact.
    expect(screen.queryByText('8905032556')).toBeNull()
    expect(rows[0]?.personnummer).toBe('8905032556')
    expect(rows[1]?.personnummer).toBe('198905032556')
  })

  test('a masked personnummer renders EXACTLY as received', () => {
    const rows = [
      makeCompleteRow({
        id: 'emp-1',
        personnummer: '••••••••••',
        personnummer_masked: true,
      }),
    ]
    renderTable({ employees: rows, allEmployees: rows })

    expect(screen.getByText('••••••••••')).toBeInTheDocument()
  })

  test('Dölj alla collapses every group; Visa alla expands them again', () => {
    renderTable({ employees: ALL_ROWS })

    expect(screen.getByText(/Anna/)).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Dölj alla grupper'))
    expect(screen.queryByText(/Anna/)).toBeNull()
    expect(screen.queryByText(/Cia/)).toBeNull()

    fireEvent.click(screen.getByTitle('Visa alla grupper'))
    expect(screen.getByText(/Anna/)).toBeInTheDocument()
    expect(screen.getByText(/Cia/)).toBeInTheDocument()
  })

  test('sort affordance is hover-reveal: unsorted header icons are hidden, active sort shows a direction icon', () => {
    renderTable({ employees: ALL_ROWS })

    const lager = sectionOf('Lager')
    const header = within(lager).getAllByRole('button', {
      name: 'Anställd',
    })[0]
    if (!header) throw new Error('Anställd header not found')

    // Unsorted: the ⇅ icon is present but opacity-0 until the column is
    // hovered (group-hover reveal — no always-on icon noise).
    expect(header.querySelector('svg')?.getAttribute('class')).toContain(
      'opacity-0'
    )

    fireEvent.click(header)
    // Active sort: a persistent direction icon, no longer hover-gated.
    expect(header.querySelector('svg')?.getAttribute('class')).not.toContain(
      'opacity-0'
    )
  })
})

// ---------------------------------------------------------------------------
// Story 7.4b: column show/hide + resize + per-user persistence
// ---------------------------------------------------------------------------

const WS_ID = 'ws-74b'
const STORAGE_KEY = `laglig:personalregister:columns:v1:${WS_ID}`

/** Flat-mode rows (no groups) carrying the workspace id for persistence. */
function makeWorkspaceRows(): EmployeeRow[] {
  return [
    makeCompleteRow({
      id: 'emp-1',
      workspace_id: WS_ID,
      personnummer: '8905032556',
    } as Partial<EmployeeRow> & { id: string }),
    makeCompleteRow({
      id: 'emp-2',
      first_name: 'Bo',
      last_name: 'Ek',
      workspace_id: WS_ID,
      personnummer: null,
    } as Partial<EmployeeRow> & { id: string }),
  ]
}

/**
 * Render the real island — it now owns the column state + persistence and
 * mounts the real table. `groups: []` yields flat mode; passing groups renders
 * the grouped sections. The Kolumner control lives in the island toolbar.
 */
function renderIsland({
  initialRows,
  groups = [],
  canManage = true,
  workspaceHasCollectiveAgreement = false,
}: {
  initialRows: EmployeeRow[]
  groups?: EmployeeGroupSummary[]
  canManage?: boolean
  workspaceHasCollectiveAgreement?: boolean
}) {
  return render(
    <PersonalregisterContent
      initialRows={initialRows}
      groups={groups}
      canManage={canManage}
      workspaceHasCollectiveAgreement={workspaceHasCollectiveAgreement}
    />
  )
}

/** The Kolumner menu entry for a label (labels also appear as table headers). */
function columnMenuItem(label: string): HTMLElement {
  const item = screen
    .getAllByText(label)
    .map((el) => el.closest('[role="menuitemcheckbox"]'))
    .find((el): el is HTMLElement => el instanceof HTMLElement)
  if (!item) throw new Error(`Menu item not found for "${label}"`)
  return item
}

describe('Personalregister column controls in the island toolbar (Story 7.4b, layout round)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockSearchParams = new URLSearchParams()
  })

  test('Kollektivavtal, Hantera grupper and Kolumner render in ONE toolbar row', () => {
    renderIsland({ initialRows: makeWorkspaceRows(), groups: GROUPS })

    // The Kolumner trigger and both sibling controls share the same toolbar
    // container (user checkpoint: the three controls must be on one row).
    const kolumner = screen.getByRole('button', { name: /kolumner/i })
    const toolbar = kolumner.parentElement
    if (!(toolbar instanceof HTMLElement)) throw new Error('toolbar not found')
    expect(
      within(toolbar).getByTestId('kollektivavtal-manager-dialog')
    ).toBeInTheDocument()
    expect(
      within(toolbar).getByTestId('manage-groups-popover')
    ).toBeInTheDocument()
  })

  test('Kolumner lists every data column; Anställd is locked (Obligatorisk); no structural entries', async () => {
    const user = userEvent.setup()
    renderIsland({ initialRows: makeWorkspaceRows() })

    await user.click(screen.getByRole('button', { name: /kolumner/i }))
    await waitFor(() => {
      expect(screen.getByText('Visa kolumner')).toBeInTheDocument()
    })

    // All ten data columns are listed — nothing structural (no drag handle;
    // flat mode has none, and the option catalog never includes it). Story
    // 7.10 added the Lön column (hidden by default, but still toggleable).
    const items = screen.getAllByRole('menuitemcheckbox')
    expect(items).toHaveLength(10)
    expect(columnMenuItem('Lön')).toBeInTheDocument()

    // Anställd is present but disabled with the Obligatorisk hint (AC2);
    // Personnummer is a plain, enabled toggle (the screen-share case).
    const anstalld = columnMenuItem('Anställd')
    expect(anstalld).toHaveAttribute('data-disabled')
    expect(within(anstalld).getByText('Obligatorisk')).toBeInTheDocument()
    expect(columnMenuItem('Personnummer')).not.toHaveAttribute('data-disabled')
  })

  test('Story 7.10: Lön is HIDDEN by default and, when shown, formats by salary_form / masks for view', async () => {
    const user = userEvent.setup()
    const rows = [
      makeCompleteRow({
        id: 'emp-1',
        salary_form: 'MAN',
        monthly_salary: '45000.00',
        hourly_pay: null,
        salary_masked: false,
      } as Partial<EmployeeRow> & { id: string }),
      makeCompleteRow({
        id: 'emp-2',
        first_name: 'Bo',
        last_name: 'Ek',
        salary_form: 'TIM',
        monthly_salary: null,
        // A view-only masked row — the repo already replaced the amount with
        // the fixed mask before serialization.
        hourly_pay: '•••••',
        salary_masked: true,
      } as unknown as Partial<EmployeeRow> & { id: string }),
    ]

    renderIsland({ initialRows: rows })

    // Hidden by default: no formatted amount visible yet (sv-SE groups with a
    // non-breaking space — match on \s to stay separator-agnostic).
    expect(screen.queryByText(/45\s000\skr/)).not.toBeInTheDocument()

    // Reveal the column.
    await user.click(screen.getByRole('button', { name: /kolumner/i }))
    await waitFor(() => {
      expect(screen.getByText('Visa kolumner')).toBeInTheDocument()
    })
    await user.click(columnMenuItem('Lön'))

    // MAN → monthly formatted; masked row → the mask, never a real amount.
    expect(screen.getByText(/45\s000\skr/)).toBeInTheDocument()
    expect(screen.getByText('•••••')).toBeInTheDocument()
  })

  test('hiding Personnummer removes header and cells, keeps Anställd, and persists per workspace', async () => {
    const user = userEvent.setup()
    renderIsland({ initialRows: makeWorkspaceRows() })

    // Visible before: header sort button + formatted cell value.
    expect(
      screen.getByRole('button', { name: 'Personnummer' })
    ).toBeInTheDocument()
    expect(screen.getByText('890503-2556')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /kolumner/i }))
    await waitFor(() => {
      expect(screen.getByText('Visa kolumner')).toBeInTheDocument()
    })
    await user.click(columnMenuItem('Personnummer'))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Personnummer' })).toBeNull()
    })
    expect(screen.queryByText('890503-2556')).toBeNull()
    // Rows themselves stay — only the column is gone.
    expect(screen.getByText('Anna Svensson')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anställd' })).toBeInTheDocument()

    // Persisted under the workspace-scoped key.
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored.visibility?.personnummer).toBe(false)
  })

  test('persisted state hydrates on mount: hidden column stays hidden, stale width clamps', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        visibility: { personnummer: false },
        sizing: { name: 99999 }, // stale out-of-bounds width
      })
    )
    renderIsland({ initialRows: makeWorkspaceRows() })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Personnummer' })).toBeNull()
    })
    // Clamped to the Anställd max (480), never the stored 99999px.
    const nameHeader = screen
      .getByRole('button', { name: 'Anställd' })
      .closest('th')
    expect(nameHeader?.style.width).toBe('480px')
  })

  test('corrupt persisted state degrades to defaults without crashing', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{definitely not json')
    renderIsland({ initialRows: makeWorkspaceRows() })

    // All columns render at defaults.
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Personnummer' })
      ).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Anställd' })).toBeInTheDocument()
  })

  test('search matches personnummer DATA even while the column is hidden', async () => {
    const rows = makeWorkspaceRows()

    // Search is over data, not cells: the filter matches regardless of any
    // column visibility state (visibility lives entirely in the table).
    const matched = filterEmployees(rows, { tab: 'alla', search: '890503' })
    expect(matched.map((r) => r.id)).toEqual(['emp-1'])

    // And the matched row renders fine with the column hidden.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ visibility: { personnummer: false }, sizing: {} })
    )
    renderIsland({ initialRows: rows })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Personnummer' })).toBeNull()
    })
    expect(screen.getByText('Anna Svensson')).toBeInTheDocument()
  })

  test('TEST-002 (Story 7.6): no workspace id → column toggles work in-session but persistence is skipped', async () => {
    const user = userEvent.setup()
    // ALL_ROWS carry no workspace_id → the island derives workspaceId null.
    renderIsland({ initialRows: ALL_ROWS, groups: GROUPS })

    await user.click(screen.getByRole('button', { name: /kolumner/i }))
    await waitFor(() => {
      expect(screen.getByText('Visa kolumner')).toBeInTheDocument()
    })
    await user.click(columnMenuItem('Personnummer'))

    // In-session state still applies (every rendered section)…
    await waitFor(() => {
      expect(
        screen.queryAllByRole('button', { name: 'Personnummer' })
      ).toHaveLength(0)
    })
    // …but NOTHING was persisted — no workspace key exists to write under.
    expect(window.localStorage.length).toBe(0)
  })

  test('STATE-001 (Story 7.6): two sequential toggles both land and persist (functional setState — no stale clobber)', async () => {
    const user = userEvent.setup()
    renderIsland({ initialRows: makeWorkspaceRows() })

    await user.click(screen.getByRole('button', { name: /kolumner/i }))
    await waitFor(() => {
      expect(screen.getByText('Visa kolumner')).toBeInTheDocument()
    })
    await user.click(columnMenuItem('Personnummer'))

    // The menu closes on select — reopen for the second toggle.
    await user.click(screen.getByRole('button', { name: /kolumner/i }))
    await waitFor(() => {
      expect(screen.getByText('Visa kolumner')).toBeInTheDocument()
    })
    await user.click(columnMenuItem('Personaltyp'))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Personnummer' })).toBeNull()
    })
    expect(screen.queryByRole('button', { name: 'Personaltyp' })).toBeNull()

    // BOTH hidden flags persisted — the second write derived from fresh prev
    // state, not a stale closure that would have resurrected Personnummer.
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored.visibility?.personnummer).toBe(false)
    expect(stored.visibility?.personel_type).toBe(false)
  })

  test('grouped view: toggling a column hides it in EVERY group section', async () => {
    const user = userEvent.setup()
    renderIsland({ initialRows: ALL_ROWS, groups: GROUPS })

    // Two sections render rows (Lager + Ogrupperad) → two headers each.
    expect(
      screen.getAllByRole('button', { name: 'Personnummer' })
    ).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: /kolumner/i }))
    await waitFor(() => {
      expect(screen.getByText('Visa kolumner')).toBeInTheDocument()
    })
    await user.click(columnMenuItem('Personnummer'))

    await waitFor(() => {
      expect(
        screen.queryAllByRole('button', { name: 'Personnummer' })
      ).toHaveLength(0)
    })
    // Sorting/sections untouched.
    expect(within(sectionOf('Lager')).getByText(/Anna/)).toBeInTheDocument()
  })
})
