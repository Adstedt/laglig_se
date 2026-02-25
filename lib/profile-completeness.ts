/**
 * Story 14.4: Profile completeness calculation.
 * Pure utility — kept outside 'use server' so it can be imported anywhere.
 */

import type { CompanyProfile } from '@prisma/client'

interface ActivityFlags {
  chemicals?: boolean
  construction?: boolean
  food?: boolean
  personalData?: boolean
  publicSector?: boolean
  heavyMachinery?: boolean
  minorEmployees?: boolean
  internationalOperations?: boolean
}

/**
 * Calculate profile completeness as an integer 0-100.
 *
 * Core fields (10% each, 50% total):
 *   company_name, organization_type, industry_label, employee_count_range, municipality
 *
 * Extended fields (5% each, 50% total):
 *   sni_code, activity_flags (≥1 true), certifications (≥1 item), compliance_maturity,
 *   workforce_composition, revenue_range, founded_year, has_collective_agreement,
 *   website_url, collective_agreement_name
 */
export function calculateProfileCompleteness(
  profile: Pick<
    CompanyProfile,
    | 'company_name'
    | 'organization_type'
    | 'industry_label'
    | 'employee_count_range'
    | 'municipality'
    | 'sni_code'
    | 'activity_flags'
    | 'certifications'
    | 'compliance_maturity'
    | 'workforce_composition'
    | 'revenue_range'
    | 'founded_year'
    | 'has_collective_agreement'
    | 'website_url'
    | 'collective_agreement_name'
  >
): number {
  let score = 0

  // Core fields — 10% each (50% total)
  if (profile.company_name) score += 10
  if (profile.organization_type) score += 10
  if (profile.industry_label) score += 10
  if (profile.employee_count_range) score += 10
  if (profile.municipality) score += 10

  // Extended fields — 5% each (50% total)
  if (profile.sni_code) score += 5

  if (profile.activity_flags) {
    const flags = profile.activity_flags as ActivityFlags
    const hasAnyTrue = Object.values(flags).some((v) => v === true)
    if (hasAnyTrue) score += 5
  }

  if (profile.certifications && profile.certifications.length > 0) score += 5
  if (profile.compliance_maturity) score += 5
  if (profile.workforce_composition) score += 5
  if (profile.revenue_range) score += 5
  if (profile.founded_year) score += 5
  if (profile.has_collective_agreement) score += 5
  if (profile.website_url) score += 5
  if (profile.collective_agreement_name) score += 5

  return score
}
