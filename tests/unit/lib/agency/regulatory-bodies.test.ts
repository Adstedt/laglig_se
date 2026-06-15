import { describe, it, expect } from 'vitest'
import {
  parseAgencyPrefix,
  regulatoryBodyForPrefix,
  deriveAgencyAttribution,
} from '@/lib/agency/regulatory-bodies'

describe('parseAgencyPrefix', () => {
  it('extracts simple prefixes', () => {
    expect(parseAgencyPrefix('SOSFS 2011:9')).toBe('SOSFS')
    expect(parseAgencyPrefix('AFS 2023:1')).toBe('AFS')
    expect(parseAgencyPrefix('MSBFS 2020:1')).toBe('MSBFS')
  })

  it('handles hyphenated prefixes', () => {
    expect(parseAgencyPrefix('HSLF-FS 2022:30')).toBe('HSLF-FS')
    expect(parseAgencyPrefix('ELSÄK-FS 2022:1')).toBe('ELSÄK-FS')
  })

  it('handles chapter-sliced numbers (AFS omnibus)', () => {
    expect(parseAgencyPrefix('AFS 2023:15 kap. 8')).toBe('AFS')
  })

  it('returns null for non-agency numbers', () => {
    expect(parseAgencyPrefix('SFS 1977:1160')).toBe('SFS') // prefix extracted, but not in body map
    expect(parseAgencyPrefix('not a doc number')).toBeNull()
    expect(parseAgencyPrefix('')).toBeNull()
  })
})

describe('regulatoryBodyForPrefix', () => {
  it('resolves known prefixes', () => {
    expect(regulatoryBodyForPrefix('SOSFS')).toBe('Socialstyrelsen')
    expect(regulatoryBodyForPrefix('HSLF-FS')).toBe('Socialstyrelsen')
    expect(regulatoryBodyForPrefix('AFS')).toBe('Arbetsmiljöverket')
  })

  it('falls back to upper-case lookup', () => {
    expect(regulatoryBodyForPrefix('sosfs')).toBe('Socialstyrelsen')
  })

  it('returns null for unknown prefixes', () => {
    expect(regulatoryBodyForPrefix('SFS')).toBeNull()
    expect(regulatoryBodyForPrefix('XYZ')).toBeNull()
  })
})

describe('deriveAgencyAttribution', () => {
  it('derives both fields for Socialstyrelsen docs', () => {
    expect(deriveAgencyAttribution('SOSFS 2011:9')).toEqual({
      agencyPrefix: 'SOSFS',
      regulatoryBody: 'Socialstyrelsen',
    })
    expect(deriveAgencyAttribution('HSLF-FS 2022:30')).toEqual({
      agencyPrefix: 'HSLF-FS',
      regulatoryBody: 'Socialstyrelsen',
    })
  })

  it('returns prefix but null body for non-mapped prefixes', () => {
    expect(deriveAgencyAttribution('SFS 1977:1160')).toEqual({
      agencyPrefix: 'SFS',
      regulatoryBody: null,
    })
  })

  it('returns nulls for unparseable input', () => {
    expect(deriveAgencyAttribution('garbage')).toEqual({
      agencyPrefix: null,
      regulatoryBody: null,
    })
  })
})
