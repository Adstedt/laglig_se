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

  // Legal form — keep in sync with the baseline forms in
  // lib/agent/skills/baseline-laws.ts so the preview matches what generation seeds.
  if (legalForm === 'AB') {
    areas.push('Bolagsrätt')
  } else if (legalForm === 'HB' || legalForm === 'KB') {
    areas.push('Handelsbolagslagen')
  } else if (legalForm === 'EF') {
    areas.push('Enskild näringsidkare')
  } else if (legalForm === 'EKONOMISK_FORENING' || legalForm === 'EK') {
    areas.push('Föreningsrätt')
  } else if (legalForm === 'STIFTELSE') {
    areas.push('Stiftelserätt')
  } else if (legalForm === 'IDEELL') {
    areas.push('Föreningsrätt')
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
