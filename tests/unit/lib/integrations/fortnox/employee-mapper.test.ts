import { describe, it, expect } from 'vitest'
import {
  Prisma,
  EmploymentForm as PrismaEmploymentForm,
  PersonelType as PrismaPersonelType,
  SalaryForm as PrismaSalaryForm,
} from '@prisma/client'
import {
  toFortnox,
  fromFortnox,
  FortnoxMappingError,
  EMPLOYMENT_FORM_CODES,
  PERSONEL_TYPE_CODES,
  SALARY_FORM_CODES,
  type EmployeeMappable,
  type FortnoxEmployee,
} from '@/lib/integrations/fortnox/employee-mapper'

// ============================================================================
// Fixtures (mock-free — plain structural values)
// ============================================================================

function makeEmployee(
  overrides: Partial<EmployeeMappable> = {}
): EmployeeMappable {
  return {
    employee_id_ref: 'E42',
    personnummer: 'enc:v1:opaque-ciphertext',
    first_name: 'Anna',
    last_name: 'Svensson',
    email: 'anna@example.se',
    phone1: '070-1234567',
    phone2: '08-7654321',
    address1: 'Storgatan 1',
    address2: 'LGH 1101',
    post_code: '11122',
    city: 'Stockholm',
    country: 'SE',
    job_title: 'Snickare',
    employment_date: new Date('2020-01-15T00:00:00.000Z'),
    employed_to: new Date('2026-12-31T00:00:00.000Z'),
    employment_form: 'TV',
    personel_type: 'ARB',
    inactive: false,
    full_time_equivalent: 0.875,
    average_weekly_hours: 38.25,
    schedule_id: 'HELTID',
    salary_form: 'MAN',
    // Story 7.10: decrypted plaintext amounts (the mapper never sees ciphertext).
    monthly_salary: '45000.00',
    hourly_pay: '185.50',
    vacation_days_paid: 25.5,
    ...overrides,
  }
}

/** Full Fortnox sample covering every mapped property. */
function makeFortnoxSample(): FortnoxEmployee {
  return {
    EmployeeId: 'E42',
    PersonalIdentityNumber: 'enc:v1:opaque-ciphertext',
    FirstName: 'Anna',
    LastName: 'Svensson',
    Email: 'anna@example.se',
    Phone1: '070-1234567',
    Phone2: '08-7654321',
    Address1: 'Storgatan 1',
    Address2: 'LGH 1101',
    City: 'Stockholm',
    PostCode: '11122',
    Country: 'SE',
    JobTitle: 'Snickare',
    EmploymentDate: '2020-01-15',
    EmployedTo: '2026-12-31',
    EmploymentForm: 'TV',
    PersonelType: 'ARB',
    Inactive: false,
    FullTimeEquivalent: 0.875,
    AverageWeeklyHours: '38.25',
    ScheduleId: 'HELTID',
    SalaryForm: 'MAN',
    MonthlySalary: '45000.00',
    HourlyPay: '185.50',
    VacationDaysPaid: 25.5,
  }
}

// ============================================================================
// Round-trip (AC4)
// ============================================================================

describe('round-trip toFortnox(fromFortnox(sample))', () => {
  it('preserves every retained (mapped) field of a full Fortnox record', () => {
    const sample = makeFortnoxSample()
    const roundTripped = toFortnox(fromFortnox(sample))

    // ≈ sample for retained fields: every mapped property survives intact.
    // Unretained Fortnox fields (payroll/vacation ledger etc.) are preserved
    // via the sync job's fortnox_raw snapshot, not by the mapper.
    expect(roundTripped).toEqual(sample)
  })

  it('round-trips a fromFortnox output through toFortnox without conversion loss', () => {
    const input = fromFortnox(makeFortnoxSample())
    // EmployeeInput satisfies EmployeeMappable structurally (decimal strings,
    // Date fields) — the mapper accepts its own output.
    const payload = toFortnox(input)
    expect(payload.FullTimeEquivalent).toBe(0.875)
    expect(payload.AverageWeeklyHours).toBe('38.25')
    expect(payload.EmploymentDate).toBe('2020-01-15')
  })
})

// ============================================================================
// Minimal / degenerate records (AC3 + throw contract)
// ============================================================================

