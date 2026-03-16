/**
 * BolagsAPI response mapper
 *
 * Maps BolagsAPI `/v1/company/{orgnr}` response to Partial<CompanyProfile>.
 * Only includes fields that have actual data — skips null/undefined values.
 */

import type { EmployeeCountRange } from '@prisma/client'
import type { BolagsApiCompany } from './types'

/** Fields from CompanyProfile that the mapper can set */
interface MappedProfile {
  company_name: string
  org_number: string
  legal_form: string
  address: string
  municipality: string
  sni_code: string
  industry_label: string
  business_description: string
  tax_status: Record<string, boolean>
  registered_date: Date
  founded_year: number
  employee_count_range: EmployeeCountRange
  website_url: string
  foreign_owned: boolean
  parent_company_name: string
  parent_company_orgnr: string
  fi_regulated: boolean
  active_status: string
  ongoing_procedures: Record<string, boolean>
  data_source: string
  last_enriched_at: Date
}

const DIRECT_LEGAL_FORMS = new Set(['AB', 'HB', 'KB', 'EF'])

function mapLegalForm(code: string): string {
  return DIRECT_LEGAL_FORMS.has(code) ? code : 'OVRIGT'
}

function mapCompanySize(size: string): EmployeeCountRange {
  switch (size.toLowerCase()) {
    case 'small':
      return 'RANGE_1_9'
    case 'medium':
      return 'RANGE_10_49'
    case 'large':
      return 'RANGE_250_PLUS'
    default:
      return 'UNKNOWN'
  }
}

function formatOrgNumber(orgnr: string): string {
  const digits = orgnr.replace(/\D/g, '')
  if (digits.length === 10) {
    return `${digits.slice(0, 6)}-${digits.slice(6)}`
  }
  return orgnr
}

/**
 * Maps a BolagsAPI company response to a partial CompanyProfile.
 * Only sets fields that have data — callers can spread the result
 * into a Prisma update/create payload.
 */
export function mapBolagsApiToProfile(
  response: BolagsApiCompany
): Partial<MappedProfile> {
  const result: Partial<MappedProfile> = {}

  // Always set these
  result.company_name = response.name
  result.org_number = formatOrgNumber(response.orgnr)
  result.data_source = 'bolagsapi'
  result.last_enriched_at = new Date()

  if (response.org_form?.code) {
    result.legal_form = mapLegalForm(response.org_form.code)
  }

  // Compose address from parts
  const addr = response.address
  if (addr) {
    const parts = [addr.street, addr.postal_code, addr.city].filter(Boolean)
    if (parts.length > 0) {
      result.address = parts.join(', ')
    }
    if (addr.municipality) {
      result.municipality = addr.municipality
    }
  }

  // Business / SNI
  const biz = response.business
  if (biz) {
    const primarySni = biz.sni_codes?.[0]
    if (primarySni?.code) {
      result.sni_code = primarySni.code
    }
    if (primarySni?.description) {
      result.industry_label = primarySni.description
    }
    if (biz.description) {
      result.business_description = biz.description
    }
  }

  // Tax status
  if (response.tax_status) {
    result.tax_status = { ...response.tax_status }
  }

  // Registration date + founded year
  if (response.registered_date) {
    const date = new Date(response.registered_date)
    if (!isNaN(date.getTime())) {
      result.registered_date = date
      result.founded_year = date.getFullYear()
    }
  }

  // Company size
  if (response.company_size) {
    result.employee_count_range = mapCompanySize(response.company_size)
  }

  // Website
  if (response.website) {
    result.website_url = response.website
  }

  // Foreign ownership
  if (response.foreign_owned !== undefined && response.foreign_owned !== null) {
    result.foreign_owned = response.foreign_owned
  }

  // Parent company
  if (response.parent_company) {
    if (response.parent_company.name) {
      result.parent_company_name = response.parent_company.name
    }
    if (response.parent_company.orgnr) {
      result.parent_company_orgnr = response.parent_company.orgnr
    }
  }

  // FI regulation
  if (response.fi) {
    result.fi_regulated =
      Array.isArray(response.fi.registrations) &&
      response.fi.registrations.length > 0
  }

  // Active status
  if (response.status?.status_text) {
    result.active_status = response.status.status_text
  }

  // Ongoing procedures
  if (response.ongoing_procedures) {
    result.ongoing_procedures = { ...response.ongoing_procedures }
  }

  return result
}
