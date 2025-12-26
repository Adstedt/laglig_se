/**
 * Unit tests for SFS PDF URL construction
 *
 * Story 2.28: Unified SFS PDF Sync & Document Classification
 */

import { describe, it, expect } from 'vitest'
import {
  constructPdfUrls,
  parseSfsNumber,
  extractYearMonth,
  padSfsNumber,
  constructStoragePath,
  extractSfsFromStoragePath,
} from '@/lib/sfs/pdf-urls'

describe('parseSfsNumber', () => {
  it('parses standard format "2025:1581"', () => {
    const result = parseSfsNumber('2025:1581')
    expect(result).toEqual({ year: '2025', number: '1581' })
  })

  it('parses format with "SFS " prefix', () => {
    const result = parseSfsNumber('SFS 2025:1581')
    expect(result).toEqual({ year: '2025', number: '1581' })
  })

  it('parses short numbers "2025:1"', () => {
    const result = parseSfsNumber('2025:1')
    expect(result).toEqual({ year: '2025', number: '1' })
  })

  it('parses long numbers "2025:12345"', () => {
    const result = parseSfsNumber('2025:12345')
    expect(result).toEqual({ year: '2025', number: '12345' })
  })

  it('returns null for invalid format', () => {
    expect(parseSfsNumber('invalid')).toBeNull()
    expect(parseSfsNumber('2025')).toBeNull()
    expect(parseSfsNumber('')).toBeNull()
    expect(parseSfsNumber('2025-1581')).toBeNull()
  })

  it('handles lowercase "sfs" prefix', () => {
    const result = parseSfsNumber('sfs 2024:100')
    expect(result).toEqual({ year: '2024', number: '100' })
  })
})

describe('extractYearMonth', () => {
  it('extracts year-month from string "YYYY-MM-DD"', () => {
    expect(extractYearMonth('2025-12-23')).toBe('2025-12')
    expect(extractYearMonth('2024-01-01')).toBe('2024-01')
    expect(extractYearMonth('2023-06-15')).toBe('2023-06')
  })

  it('extracts year-month from Date object', () => {
    const date = new Date('2025-12-23T00:00:00Z')
    expect(extractYearMonth(date)).toBe('2025-12')
  })

  it('returns null for invalid input', () => {
    expect(extractYearMonth(null)).toBeNull()
    expect(extractYearMonth(undefined)).toBeNull()
    expect(extractYearMonth('')).toBeNull()
    expect(extractYearMonth('invalid')).toBeNull()
  })

  it('handles partial date strings', () => {
    expect(extractYearMonth('2025-12')).toBe('2025-12')
  })
})

describe('padSfsNumber', () => {
  it('pads single digit', () => {
    expect(padSfsNumber('1')).toBe('0001')
  })

  it('pads two digits', () => {
    expect(padSfsNumber('12')).toBe('0012')
  })

  it('pads three digits', () => {
    expect(padSfsNumber('123')).toBe('0123')
  })

  it('does not pad four digits', () => {
    expect(padSfsNumber('1234')).toBe('1234')
  })

  it('does not modify five+ digits', () => {
    expect(padSfsNumber('12345')).toBe('12345')
  })
})

describe('constructPdfUrls', () => {
  it('constructs correct URLs for standard SFS number', () => {
    const result = constructPdfUrls('2025:1581', '2025-12-23')

    expect(result.html).toBe(
      'https://svenskforfattningssamling.se/doc/20251581.html'
    )
    expect(result.pdf).toBe(
      'https://svenskforfattningssamling.se/sites/default/files/sfs/2025-12/SFS2025-1581.pdf'
    )
    expect(result.year).toBe('2025')
    expect(result.number).toBe('1581')
    expect(result.yearMonth).toBe('2025-12')
  })

  it('pads SFS numbers correctly in HTML URL (123 → 0123)', () => {
    const result = constructPdfUrls('2025:123', '2025-01-15')

    // HTML uses padded number
    expect(result.html).toBe(
      'https://svenskforfattningssamling.se/doc/20250123.html'
    )
    // PDF uses original number
    expect(result.pdf).toBe(
      'https://svenskforfattningssamling.se/sites/default/files/sfs/2025-01/SFS2025-123.pdf'
    )
  })

  it('extracts year-month from publication date', () => {
    const result = constructPdfUrls('2024:456', '2024-06-15')

    expect(result.yearMonth).toBe('2024-06')
    expect(result.pdf).toContain('/2024-06/')
  })

  it('handles Date object for publication date', () => {
    const date = new Date('2025-03-10T00:00:00Z')
    const result = constructPdfUrls('2025:100', date)

    expect(result.yearMonth).toBe('2025-03')
    expect(result.pdf).toContain('/2025-03/')
  })

  it('uses fallback when no publication date provided', () => {
    const result = constructPdfUrls('2025:500')

    expect(result.yearMonth).toBeNull()
    // Fallback uses year-01
    expect(result.pdf).toContain('/2025-01/')
  })

  it('handles "SFS " prefix', () => {
    const result = constructPdfUrls('SFS 2024:789', '2024-04-01')

    expect(result.year).toBe('2024')
    expect(result.number).toBe('789')
    expect(result.html).toBe(
      'https://svenskforfattningssamling.se/doc/20240789.html'
    )
  })

  it('throws error for invalid SFS number', () => {
    expect(() => constructPdfUrls('invalid')).toThrow('Invalid SFS number')
  })

  it('handles single-digit SFS numbers', () => {
    const result = constructPdfUrls('2025:1', '2025-01-01')

    expect(result.html).toBe(
      'https://svenskforfattningssamling.se/doc/20250001.html'
    )
    expect(result.pdf).toContain('SFS2025-1.pdf')
  })
})

describe('constructStoragePath', () => {
  it('constructs correct path for standard SFS number', () => {
    expect(constructStoragePath('2025:1581')).toBe('2025/SFS2025-1581.pdf')
  })

  it('constructs correct path for short number', () => {
    expect(constructStoragePath('2025:1')).toBe('2025/SFS2025-1.pdf')
  })

  it('handles SFS prefix', () => {
    expect(constructStoragePath('SFS 2024:100')).toBe('2024/SFS2024-100.pdf')
  })

  it('throws error for invalid SFS number', () => {
    expect(() => constructStoragePath('invalid')).toThrow('Invalid SFS number')
  })
})

describe('extractSfsFromStoragePath', () => {
  it('extracts SFS number from storage path', () => {
    expect(extractSfsFromStoragePath('2025/SFS2025-1581.pdf')).toBe('2025:1581')
  })

  it('extracts SFS number from short number path', () => {
    expect(extractSfsFromStoragePath('2025/SFS2025-1.pdf')).toBe('2025:1')
  })

  it('handles long numbers', () => {
    expect(extractSfsFromStoragePath('2024/SFS2024-12345.pdf')).toBe(
      '2024:12345'
    )
  })

  it('returns null for invalid paths', () => {
    expect(extractSfsFromStoragePath('invalid')).toBeNull()
    expect(extractSfsFromStoragePath('2025/something.pdf')).toBeNull()
    expect(extractSfsFromStoragePath('')).toBeNull()
  })
})
