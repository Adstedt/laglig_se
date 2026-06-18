/**
 * Unit tests for the official SFS source link resolver.
 */
import { describe, it, expect } from 'vitest'
import { getOfficialSfsSource } from '../official-source'

describe('getOfficialSfsSource', () => {
  it('links 2018-04+ documents to the svenskforfattningssamling authentic page', () => {
    const r = getOfficialSfsSource('SFS 2026:1134', '2026-06-11', 'SFS_LAW')
    expect(r).toEqual({
      url: 'https://svenskforfattningssamling.se/doc/20261134.html',
      label: 'Svensk författningssamling',
    })
  })

  it('does not zero-pad short numbers in the doc URL', () => {
    const r = getOfficialSfsSource('SFS 2021:13', '2021-04-22', 'SFS_LAW')
    expect(r?.url).toBe('https://svenskforfattningssamling.se/doc/202113.html')
  })

  it('routes pre-2018 base laws to rkrattsbaser consolidated text', () => {
    const r = getOfficialSfsSource('SFS 1962:700', '1962-12-21', 'SFS_LAW')
    expect(r).toEqual({
      url: 'https://rkrattsbaser.gov.se/sfst?bet=1962:700',
      label: 'Lagtext (Regeringskansliet)',
    })
  })

  it('treats a missing publication date as pre-digital (safe rkrattsbaser fallback)', () => {
    const r = getOfficialSfsSource('SFS 1998:808', null, 'SFS_LAW')
    expect(r?.url).toBe('https://rkrattsbaser.gov.se/sfst?bet=1998:808')
  })

  it('still links 2018+ amendments to svenskforfattningssamling', () => {
    const r = getOfficialSfsSource(
      'SFS 2026:979',
      '2026-06-09',
      'SFS_AMENDMENT'
    )
    expect(r?.url).toBe('https://svenskforfattningssamling.se/doc/2026979.html')
  })

  it('returns null for pre-2018 amendments (no usable standalone page)', () => {
    // Caller should use the self-hosted PDF instead.
    expect(
      getOfficialSfsSource('SFS 2014:8', '2014-01-16', 'SFS_AMENDMENT')
    ).toBeNull()
  })

  it('returns null for malformed / non-SFS numbers (never guesses a URL)', () => {
    expect(
      getOfficialSfsSource('SFS N2020:7', '2020-08-13', 'SFS_LAW')
    ).toBeNull()
    expect(getOfficialSfsSource('N2021:13', '2021-04-22', 'SFS_LAW')).toBeNull()
    expect(getOfficialSfsSource('', '2020-01-01')).toBeNull()
  })

  it('uses the exact 2018-04-01 boundary', () => {
    expect(
      getOfficialSfsSource('SFS 2018:159', '2018-04-01', 'SFS_LAW')?.url
    ).toContain('svenskforfattningssamling.se')
    expect(
      getOfficialSfsSource('SFS 2018:158', '2018-03-31', 'SFS_LAW')?.url
    ).toContain('rkrattsbaser.gov.se')
  })
})
