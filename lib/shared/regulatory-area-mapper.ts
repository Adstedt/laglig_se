interface RegulatoryAreaInput {
  legalForm: string
  taxStatus: Partial<Record<string, boolean>>
  activityFlags: Record<string, boolean>
}

/**
 * Map company data to regulatory area tags using static rules + LLM-inferred flags.
 * Shared utility used by Story 16.2 (preview) and Story 16.3 (onboarding questions).
 *
 * Returns Swedish regulatory area names.
 */
export function mapRegulatoryAreas(input: RegulatoryAreaInput): string[] {
  const { legalForm, taxStatus, activityFlags } = input
  const areas: string[] = []

  // Universal — every company
  areas.push('GDPR')
  areas.push('Bokföring')

  // Legal form
  if (legalForm === 'AB') {
    areas.push('Bolagsrätt')
  } else if (legalForm === 'HB' || legalForm === 'KB') {
    areas.push('Handelsbolagslagen')
  } else if (legalForm === 'EF') {
    areas.push('Enskild näringsidkare')
  }

  // Tax status
  if (taxStatus.f_tax) {
    areas.push('Skatterätt')
  }
  if (taxStatus.vat) {
    areas.push('Mervärdesskatt')
  }

  // Employer status (employer flag OR registered_for_vat_or_employer)
  if (taxStatus.employer || taxStatus.registered_for_vat_or_employer) {
    areas.push('Arbetsrätt')
  }

  // Activity flags from LLM inference
  if (activityFlags.chemicals) {
    areas.push('Kemikaliesäkerhet')
  }
  if (activityFlags.construction) {
    areas.push('Byggregler')
  }
  if (activityFlags.food) {
    areas.push('Livsmedelssäkerhet')
  }
  if (activityFlags.personalData) {
    areas.push('Dataskydd')
  }
  if (activityFlags.heavyMachinery) {
    areas.push('Maskinsäkerhet & arbetsutrustning')
  }
  if (activityFlags.internationalOperations) {
    areas.push('Internationell handel')
  }

  return areas
}
