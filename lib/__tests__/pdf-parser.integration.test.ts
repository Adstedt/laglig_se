/**
 * Integration Tests for PDF Parser
 * Story 2.13 Task 1.3: Tests against actual PDF fixtures
 */

import { describe, it, expect } from 'vitest'
import * as path from 'path'
import { parsePdfFromPath } from '../external/pdf-parser'

const FIXTURES_DIR = path.join(
  __dirname,
  '..',
  '..',
  'tests',
  'fixtures',
  'amendment-pdfs'
)

describe('PDF Parser Integration', () => {
  it('should parse SFS 2024:804 amendment (arbetsmiljölagen)', async () => {
    const result = await parsePdfFromPath(
      path.join(FIXTURES_DIR, 'SFS2024-804.pdf')
    )

    expect(result.sfsNumber).toBe('2024:804')
    expect(result.baseLaw).toEqual({
      name: 'arbetsmiljölagen',
      sfsNumber: '1977:1160',
    })
    expect(result.effectiveDate).toBe('2024-11-08')
    expect(result.pageCount).toBe(1)
    // This amendment repeals 8 kap. 4 § - detected via "dels att 8 kap. 4 § ska upphävas" pattern
    expect(result.affectedSections).toContainEqual({
      chapter: '8',
      section: '4',
      type: 'repealed',
    })
  })

  it('should parse SFS 2019:614 amendment with section detection', async () => {
    const result = await parsePdfFromPath(
      path.join(FIXTURES_DIR, 'SFS2019-614.pdf')
    )

    expect(result.sfsNumber).toBe('2019:614')
    expect(result.baseLaw).toEqual({
      name: 'arbetsmiljölagen',
      sfsNumber: '1977:1160',
    })
    expect(result.effectiveDate).toBe('2019-11-15')
    // Should detect "2 kap. 8 § arbetsmiljölagen (1977:1160)2 ska ha följande lydelse"
    expect(result.affectedSections).toContainEqual({
      chapter: '2',
      section: '8',
      type: 'amended',
    })
  })

  it('should parse SFS 2020:449 amendment with section detection', async () => {
    const result = await parsePdfFromPath(
      path.join(FIXTURES_DIR, 'SFS2020-449.pdf')
    )

    expect(result.sfsNumber).toBe('2020:449')
    expect(result.baseLaw).toEqual({
      name: 'arbetsmiljölagen',
      sfsNumber: '1977:1160',
    })
    expect(result.effectiveDate).toBe('2020-07-01')
    // Should detect "6 kap. 17 § arbetsmiljölagen (1977:1160)2 ska ha följande lydelse"
    expect(result.affectedSections).toContainEqual({
      chapter: '6',
      section: '17',
      type: 'amended',
    })
  })

  it('should parse SFS 2022:1109 amendment (arbetsmiljölagen)', async () => {
    const result = await parsePdfFromPath(
      path.join(FIXTURES_DIR, 'SFS2022-1109.pdf')
    )

    expect(result.sfsNumber).toBe('2022:1109')
    expect(result.baseLaw).toEqual({
      name: 'arbetsmiljölagen',
      sfsNumber: '1977:1160',
    })
    expect(result.effectiveDate).toBe('2022-07-25')
    expect(result.pageCount).toBe(3)
  })

  it('should parse SFS 2025:1458 amendment (miljötillsynsförordningen)', async () => {
    const result = await parsePdfFromPath(
      path.join(FIXTURES_DIR, 'SFS2025-1458.pdf')
    )

    expect(result.sfsNumber).toBe('2025:1458')
    // This PDF has multiple law references; the base law detection finds the first one
    expect(result.baseLaw).toBeDefined()
    expect(result.baseLaw?.sfsNumber).toMatch(/\d{4}:\d+/)
    expect(result.effectiveDate).toBe('2026-01-15')
    expect(result.pageCount).toBe(3)
  })

  it('should parse SFS 2025:1461 amendment with sections', async () => {
    const result = await parsePdfFromPath(
      path.join(FIXTURES_DIR, 'SFS2025-1461.pdf')
    )

    expect(result.sfsNumber).toBe('2025:1461')
    // The base law is "lagen om tilläggsskatt (2023:875)"
    expect(result.baseLaw).toBeDefined()
    expect(result.baseLaw?.sfsNumber).toBe('2023:875')
    expect(result.baseLaw?.name).toContain('lagen')
    expect(result.effectiveDate).toBe('2026-01-01')
    expect(result.pageCount).toBe(14)
    // This document should have detected section amendments
    expect(result.affectedSections.length).toBeGreaterThan(0)
  })

  it('should parse historical PDF from rkrattsdb (SFS 2010:1225)', async () => {
    const result = await parsePdfFromPath(
      path.join(FIXTURES_DIR, 'SFS2010-1225-rkrattsdb.pdf')
    )

    expect(result.sfsNumber).toBe('2010:1225')
    expect(result.baseLaw).toEqual({
      name: 'arbetsmiljölagen',
      sfsNumber: '1977:1160',
    })
    expect(result.effectiveDate).toBe('2011-01-01')
    expect(result.pageCount).toBe(2)
  })

  it('should handle all valid fixtures without throwing', async () => {
    const validFixtures = [
      'SFS2000-764-rkrattsdb.pdf',
      'SFS2003-365-rkrattsdb.pdf',
      'SFS2008-934-rkrattsdb.pdf',
      'SFS2010-1225-rkrattsdb.pdf',
      'SFS2019-614.pdf',
      'SFS2020-449.pdf',
      'SFS2022-1109.pdf',
      'SFS2023-349.pdf',
      'SFS2024-804.pdf',
      'SFS2025-1458.pdf',
      'SFS2025-1461.pdf',
    ]

    for (const fixture of validFixtures) {
      const filePath = path.join(FIXTURES_DIR, fixture)
      await expect(parsePdfFromPath(filePath)).resolves.toBeDefined()
    }
  })
})
