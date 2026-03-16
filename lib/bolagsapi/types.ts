/**
 * BolagsAPI response types
 *
 * Type definitions matching the BolagsAPI `/v1/company/{orgnr}` response schema.
 * All properties except `name` and `orgnr` are optional since the API may
 * return partial data depending on the company and data availability.
 */

export interface BolagsApiOrgForm {
  code: string
  description?: string
}

export interface BolagsApiAddress {
  street?: string
  postal_code?: string
  city?: string
  municipality?: string
}

export interface BolagsApiSniCode {
  code: string
  description?: string
}

export interface BolagsApiBusiness {
  sni_codes?: BolagsApiSniCode[]
  description?: string
}

export interface BolagsApiTaxStatus {
  f_tax?: boolean
  vat?: boolean
  employer?: boolean
}

export interface BolagsApiParentCompany {
  name?: string
  orgnr?: string
}

export interface BolagsApiFi {
  registrations?: string[]
}

export interface BolagsApiStatus {
  active?: boolean
  status_text?: string
}

export interface BolagsApiOngoingProcedures {
  liquidation?: boolean
  restructuring?: boolean
}

export interface BolagsApiMeta {
  updated_at?: string
}

export interface BolagsApiCompany {
  name: string
  orgnr: string
  org_form?: BolagsApiOrgForm
  address?: BolagsApiAddress
  business?: BolagsApiBusiness
  tax_status?: BolagsApiTaxStatus
  registered_date?: string
  company_size?: string
  website?: string
  foreign_owned?: boolean
  parent_company?: BolagsApiParentCompany | null
  fi?: BolagsApiFi | null
  status?: BolagsApiStatus
  ongoing_procedures?: BolagsApiOngoingProcedures | null
  meta?: BolagsApiMeta
}

export interface BolagsApiValidationResult {
  valid: boolean
  exists: boolean
  formatted: string
}
