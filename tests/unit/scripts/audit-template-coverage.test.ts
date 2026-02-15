/**
 * Story 9.4: Unit Tests for Template Coverage Audit Script
 *
 * Tests: CSV parsing, EU CELEX conversion, AFS chapter expansion,
 * normalization/substitution, report counting, EU gate exclusion.
 */

import { describe, it, expect } from 'vitest'
import {
  parseCsv,
  parseCsvLine,
  normalizeDocNumber,
  expandCsvRows,
  csvEuToCelex,
  formatReport,
  type CsvRow,
  type AuditReport,
  type AuditResult,
} from '@/scripts/audit-template-coverage'

// ============================================================================
// CSV Parsing
// ============================================================================

describe('parseCsv', () => {
  it('parses header and data rows correctly', () => {
    const csv = [
      'doc_number,authority,short_name,template,needs_chapter_split,chapter_count,ingestion_source,notes',
      'SFS 1977:480,SFS,Semesterlag,arbetsmiljo,no,,riksdagen.se,',
    ].join('\n')
    const rows = parseCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.doc_number).toBe('SFS 1977:480')
    expect(rows[0]!.authority).toBe('SFS')
    expect(rows[0]!.short_name).toBe('Semesterlag')
    expect(rows[0]!.template).toBe('arbetsmiljo')
    expect(rows[0]!.needs_chapter_split).toBe(false)
    expect(rows[0]!.chapter_count).toBe(0)
  })

  it('parses chapter split row correctly', () => {
    const csv = [
      'doc_number,authority,short_name,template,needs_chapter_split,chapter_count,ingestion_source,notes',
      'AFS 2023:2,AFS,Organisatorisk och social arbetsmiljö m.fl.,arbetsmiljo,yes,8,av.se,Chapters: OSA etc',
    ].join('\n')
    const rows = parseCsv(csv)
    expect(rows[0]!.needs_chapter_split).toBe(true)
    expect(rows[0]!.chapter_count).toBe(8)
  })

  it('handles all 13 authority prefixes', () => {
    const prefixes = [
      'SFS 1977:480,SFS',
      'AFS 2023:1,AFS',
      '(EU) nr 2016/679,EU',
      '(EG) nr 1907/2006,EU',
      'MSBFS 2020:1,MSBFS',
      'NFS 2001:2,NFS',
      'ELSAK-FS 2017:2,ELSAK-FS',
      'KIFS 2017:7,KIFS',
      'BFS 2011:16,BFS',
      'SRVFS 2004:3,SRVFS',
      'SKVFS 2015:6,SKVFS',
      'SCB-FS 2024:25,SCB-FS',
      'SSMFS 2018:2,SSMFS',
      'STAFS 2020:1,STAFS',
    ]
    const header =
      'doc_number,authority,short_name,template,needs_chapter_split,chapter_count,ingestion_source,notes'
    const csv =
      header +
      '\n' +
      prefixes.map((p) => `${p},Test,arbetsmiljo,no,,test,`).join('\n')
    const rows = parseCsv(csv)
    expect(rows).toHaveLength(14)
    const authorities = rows.map((r) => r.authority)
    expect(authorities).toContain('SFS')
    expect(authorities).toContain('AFS')
    expect(authorities).toContain('EU')
    expect(authorities).toContain('MSBFS')
    expect(authorities).toContain('NFS')
    expect(authorities).toContain('ELSAK-FS')
    expect(authorities).toContain('KIFS')
    expect(authorities).toContain('BFS')
    expect(authorities).toContain('SRVFS')
    expect(authorities).toContain('SKVFS')
    expect(authorities).toContain('SCB-FS')
    expect(authorities).toContain('SSMFS')
    expect(authorities).toContain('STAFS')
  })

  it('handles quoted fields with commas in notes', () => {
    const csv = [
      'doc_number,authority,short_name,template,needs_chapter_split,chapter_count,ingestion_source,notes',
      'AFS 2023:10,AFS,Fysiska risker,arbetsmiljo,yes,17,av.se,"Chapters: fall; ras; ergonomi"',
    ].join('\n')
    const rows = parseCsv(csv)
    expect(rows[0]!.notes).toBe('Chapters: fall; ras; ergonomi')
  })

  it('skips empty lines', () => {
    const csv = [
      'doc_number,authority,short_name,template,needs_chapter_split,chapter_count,ingestion_source,notes',
      'SFS 1977:480,SFS,Semesterlag,arbetsmiljo,no,,riksdagen.se,',
      '',
      'SFS 1982:80,SFS,LAS,arbetsmiljo,no,,riksdagen.se,',
    ].join('\n')
    const rows = parseCsv(csv)
    expect(rows).toHaveLength(2)
  })
})