describe('fromFortnox — minimal record tolerance', () => {
  it('accepts a minimal record (Email/FirstName/LastName) without throwing', () => {
    const result = fromFortnox({
      Email: 'min@example.se',
      FirstName: 'Min',
      LastName: 'Imal',
    })

    expect(result.first_name).toBe('Min')
    expect(result.last_name).toBe('Imal')
    expect(result.email).toBe('min@example.se')
    // Everything else null (→ "Ej komplett" via 7.4's rule) or defaulted.
    expect(result.employee_id_ref).toBeNull()
    expect(result.personnummer).toBeNull()
    expect(result.phone1).toBeNull()
    expect(result.phone2).toBeNull()
    expect(result.address1).toBeNull()
    expect(result.address2).toBeNull()
    expect(result.post_code).toBeNull()
    expect(result.city).toBeNull()
    expect(result.job_title).toBeNull()
    expect(result.employment_date).toBeNull()
    expect(result.employed_to).toBeNull()
    expect(result.employment_form).toBeNull()
    expect(result.personel_type).toBeNull()
    expect(result.full_time_equivalent).toBeNull()
    expect(result.average_weekly_hours).toBeNull()
    expect(result.schedule_id).toBeNull()
    expect(result.salary_form).toBeNull()
    expect(result.vacation_days_paid).toBeNull()
    // Defaults, not nulls:
    expect(result.country).toBe('SE')
    expect(result.inactive).toBe(false)
  })

  it('throws the typed FortnoxMappingError when FirstName is missing', () => {
    expect(() => fromFortnox({ Email: 'x@x.se', LastName: 'Only' })).toThrow(
      FortnoxMappingError
    )
  })

  it('throws the typed FortnoxMappingError when LastName is missing', () => {
    expect(() => fromFortnox({ Email: 'x@x.se', FirstName: 'Only' })).toThrow(
      FortnoxMappingError
    )
  })

  it('treats whitespace-only names as missing (typed error, stable code)', () => {
    try {
      fromFortnox({ FirstName: '   ', LastName: 'Svensson' })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(FortnoxMappingError)
      expect((error as FortnoxMappingError).code).toBe(
        'FORTNOX_MISSING_REQUIRED_NAME'
      )
    }
  })

  it('rejects a fully empty Fortnox record (names missing — the only throw case)', () => {
    expect(() => fromFortnox({})).toThrow(FortnoxMappingError)
  })

  it('degrades malformed non-name fields to null instead of throwing', () => {
    const result = fromFortnox({
      FirstName: 'Anna',
      LastName: 'Svensson',
      EmploymentDate: 'not-a-date',
      EmploymentForm: 'XXX' as never,
      AverageWeeklyHours: 'abc',
      FullTimeEquivalent: Number.NaN,
    })
    expect(result.employment_date).toBeNull()
    expect(result.employment_form).toBeNull()
    expect(result.average_weekly_hours).toBeNull()
    expect(result.full_time_equivalent).toBeNull()
  })
})

describe('toFortnox — empty/degenerate employee', () => {
  it('never throws, even on an empty object (pure projection, nulls out)', () => {
    // Runtime tolerance beyond the type: toFortnox has NO throw case.
    const payload = toFortnox({} as EmployeeMappable)
    expect(payload.EmployeeId).toBeNull()
    expect(payload.FullTimeEquivalent).toBeNull()
    expect(payload.AverageWeeklyHours).toBeNull()
    expect(payload.EmploymentDate).toBeNull()
    expect(payload.Inactive).toBe(false)
    expect(payload.Country).toBe('SE')
  })
})

// ============================================================================
// Enum identity (loops the PRISMA enums — guards mapper↔schema drift)
// ============================================================================

