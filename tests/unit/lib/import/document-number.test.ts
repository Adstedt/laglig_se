/**
 * Story 24.3 AC 2: parseDocumentNumber unit tests.
 *
 * Coverage matrix per AC: SFS (with/without prefix, leading zeros), AFS,
 * MSBFS, NFS, BFS, SOSFS, HSLF-FS, ELSÄK-FS, SKVFS, TSFS (one each), one
 * synthetic future-agency to prove the open-set principle, EU paren / EU
 * directive / EU bare / CELEX, and 3+ negatives.
 */

import { describe, it, expect } from 'vitest'
import {
  parseDocumentNumber,
  suffixMatches,
} from '@/lib/import/document-number'

describe('parseDocumentNumber — SFS-like, prefixed', () => {
  it('parses canonical SFS', () => {
    const r = parseDocumentNumber('SFS 1977:1160')
    expect(r).toEqual({
      series: 'SFS',
      canonical: 'SFS 1977:1160',
      year: '1977',
      number: '1160',
      kind: 'SFS_LIKE',
    })
  })

  it('uppercases prefix', () => {
    expect(parseDocumentNumber('sfs 1977:1160')?.series).toBe('SFS')
    expect(parseDocumentNumber('Sfs 1977:1160')?.canonical).toBe(
      'SFS 1977:1160'
    )
  })

  it('collapses internal whitespace + trims', () => {
    expect(parseDocumentNumber('  SFS  1977:1160 ')?.canonical).toBe(
      'SFS 1977:1160'
    )
  })

  it('preserves leading zeros on number', () => {
    const r = parseDocumentNumber('SFS 1962:0381')
    expect(r?.number).toBe('0381')
    expect(r?.canonical).toBe('SFS 1962:0381')
  })

  it('accepts trailing chapter suffix and discards it from canonical', () => {
    // Catalog stores some AFS rows as "AFS 2023:15 kap. 8" — parser strips
    // the suffix so input "AFS 2023:15" exact-matches.
    const r = parseDocumentNumber('AFS 2023:15 kap. 8')
    expect(r?.canonical).toBe('AFS 2023:15')
    expect(r?.year).toBe('2023')
    expect(r?.number).toBe('15')
  })
})

describe('parseDocumentNumber — agency open-set', () => {
  // Real prefixes verified from the live LegalDocument catalog (Story 24.3 Task 0)
  const cases: Array<[string, string]> = [
    ['AFS 2023:3', 'AFS'],
    ['MSBFS 2009:5', 'MSBFS'],
    ['BFS 2011:16', 'BFS'],
    ['SSMFS 2018:4', 'SSMFS'],
    ['ELSÄK-FS 2019:1', 'ELSÄK-FS'],
    ['NFS 2020:1', 'NFS'],
    ['SRVFS 2008:1', 'SRVFS'],
    ['KIFS 2017:7', 'KIFS'],
    ['MCFFS 2020:2', 'MCFFS'],
    ['SCB-FS 2011:1', 'SCB-FS'],
    ['STAFS 2020:1', 'STAFS'],
    ['SKVFS 2014:5', 'SKVFS'],
    ['HSLF-FS 2022:30', 'HSLF-FS'],
    ['SOSFS 2014:5', 'SOSFS'],
    ['TSFS 2020:42', 'TSFS'],
  ]

  it.each(cases)('parses %s with series=%s', (input, series) => {
    const r = parseDocumentNumber(input)
    expect(r?.series).toBe(series)
    expect(r?.kind).toBe('SFS_LIKE')
    expect(r?.canonical).toBe(input)
  })

  it('open-set proof — synthetic future agency code', () => {
    // The point of the open-set design: a brand-new agency we've never
    // seen before should parse without code change.
    const r = parseDocumentNumber('ZZFS 2030:1')
    expect(r?.series).toBe('ZZFS')
    expect(r?.canonical).toBe('ZZFS 2030:1')
    expect(r?.kind).toBe('SFS_LIKE')
  })
})

describe('parseDocumentNumber — bare YYYY:NNN', () => {
  it('parses bare with series=null', () => {
    const r = parseDocumentNumber('1977:1160')
    expect(r).toEqual({
      series: null,
      canonical: '1977:1160',
      year: '1977',
      number: '1160',
      kind: 'SFS_LIKE',
    })
  })
})

