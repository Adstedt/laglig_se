import { describe, it, expect } from 'vitest'
import { mapRegulatoryAreas } from '@/lib/shared/regulatory-area-mapper'

describe('mapRegulatoryAreas', () => {
  it('always includes GDPR and Bokföring', () => {
    const areas = mapRegulatoryAreas({
      legalForm: '',
      taxStatus: {},
      activityFlags: {},
    })
    expect(areas).toContain('GDPR')
    expect(areas).toContain('Bokföring')
  })

  it('maps AB to Bolagsrätt', () => {
    const areas = mapRegulatoryAreas({
      legalForm: 'AB',
      taxStatus: {},
      activityFlags: {},
    })
    expect(areas).toContain('Bolagsrätt')
    expect(areas).not.toContain('Handelsbolagslagen')
    expect(areas).not.toContain('Enskild näringsidkare')
  })

  it('maps HB to Handelsbolagslagen', () => {
    const areas = mapRegulatoryAreas({
      legalForm: 'HB',
      taxStatus: {},
      activityFlags: {},
    })
    expect(areas).toContain('Handelsbolagslagen')
  })

  it('maps KB to Handelsbolagslagen', () => {
    const areas = mapRegulatoryAreas({
      legalForm: 'KB',
      taxStatus: {},
      activityFlags: {},
    })
    expect(areas).toContain('Handelsbolagslagen')
  })

  it('maps EF to Enskild näringsidkare', () => {
    const areas = mapRegulatoryAreas({
      legalForm: 'EF',
      taxStatus: {},
      activityFlags: {},
    })
    expect(areas).toContain('Enskild näringsidkare')
  })

  it('maps f_tax to Skatterätt', () => {
    const areas = mapRegulatoryAreas({
      legalForm: '',
      taxStatus: { f_tax: true },
      activityFlags: {},
    })
    expect(areas).toContain('Skatterätt')
  })

  it('maps vat to Mervärdesskatt', () => {
    const areas = mapRegulatoryAreas({
      legalForm: '',
      taxStatus: { vat: true },
      activityFlags: {},
    })
    expect(areas).toContain('Mervärdesskatt')
  })

  it('maps employer to Arbetsrätt', () => {
    const areas = mapRegulatoryAreas({
      legalForm: '',
      taxStatus: { employer: true },
      activityFlags: {},
    })
    expect(areas).toContain('Arbetsrätt')
  })

  it('maps registered_for_vat_or_employer to Arbetsrätt', () => {
    const areas = mapRegulatoryAreas({
      legalForm: '',
      taxStatus: { registered_for_vat_or_employer: true },
      activityFlags: {},
    })
    expect(areas).toContain('Arbetsrätt')
  })

  it('maps activity flag chemicals to Kemikaliesäkerhet', () => {
    const areas = mapRegulatoryAreas({
      legalForm: '',
      taxStatus: {},
      activityFlags: { chemicals: true },
    })
    expect(areas).toContain('Kemikaliesäkerhet')
  })

  it('maps activity flag construction to Byggregler', () => {
    const areas = mapRegulatoryAreas({
      legalForm: '',
      taxStatus: {},
      activityFlags: { construction: true },
    })
    expect(areas).toContain('Byggregler')
  })

  it('maps activity flag food to Livsmedelssäkerhet', () => {
    const areas = mapRegulatoryAreas({
      legalForm: '',
      taxStatus: {},
      activityFlags: { food: true },
    })
    expect(areas).toContain('Livsmedelssäkerhet')
  })

  it('maps activity flag personalData to Dataskydd', () => {
    const areas = mapRegulatoryAreas({
      legalForm: '',
      taxStatus: {},
      activityFlags: { personalData: true },
    })
    expect(areas).toContain('Dataskydd')
  })

  it('maps activity flag heavyMachinery to Maskinsäkerhet & arbetsutrustning', () => {
    const areas = mapRegulatoryAreas({
      legalForm: '',
      taxStatus: {},
      activityFlags: { heavyMachinery: true },
    })
    expect(areas).toContain('Maskinsäkerhet & arbetsutrustning')
  })

  it('maps activity flag internationalOperations to Internationell handel', () => {
    const areas = mapRegulatoryAreas({
      legalForm: '',
      taxStatus: {},
      activityFlags: { internationalOperations: true },
    })
    expect(areas).toContain('Internationell handel')
  })

  it('does not include flag-based areas when flag is false', () => {
    const areas = mapRegulatoryAreas({
      legalForm: '',
      taxStatus: {},
      activityFlags: { chemicals: false, food: false },
    })
    expect(areas).not.toContain('Kemikaliesäkerhet')
    expect(areas).not.toContain('Livsmedelssäkerhet')
  })

  it('returns correct areas for AB + F-skatt + food flag', () => {
    const areas = mapRegulatoryAreas({
      legalForm: 'AB',
      taxStatus: { f_tax: true },
      activityFlags: { food: true },
    })
    expect(areas).toContain('GDPR')
    expect(areas).toContain('Bokföring')
    expect(areas).toContain('Bolagsrätt')
    expect(areas).toContain('Skatterätt')
    expect(areas).toContain('Livsmedelssäkerhet')
    expect(areas).toHaveLength(5)
  })

  it('returns correct areas for EF with no flags', () => {
    const areas = mapRegulatoryAreas({
      legalForm: 'EF',
      taxStatus: {},
      activityFlags: {},
    })
    expect(areas).toContain('GDPR')
    expect(areas).toContain('Bokföring')
    expect(areas).toContain('Enskild näringsidkare')
    expect(areas).toHaveLength(3)
  })
})