describe('enum identity mapping', () => {
  it('mapper code lists exactly match the Prisma enums (drift guard)', () => {
    expect([...EMPLOYMENT_FORM_CODES].sort()).toEqual(
      Object.values(PrismaEmploymentForm).sort()
    )
    expect([...PERSONEL_TYPE_CODES].sort()).toEqual(
      Object.values(PrismaPersonelType).sort()
    )
    expect([...SALARY_FORM_CODES].sort()).toEqual(
      Object.values(PrismaSalaryForm).sort()
    )
  })

  it.each(Object.values(PrismaEmploymentForm))(
    'EmploymentForm %s maps by identity in both directions',
    (code) => {
      const input = fromFortnox({
        FirstName: 'A',
        LastName: 'B',
        EmploymentForm: code,
      })
      expect(input.employment_form).toBe(code)
      expect(toFortnox(input).EmploymentForm).toBe(code)
    }
  )

  it.each(Object.values(PrismaPersonelType))(
    'PersonelType %s maps by identity in both directions',
    (code) => {
      const input = fromFortnox({
        FirstName: 'A',
        LastName: 'B',
        PersonelType: code,
      })
      expect(input.personel_type).toBe(code)
      expect(toFortnox(input).PersonelType).toBe(code)
    }
  )

  it.each(Object.values(PrismaSalaryForm))(
    'SalaryForm %s maps by identity in both directions',
    (code) => {
      const input = fromFortnox({
        FirstName: 'A',
        LastName: 'B',
        SalaryForm: code,
      })
      expect(input.salary_form).toBe(code)
      expect(toFortnox(input).SalaryForm).toBe(code)
    }
  )

  it('degrades unknown enum codes to null (no throw, no passthrough)', () => {
    expect(
      toFortnox(makeEmployee({ employment_form: 'ZZZ' as never }))
        .EmploymentForm
    ).toBeNull()
  })
})

// ============================================================================
// Decimal boundary (first Prisma Decimal boundary in the codebase)
// ============================================================================

describe('Decimal boundary — precision-safe, string-based conversion', () => {
  it('converts Prisma Decimal via toString, never parseFloat (0.875 FTE exact)', () => {
    const payload = toFortnox(
      makeEmployee({
        full_time_equivalent: new Prisma.Decimal('0.875'),
        average_weekly_hours: new Prisma.Decimal('38.25'),
        vacation_days_paid: new Prisma.Decimal('25.5'),
      })
    )
    expect(payload.FullTimeEquivalent).toBe(0.875)
    expect(payload.AverageWeeklyHours).toBe('38.25')
    expect(payload.VacationDaysPaid).toBe(25.5)
  })

  it('round-trips Decimal precision through fromFortnox → toFortnox', () => {
    const input = fromFortnox({
      FirstName: 'A',
      LastName: 'B',
      FullTimeEquivalent: 0.875,
      AverageWeeklyHours: '38.25',
      VacationDaysPaid: 25.5,
    })
    // Precision-safe decimal STRINGS toward Prisma Decimal columns.
    expect(input.full_time_equivalent).toBe('0.875')
    expect(input.average_weekly_hours).toBe('38.25')
    expect(input.vacation_days_paid).toBe('25.5')

    const payload = toFortnox(input)
    expect(payload.FullTimeEquivalent).toBe(0.875)
    expect(payload.AverageWeeklyHours).toBe('38.25')
    expect(payload.VacationDaysPaid).toBe(25.5)
  })

  it('accepts plain numbers and numeric strings at the boundary', () => {
    const payload = toFortnox(
      makeEmployee({
        full_time_equivalent: 1,
        average_weekly_hours: '40',
        vacation_days_paid: '30.00',
      })
    )
    expect(payload.FullTimeEquivalent).toBe(1)
    expect(payload.AverageWeeklyHours).toBe('40')
    expect(payload.VacationDaysPaid).toBe(30)
  })

  it('degrades null/malformed numerics to null', () => {
    const payload = toFortnox(
      makeEmployee({
        full_time_equivalent: null,
        average_weekly_hours: 'not-a-number',
        vacation_days_paid: Number.NaN,
      })
    )
    expect(payload.FullTimeEquivalent).toBeNull()
    expect(payload.AverageWeeklyHours).toBeNull()
    expect(payload.VacationDaysPaid).toBeNull()
  })
})

// ============================================================================
// String-vs-float emission per field (Fortnox spec type split)
// ============================================================================