describe('parseDocumentNumber — EU forms', () => {
  it('parses EU paren regulation', () => {
    expect(parseDocumentNumber('(EU) 2016/679')).toEqual({
      series: 'EU',
      canonical: '(EU) 2016/679',
      year: '2016',
      number: '679',
      kind: 'EU_REG',
    })
  })

  it('parses (EG) 1907/2006', () => {
    expect(parseDocumentNumber('(EG) 1907/2006')?.series).toBe('EG')
    expect(parseDocumentNumber('(EG) 1907/2006')?.kind).toBe('EU_REG')
  })

  it('parses EU directive trailing form', () => {
    expect(parseDocumentNumber('2010/75/EU')).toEqual({
      series: 'EU',
      canonical: '2010/75/EU',
      year: '2010',
      number: '75',
      kind: 'EU_DIR',
    })
  })

  it('parses EU bare YYYY/NNN', () => {
    expect(parseDocumentNumber('2016/679')).toEqual({
      series: null,
      canonical: '2016/679',
      year: '2016',
      number: '679',
      kind: 'EU_REG',
    })
  })

  it('parses CELEX regulation form', () => {
    const r = parseDocumentNumber('32016R0679')
    expect(r?.series).toBe('EU')
    expect(r?.year).toBe('2016')
    expect(r?.number).toBe('679') // leading zero stripped
    expect(r?.canonical).toBe('(EU) 2016/679')
    expect(r?.kind).toBe('EU_REG')
  })

  it('parses CELEX directive form', () => {
    const r = parseDocumentNumber('32020L1833')
    expect(r?.series).toBe('EU')
    expect(r?.canonical).toBe('2020/1833/EU')
    expect(r?.kind).toBe('EU_DIR')
  })

  it('parses Regulation (EU) catalog format → short paren canonical', () => {
    const r = parseDocumentNumber('Regulation (EU) 2024/3239')
    expect(r?.canonical).toBe('(EU) 2024/3239')
    expect(r?.kind).toBe('EU_REG')
  })

  it('parses Directive (EU) catalog format → trailing canonical', () => {
    const r = parseDocumentNumber('Directive (EU) 2010/75')
    expect(r?.canonical).toBe('2010/75/EU')
    expect(r?.kind).toBe('EU_DIR')
  })
})

describe('parseDocumentNumber — negatives', () => {
  it.each([
    'foobar',
    '',
    '   ',
    'NJA 2023 s. 45', // court case ref — out of scope
    '32008L0098R(07)', // CELEX with correction suffix — out of scope
    'random text 1234',
    'SFS', // prefix without number
    '1977', // year without number
  ])('rejects %j', (input) => {
    expect(parseDocumentNumber(input)).toBeNull()
  })

  it('rejects non-string inputs gracefully', () => {
    // @ts-expect-error — guarding against runtime junk
    expect(parseDocumentNumber(undefined)).toBeNull()
    // @ts-expect-error — guarding against runtime junk
    expect(parseDocumentNumber(null)).toBeNull()
    // @ts-expect-error — guarding against runtime junk
    expect(parseDocumentNumber(123)).toBeNull()
  })
})

describe('suffixMatches', () => {
  it('matches identical year+number across different prefixes', () => {
    const a = parseDocumentNumber('AFS 2020:5')!
    const b = parseDocumentNumber('MSBFS 2020:5')!
    expect(suffixMatches(a, b)).toBe(true)
  })

  it('matches "(EU) 2016/679" against CELEX "32016R0679" (dual-format bridge)', () => {
    const a = parseDocumentNumber('(EU) 2016/679')!
    const b = parseDocumentNumber('32016R0679')!
    expect(suffixMatches(a, b)).toBe(true)
  })

  it('strips leading zeros for comparison', () => {
    // CELEX-decoded "39" should suffix-match SFS-style "0039"
    const a = parseDocumentNumber('SFS 2020:0039')!
    const b = parseDocumentNumber('32020R0039')!
    expect(suffixMatches(a, b)).toBe(true)
  })

  it('does NOT match when year differs', () => {
    const a = parseDocumentNumber('AFS 2019:5')!
    const b = parseDocumentNumber('AFS 2020:5')!
    expect(suffixMatches(a, b)).toBe(false)
  })

  it('does NOT match when number differs', () => {
    const a = parseDocumentNumber('AFS 2020:5')!
    const b = parseDocumentNumber('AFS 2020:50')!
    expect(suffixMatches(a, b)).toBe(false)
  })
})