describe('parseCsvLine', () => {
  it('splits simple comma-separated values', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('handles quoted fields with commas', () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd'])
  })
})

// ============================================================================
// EU CELEX Conversion
// ============================================================================

describe('csvEuToCelex', () => {
  it('converts (EG) nr format', () => {
    expect(csvEuToCelex('(EG) nr 1907/2006')).toBe('32006R1907')
  })

  it('converts (EU) nr format', () => {
    expect(csvEuToCelex('(EU) nr 2016/679')).toBe('32016R0679')
  })

  it('converts (EU) nr format with small number', () => {
    expect(csvEuToCelex('(EU) nr 40/2025')).toBe('32025R0040')
  })

  it('converts (EG) nr 1272/2008 (CLP)', () => {
    expect(csvEuToCelex('(EG) nr 1272/2008')).toBe('32008R1272')
  })

  it('converts (EU) nr 2019/1021 (POPs)', () => {
    expect(csvEuToCelex('(EU) nr 2019/1021')).toBe('32019R1021')
  })

  it('converts (EG) nr 561/2006', () => {
    expect(csvEuToCelex('(EG) nr 561/2006')).toBe('32006R0561')
  })

  it('converts (EU) nr 165/2014', () => {
    expect(csvEuToCelex('(EU) nr 165/2014')).toBe('32014R0165')
  })

  it('converts (EU) nr 2023/1230', () => {
    expect(csvEuToCelex('(EU) nr 2023/1230')).toBe('32023R1230')
  })

  it('converts (EU) nr 852/2020 (Taxonomy)', () => {
    expect(csvEuToCelex('(EU) nr 852/2020')).toBe('32020R0852')
  })

  it('converts (EU) nr 573/2024 (F-gas)', () => {
    expect(csvEuToCelex('(EU) nr 573/2024')).toBe('32024R0573')
  })

  it('returns null for non-EU formats', () => {
    expect(csvEuToCelex('SFS 1977:480')).toBeNull()
    expect(csvEuToCelex('AFS 2023:1')).toBeNull()
  })
})

// ============================================================================
// Normalization & Substitution
// ============================================================================

describe('normalizeDocNumber', () => {
  it('normalizes ELSAK-FS to ELSÄK-FS', () => {
    expect(normalizeDocNumber('ELSAK-FS 2017:2')).toBe('ELSÄK-FS 2017:2')
  })

  it('applies SCB-FS substitution', () => {
    expect(normalizeDocNumber('SCB-FS 2024:25')).toBe('SCB-FS 2025:19')
  })

  it('leaves SFS unchanged', () => {
    expect(normalizeDocNumber('SFS 1977:480')).toBe('SFS 1977:480')
  })

  it('leaves AFS unchanged', () => {
    expect(normalizeDocNumber('AFS 2023:1')).toBe('AFS 2023:1')
  })

  it('leaves MSBFS unchanged', () => {
    expect(normalizeDocNumber('MSBFS 2020:1')).toBe('MSBFS 2020:1')
  })

  it('leaves already-correct ELSÄK-FS unchanged', () => {
    expect(normalizeDocNumber('ELSÄK-FS 2022:1')).toBe('ELSÄK-FS 2022:1')
  })
})

// ============================================================================
// AFS Chapter Expansion
// ============================================================================

