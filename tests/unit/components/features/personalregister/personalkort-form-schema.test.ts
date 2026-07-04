/**
 * Story 7.3: Personalkort form-schema tests — lenient-required design
 * (name-only save passes), Swedish personnummer messages, sysselsättningsgrad
 * bounds, and the form-values ↔ action-input mapping (%, masking, group
 * preservation).
 */
import { describe, test, expect } from 'vitest'
import {
  personalkortFormSchema,
  emptyFormValues,
  formValuesFromRow,
  toEmployeeInput,
} from '@/components/features/personalregister/personalkort-modal/form-schema'
import type { EmployeeRow } from '@/components/features/personalregister/employee-row'

function values(overrides: Partial<ReturnType<typeof emptyFormValues>> = {}) {
  return { ...emptyFormValues(), ...overrides }
}

describe('personalkortFormSchema', () => {
  test('name-only save passes (lenient-required design, AC6)', () => {
    const result = personalkortFormSchema.safeParse(
      values({ first_name: 'Anna', last_name: 'Svensson' })
    )
    expect(result.success).toBe(true)
  })

  test('missing förnamn/efternamn blocks save with Swedish messages', () => {
    const result = personalkortFormSchema.safeParse(values())
    expect(result.success).toBe(false)
    const messages = result.success
      ? []
      : result.error.issues.map((i) => i.message)
    expect(messages).toContain('Förnamn krävs')
    expect(messages).toContain('Efternamn krävs')
  })

  test('bad personnummer fails with the Swedish checksum message', () => {
    const result = personalkortFormSchema.safeParse(
      values({
        first_name: 'Anna',
        last_name: 'Svensson',
        personnummer: '640823-3235', // Luhn failure
      })
    )
    expect(result.success).toBe(false)
    const issue = result.success
      ? undefined
      : result.error.issues.find((i) => i.path[0] === 'personnummer')
    expect(issue?.message).toBe('Ogiltigt personnummer')
  })

  test('malformed personnummer fails with the Swedish format message', () => {
    const result = personalkortFormSchema.safeParse(
      values({ first_name: 'A', last_name: 'B', personnummer: '12-34' })
    )
    expect(result.success).toBe(false)
    const issue = result.success
      ? undefined
      : result.error.issues.find((i) => i.path[0] === 'personnummer')
    expect(issue?.message).toBe('Ogiltigt format — ange ÅÅMMDD-XXXX')
  })

  test('valid personnummer passes (with and without century/hyphen)', () => {
    for (const pnr of ['640823-3234', '19640823-3234', '6408233234']) {
      expect(
        personalkortFormSchema.safeParse(
          values({ first_name: 'A', last_name: 'B', personnummer: pnr })
        ).success
      ).toBe(true)
    }
  })

  test('sysselsättningsgrad accepts 0–100 (and empty), rejects outside', () => {
    const base = { first_name: 'A', last_name: 'B' }
    expect(
      personalkortFormSchema.safeParse(
        values({ ...base, employment_percent: '' })
      ).success
    ).toBe(true)
    expect(
      personalkortFormSchema.safeParse(
        values({ ...base, employment_percent: '100' })
      ).success
    ).toBe(true)
    expect(
      personalkortFormSchema.safeParse(
        values({ ...base, employment_percent: '87,5' })
      ).success
    ).toBe(true)
    expect(
      personalkortFormSchema.safeParse(
        values({ ...base, employment_percent: '101' })
      ).success
    ).toBe(false)
    expect(
      personalkortFormSchema.safeParse(
        values({ ...base, employment_percent: '-1' })
      ).success
    ).toBe(false)
    expect(
      personalkortFormSchema.safeParse(
        values({ ...base, employment_percent: 'abc' })
      ).success
    ).toBe(false)
  })

  test('negative veckoarbetstid/semesterdagar rejected', () => {
    const base = { first_name: 'A', last_name: 'B' }
    expect(
      personalkortFormSchema.safeParse(
        values({ ...base, average_weekly_hours: '-2' })
      ).success
    ).toBe(false)
    expect(
      personalkortFormSchema.safeParse(
        values({ ...base, vacation_days_paid: '-1' })
      ).success
    ).toBe(false)
  })
})

function makeRow(overrides: Partial<EmployeeRow> = {}): EmployeeRow {
  return {
    id: 'emp-1',
    first_name: 'Anna',
    last_name: 'Svensson',
    employee_id_ref: 'A-1',
    personnummer: '640823-3234',
    personnummer_masked: false,
    email: 'anna@example.se',
    phone1: null,
    phone2: null,
    address1: null,
    address2: null,
    post_code: null,
    city: null,
    country: 'SE',
    job_title: null,
    employment_date: new Date('2024-01-15T00:00:00Z'),
    employed_to: null,
    employment_form: 'TV',
    personel_type: 'TJM',
    salary_form: 'MAN',
    monthly_salary: '45000.00',
    hourly_pay: null,
    salary_masked: false,
    inactive: false,
    full_time_equivalent: 0.75,
    average_weekly_hours: 30,
    vacation_days_paid: 25,
    manager_id: null,
    group_id: 'grp-1',
    group: { id: 'grp-1', name: 'Lager' },
    collective_agreement_id: null,
    collective_agreement: null,
    ...overrides,
  } as EmployeeRow
}

