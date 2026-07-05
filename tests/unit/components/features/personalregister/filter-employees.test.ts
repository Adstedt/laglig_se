/**
 * Story 7.2: Tests for the pure client-side employee filter/search helper.
 */
import { describe, test, expect } from 'vitest'
import { filterEmployees } from '@/components/features/personalregister/filter-employees'
import type { EmployeeRow } from '@/components/features/personalregister/employee-row'

const PERSONNUMMER_MASK = '••••••-••••'

function makeRow(overrides: Partial<EmployeeRow> = {}): EmployeeRow {
  return {
    id: 'emp-1',
    workspace_id: 'ws-1',
    created_by: 'user-1',
    employee_id_ref: null,
    personnummer: null,
    personnummer_masked: false,
    first_name: 'Anna',
    last_name: 'Andersson',
    email: null,
    phone1: null,
    phone2: null,
    address1: null,
    address2: null,
    post_code: null,
    city: null,
    country: 'SE',
    job_title: null,
    employment_date: null,
    employed_to: null,
    employment_form: null,
    personel_type: null,
    inactive: false,
    full_time_equivalent: null,
    average_weekly_hours: null,
    schedule_id: null,
    salary_form: null,
    vacation_days_paid: null,
    collective_agreement_id: null,
    group_id: null,
    manager_id: null,
    fortnox_employee_id: null,
    fortnox_synced_at: null,
    fortnox_sync_status: 'NOT_LINKED',
    created_at: new Date(),
    updated_at: new Date(),
    group: null,
    collective_agreement: null,
    ...overrides,
  } as EmployeeRow
}

const rows: EmployeeRow[] = [
  makeRow({
    id: 'emp-1',
    first_name: 'Anna',
    last_name: 'Andersson',
    employee_id_ref: 'A-100',
    personnummer: '19900101-1234',
    personnummer_masked: false,
  }),
  makeRow({
    id: 'emp-2',
    first_name: 'Bertil',
    last_name: 'Berg',
    employee_id_ref: 'B-200',
    inactive: true,
  }),
  makeRow({
    id: 'emp-3',
    first_name: 'Cecilia',
    last_name: 'Carlsson',
    personnummer: PERSONNUMMER_MASK,
    personnummer_masked: true,
  }),
]

describe('filterEmployees — status tabs', () => {
  test('"alla" returns everything', () => {
    expect(filterEmployees(rows, { tab: 'alla', search: '' })).toHaveLength(3)
  })

  test('"aktiva" returns only !inactive', () => {
    const result = filterEmployees(rows, { tab: 'aktiva', search: '' })
    expect(result.map((r) => r.id)).toEqual(['emp-1', 'emp-3'])
  })

  test('"inaktiva" returns only inactive', () => {
    const result = filterEmployees(rows, { tab: 'inaktiva', search: '' })
    expect(result.map((r) => r.id)).toEqual(['emp-2'])
  })
})

describe('filterEmployees — "ej_kompletta" tab (Story 7.4)', () => {
  const completeActive = makeRow({
    id: 'emp-complete',
    personnummer: '890503-2556',
    employment_date: new Date('2020-01-01'),
    employment_form: 'TV',
    personel_type: 'ARB',
  })
  const completeInactive = makeRow({
    id: 'emp-complete-inactive',
    first_name: 'Doris',
    last_name: 'Dahl',
    personnummer: '890503-2556',
    employment_date: new Date('2020-01-01'),
    employment_form: 'TV',
    personel_type: 'ARB',
    inactive: true,
  })
  const incomplete = makeRow({ id: 'emp-incomplete', first_name: 'Erik' })
  const mixedRows = [completeActive, completeInactive, incomplete]

  test('returns exactly the incomplete rows — orthogonal to Aktiv/Inaktiv', () => {
    const result = filterEmployees(mixedRows, {
      tab: 'ej_kompletta',
      search: '',
    })
    // A complete INACTIVE row is excluded; incomplete rows included
    // regardless of activity.
    expect(result.map((r) => r.id)).toEqual(['emp-incomplete'])
  })

  test('workspace kollektivavtal flag pulls agreement-less rows into the tab', () => {
    expect(
      filterEmployees([completeActive], { tab: 'ej_kompletta', search: '' })
    ).toHaveLength(0)
    expect(
      filterEmployees([completeActive], {
        tab: 'ej_kompletta',
        search: '',
        workspaceHasCollectiveAgreement: true,
      }).map((r) => r.id)
    ).toEqual(['emp-complete'])
  })

  test('composes with search like the other tabs', () => {
    expect(
      filterEmployees(mixedRows, { tab: 'ej_kompletta', search: 'erik' })
    ).toHaveLength(1)
    expect(
      filterEmployees(mixedRows, { tab: 'ej_kompletta', search: 'doris' })
    ).toHaveLength(0)
  })
})

describe('filterEmployees — search', () => {
  test('matches name case-insensitively (first + last)', () => {
    expect(
      filterEmployees(rows, { tab: 'alla', search: 'anna anders' }).map(
        (r) => r.id
      )
    ).toEqual(['emp-1'])
    expect(
      filterEmployees(rows, { tab: 'alla', search: 'BERG' }).map((r) => r.id)
    ).toEqual(['emp-2'])
  })

  test('matches anställnings-ID', () => {
    expect(
      filterEmployees(rows, { tab: 'alla', search: 'b-200' }).map((r) => r.id)
    ).toEqual(['emp-2'])
  })

  test('matches a decrypted personnummer', () => {
    expect(
      filterEmployees(rows, { tab: 'alla', search: '19900101' }).map(
        (r) => r.id
      )
    ).toEqual(['emp-1'])
  })

  test('masked personnummer is unsearchable by design', () => {
    // emp-3 carries the mask — digit queries must never match it.
    expect(
      filterEmployees([rows[2] as EmployeeRow], {
        tab: 'alla',
        search: '19900101',
      })
    ).toHaveLength(0)
    // Not even the mask characters themselves match.
    expect(
      filterEmployees([rows[2] as EmployeeRow], {
        tab: 'alla',
        search: PERSONNUMMER_MASK,
      })
    ).toHaveLength(0)
  })

  test('search composes with the tab filter', () => {
    // Bertil matches the search but is inactive → excluded under "aktiva".
    expect(
      filterEmployees(rows, { tab: 'aktiva', search: 'bertil' })
    ).toHaveLength(0)
    expect(
      filterEmployees(rows, { tab: 'inaktiva', search: 'bertil' })
    ).toHaveLength(1)
  })

  test('blank / whitespace-only search is a no-op', () => {
    expect(filterEmployees(rows, { tab: 'alla', search: '   ' })).toHaveLength(
      3
    )
  })

  test('no match returns empty', () => {
    expect(
      filterEmployees(rows, { tab: 'alla', search: 'zzz-not-there' })
    ).toHaveLength(0)
  })
})