describe('expandCsvRows', () => {
  it('includes parent entry for chapter-split AFS (chapters discovered from DB)', () => {
    const rows: CsvRow[] = [
      {
        doc_number: 'AFS 2023:2',
        authority: 'AFS',
        short_name: 'OSA m.fl.',
        template: 'arbetsmiljo',
        needs_chapter_split: true,
        chapter_count: 8,
        ingestion_source: 'av.se',
        notes: '',
      },
    ]
    const entries = expandCsvRows(rows)
    // Only the parent — chapters are discovered from DB at audit time
    expect(entries).toHaveLength(1)
    expect(entries[0]!.lookupNumber).toBe('AFS 2023:2')
    expect(entries[0]!.isChapterSplitParent).toBe(true)
    expect(entries[0]!.isChapterEntry).toBe(false)
    expect(entries[0]!.originalCsvNumber).toBe('AFS 2023:2')
  })

  it('does not expand non-split AFS', () => {
    const rows: CsvRow[] = [
      {
        doc_number: 'AFS 2023:1',
        authority: 'AFS',
        short_name: 'SAM',
        template: 'arbetsmiljo',
        needs_chapter_split: false,
        chapter_count: 1,
        ingestion_source: 'av.se',
        notes: '',
      },
    ]
    const entries = expandCsvRows(rows)
    expect(entries).toHaveLength(1)
    expect(entries[0]!.lookupNumber).toBe('AFS 2023:1')
    expect(entries[0]!.isChapterEntry).toBe(false)
    expect(entries[0]!.isChapterSplitParent).toBeFalsy()
  })

  it('marks EU entries correctly', () => {
    const rows: CsvRow[] = [
      {
        doc_number: '(EU) nr 2016/679',
        authority: 'EU',
        short_name: 'GDPR',
        template: 'arbetsmiljo',
        needs_chapter_split: false,
        chapter_count: 0,
        ingestion_source: 'eur-lex.europa.eu',
        notes: '',
      },
    ]
    const entries = expandCsvRows(rows)
    expect(entries).toHaveLength(1)
    expect(entries[0]!.isEu).toBe(true)
  })

  it('normalizes ELSAK-FS in expansion', () => {
    const rows: CsvRow[] = [
      {
        doc_number: 'ELSAK-FS 2017:2',
        authority: 'ELSAK-FS',
        short_name: 'Elinstallationsarbete',
        template: 'arbetsmiljo',
        needs_chapter_split: false,
        chapter_count: 0,
        ingestion_source: 'elsakerhetsverket.se',
        notes: '',
      },
    ]
    const entries = expandCsvRows(rows)
    expect(entries[0]!.lookupNumber).toBe('ELSÄK-FS 2017:2')
  })

  it('applies SCB-FS substitution in expansion', () => {
    const rows: CsvRow[] = [
      {
        doc_number: 'SCB-FS 2024:25',
        authority: 'SCB-FS',
        short_name: 'Statistik miljöskyddskostnader',
        template: 'miljo',
        needs_chapter_split: false,
        chapter_count: 0,
        ingestion_source: 'scb.se',
        notes: '',
      },
    ]
    const entries = expandCsvRows(rows)
    expect(entries[0]!.lookupNumber).toBe('SCB-FS 2025:19')
    expect(entries[0]!.originalCsvNumber).toBe('SCB-FS 2024:25')
  })

  it('chapter-split AFS parents get 1 entry each (chapters from DB)', () => {
    const rows: CsvRow[] = [
      {
        doc_number: 'AFS 2023:2',
        authority: 'AFS',
        short_name: '',
        template: '',
        needs_chapter_split: true,
        chapter_count: 8,
        ingestion_source: '',
        notes: '',
      },
      {
        doc_number: 'AFS 2023:9',
        authority: 'AFS',
        short_name: '',
        template: '',
        needs_chapter_split: true,
        chapter_count: 2,
        ingestion_source: '',
        notes: '',
      },
      {
        doc_number: 'AFS 2023:10',
        authority: 'AFS',
        short_name: '',
        template: '',
        needs_chapter_split: true,
        chapter_count: 17,
        ingestion_source: '',
        notes: '',
      },
    ]
    const entries = expandCsvRows(rows)
    // 3 parents — chapters discovered from DB during audit
    expect(entries).toHaveLength(3)
    expect(entries.every((e) => e.isChapterSplitParent)).toBe(true)
  })
})

// ============================================================================
// Report Counting & EU Gate Exclusion
// ============================================================================

