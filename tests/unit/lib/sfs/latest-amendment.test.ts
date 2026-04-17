import { describe, it, expect } from 'vitest'
import { getLatestAmendmentSfs } from '@/lib/sfs/latest-amendment'

describe('getLatestAmendmentSfs', () => {
  it('returns null for empty array', () => {
    expect(getLatestAmendmentSfs([])).toBeNull()
  })

  it('returns null when no amendment has amending_document', () => {
    expect(
      getLatestAmendmentSfs([
        {
          effective_date: new Date('2024-01-01'),
          amending_document: null,
        },
      ])
    ).toBeNull()
  })

  it('picks the amendment with the latest effective_date', () => {
    expect(
      getLatestAmendmentSfs([
        {
          effective_date: new Date('2022-01-01'),
          amending_document: { document_number: 'SFS 2022:100' },
        },
        {
          effective_date: new Date('2024-06-15'),
          amending_document: { document_number: 'SFS 2024:500' },
        },
        {
          effective_date: new Date('2023-03-01'),
          amending_document: { document_number: 'SFS 2023:200' },
        },
      ])
    ).toBe('SFS 2024:500')
  })

  it('falls back to publication_date when effective_date is null', () => {
    expect(
      getLatestAmendmentSfs([
        {
          effective_date: null,
          publication_date: new Date('2023-01-01'),
          amending_document: { document_number: 'SFS 2023:1' },
        },
        {
          effective_date: null,
          publication_date: new Date('2024-01-01'),
          amending_document: { document_number: 'SFS 2024:1' },
        },
      ])
    ).toBe('SFS 2024:1')
  })

  it('accepts ISO string dates (from SWR/cached serialization)', () => {
    expect(
      getLatestAmendmentSfs([
        {
          effective_date: '2022-06-01',
          amending_document: { document_number: 'SFS 2022:99' },
        },
        {
          effective_date: '2025-03-15',
          amending_document: { document_number: 'SFS 2025:42' },
        },
      ])
    ).toBe('SFS 2025:42')
  })

  it('normalizes raw document_number without SFS prefix', () => {
    expect(
      getLatestAmendmentSfs([
        {
          effective_date: new Date('2024-01-01'),
          amending_document: { document_number: '2024:500' },
        },
      ])
    ).toBe('SFS 2024:500')
  })

  it('preserves existing SFS prefix', () => {
    expect(
      getLatestAmendmentSfs([
        {
          effective_date: new Date('2024-01-01'),
          amending_document: { document_number: 'SFS 2024:500' },
        },
      ])
    ).toBe('SFS 2024:500')
  })

  it('falls back to parsing SFS from amending_law_title when amending_document is null', () => {
    expect(
      getLatestAmendmentSfs([
        {
          effective_date: new Date('2024-06-15'),
          amending_document: null,
          amending_law_title: 'Lag (2024:500) om ändring i arbetsmiljölagen',
        },
        {
          effective_date: new Date('2022-01-01'),
          amending_document: null,
          amending_law_title: 'Lag (2022:100) om ändring i arbetsmiljölagen',
        },
      ])
    ).toBe('SFS 2024:500')
  })

  it('mixes linked and unlinked amendments — prefers latest regardless of source', () => {
    expect(
      getLatestAmendmentSfs([
        {
          effective_date: new Date('2022-01-01'),
          amending_document: { document_number: 'SFS 2022:100' },
        },
        {
          effective_date: new Date('2024-06-15'),
          amending_document: null,
          amending_law_title: 'Lag (2024:500) om ändring i...',
        },
      ])
    ).toBe('SFS 2024:500')
  })

  it('falls back to SFS-number sort when all dates are null (year desc)', () => {
    expect(
      getLatestAmendmentSfs([
        {
          effective_date: null,
          amending_document: null,
          amending_law_title: 'Lag (1994:579) om ändring i...',
        },
        {
          effective_date: null,
          amending_document: null,
          amending_law_title: 'Lag (2023:100) om ändring i...',
        },
        {
          effective_date: null,
          amending_document: null,
          amending_law_title: 'Lag (2010:856) om ändring i...',
        },
      ])
    ).toBe('SFS 2023:100')
  })

  it('uses sequence number as tie-breaker within the same year', () => {
    expect(
      getLatestAmendmentSfs([
        {
          effective_date: null,
          amending_document: null,
          amending_law_title: 'Lag (2024:100) om ändring i...',
        },
        {
          effective_date: null,
          amending_document: null,
          amending_law_title: 'Lag (2024:1100) om ändring i...',
        },
        {
          effective_date: null,
          amending_document: null,
          amending_law_title: 'Lag (2024:500) om ändring i...',
        },
      ])
    ).toBe('SFS 2024:1100')
  })

  it('prefers entries with dates over those without when tied on year', () => {
    expect(
      getLatestAmendmentSfs([
        {
          effective_date: new Date('2024-06-15'),
          amending_document: { document_number: 'SFS 2024:500' },
        },
        {
          effective_date: null,
          amending_document: null,
          amending_law_title: 'Lag (2024:999) om ändring i...',
        },
      ])
    ).toBe('SFS 2024:500')
  })
})
