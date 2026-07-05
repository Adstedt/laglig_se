/**
 * Story 7.4: the completeness rule matrix — each LAS-critical field missing
 * individually, combinations, the workspace kollektivavtal flag on/off, and
 * the masked-personnummer-counts-as-present contract.
 */
import { describe, test, expect } from 'vitest'
import {
  assessEmployeeCompleteness,
  COMPLETENESS_REASONS,
  type EmployeeCompletenessInput,
} from '@/lib/employees/employee-completeness'

function makeInput(
  overrides: Partial<EmployeeCompletenessInput> = {}
): EmployeeCompletenessInput {
  return {
    personnummer: '890503-2556',
    employment_date: new Date('2020-01-01'),
    employment_form: 'TV',
    personel_type: 'ARB',
    collective_agreement: { id: 'ca-1', name: 'Byggavtalet' },
    ...overrides,
  }
}

const OFF = { workspaceHasCollectiveAgreement: false }
const ON = { workspaceHasCollectiveAgreement: true }

describe('assessEmployeeCompleteness — complete rows', () => {
  test('all fields present, flag on → complete, no reasons', () => {
    expect(assessEmployeeCompleteness(makeInput(), ON)).toEqual({
      complete: true,
      reasons: [],
    })
  })

  test('all fields present, flag off, agreement missing → still complete', () => {
    const result = assessEmployeeCompleteness(
      makeInput({ collective_agreement: null }),
      OFF
    )
    expect(result.complete).toBe(true)
    expect(result.reasons).toEqual([])
  })
})

describe('assessEmployeeCompleteness — each field individually missing', () => {
  test.each([
    ['personnummer', { personnummer: null }, COMPLETENESS_REASONS.personnummer],
    [
      'employment_date',
      { employment_date: null },
      COMPLETENESS_REASONS.employment_date,
    ],
    [
      'employment_form',
      { employment_form: null },
      COMPLETENESS_REASONS.employment_form,
    ],
    [
      'personel_type',
      { personel_type: null },
      COMPLETENESS_REASONS.personel_type,
    ],
  ] as const)('missing %s → exactly one reason', (_name, overrides, reason) => {
    const result = assessEmployeeCompleteness(makeInput(overrides), OFF)
    expect(result.complete).toBe(false)
    expect(result.reasons).toEqual([reason])
  })

  test('missing kollektivavtal → reason ONLY when the workspace flag is on', () => {
    const input = makeInput({ collective_agreement: null })
    expect(assessEmployeeCompleteness(input, ON)).toEqual({
      complete: false,
      reasons: [COMPLETENESS_REASONS.collective_agreement],
    })
    expect(assessEmployeeCompleteness(input, OFF).complete).toBe(true)
  })
})

describe('assessEmployeeCompleteness — combinations & stable order', () => {
  test('everything missing, flag on → all five reasons in stable order', () => {
    const result = assessEmployeeCompleteness(
      {
        personnummer: null,
        employment_date: null,
        employment_form: null,
        personel_type: null,
        collective_agreement: null,
      },
      ON
    )
    expect(result.complete).toBe(false)
    expect(result.reasons).toEqual([
      'Saknar personnummer',
      'Saknar anställningsdatum',
      'Saknar anställningsform',
      'Saknar personaltyp',
      'Inget kollektivavtal tilldelat',
    ])
  })

  test('everything missing, flag off → four reasons (no kollektivavtal)', () => {
    const result = assessEmployeeCompleteness(
      {
        personnummer: null,
        employment_date: null,
        employment_form: null,
        personel_type: null,
        collective_agreement: null,
      },
      OFF
    )
    expect(result.reasons).toEqual([
      'Saknar personnummer',
      'Saknar anställningsdatum',
      'Saknar anställningsform',
      'Saknar personaltyp',
    ])
  })

  test('subset combination keeps stable order regardless of field "severity"', () => {
    const result = assessEmployeeCompleteness(
      makeInput({ personel_type: null, personnummer: null }),
      ON
    )
    expect(result.reasons).toEqual([
      'Saknar personnummer',
      'Saknar personaltyp',
    ])
  })
})

describe('assessEmployeeCompleteness — masked personnummer counts as present', () => {
  test('the mask means "exists but hidden" — no personnummer reason', () => {
    const result = assessEmployeeCompleteness(
      makeInput({ personnummer: '••••••-••••' }),
      ON
    )
    expect(result.complete).toBe(true)
    expect(result.reasons).toEqual([])
  })

  test('null-check only: any non-null string counts as present', () => {
    // The rule must never inspect mask strings beyond null-ness.
    const result = assessEmployeeCompleteness(
      makeInput({ personnummer: '' }),
      ON
    )
    expect(result.reasons).not.toContain(COMPLETENESS_REASONS.personnummer)
  })

  test('orthogonal to Inaktiv: rule reads no activity field at all', () => {
    // Structural input has no `inactive` — compile-time guarantee; assert the
    // complete verdict is driven purely by the five criteria.
    expect(assessEmployeeCompleteness(makeInput(), ON).complete).toBe(true)
  })
})
