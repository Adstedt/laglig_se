import { describe, it, expect } from 'vitest'
import { calculateProfileCompleteness } from '@/lib/profile-completeness'

function makeProfile(
  overrides: Partial<Parameters<typeof calculateProfileCompleteness>[0]> = {}
): Parameters<typeof calculateProfileCompleteness>[0] {
  return {
    company_name: null,
    organization_type: null,
    industry_label: null,
    employee_count_range: null,
    municipality: null,
    sni_code: null,
    activity_flags: null,
    certifications: [],
    compliance_maturity: null,
    workforce_composition: null,
    revenue_range: null,
    founded_year: null,
    has_collective_agreement: false,
    website_url: null,
    collective_agreement_name: null,
    business_description: null,
    tax_status: null,
    ...overrides,
  }
}

describe('calculateProfileCompleteness', () => {
  it('adds 5% when tax_status is present', () => {
    const without = makeProfile({ company_name: 'Test AB' })
    const with_ = makeProfile({
      company_name: 'Test AB',
      tax_status: { f_tax: true, vat: false, employer: false },
    })

    expect(calculateProfileCompleteness(with_)).toBe(
      calculateProfileCompleteness(without) + 5
    )
  })

  it('does not add tax_status points when null', () => {
    const profile = makeProfile({ company_name: 'Test AB', tax_status: null })
    expect(calculateProfileCompleteness(profile)).toBe(10) // company_name only
  })

  it('clamps at 100 when all fields filled', () => {
    const profile = makeProfile({
      company_name: 'Full AB',
      organization_type: 'AB',
      industry_label: 'IT',
      employee_count_range: 'RANGE_10_49',
      municipality: 'Stockholm',
      sni_code: '62010',
      activity_flags: { chemicals: true },
      certifications: ['ISO 9001'],
      compliance_maturity: 'ADVANCED',
      workforce_composition: { fullTime: 10 },
      revenue_range: 'RANGE_10M_50M',
      founded_year: 2000,
      has_collective_agreement: true,
      website_url: 'https://example.com',
      collective_agreement_name: 'Teknikavtalet',
      business_description: 'IT-konsultföretag',
      tax_status: { f_tax: true, vat: true, employer: true },
    })

    // 50% core + 60% extended = 110% → clamped to 100
    expect(calculateProfileCompleteness(profile)).toBe(100)
  })
})
