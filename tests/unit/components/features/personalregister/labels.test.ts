/**
 * Story 7.2: Guard against enum drift — every Fortnox-coded enum member must
 * have a Swedish label. If a member is added to the Prisma schema without a
 * label, these tests fail.
 */
import { describe, test, expect } from 'vitest'
import { EmploymentForm, PersonelType, SalaryForm } from '@prisma/client'
import {
  EMPLOYMENT_FORM_LABELS,
  PERSONEL_TYPE_LABELS,
  SALARY_FORM_LABELS,
  employmentFormLabel,
  personelTypeLabel,
  salaryFormLabel,
  EMPTY_FIELD_LABEL,
} from '@/components/features/personalregister/labels'

describe('employee enum labels', () => {
  test('every EmploymentForm member has a non-empty Swedish label', () => {
    for (const member of Object.values(EmploymentForm)) {
      expect(
        EMPLOYMENT_FORM_LABELS[member],
        `missing label for EmploymentForm.${member}`
      ).toBeTruthy()
    }
  })

  test('every PersonelType member has a non-empty Swedish label', () => {
    for (const member of Object.values(PersonelType)) {
      expect(
        PERSONEL_TYPE_LABELS[member],
        `missing label for PersonelType.${member}`
      ).toBeTruthy()
    }
  })

  test('every SalaryForm member has a non-empty Swedish label', () => {
    for (const member of Object.values(SalaryForm)) {
      expect(
        SALARY_FORM_LABELS[member],
        `missing label for SalaryForm.${member}`
      ).toBeTruthy()
    }
  })

  test('spot-check the canonical mappings', () => {
    expect(EMPLOYMENT_FORM_LABELS.TV).toBe('Tillsvidareanställning')
    expect(PERSONEL_TYPE_LABELS.TJM).toBe('Tjänsteman')
    expect(SALARY_FORM_LABELS.MAN).toBe('Månadslön')
  })

  test('helpers return the empty-field label for null', () => {
    expect(employmentFormLabel(null)).toBe(EMPTY_FIELD_LABEL)
    expect(personelTypeLabel(null)).toBe(EMPTY_FIELD_LABEL)
    expect(salaryFormLabel(null)).toBe(EMPTY_FIELD_LABEL)
    expect(employmentFormLabel(EmploymentForm.VIK)).toBe('Vikariat')
  })
})
