/**
 * Story 7.4b: register column state — clamping, sanitizing and per-workspace
 * localStorage persistence. Corrupt/stale stored state must DEGRADE to
 * defaults (never crash), unknown/new columns default to visible, and the
 * non-hideable columns (Anställd, drag handle) can never be persisted hidden.
 */
import { describe, test, expect, beforeEach } from 'vitest'
import {
  EMPLOYEE_COLUMN_SIZE_BOUNDS,
  clampEmployeeColumnSizing,
  sanitizeEmployeeColumnVisibility,
  defaultEmployeeColumnState,
  loadEmployeeColumnState,
  saveEmployeeColumnState,
  EMPLOYEE_DEFAULT_HIDDEN_COLUMN_IDS,
} from '@/components/features/personalregister/employee-column-state'
import { EMPLOYEE_COLUMN_OPTIONS } from '@/components/features/personalregister/employee-column-settings'

const WS = 'ws-column-state'
const KEY = `laglig:personalregister:columns:v1:${WS}`

beforeEach(() => {
  window.localStorage.clear()
})

describe('clampEmployeeColumnSizing', () => {
  test('clamps out-of-bounds widths to the declared bounds (infinite-width fix)', () => {
    expect(clampEmployeeColumnSizing({ name: 99999, personnummer: 1 })).toEqual(
      {
        name: EMPLOYEE_COLUMN_SIZE_BOUNDS.name!.max,
        personnummer: EMPLOYEE_COLUMN_SIZE_BOUNDS.personnummer!.min,
      }
    )
  })

  test('in-bounds widths pass through unchanged', () => {
    expect(clampEmployeeColumnSizing({ name: 300 })).toEqual({ name: 300 })
  })

  test('drops unknown column ids and non-finite values', () => {
    expect(
      clampEmployeeColumnSizing({
        ghost_column: 500,
        name: Number.NaN,
        status: Number.POSITIVE_INFINITY,
      })
    ).toEqual({})
  })
})

describe('sanitizeEmployeeColumnVisibility', () => {
  test('keeps boolean entries for hideable columns — including personnummer', () => {
    expect(
      sanitizeEmployeeColumnVisibility({ personnummer: false, group: true })
    ).toEqual({ personnummer: false, group: true })
  })

  test('drops the non-hideable Anställd and drag-handle columns', () => {
    expect(
      sanitizeEmployeeColumnVisibility({ name: false, dragHandle: false })
    ).toEqual({})
  })

  test('drops unknown ids (new columns default to visible) and non-booleans', () => {
    expect(
      sanitizeEmployeeColumnVisibility({
        removed_in_v2: false,
        personnummer: 'nej',
      })
    ).toEqual({})
  })

  test('non-object input degrades to empty state', () => {
    expect(sanitizeEmployeeColumnVisibility(null)).toEqual({})
    expect(sanitizeEmployeeColumnVisibility('trasigt')).toEqual({})
  })
})

describe('load/save round-trip', () => {
  test('nothing stored → defaults (all visible, no size overrides)', () => {
    expect(loadEmployeeColumnState(WS)).toEqual(defaultEmployeeColumnState())
  })

  test('save → load round-trips visibility and sizing (salary seeds hidden)', () => {
    saveEmployeeColumnState(WS, {
      visibility: { personnummer: false },
      sizing: { name: 300 },
    })
    expect(loadEmployeeColumnState(WS)).toEqual({
      // Story 7.10: the default-hidden Lön column is seeded on load.
      visibility: { personnummer: false, salary: false },
      sizing: { name: 300 },
    })
  })

  test('Story 7.10: salary (defaultVisible:false) seeds HIDDEN on first load', () => {
    // Nothing stored — a brand-new user must NOT see the Lön column.
    expect(loadEmployeeColumnState(WS).visibility.salary).toBe(false)
    expect(defaultEmployeeColumnState().visibility.salary).toBe(false)
  })

  test('Story 7.10: salary stays hidden even for a blob that predates the column', () => {
    // A returning user whose persisted state has no salary key must still get
    // it hidden (the sanitizer would otherwise default it visible).
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ visibility: { group: false }, sizing: {} })
    )
    expect(loadEmployeeColumnState(WS).visibility.salary).toBe(false)
  })

  test('Story 7.10: an explicit stored salary:true is honored (user toggled it on)', () => {
    saveEmployeeColumnState(WS, { visibility: { salary: true }, sizing: {} })
    expect(loadEmployeeColumnState(WS).visibility.salary).toBe(true)
  })

  test('corrupt JSON degrades to defaults', () => {
    window.localStorage.setItem(KEY, '{not json!!')
    expect(loadEmployeeColumnState(WS)).toEqual(defaultEmployeeColumnState())
  })

  test('valid JSON of the wrong shape degrades to defaults', () => {
    window.localStorage.setItem(KEY, JSON.stringify([1, 2, 3]))
    expect(loadEmployeeColumnState(WS)).toEqual(defaultEmployeeColumnState())
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ visibility: 'x', sizing: 7 })
    )
    expect(loadEmployeeColumnState(WS)).toEqual(defaultEmployeeColumnState())
  })

  test('stale stored state is sanitized on load: hidden Anställd resurfaces, widths clamp', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        visibility: { name: false, personnummer: false, old_column: false },
        sizing: { name: 99999, old_column: 10 },
      })
    )
    expect(loadEmployeeColumnState(WS)).toEqual({
      // Story 7.10: salary seeds hidden alongside the surviving personnummer.
      visibility: { personnummer: false, salary: false },
      sizing: { name: EMPLOYEE_COLUMN_SIZE_BOUNDS.name!.max },
    })
  })

  test('state is keyed per workspace — no cross-workspace bleed', () => {
    saveEmployeeColumnState(WS, {
      visibility: { personnummer: false },
      sizing: {},
    })
    expect(loadEmployeeColumnState('ws-other')).toEqual(
      defaultEmployeeColumnState()
    )
  })
})

describe('column catalog invariants', () => {
  test('every toggle option has declared size bounds', () => {
    for (const option of EMPLOYEE_COLUMN_OPTIONS) {
      expect(
        EMPLOYEE_COLUMN_SIZE_BOUNDS[option.id],
        `missing bounds for ${option.id}`
      ).toBeDefined()
    }
  })

  test('Story 7.10: the default-hidden set mirrors the options defaultVisible:false', () => {
    const optionHidden = EMPLOYEE_COLUMN_OPTIONS.filter(
      (o) => o.defaultVisible === false
    ).map((o) => o.id)
    expect(optionHidden).toContain('salary')
    // The two sources must never drift.
    expect([...EMPLOYEE_DEFAULT_HIDDEN_COLUMN_IDS].sort()).toEqual(
      optionHidden.sort()
    )
  })

  test('Anställd is the only mandatory toggle option; drag handle is not listed', () => {
    const mandatory = EMPLOYEE_COLUMN_OPTIONS.filter((o) => o.mandatory)
    expect(mandatory.map((o) => o.id)).toEqual(['name'])
    expect(EMPLOYEE_COLUMN_OPTIONS.some((o) => o.id === 'dragHandle')).toBe(
      false
    )
  })
})
