/**
 * Story 7.7: lib/employees/labels.ts — the lib-side Swedish label module
 * (lib may not import from components; personalregister/labels.ts stays the
 * UI's source of truth).
 *
 * DRIFT GUARD: the lib maps must stay IDENTICAL to the personalregister maps
 * — a label edit in one place must fail here until mirrored.
 */

import { describe, it, expect } from 'vitest'
import {
  EMPLOYMENT_FORM_LABELS,
  PERSONEL_TYPE_LABELS,
  EMPTY_FIELD_LABEL,
  employmentFormLabel,
  personelTypeLabel,
  formatEmploymentDate,
  formatFullTimeEquivalent,
  employeeStatusLabel,
} from '@/lib/employees/labels'
import {
  EMPLOYMENT_FORM_LABELS as UI_EMPLOYMENT_FORM_LABELS,
  PERSONEL_TYPE_LABELS as UI_PERSONEL_TYPE_LABELS,
  EMPTY_FIELD_LABEL as UI_EMPTY_FIELD_LABEL,
} from '@/components/features/personalregister/labels'

describe('lib/employees/labels — drift guard vs personalregister', () => {
  it('EMPLOYMENT_FORM_LABELS is identical to the UI map', () => {
    expect(EMPLOYMENT_FORM_LABELS).toEqual(UI_EMPLOYMENT_FORM_LABELS)
  })

  it('PERSONEL_TYPE_LABELS is identical to the UI map', () => {
    expect(PERSONEL_TYPE_LABELS).toEqual(UI_PERSONEL_TYPE_LABELS)
  })

  it('EMPTY_FIELD_LABEL matches the UI convention ("Ej ifylld")', () => {
    expect(EMPTY_FIELD_LABEL).toBe(UI_EMPTY_FIELD_LABEL)
    expect(EMPTY_FIELD_LABEL).toBe('Ej ifylld')
  })
})

describe('label helpers', () => {
  it('null-safe label functions fall back to "Ej ifylld"', () => {
    expect(employmentFormLabel(null)).toBe('Ej ifylld')
    expect(personelTypeLabel(null)).toBe('Ej ifylld')
    expect(employmentFormLabel('TV')).toBe('Tillsvidareanställning')
    expect(personelTypeLabel('ARB')).toBe('Arbetare')
  })

  it('formatEmploymentDate → YYYY-MM-DD, Ej ifylld for null/invalid', () => {
    expect(formatEmploymentDate(new Date('2020-03-01T12:00:00Z'))).toBe(
      '2020-03-01'
    )
    expect(formatEmploymentDate('2021-06-15')).toBe('2021-06-15')
    expect(formatEmploymentDate(null)).toBe('Ej ifylld')
    expect(formatEmploymentDate('not-a-date')).toBe('Ej ifylld')
  })

  it('formatFullTimeEquivalent → percent; 0 is a real value; null missing', () => {
    expect(formatFullTimeEquivalent(1)).toBe('100 %')
    expect(formatFullTimeEquivalent(0.75)).toBe('75 %')
    expect(formatFullTimeEquivalent(0.875)).toBe('87.5 %')
    expect(formatFullTimeEquivalent(0)).toBe('0 %')
    expect(formatFullTimeEquivalent(null)).toBe('Ej ifylld')
    expect(formatFullTimeEquivalent(undefined)).toBe('Ej ifylld')
    expect(formatFullTimeEquivalent({ toNumber: () => 0.5 })).toBe('50 %')
  })

  it('employeeStatusLabel → Aktiv/Inaktiv', () => {
    expect(employeeStatusLabel(false)).toBe('Aktiv')
    expect(employeeStatusLabel(true)).toBe('Inaktiv')
  })
})
