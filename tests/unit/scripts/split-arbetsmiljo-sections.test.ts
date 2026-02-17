/**
 * Unit Tests for Split Arbetsmiljö Sections Script
 *
 * Tests cover: section definitions, routing maps, getNewSectionNumber logic
 * for all Notisum sections (01-09), section overrides, and edge cases.
 */

import { describe, it, expect, vi } from 'vitest'

// ── Hoisted mocks ──────────────────────────────────────────────────────────
// Mock Prisma and fs so the module can be imported without side effects
const { mockReadFileSync } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
}))

vi.mock('@prisma/client', () => ({
  PrismaClient: function () {
    return {
      $disconnect: vi.fn(),
    }
  },
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    readFileSync: mockReadFileSync,
    default: {
      ...(actual['default'] as Record<string, unknown>),
      readFileSync: mockReadFileSync,
    },
  }
})

import {
  SECTION_DEFINITIONS,
  SECTION_09_ROUTING,
  NOTISUM_TO_NEW_SECTION,
  SECTION_OVERRIDES,
  getNewSectionNumber,
} from '@/scripts/split-arbetsmiljo-sections'
import type { AnalysisEntry } from '@/scripts/seed-arbetsmiljo-template'

// ============================================================================
// Test Helpers
// ============================================================================

function makeEntry(
  fullReference: string,
  originalSection: string
): AnalysisEntry {
  return {
    fullReference,
    title: 'Test',
    originalIndex: '--',
    originalSection,
  }
}

// ============================================================================
// Section Definitions
// ============================================================================

