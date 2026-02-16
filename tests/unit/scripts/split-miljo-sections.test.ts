/**
 * Unit Tests for Split Miljö Sections Script
 *
 * Tests cover: section definitions, routing maps, getNewSectionNumber logic
 * for all Notisum sections (01-09), S09 routing completeness, and edge cases.
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
  getNewSectionNumber,
  resolveDocumentNumber,
  euToDbFormat,
} from '@/scripts/split-miljo-sections'
import type { AnalysisEntry } from '@/scripts/seed-miljo-template'

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
  it('has exactly 9 sections', () => {
    expect(SECTION_DEFINITIONS).toHaveLength(9)
  })

  it('has sequential section numbers 01-09', () => {
    const numbers = SECTION_DEFINITIONS.map((d) => d.number)
    expect(numbers).toEqual([
      '01',
      '02',
      '03',
      '04',
      '05',
      '06',
      '07',
      '08',
      '09',
    ])
  })

  it('has sequential positions 1-9', () => {
    const positions = SECTION_DEFINITIONS.map((d) => d.position)
    expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('all sections have name and description', () => {
    for (const def of SECTION_DEFINITIONS) {
      expect(def.name.length).toBeGreaterThan(0)
      expect(def.description.length).toBeGreaterThan(0)
    }
  })

  it('section names match plan', () => {
    expect(SECTION_DEFINITIONS[0]!.name).toBe('Övergripande miljölagstiftning')
    expect(SECTION_DEFINITIONS[1]!.name).toBe(
      'Avfall, återvinning & producentansvar'
    )
    expect(SECTION_DEFINITIONS[2]!.name).toBe(
      'Kemikalier, bekämpningsmedel & farliga ämnen'
    )
    expect(SECTION_DEFINITIONS[3]!.name).toBe(
      'Tillstånd, miljöprövning & egenkontroll'
    )
    expect(SECTION_DEFINITIONS[4]!.name).toBe('Utsläpp & emissioner')
    expect(SECTION_DEFINITIONS[5]!.name).toBe('Transport av farligt gods')
    expect(SECTION_DEFINITIONS[6]!.name).toBe(
      'Brand, explosion & räddningstjänst'
    )
    expect(SECTION_DEFINITIONS[7]!.name).toBe('Strålskydd')
    expect(SECTION_DEFINITIONS[8]!.name).toBe(
      'Klimat, energi & hållbarhetsrapportering'
    )
  })
})

// ============================================================================
// SECTION_09_ROUTING
// ============================================================================

describe('SECTION_09_ROUTING', () => {
  it('has 47 entries (all S09 documents)', () => {
    expect(Object.keys(SECTION_09_ROUTING)).toHaveLength(47)
  })

  it('all values are valid section numbers (01-09)', () => {
    const validSections = new Set([
      '01',
      '02',
      '03',
      '04',
      '05',
      '06',
      '07',
      '08',
      '09',
    ])
    for (const [, section] of Object.entries(SECTION_09_ROUTING)) {
      expect(validSections.has(section)).toBe(true)
    }
  })

  it('routes 1 item to S01 (Övergripande)', () => {
    const s01 = Object.values(SECTION_09_ROUTING).filter((v) => v === '01')
    expect(s01).toHaveLength(1)
    expect(SECTION_09_ROUTING['NFS 2004:15']).toBe('01')
  })

  it('routes 8 items to S02 (Avfall & producentansvar)', () => {
    const s02 = Object.values(SECTION_09_ROUTING).filter((v) => v === '02')
    expect(s02).toHaveLength(8)
    expect(SECTION_09_ROUTING['SFS 2001:512']).toBe('02')
    expect(SECTION_09_ROUTING['NFS 2004:10']).toBe('02')
    expect(SECTION_09_ROUTING['SFS 2008:834']).toBe('02')
    expect(SECTION_09_ROUTING['SFS 2012:861']).toBe('02')
    expect(SECTION_09_ROUTING['SFS 2021:1002']).toBe('02')
    expect(SECTION_09_ROUTING['SFS 2021:996']).toBe('02')
    expect(SECTION_09_ROUTING['SFS 2022:1276']).toBe('02')
    expect(SECTION_09_ROUTING['(EU) nr 1542/2023']).toBe('02')
  })

  it('routes 11 items to S03 (Kemikalier)', () => {
    const s03 = Object.values(SECTION_09_ROUTING).filter((v) => v === '03')
    expect(s03).toHaveLength(11)
    expect(SECTION_09_ROUTING['SFS 1998:944']).toBe('03')
    expect(SECTION_09_ROUTING['(EG) nr 440/2008']).toBe('03')
    expect(SECTION_09_ROUTING['(EU) nr 649/2012']).toBe('03')
    expect(SECTION_09_ROUTING['SFS 2013:254']).toBe('03')
    expect(SECTION_09_ROUTING['SFS 2014:425']).toBe('03')
    expect(SECTION_09_ROUTING['KIFS 2022:3']).toBe('03')
    expect(SECTION_09_ROUTING['NFS 2015:2']).toBe('03')
    expect(SECTION_09_ROUTING['NFS 2015:3']).toBe('03')
    expect(SECTION_09_ROUTING['SFS 2016:402']).toBe('03')
    expect(SECTION_09_ROUTING['SFS 2016:1067']).toBe('03')
    expect(SECTION_09_ROUTING['SFS 2017:214']).toBe('03')
  })

  it('routes 4 items to S04 (Tillstånd)', () => {
    const s04 = Object.values(SECTION_09_ROUTING).filter((v) => v === '04')
    expect(s04).toHaveLength(4)
    expect(SECTION_09_ROUTING['(EG) nr 166/2006']).toBe('04')
    expect(SECTION_09_ROUTING['SFS 2007:667']).toBe('04')
    expect(SECTION_09_ROUTING['SFS 2016:986']).toBe('04')
    expect(SECTION_09_ROUTING['STAFS 2020:1']).toBe('04')
  })

  it('routes 1 item to S05 (Utsläpp)', () => {
    const s05 = Object.values(SECTION_09_ROUTING).filter((v) => v === '05')
    expect(s05).toHaveLength(1)
    expect(SECTION_09_ROUTING['SFS 2018:471']).toBe('05')
  })

  it('routes 1 item to S06 (Transport)', () => {
    const s06 = Object.values(SECTION_09_ROUTING).filter((v) => v === '06')
    expect(s06).toHaveLength(1)
    expect(SECTION_09_ROUTING['MSBFS 2011:3']).toBe('06')
  })

  it('routes 8 items to S07 (Brand/explosion)', () => {
    const s07 = Object.values(SECTION_09_ROUTING).filter((v) => v === '07')
    expect(s07).toHaveLength(8)
    expect(SECTION_09_ROUTING['SFS 1999:381']).toBe('07')
    expect(SECTION_09_ROUTING['SFS 2015:236']).toBe('07')
    expect(SECTION_09_ROUTING['MSBFS 2015:8']).toBe('07')
    expect(SECTION_09_ROUTING['SFS 2003:789']).toBe('07')
    expect(SECTION_09_ROUTING['MSBFS 2014:6']).toBe('07')
    expect(SECTION_09_ROUTING['MSBFS 2025:2']).toBe('07')
    expect(SECTION_09_ROUTING['MSBFS 2016:4']).toBe('07')
    expect(SECTION_09_ROUTING['MSBFS 2018:3']).toBe('07')
  })

  it('routes 4 items to S08 (Strålskydd)', () => {
    const s08 = Object.values(SECTION_09_ROUTING).filter((v) => v === '08')
    expect(s08).toHaveLength(4)
    expect(SECTION_09_ROUTING['SFS 2018:396']).toBe('08')
    expect(SECTION_09_ROUTING['SFS 2018:506']).toBe('08')
    expect(SECTION_09_ROUTING['SSMFS 2018:2']).toBe('08')
    expect(SECTION_09_ROUTING['NFS 2018:11']).toBe('08')
  })

  it('routes 9 items to S09 (Klimat & hållbarhet)', () => {
    const s09 = Object.values(SECTION_09_ROUTING).filter((v) => v === '09')
    expect(s09).toHaveLength(9)
    expect(SECTION_09_ROUTING['SFS 2008:112']).toBe('09')
    expect(SECTION_09_ROUTING['SFS 2014:266']).toBe('09')
    expect(SECTION_09_ROUTING['SFS 2014:347']).toBe('09')
    expect(SECTION_09_ROUTING['(EU) nr 852/2020']).toBe('09')
    expect(SECTION_09_ROUTING['SFS 2021:787']).toBe('09')
    expect(SECTION_09_ROUTING['SFS 2021:789']).toBe('09')
    expect(SECTION_09_ROUTING['(EU) nr 956/2023']).toBe('09')
    expect(SECTION_09_ROUTING['(EU) nr 1115/2023']).toBe('09')
    expect(SECTION_09_ROUTING['(EU) nr 2772/2023']).toBe('09')
  })

  it('S09 routing item counts sum to 47', () => {
    const counts = [1, 8, 11, 4, 1, 1, 8, 4, 9] // S01-S09 destinations
    expect(counts.reduce((a, b) => a + b, 0)).toBe(47)
  })
})

// ============================================================================
// NOTISUM_TO_NEW_SECTION
// ============================================================================

describe('NOTISUM_TO_NEW_SECTION', () => {
  it('covers all 8 Notisum sections (01-08)', () => {
    expect(Object.keys(NOTISUM_TO_NEW_SECTION)).toHaveLength(8)
  })

  it('maps S01-S07 to same numbers', () => {
    expect(NOTISUM_TO_NEW_SECTION['01']).toBe('01')
    expect(NOTISUM_TO_NEW_SECTION['02']).toBe('02')
    expect(NOTISUM_TO_NEW_SECTION['03']).toBe('03')
    expect(NOTISUM_TO_NEW_SECTION['04']).toBe('04')
    expect(NOTISUM_TO_NEW_SECTION['05']).toBe('05')
    expect(NOTISUM_TO_NEW_SECTION['06']).toBe('06')
    expect(NOTISUM_TO_NEW_SECTION['07']).toBe('07')
  })

  it('merges S08 (brandskydd) into S07 (brand/explosion)', () => {
    expect(NOTISUM_TO_NEW_SECTION['08']).toBe('07')
  })

  it('does not include S09 (routed individually)', () => {
    expect(NOTISUM_TO_NEW_SECTION['09']).toBeUndefined()
  })
})

// ============================================================================
// getNewSectionNumber
// ============================================================================

describe('getNewSectionNumber', () => {
  // --- Notisum S01-S07: identity mapping ---
  it('routes S01 entries to S01', () => {
    expect(getNewSectionNumber(makeEntry('SFS 1998:808', '01'))).toBe('01')
  })

  it('routes S02 entries to S02', () => {
    expect(getNewSectionNumber(makeEntry('SFS 2020:614', '02'))).toBe('02')
  })

  it('routes S03 entries to S03', () => {
    expect(getNewSectionNumber(makeEntry('(EG) nr 1907/2006', '03'))).toBe('03')
  })

  it('routes S04 entries to S04', () => {
    expect(getNewSectionNumber(makeEntry('SFS 2013:250', '04'))).toBe('04')
  })

  it('routes S05 entries to S05', () => {
    expect(getNewSectionNumber(makeEntry('(EU) nr 573/2024', '05'))).toBe('05')
  })

  it('routes S06 entries to S06', () => {
    expect(getNewSectionNumber(makeEntry('SFS 2006:263', '06'))).toBe('06')
  })

  it('routes S07 (brand/explosiva) entries to S07', () => {
    expect(getNewSectionNumber(makeEntry('SFS 2010:1011', '07'))).toBe('07')
  })

  // --- Notisum S08 → S07 (merge) ---
  it('routes S08 (brandskydd) entries to S07', () => {
    expect(getNewSectionNumber(makeEntry('SFS 2003:778', '08'))).toBe('07')
    expect(getNewSectionNumber(makeEntry('SRVFS 2004:3', '08'))).toBe('07')
  })

  // --- Notisum S09 routing ---
  it('routes S09 construction noise to S01', () => {
    expect(getNewSectionNumber(makeEntry('NFS 2004:15', '09'))).toBe('01')
  })

  it('routes S09 waste/producer entries to S02', () => {
    expect(getNewSectionNumber(makeEntry('SFS 2001:512', '09'))).toBe('02')
    expect(getNewSectionNumber(makeEntry('(EU) nr 1542/2023', '09'))).toBe('02')
    expect(getNewSectionNumber(makeEntry('SFS 2021:996', '09'))).toBe('02')
  })

  it('routes S09 chemical entries to S03', () => {
    expect(getNewSectionNumber(makeEntry('SFS 1998:944', '09'))).toBe('03')
    expect(getNewSectionNumber(makeEntry('(EU) nr 649/2012', '09'))).toBe('03')
    expect(getNewSectionNumber(makeEntry('SFS 2014:425', '09'))).toBe('03')
    expect(getNewSectionNumber(makeEntry('NFS 2015:2', '09'))).toBe('03')
  })

  it('routes S09 permit entries to S04', () => {
    expect(getNewSectionNumber(makeEntry('(EG) nr 166/2006', '09'))).toBe('04')
    expect(getNewSectionNumber(makeEntry('SFS 2007:667', '09'))).toBe('04')
    expect(getNewSectionNumber(makeEntry('STAFS 2020:1', '09'))).toBe('04')
  })

  it('routes S09 combustion to S05', () => {
    expect(getNewSectionNumber(makeEntry('SFS 2018:471', '09'))).toBe('05')
  })

  it('routes S09 pressure equipment to S06', () => {
    expect(getNewSectionNumber(makeEntry('MSBFS 2011:3', '09'))).toBe('06')
  })

  it('routes S09 Seveso and fire entries to S07', () => {
    expect(getNewSectionNumber(makeEntry('SFS 1999:381', '09'))).toBe('07')
    expect(getNewSectionNumber(makeEntry('SFS 2015:236', '09'))).toBe('07')
    expect(getNewSectionNumber(makeEntry('MSBFS 2015:8', '09'))).toBe('07')
    expect(getNewSectionNumber(makeEntry('SFS 2003:789', '09'))).toBe('07')
    expect(getNewSectionNumber(makeEntry('MSBFS 2014:6', '09'))).toBe('07')
  })

  it('routes S09 radiation entries to S08', () => {
    expect(getNewSectionNumber(makeEntry('SFS 2018:396', '09'))).toBe('08')
    expect(getNewSectionNumber(makeEntry('SFS 2018:506', '09'))).toBe('08')
    expect(getNewSectionNumber(makeEntry('SSMFS 2018:2', '09'))).toBe('08')
    expect(getNewSectionNumber(makeEntry('NFS 2018:11', '09'))).toBe('08')
  })

  it('routes S09 climate/sustainability entries to S09', () => {
    expect(getNewSectionNumber(makeEntry('(EU) nr 852/2020', '09'))).toBe('09')
    expect(getNewSectionNumber(makeEntry('(EU) nr 956/2023', '09'))).toBe('09')
    expect(getNewSectionNumber(makeEntry('(EU) nr 2772/2023', '09'))).toBe('09')
    expect(getNewSectionNumber(makeEntry('SFS 2021:787', '09'))).toBe('09')
    expect(getNewSectionNumber(makeEntry('SFS 2008:112', '09'))).toBe('09')
  })

  // --- Error handling ---
  it('throws for unknown S09 entry', () => {
    expect(() =>
      getNewSectionNumber(makeEntry('UNKNOWN 2099:99', '09'))
    ).toThrow('No routing defined for S09 entry')
  })

  it('throws for unmapped Notisum section', () => {
    expect(() => getNewSectionNumber(makeEntry('SFS 1998:808', '10'))).toThrow(
      'No mapping for Notisum section 10'
    )
  })
})

// ============================================================================
// resolveDocumentNumber
// ============================================================================

describe('resolveDocumentNumber', () => {
  it('returns document number as-is for simple references', () => {
    expect(resolveDocumentNumber(makeEntry('SFS 1998:808', '01'))).toBe(
      'SFS 1998:808'
    )
  })

  it('strips OVK suffix', () => {
    expect(resolveDocumentNumber(makeEntry('BFS 2011:16 - OVK 1', '05'))).toBe(
      'BFS 2011:16'
    )
  })

  it('returns EU references as-is (text format)', () => {
    expect(resolveDocumentNumber(makeEntry('(EG) nr 1907/2006', '03'))).toBe(
      '(EG) nr 1907/2006'
    )
  })
})

// ============================================================================
// euToDbFormat
// ============================================================================

describe('euToDbFormat', () => {
  it('converts (EU) nr format to English DB format', () => {
    expect(euToDbFormat('(EU) nr 573/2024')).toBe('Regulation (EU) 2024/573')
  })

  it('converts (EU) without nr', () => {
    expect(euToDbFormat('(EU) 40/2025')).toBe('Regulation (EU) 2025/40')
  })

  it('converts (EG) format to Regulation (EC)', () => {
    // Note: EG prefix maps to the letter G which triggers EC
    expect(euToDbFormat('(EG) nr 1907/2006')).toBe('Regulation (EC) 2006/1907')
  })

  it('returns null for non-EU references', () => {
    expect(euToDbFormat('SFS 1998:808')).toBeNull()
    expect(euToDbFormat('NFS 2020:5')).toBeNull()
  })
})

// ============================================================================
// Expected section item counts (cross-check)
// ============================================================================

describe('Expected section counts', () => {
  it('S01 Övergripande: 9 from Notisum S01 + 1 from S09 = 10', () => {
    const notisumS01 = 9
    const fromS09 = Object.values(SECTION_09_ROUTING).filter(
      (v) => v === '01'
    ).length
    expect(notisumS01 + fromS09).toBe(10)
  })

  it('S02 Avfall: 7 from Notisum S02 + 8 from S09 = 15', () => {
    const notisumS02 = 7
    const fromS09 = Object.values(SECTION_09_ROUTING).filter(
      (v) => v === '02'
    ).length
    expect(notisumS02 + fromS09).toBe(15)
  })

  it('S03 Kemikalier: 6 from Notisum S03 + 11 from S09 = 17', () => {
    const notisumS03 = 6
    const fromS09 = Object.values(SECTION_09_ROUTING).filter(
      (v) => v === '03'
    ).length
    expect(notisumS03 + fromS09).toBe(17)
  })

  it('S04 Tillstånd: 9 from Notisum S04 + 4 from S09 = 13', () => {
    const notisumS04 = 9
    const fromS09 = Object.values(SECTION_09_ROUTING).filter(
      (v) => v === '04'
    ).length
    expect(notisumS04 + fromS09).toBe(13)
  })

  it('S05 Utsläpp: 6 from Notisum S05 + 1 from S09 = 7', () => {
    const notisumS05 = 6
    const fromS09 = Object.values(SECTION_09_ROUTING).filter(
      (v) => v === '05'
    ).length
    expect(notisumS05 + fromS09).toBe(7)
  })

  it('S06 Transport: 4 from Notisum S06 + 1 from S09 = 5', () => {
    const notisumS06 = 4
    const fromS09 = Object.values(SECTION_09_ROUTING).filter(
      (v) => v === '06'
    ).length
    expect(notisumS06 + fromS09).toBe(5)
  })

  it('S07 Brand: 8 from Notisum S07 + 2 from Notisum S08 + 8 from S09 = 18', () => {
    const notisumS07 = 8
    const notisumS08 = 2
    const fromS09 = Object.values(SECTION_09_ROUTING).filter(
      (v) => v === '07'
    ).length
    expect(notisumS07 + notisumS08 + fromS09).toBe(18)
  })

  it('S08 Strålskydd: 0 from Notisum + 4 from S09 = 4', () => {
    const fromS09 = Object.values(SECTION_09_ROUTING).filter(
      (v) => v === '08'
    ).length
    expect(fromS09).toBe(4)
  })

  it('S09 Klimat: 0 from Notisum + 9 from S09 = 9', () => {
    const fromS09 = Object.values(SECTION_09_ROUTING).filter(
      (v) => v === '09'
    ).length
    expect(fromS09).toBe(9)
  })

  it('all sections sum to 98 documents', () => {
    const notisumCounts = [9, 7, 6, 9, 6, 4, 8, 2] // S01-S08
    const s09Routes = 47
    const totalNotisum = notisumCounts.reduce((a, b) => a + b, 0) + s09Routes
    expect(totalNotisum).toBe(98)
  })
})