describe('formatReport', () => {
  function makeResult(
    overrides: Partial<AuditResult> & { lookupNumber: string; isEu?: boolean }
  ): AuditResult {
    return {
      entry: {
        lookupNumber: overrides.lookupNumber,
        originalCsvNumber: overrides.lookupNumber,
        authority: overrides.isEu ? 'EU' : 'SFS',
        short_name: 'Test',
        template: 'arbetsmiljo',
        isChapterEntry: false,
        isEu: overrides.isEu ?? false,
      },
      exists: overrides.exists ?? true,
      hasContent: overrides.hasContent ?? true,
      hasSummary: overrides.hasSummary ?? true,
      hasKommentar: overrides.hasKommentar ?? true,
      dbDocumentNumber: overrides.lookupNumber,
      contentLength: overrides.contentLength ?? 1000,
    }
  }

  it('reports PASS when all non-EU docs are complete', () => {
    const report: AuditReport = {
      nonEuResults: [
        makeResult({ lookupNumber: 'SFS 1977:480' }),
        makeResult({ lookupNumber: 'AFS 2023:1' }),
      ],
      euResults: [
        makeResult({
          lookupNumber: '(EU) nr 2016/679',
          isEu: true,
          hasContent: false,
        }),
      ],
      totalExpanded: 3,
      nonEuTotal: 2,
      euTotal: 1,
      nonEuFound: 2,
      nonEuWithContent: 2,
      nonEuWithSummary: 2,
      nonEuWithKommentar: 2,
      euFound: 1,
      euWithContent: 0,
      pass: true,
    }
    const text = formatReport(report)
    expect(text).toContain('PASS')
  })

  it('reports FAIL when a non-EU doc is missing', () => {
    const report: AuditReport = {
      nonEuResults: [
        makeResult({ lookupNumber: 'SFS 1977:480', exists: false }),
      ],
      euResults: [],
      totalExpanded: 1,
      nonEuTotal: 1,
      euTotal: 0,
      nonEuFound: 0,
      nonEuWithContent: 0,
      nonEuWithSummary: 0,
      nonEuWithKommentar: 0,
      euFound: 0,
      euWithContent: 0,
      pass: false,
    }
    const text = formatReport(report)
    expect(text).toContain('FAIL')
  })

  it('EU docs without content do NOT cause FAIL', () => {
    const report: AuditReport = {
      nonEuResults: [makeResult({ lookupNumber: 'SFS 1977:480' })],
      euResults: [
        makeResult({
          lookupNumber: '(EU) nr 2016/679',
          isEu: true,
          hasContent: false,
          hasSummary: false,
          hasKommentar: false,
        }),
      ],
      totalExpanded: 2,
      nonEuTotal: 1,
      euTotal: 1,
      nonEuFound: 1,
      nonEuWithContent: 1,
      nonEuWithSummary: 1,
      nonEuWithKommentar: 1,
      euFound: 1,
      euWithContent: 0,
      pass: true,
    }
    const text = formatReport(report)
    expect(text).toContain('PASS')
    expect(text).toContain('INFORMATIONAL')
  })

  it('includes EU diagnostic section in report', () => {
    const report: AuditReport = {
      nonEuResults: [],
      euResults: [makeResult({ lookupNumber: '(EU) nr 2016/679', isEu: true })],
      totalExpanded: 1,
      nonEuTotal: 0,
      euTotal: 1,
      nonEuFound: 0,
      nonEuWithContent: 0,
      nonEuWithSummary: 0,
      nonEuWithKommentar: 0,
      euFound: 1,
      euWithContent: 1,
      pass: true,
    }
    const text = formatReport(report)
    expect(text).toContain('EU DOCUMENTS')
    expect(text).toContain('Present:      1/1')
  })

  it('groups non-EU results by authority', () => {
    const sfsResult = makeResult({ lookupNumber: 'SFS 1977:480' })
    const afsResult = makeResult({ lookupNumber: 'AFS 2023:1' })
    // Override the authority for the AFS entry
    afsResult.entry = { ...afsResult.entry, authority: 'AFS' }
    const report: AuditReport = {
      nonEuResults: [sfsResult, afsResult],
      euResults: [],
      totalExpanded: 2,
      nonEuTotal: 2,
      euTotal: 0,
      nonEuFound: 2,
      nonEuWithContent: 2,
      nonEuWithSummary: 2,
      nonEuWithKommentar: 2,
      euFound: 0,
      euWithContent: 0,
      pass: true,
    }
    const text = formatReport(report)
    expect(text).toContain('SFS (1 entries)')
    expect(text).toContain('AFS (1 entries)')
  })
})