describe('formValuesFromRow', () => {
  test('prefills from the serialized row; FTE shown as %', () => {
    const formValues = formValuesFromRow(makeRow())
    expect(formValues.first_name).toBe('Anna')
    expect(formValues.personnummer).toBe('640823-3234')
    expect(formValues.employment_percent).toBe('75')
    expect(formValues.average_weekly_hours).toBe('30')
    expect(formValues.employment_form).toBe('TV')
    expect(formValues.employment_date).toEqual(new Date('2024-01-15T00:00:00Z'))
  })

  test('a masked personnummer prefills as empty — the mask never round-trips', () => {
    const formValues = formValuesFromRow(
      makeRow({ personnummer: '••••••-••••', personnummer_masked: true })
    )
    expect(formValues.personnummer).toBe('')
  })

  test('Story 7.10: salary prefills from the decrypted canonical string', () => {
    const formValues = formValuesFromRow(
      makeRow({ monthly_salary: '45000.00', hourly_pay: null })
    )
    expect(formValues.monthly_salary).toBe('45000.00')
    expect(formValues.hourly_pay).toBe('')
  })

  test('Story 7.10: a masked salary prefills empty — the mask never round-trips', () => {
    const formValues = formValuesFromRow(
      makeRow({
        monthly_salary: '•••••',
        hourly_pay: '•••••',
        salary_masked: true,
      })
    )
    expect(formValues.monthly_salary).toBe('')
    expect(formValues.hourly_pay).toBe('')
  })
})

describe('toEmployeeInput', () => {
  test('converts % to the 0–1 decimal and empty strings to null', () => {
    const input = toEmployeeInput(
      values({
        first_name: 'Anna',
        last_name: 'Svensson',
        employment_percent: '75',
        average_weekly_hours: '',
        personnummer: '',
      }),
      null
    )
    expect(input.full_time_equivalent).toBe(0.75)
    expect(input.average_weekly_hours).toBeNull()
    expect(input.personnummer).toBeNull()
    expect(input.employment_form).toBeNull()
    expect(input.group_id).toBeNull()
  })

  // QA DATA-001 — three-state personnummer contract (client leg):
  //  masked prefill + empty  → key OMITTED (keep stored value),
  //  masked prefill + typed  → value sent (replace),
  //  plaintext prefill + cleared → null (deliberate clear),
  //  create mode (not masked) + empty → null (unchanged).

  test('DATA-001: masked prefill + untouched empty field omits the personnummer key (keep)', () => {
    const input = toEmployeeInput(
      values({ first_name: 'Anna', last_name: 'Svensson', personnummer: '' }),
      null,
      { personnummerMasked: true }
    )
    expect('personnummer' in input).toBe(false)
  })

  test('DATA-001: full masked round-trip — formValuesFromRow(masked) → toEmployeeInput omits the key', () => {
    const row = makeRow({
      personnummer: '••••••-••••',
      personnummer_masked: true,
    })
    const formValues = formValuesFromRow(row)
    expect(formValues.personnummer).toBe('')
    const input = toEmployeeInput(formValues, row.group_id, {
      personnummerMasked: row.personnummer_masked,
    })
    expect('personnummer' in input).toBe(false)
  })

  test('DATA-001: masked prefill + newly typed value sends the value (replace)', () => {
    const input = toEmployeeInput(
      values({
        first_name: 'Anna',
        last_name: 'Svensson',
        personnummer: '640823-3234',
      }),
      null,
      { personnummerMasked: true }
    )
    expect(input.personnummer).toBe('640823-3234')
  })

  test('DATA-001: plaintext prefill deliberately cleared sends null (clear)', () => {
    const input = toEmployeeInput(
      values({ first_name: 'Anna', last_name: 'Svensson', personnummer: '' }),
      null,
      { personnummerMasked: false }
    )
    expect('personnummer' in input).toBe(true)
    expect(input.personnummer).toBeNull()
  })

  // Story 7.10 — the SAME three-state contract for salary.
  test('Story 7.10: masked salary + untouched empty fields omit the salary keys (keep)', () => {
    const input = toEmployeeInput(
      values({
        first_name: 'Anna',
        last_name: 'Svensson',
        monthly_salary: '',
        hourly_pay: '',
      }),
      null,
      { salaryMasked: true }
    )
    expect('monthly_salary' in input).toBe(false)
    expect('hourly_pay' in input).toBe(false)
  })

  test('Story 7.10: masked salary + newly typed value sends the value (replace)', () => {
    const input = toEmployeeInput(
      values({
        first_name: 'Anna',
        last_name: 'Svensson',
        monthly_salary: '52000',
      }),
      null,
      { salaryMasked: true }
    )
    expect(input.monthly_salary).toBe('52000')
    // the untouched hourly field is still omitted (keep stored)
    expect('hourly_pay' in input).toBe(false)
  })

  test('Story 7.10: plaintext salary deliberately cleared sends null (clear)', () => {
    const input = toEmployeeInput(
      values({ first_name: 'Anna', last_name: 'Svensson', monthly_salary: '' }),
      null,
      { salaryMasked: false }
    )
    expect('monthly_salary' in input).toBe(true)
    expect(input.monthly_salary).toBeNull()
  })

  test('preserves the row group_id (the form has no group field)', () => {
    const input = toEmployeeInput(
      values({ first_name: 'A', last_name: 'B' }),
      'grp-1'
    )
    expect(input.group_id).toBe('grp-1')
  })

  test('dates serialize as ISO strings (toISODate output)', () => {
    const input = toEmployeeInput(
      values({
        first_name: 'A',
        last_name: 'B',
        employment_date: new Date(2024, 0, 15),
      }),
      null
    )
    expect(input.employment_date).toBe('2024-01-15')
    expect(input.employed_to).toBeNull()
  })

  test('decimal comma is accepted for numeric fields', () => {
    const input = toEmployeeInput(
      values({
        first_name: 'A',
        last_name: 'B',
        employment_percent: '87,5',
        vacation_days_paid: '12,5',
      }),
      null
    )
    expect(input.full_time_equivalent).toBe(0.875)
    expect(input.vacation_days_paid).toBe(12.5)
  })
})