describe('SECTION_DEFINITIONS', () => {
  it('has exactly 8 sections', () => {
    expect(SECTION_DEFINITIONS).toHaveLength(8)
  })

  it('has sequential section numbers 01-08', () => {
    const numbers = SECTION_DEFINITIONS.map((d) => d.number)
    expect(numbers).toEqual(['01', '02', '03', '04', '05', '06', '07', '08'])
  })

  it('has sequential positions 1-8', () => {
    const positions = SECTION_DEFINITIONS.map((d) => d.position)
    expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('all sections have name and description', () => {
    for (const def of SECTION_DEFINITIONS) {
      expect(def.name.length).toBeGreaterThan(0)
      expect(def.description.length).toBeGreaterThan(0)
    }
  })

  it('section names match plan', () => {
    expect(SECTION_DEFINITIONS[0]!.name).toBe('Alla arbetsgivares skyldigheter')
    expect(SECTION_DEFINITIONS[1]!.name).toBe('Anställda, rättigheter & HR')
    expect(SECTION_DEFINITIONS[4]!.name).toBe(
      'Maskiner, lyft & teknisk utrustning'
    )
    expect(SECTION_DEFINITIONS[7]!.name).toBe('Transport, kör- & vilotider')
  })
})

// ============================================================================
// SECTION_09_ROUTING
// ============================================================================

describe('SECTION_09_ROUTING', () => {
  it('has 43 entries (all S09 documents)', () => {
    expect(Object.keys(SECTION_09_ROUTING)).toHaveLength(43)
  })

  it('all values are valid section numbers (02-08, no S01)', () => {
    const validSections = new Set(['02', '03', '04', '05', '06', '07', '08'])
    for (const [, section] of Object.entries(SECTION_09_ROUTING)) {
      expect(validSections.has(section)).toBe(true)
    }
  })

  it('routes 1 item to S02 (HR)', () => {
    const s02 = Object.values(SECTION_09_ROUTING).filter((v) => v === '02')
    expect(s02).toHaveLength(1)
    expect(SECTION_09_ROUTING['SKVFS 2015:6']).toBe('02')
  })

  it('routes 1 item to S03 (Arbetsplats)', () => {
    const s03 = Object.values(SECTION_09_ROUTING).filter((v) => v === '03')
    expect(s03).toHaveLength(1)
    expect(SECTION_09_ROUTING['AFS 2023:2 (ersatter AFS 1993:2)']).toBe('03')
  })

  it('routes 8 items to S05 (Maskiner)', () => {
    const s05 = Object.values(SECTION_09_ROUTING).filter((v) => v === '05')
    expect(s05).toHaveLength(8)
    expect(SECTION_09_ROUTING['AFS 2023:5']).toBe('05')
    expect(SECTION_09_ROUTING['AFS 2023:11']).toBe('05')
    expect(SECTION_09_ROUTING['AFS 2023:11 (ersatter AFS 2013:4)']).toBe('05')
  })

  it('routes 16 items to S06 (Farliga ämnen)', () => {
    const s06 = Object.values(SECTION_09_ROUTING).filter((v) => v === '06')
    expect(s06).toHaveLength(16)
    expect(SECTION_09_ROUTING['SFS 2018:396']).toBe('06')
    expect(SECTION_09_ROUTING['AFS 2023:13 (ersatter AFS 2006:1)']).toBe('06')
    expect(SECTION_09_ROUTING['KIFS 2022:3']).toBe('06')
    expect(SECTION_09_ROUTING['(EU) nr 1021/2019']).toBe('06')
  })

  it('routes 5 items to S07 (Brand/el)', () => {
    const s07 = Object.values(SECTION_09_ROUTING).filter((v) => v === '07')
    expect(s07).toHaveLength(5)
    expect(SECTION_09_ROUTING['ELSAK-FS 2017:2']).toBe('07')
    expect(SECTION_09_ROUTING['ELSAK-FS 2017:3']).toBe('07')
    expect(SECTION_09_ROUTING['MSBFS 2025:2']).toBe('07')
    expect(SECTION_09_ROUTING['SFS 2003:789']).toBe('07')
    expect(SECTION_09_ROUTING['MSBFS 2013:3']).toBe('07')
  })

  it('routes 12 items to S08 (Transport)', () => {
    const s08 = Object.values(SECTION_09_ROUTING).filter((v) => v === '08')
    expect(s08).toHaveLength(12)
    expect(SECTION_09_ROUTING['SFS 1999:678']).toBe('08')
    expect(SECTION_09_ROUTING['(EG) nr 561/2006']).toBe('08')
    expect(SECTION_09_ROUTING['(EU) nr 165/2014']).toBe('08')
    expect(SECTION_09_ROUTING['MSBFS 2024:10']).toBe('08')
  })
})

// ============================================================================
// NOTISUM_TO_NEW_SECTION
// ============================================================================

describe('NOTISUM_TO_NEW_SECTION', () => {
  it('covers all 8 Notisum sections', () => {
    expect(Object.keys(NOTISUM_TO_NEW_SECTION)).toHaveLength(8)
  })

  it('maps S01-S05 to same numbers', () => {
    expect(NOTISUM_TO_NEW_SECTION['01']).toBe('01')
    expect(NOTISUM_TO_NEW_SECTION['02']).toBe('02')
    expect(NOTISUM_TO_NEW_SECTION['03']).toBe('03')
    expect(NOTISUM_TO_NEW_SECTION['04']).toBe('04')
    expect(NOTISUM_TO_NEW_SECTION['05']).toBe('05')
  })

  it('merges S06 (brand) and S07 (el) into S07', () => {
    expect(NOTISUM_TO_NEW_SECTION['06']).toBe('07')
    expect(NOTISUM_TO_NEW_SECTION['07']).toBe('07')
  })

  it('maps S08 (kemiska) to S06 (farliga ämnen)', () => {
    expect(NOTISUM_TO_NEW_SECTION['08']).toBe('06')
  })
})

// ============================================================================
// SECTION_OVERRIDES
// ============================================================================

describe('SECTION_OVERRIDES', () => {
  it('has exactly 1 override', () => {
    expect(Object.keys(SECTION_OVERRIDES)).toHaveLength(1)
  })

  it('moves EM fields from S07 to S04', () => {
    expect(SECTION_OVERRIDES['AFS 2023:10 (ersatter AFS 2016:3)']).toBe('04')
  })
})

// ============================================================================
// getNewSectionNumber
// ============================================================================

describe('getNewSectionNumber', () => {
  // --- Notisum S01-S05: identity mapping ---
  it('routes S01 entries to S01', () => {
    expect(getNewSectionNumber(makeEntry('SFS 1977:1160', '01'))).toBe('01')
  })

  it('routes S02 entries to S02', () => {
    expect(getNewSectionNumber(makeEntry('(EU) nr 679/2016', '02'))).toBe('02')
  })

  it('routes S03 entries to S03', () => {
    expect(
      getNewSectionNumber(makeEntry('AFS 2023:12 (ersatter AFS 2020:1)', '03'))
    ).toBe('03')
  })

  it('routes S04 entries to S04', () => {
    expect(
      getNewSectionNumber(makeEntry('AFS 2023:10 (ersatter AFS 2012:2)', '04'))
    ).toBe('04')
  })

  it('routes S05 entries to S05', () => {
    expect(
      getNewSectionNumber(makeEntry('AFS 2023:4 (ersatter AFS 2008:3)', '05'))
    ).toBe('05')
  })

  // --- Notisum S06 (brand) → S07 ---
  it('routes S06 (brand) entries to S07', () => {
    expect(getNewSectionNumber(makeEntry('SFS 2003:778', '06'))).toBe('07')
  })

  // --- Notisum S07 (el) → S07 (with EM fields override) ---
  it('routes S07 (el) entries to S07 by default', () => {
    expect(getNewSectionNumber(makeEntry('SFS 2016:732', '07'))).toBe('07')
  })

  it('routes S07 EM fields to S04 via override', () => {
    expect(
      getNewSectionNumber(makeEntry('AFS 2023:10 (ersatter AFS 2016:3)', '07'))
    ).toBe('04')
  })

  // --- Notisum S08 (kemiska) → S06 ---
  it('routes S08 (kemiska) entries to S06', () => {
    expect(getNewSectionNumber(makeEntry('(EG) nr 1907/2006', '08'))).toBe('06')
  })

  // --- Notisum S09 routing ---
  it('routes S09 transport entries to S08', () => {
    expect(getNewSectionNumber(makeEntry('SFS 1999:678', '09'))).toBe('08')
    expect(getNewSectionNumber(makeEntry('(EG) nr 561/2006', '09'))).toBe('08')
    expect(getNewSectionNumber(makeEntry('MSBFS 2024:10', '09'))).toBe('08')
  })

  it('routes S09 chemical/exposure entries to S06', () => {
    expect(
      getNewSectionNumber(makeEntry('AFS 2023:10 (ersatter AFS 2018:4)', '09'))
    ).toBe('06')
    expect(getNewSectionNumber(makeEntry('SFS 2018:396', '09'))).toBe('06')
    expect(getNewSectionNumber(makeEntry('KIFS 2022:3', '09'))).toBe('06')
  })

  it('routes S09 brand/el entries to S07', () => {
    expect(getNewSectionNumber(makeEntry('ELSAK-FS 2017:2', '09'))).toBe('07')
    expect(getNewSectionNumber(makeEntry('MSBFS 2025:2', '09'))).toBe('07')
  })

  it('routes S09 equipment entries to S05', () => {
    expect(getNewSectionNumber(makeEntry('AFS 2023:5', '09'))).toBe('05')
    expect(getNewSectionNumber(makeEntry('AFS 2023:11', '09'))).toBe('05')
    expect(
      getNewSectionNumber(makeEntry('AFS 2023:11 (ersatter AFS 2013:4)', '09'))
    ).toBe('05')
  })

  it('routes S09 HR entry to S02', () => {
    expect(getNewSectionNumber(makeEntry('SKVFS 2015:6', '09'))).toBe('02')
  })

  it('routes S09 våld och hot to S03', () => {
    expect(
      getNewSectionNumber(makeEntry('AFS 2023:2 (ersatter AFS 1993:2)', '09'))
    ).toBe('03')
  })

  // --- Error handling ---
  it('throws for unknown S09 entry', () => {
    expect(() =>
      getNewSectionNumber(makeEntry('UNKNOWN 2099:99', '09'))
    ).toThrow('No routing defined for S09 entry')
  })

  it('throws for unmapped Notisum section', () => {
    expect(() => getNewSectionNumber(makeEntry('SFS 1977:1160', '10'))).toThrow(
      'No mapping for Notisum section 10'
    )
  })
})
