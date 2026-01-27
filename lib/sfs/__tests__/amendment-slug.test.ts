/**
 * Unit tests for Amendment Slug Generator
 * Story 2.29: Amendment Document Pages
 */

import { describe, it, expect } from 'vitest'
import {
  generateAmendmentSlug,
  generateAmendmentTitle,
  parseSfsFromSlug,
} from '../amendment-slug'

describe('generateAmendmentSlug', () => {
  it('generates slug from SFS number and base law name', () => {
    const slug = generateAmendmentSlug(
      '2022:1109',
      'Lag (2022:1109) om ändring i arbetsmiljölagen (1977:1160)',
      'arbetsmiljölagen'
    )
    expect(slug).toBe('lag-om-andring-i-arbetsmiljolagen-2022-1109')
  })

  it('extracts base law name from title when baseLawName not provided', () => {
    const slug = generateAmendmentSlug(
      '2022:1109',
      'Lag (2022:1109) om ändring i arbetsmiljölagen (1977:1160)',
      null
    )
    expect(slug).toBe('lag-om-andring-i-arbetsmiljolagen-2022-1109')
  })

  it('handles förordningar', () => {
    const slug = generateAmendmentSlug(
      '2023:789',
      'Förordning (2023:789) om ändring i arbetsmiljöförordningen (1977:1166)',
      'arbetsmiljöförordningen'
    )
    expect(slug).toBe('lag-om-andring-i-arbetsmiljoforordningen-2023-789')
  })

  it('normalizes Swedish characters', () => {
    const slug = generateAmendmentSlug('2024:100', null, 'ärendelagen')
    expect(slug).toBe('lag-om-andring-i-arendelagen-2024-100')
  })

  it('handles SFS prefix in number', () => {
    const slug = generateAmendmentSlug(
      'SFS 2022:1109',
      null,
      'arbetsmiljölagen'
    )
    expect(slug).toBe('lag-om-andring-i-arbetsmiljolagen-2022-1109')
  })

  it('returns fallback when no title or baseLawName', () => {
    const slug = generateAmendmentSlug('2022:1109', null, null)
    expect(slug).toBe('lag-om-andring-i-lag-2022-1109')
  })
})

describe('generateAmendmentTitle', () => {
  it('generates standard amendment title', () => {
    const title = generateAmendmentTitle(
      '2022:1109',
      '1977:1160',
      'arbetsmiljölagen'
    )
    expect(title).toBe(
      'Lag (2022:1109) om ändring i arbetsmiljölagen (1977:1160)'
    )
  })

  it('uses fallback when baseLawName not provided', () => {
    const title = generateAmendmentTitle('2022:1109', '1977:1160', null)
    expect(title).toBe('Lag (2022:1109) om ändring i lagen (1977:1160)')
  })
})

describe('parseSfsFromSlug', () => {
  it('extracts SFS number from standard slug', () => {
    const sfs = parseSfsFromSlug('lag-om-andring-i-arbetsmiljolagen-2022-1109')
    expect(sfs).toBe('2022:1109')
  })

  it('extracts SFS number with different base law name', () => {
    const sfs = parseSfsFromSlug('lag-om-andring-i-lagen-2024-100')
    expect(sfs).toBe('2024:100')
  })

  it('returns null for invalid slug', () => {
    const sfs = parseSfsFromSlug('invalid-slug')
    expect(sfs).toBeNull()
  })

  it('returns null for slug without year-number suffix', () => {
    const sfs = parseSfsFromSlug('lag-om-andring-i-arbetsmiljolagen')
    expect(sfs).toBeNull()
  })
})