describe('string-vs-float Fortnox emission (spec-verified split)', () => {
  it('emits FullTimeEquivalent and VacationDaysPaid as numbers', () => {
    const payload = toFortnox(makeEmployee())
    expect(typeof payload.FullTimeEquivalent).toBe('number')
    expect(typeof payload.VacationDaysPaid).toBe('number')
  })

  it('emits AverageWeeklyHours as a string', () => {
    const payload = toFortnox(makeEmployee())
    expect(typeof payload.AverageWeeklyHours).toBe('string')
  })

  // Story 7.10: salary amounts are Fortnox STRINGS (spec split), mapped from
  // decrypted plaintext.
  it('emits MonthlySalary and HourlyPay as decimal strings', () => {
    const payload = toFortnox(makeEmployee())
    expect(payload.MonthlySalary).toBe('45000.00')
    expect(payload.HourlyPay).toBe('185.50')
    expect(typeof payload.MonthlySalary).toBe('string')
    expect(typeof payload.HourlyPay).toBe('string')
  })

  it('round-trips salary through fromFortnox → toFortnox', () => {
    const input = fromFortnox(makeFortnoxSample())
    expect(input.monthly_salary).toBe('45000.00')
    expect(input.hourly_pay).toBe('185.50')
    const payload = toFortnox(input)
    expect(payload.MonthlySalary).toBe('45000.00')
    expect(payload.HourlyPay).toBe('185.50')
  })

  it('nulls salary out on an empty record (never throws)', () => {
    const payload = toFortnox({} as EmployeeMappable)
    expect(payload.MonthlySalary).toBeNull()
    expect(payload.HourlyPay).toBeNull()
  })
})

// ============================================================================
// Dates
// ============================================================================

describe('date formats', () => {
  it('emits YYYY-MM-DD strings toward Fortnox from Date values', () => {
    const payload = toFortnox(makeEmployee())
    expect(payload.EmploymentDate).toBe('2020-01-15')
    expect(payload.EmployedTo).toBe('2026-12-31')
  })

  it('accepts ISO date strings on the employee side too', () => {
    const payload = toFortnox(
      makeEmployee({ employment_date: '2021-06-01T00:00:00.000Z' })
    )
    expect(payload.EmploymentDate).toBe('2021-06-01')
  })

  it('parses Fortnox YYYY-MM-DD into UTC-midnight Dates', () => {
    const input = fromFortnox(makeFortnoxSample())
    expect(input.employment_date).toBeInstanceOf(Date)
    expect(input.employment_date?.toISOString()).toBe(
      '2020-01-15T00:00:00.000Z'
    )
    expect(input.employed_to?.toISOString()).toBe('2026-12-31T00:00:00.000Z')
  })

  it('degrades invalid dates to null in both directions', () => {
    expect(
      toFortnox(makeEmployee({ employment_date: new Date('invalid') }))
        .EmploymentDate
    ).toBeNull()
    expect(
      fromFortnox({ FirstName: 'A', LastName: 'B', EmployedTo: '31/12/2026' })
        .employed_to
    ).toBeNull()
  })
})

// ============================================================================
// Country default
// ============================================================================

describe('country default (SE)', () => {
  it('defaults to SE inbound when Country is absent', () => {
    expect(fromFortnox({ FirstName: 'A', LastName: 'B' }).country).toBe('SE')
  })

  it('defaults to SE outbound when country is null', () => {
    expect(toFortnox(makeEmployee({ country: null })).Country).toBe('SE')
  })

  it('preserves an explicit non-SE country in both directions', () => {
    expect(
      fromFortnox({ FirstName: 'A', LastName: 'B', Country: 'NO' }).country
    ).toBe('NO')
    expect(toFortnox(makeEmployee({ country: 'NO' })).Country).toBe('NO')
  })
})

// ============================================================================
// Two-id distinction (business key vs sync metadata)
// ============================================================================

describe('id-field separation', () => {
  it('toFortnox emits EmployeeId from employee_id_ref only', () => {
    // Sneak a fortnox_employee_id onto the input — the mapper must not read it.
    const employee = {
      ...makeEmployee({ employee_id_ref: 'E42' }),
      fortnox_employee_id: 'fnx-internal-999',
    } as EmployeeMappable
    expect(toFortnox(employee).EmployeeId).toBe('E42')
  })

  it('fromFortnox writes employee_id_ref and never sync metadata', () => {
    const input = fromFortnox({
      FirstName: 'A',
      LastName: 'B',
      EmployeeId: 'E77',
    })
    expect(input.employee_id_ref).toBe('E77')
    // Sync metadata is owned by the future sync job — the mapper's output
    // must not contain those keys at all.
    expect(input).not.toHaveProperty('fortnox_employee_id')
    expect(input).not.toHaveProperty('fortnox_synced_at')
    expect(input).not.toHaveProperty('fortnox_sync_status')
    expect(input).not.toHaveProperty('fortnox_raw')
  })
})
