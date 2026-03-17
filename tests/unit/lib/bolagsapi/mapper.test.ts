import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mapBolagsApiToProfile } from '@/lib/bolagsapi/mapper'
import type { BolagsApiCompany } from '@/lib/bolagsapi/types'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-16T12:00:00Z'))
})

const FULL_RESPONSE: BolagsApiCompany = {
  name: 'Laglig AB',
  orgnr: '5591234567',
  org_form: { code: 'AB', description: 'Aktiebolag' },
  address: {
    street: 'Kungsgatan 10',
    postal_code: '111 43',
    city: 'Stockholm',
    municipality: 'Stockholm',
  },
  business: {
    sni_codes: [{ code: '62010', description: 'Dataprogrammering' }],
    description: 'Utveckling av juridisk mjukvara',
  },
  tax_status: { f_tax: true, vat: true, employer: true },
  registered_date: '2020-03-15',
  company_size: 'small',
  website: 'https://laglig.se',
  foreign_owned: false,
  parent_company: null,
  fi: null,
  status: { active: true, status_text: 'active' },
  ongoing_procedures: null,
  meta: { updated_at: '2026-03-10T08:00:00Z' },
}

describe('mapBolagsApiToProfile', () => {
  it('maps a full response correctly', () => {
    const result = mapBolagsApiToProfile(FULL_RESPONSE)

    expect(result.company_name).toBe('Laglig AB')
    expect(result.org_number).toBe('559123-4567')
    expect(result.legal_form).toBe('AB')
    expect(result.address).toBe('Kungsgatan 10, 111 43, Stockholm')
    expect(result.municipality).toBe('Stockholm')
    expect(result.sni_code).toBe('62010')
    expect(result.industry_label).toBe('Dataprogrammering')
    expect(result.business_description).toBe('Utveckling av juridisk mjukvara')
    expect(result.tax_status).toEqual({
      f_tax: true,
      vat: true,
      employer: true,
    })
    expect(result.registered_date).toEqual(new Date('2020-03-15'))
    expect(result.founded_year).toBe(2020)
    expect(result.employee_count_range).toBe('RANGE_1_9')
    expect(result.website_url).toBe('https://laglig.se')
    expect(result.foreign_owned).toBe(false)
    expect(result.active_status).toBe('active')
    expect(result.data_source).toBe('bolagsapi')
    expect(result.last_enriched_at).toEqual(new Date('2026-03-16T12:00:00Z'))
  })

  it('handles partial response with missing fields', () => {
    const partial: BolagsApiCompany = {
      name: 'Minimal AB',
      orgnr: '5591234567',
    }

    const result = mapBolagsApiToProfile(partial)

    expect(result.company_name).toBe('Minimal AB')
    expect(result.org_number).toBe('559123-4567')
    expect(result.data_source).toBe('bolagsapi')
    expect(result.last_enriched_at).toBeDefined()
    // Missing fields should not be set
    expect(result.legal_form).toBeUndefined()
    expect(result.address).toBeUndefined()
    expect(result.municipality).toBeUndefined()
    expect(result.sni_code).toBeUndefined()
    expect(result.business_description).toBeUndefined()
    expect(result.tax_status).toBeUndefined()
    expect(result.registered_date).toBeUndefined()
    expect(result.website_url).toBeUndefined()
  })

  it('maps company_size "medium" to RANGE_10_49', () => {
    const response: BolagsApiCompany = {
      name: 'Medium AB',
      orgnr: '5591234567',
      company_size: 'medium',
    }

    const result = mapBolagsApiToProfile(response)
    expect(result.employee_count_range).toBe('RANGE_10_49')
  })

  it('maps company_size "large" to RANGE_250_PLUS', () => {
    const response: BolagsApiCompany = {
      name: 'Big AB',
      orgnr: '5591234567',
      company_size: 'large',
    }

    const result = mapBolagsApiToProfile(response)
    expect(result.employee_count_range).toBe('RANGE_250_PLUS')
  })

  it('maps unrecognized company_size to UNKNOWN', () => {
    const response: BolagsApiCompany = {
      name: 'Unknown AB',
      orgnr: '5591234567',
      company_size: 'micro',
    }

    const result = mapBolagsApiToProfile(response)
    expect(result.employee_count_range).toBe('UNKNOWN')
  })

  it('maps org_form codes: AB direct, BRF to OVRIGT', () => {
    const ab: BolagsApiCompany = {
      name: 'AB Co',
      orgnr: '5591234567',
      org_form: { code: 'AB' },
    }
    expect(mapBolagsApiToProfile(ab).legal_form).toBe('AB')

    const brf: BolagsApiCompany = {
      name: 'BRF',
      orgnr: '5591234567',
      org_form: { code: 'BRF' },
    }
    expect(mapBolagsApiToProfile(brf).legal_form).toBe('OVRIGT')
  })

  it('sets fi_regulated true when fi has registrations', () => {
    const response: BolagsApiCompany = {
      name: 'FI Co',
      orgnr: '5591234567',
      fi: { registrations: ['Fondbolag'] },
    }

    const result = mapBolagsApiToProfile(response)
    expect(result.fi_regulated).toBe(true)
  })

  it('does not set fi_regulated when fi is null', () => {
    const response: BolagsApiCompany = {
      name: 'No FI',
      orgnr: '5591234567',
      fi: null,
    }

    const result = mapBolagsApiToProfile(response)
    expect(result.fi_regulated).toBeUndefined()
  })

  it('maps parent company fields', () => {
    const response: BolagsApiCompany = {
      name: 'Child AB',
      orgnr: '5591234567',
      parent_company: { name: 'Parent Corp', orgnr: '5561234567' },
    }

    const result = mapBolagsApiToProfile(response)
    expect(result.parent_company_name).toBe('Parent Corp')
    expect(result.parent_company_orgnr).toBe('5561234567')
  })

  it('formats org number with hyphen', () => {
    const response: BolagsApiCompany = {
      name: 'Test',
      orgnr: '5591234567',
    }

    const result = mapBolagsApiToProfile(response)
    expect(result.org_number).toBe('559123-4567')
  })
})
