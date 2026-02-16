/**
 * Story 12.5: Unit Tests for Seed Miljö Template
 *
 * Tests cover: record counts, index uniqueness, service company flags,
 * document resolution, source_type classification, regulatory_body mapping,
 * cross_list_references, EU CELEX conversion, idempotency, dry-run mode,
 * missing document handling, and pure function unit tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ──────────────────────────────────────────────────────────
const { mockPrisma, mockReadFileSync } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findFirst: vi.fn(), create: vi.fn() },
    lawListTemplate: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    templateSection: { upsert: vi.fn(), update: vi.fn() },
    templateItem: { upsert: vi.fn() },
    legalDocument: { findUnique: vi.fn(), findMany: vi.fn() },
    euDocument: { findUnique: vi.fn() },
    $disconnect: vi.fn(),
  },
  mockReadFileSync: vi.fn(),
}))

vi.mock('@prisma/client', () => ({
  PrismaClient: function () {
    return mockPrisma
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

// ============================================================================
// Pure Function Tests (no mocking needed)
// ============================================================================

describe('Story 12.5: extractBaseDocumentNumber', () => {
  let extractBaseDocumentNumber: typeof import('@/scripts/seed-miljo-template').extractBaseDocumentNumber

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-miljo-template')
    extractBaseDocumentNumber = mod.extractBaseDocumentNumber
  })

  it('returns unchanged for references without ersätter', () => {
    expect(extractBaseDocumentNumber('SFS 1998:808')).toBe('SFS 1998:808')
  })

  it('strips (ersätter ...) clause if present', () => {
    expect(extractBaseDocumentNumber('AFS 2023:2 (ersätter AFS 2015:4)')).toBe(
      'AFS 2023:2'
    )
  })

  it('handles NFS references', () => {
    expect(extractBaseDocumentNumber('NFS 2020:5')).toBe('NFS 2020:5')
  })

  it('handles EU references', () => {
    expect(extractBaseDocumentNumber('(EU) nr 573/2024')).toBe(
      '(EU) nr 573/2024'
    )
  })

  it('handles EG references', () => {
    expect(extractBaseDocumentNumber('(EG) nr 1907/2006')).toBe(
      '(EG) nr 1907/2006'
    )
  })
})

describe('Story 12.5: extractReplacesReference', () => {
  let extractReplacesReference: typeof import('@/scripts/seed-miljo-template').extractReplacesReference

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-miljo-template')
    extractReplacesReference = mod.extractReplacesReference
  })

  it('returns null for references without ersätter', () => {
    expect(extractReplacesReference('SFS 1998:808')).toBeNull()
  })

  it('extracts old reference from ersätter notation', () => {
    expect(extractReplacesReference('AFS 2023:1 (ersätter AFS 2001:1)')).toBe(
      'AFS 2001:1'
    )
  })
})

describe('Story 12.5: normalizeDocumentNumber', () => {
  let normalizeDocumentNumber: typeof import('@/scripts/seed-miljo-template').normalizeDocumentNumber

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-miljo-template')
    normalizeDocumentNumber = mod.normalizeDocumentNumber
  })

  it('strips OVK suffix from BFS', () => {
    expect(normalizeDocumentNumber('BFS 2011:16 - OVK 1')).toBe('BFS 2011:16')
  })

  it('leaves normal SFS unchanged', () => {
    expect(normalizeDocumentNumber('SFS 1998:808')).toBe('SFS 1998:808')
  })

  it('leaves NFS unchanged', () => {
    expect(normalizeDocumentNumber('NFS 2020:5')).toBe('NFS 2020:5')
  })

  it('leaves MSBFS unchanged', () => {
    expect(normalizeDocumentNumber('MSBFS 2024:10')).toBe('MSBFS 2024:10')
  })

  it('leaves EU references unchanged', () => {
    expect(normalizeDocumentNumber('(EU) nr 573/2024')).toBe('(EU) nr 573/2024')
  })
})

describe('Story 12.5: source_type classification (Test 5)', () => {
  let classifySourceType: typeof import('@/scripts/seed-miljo-template').classifySourceType

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-miljo-template')
    classifySourceType = mod.classifySourceType
  })

  it('classifies SFS with "lag" in title as lag', () => {
    expect(classifySourceType('SFS 1998:808', 'Miljöbalk')).toBe('lag')
  })

  it('classifies SFS with "förordning" in title as forordning', () => {
    expect(
      classifySourceType('SFS 2012:259', 'Förordning om miljösanktionsavgifter')
    ).toBe('forordning')
  })

  it('classifies NFS as foreskrift', () => {
    expect(
      classifySourceType('NFS 2020:5', 'Naturvårdsverkets föreskrifter')
    ).toBe('foreskrift')
  })

  it('classifies MSBFS as foreskrift', () => {
    expect(classifySourceType('MSBFS 2024:10', 'ADR-S')).toBe('foreskrift')
  })

  it('classifies KIFS as foreskrift', () => {
    expect(classifySourceType('KIFS 2017:7', 'Kemiska produkter')).toBe(
      'foreskrift'
    )
  })

  it('classifies BFS as foreskrift', () => {
    expect(classifySourceType('BFS 2011:16', 'OVK')).toBe('foreskrift')
  })

  it('classifies SRVFS as allmanna-rad', () => {
    expect(classifySourceType('SRVFS 2004:3', 'Brandskyddsarbete')).toBe(
      'allmanna-rad'
    )
  })

  it('classifies SCB-FS as foreskrift', () => {
    expect(classifySourceType('SCB-FS 2024:25', 'Statistik')).toBe('foreskrift')
  })

  it('classifies SSMFS as foreskrift', () => {
    expect(classifySourceType('SSMFS 2018:2', 'Anmälningspliktig')).toBe(
      'foreskrift'
    )
  })

  it('classifies STAFS as foreskrift', () => {
    expect(classifySourceType('STAFS 2020:1', 'Ackreditering')).toBe(
      'foreskrift'
    )
  })

  it('classifies (EU) as eu-forordning', () => {
    expect(classifySourceType('(EU) nr 573/2024', 'F-gasförordningen')).toBe(
      'eu-forordning'
    )
  })

  it('classifies (EG) as eu-forordning', () => {
    expect(classifySourceType('(EG) nr 1907/2006', 'REACH')).toBe(
      'eu-forordning'
    )
  })

  it('classifies (EU) without nr as eu-forordning', () => {
    expect(classifySourceType('(EU) 40/2025', 'Förpackningar')).toBe(
      'eu-forordning'
    )
  })
})

describe('Story 12.5: regulatory_body mapping (Test 6)', () => {
  let getRegulatoryBody: typeof import('@/scripts/seed-miljo-template').getRegulatoryBody

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-miljo-template')
    getRegulatoryBody = mod.getRegulatoryBody
  })

  it('maps SFS to Riksdagen', () => {
    expect(getRegulatoryBody('SFS 1998:808')).toBe('Riksdagen')
  })

  it('maps NFS to Naturvårdsverket', () => {
    expect(getRegulatoryBody('NFS 2020:5')).toBe('Naturvårdsverket')
  })

  it('maps MSBFS to MSB', () => {
    expect(getRegulatoryBody('MSBFS 2024:10')).toBe('MSB')
  })

  it('maps KIFS to Kemikalieinspektionen', () => {
    expect(getRegulatoryBody('KIFS 2017:7')).toBe('Kemikalieinspektionen')
  })

  it('maps BFS to Boverket', () => {
    expect(getRegulatoryBody('BFS 2011:16')).toBe('Boverket')
  })

  it('maps SRVFS to Räddningsverket', () => {
    expect(getRegulatoryBody('SRVFS 2004:3')).toBe('Räddningsverket')
  })

  it('maps SCB-FS to SCB', () => {
    expect(getRegulatoryBody('SCB-FS 2024:25')).toBe('SCB')
  })

  it('maps SSMFS to Strålsäkerhetsmyndigheten', () => {
    expect(getRegulatoryBody('SSMFS 2018:2')).toBe('Strålsäkerhetsmyndigheten')
  })

  it('maps STAFS to Swedac', () => {
    expect(getRegulatoryBody('STAFS 2020:1')).toBe('Swedac')
  })

  it('maps (EU) to EU', () => {
    expect(getRegulatoryBody('(EU) nr 573/2024')).toBe('EU')
  })

  it('maps (EG) to EU', () => {
    expect(getRegulatoryBody('(EG) nr 1907/2006')).toBe('EU')
  })

  it('returns Okänd for unknown prefix', () => {
    expect(getRegulatoryBody('UNKNOWN 2024:1')).toBe('Okänd')
  })
})

describe('Story 12.5: cross_list_references populated correctly (Test 7)', () => {
  let getCrossListReferences: typeof import('@/scripts/seed-miljo-template').getCrossListReferences

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-miljo-template')
    getCrossListReferences = mod.getCrossListReferences
  })

  it('REACH appears in arbetsmiljo and arbetsmiljo-tjansteforetag', () => {
    const refs = getCrossListReferences({
      fullReference: '(EG) nr 1907/2006',
      title: 'REACH',
      originalIndex: '1',
      originalSection: '03',
    })
    expect(refs).toContain('arbetsmiljo')
    expect(refs).toContain('arbetsmiljo-tjansteforetag')
  })

  it('SFS 2018:396 appears in arbetsmiljo and fastighet-bygg', () => {
    const refs = getCrossListReferences({
      fullReference: 'SFS 2018:396',
      title: 'Strålskyddslag',
      originalIndex: '29',
      originalSection: '09',
    })
    expect(refs).toContain('arbetsmiljo')
    expect(refs).toContain('fastighet-bygg')
    expect(refs).not.toContain('arbetsmiljo-tjansteforetag')
  })

  it('BFS 2011:16 - OVK 1 matches arbetsmiljo and fastighet-bygg via normalization', () => {
    const refs = getCrossListReferences({
      fullReference: 'BFS 2011:16 - OVK 1',
      title: 'OVK',
      originalIndex: '6',
      originalSection: '05',
    })
    expect(refs).toContain('arbetsmiljo')
    expect(refs).toContain('fastighet-bygg')
  })

  it('SSMFS 2018:2 appears in halsa', () => {
    const refs = getCrossListReferences({
      fullReference: 'SSMFS 2018:2',
      title: 'Anmälningspliktiga verksamheter',
      originalIndex: '33',
      originalSection: '09',
    })
    expect(refs).toContain('halsa')
    expect(refs).toHaveLength(1)
  })

  it('(EU) 40/2025 appears in livsmedel', () => {
    const refs = getCrossListReferences({
      fullReference: '(EU) 40/2025',
      title: 'Förpackningar',
      originalIndex: '5',
      originalSection: '02',
    })
    expect(refs).toContain('livsmedel')
  })

  it('SFS 1995:1554 appears in miljo-sverige', () => {
    const refs = getCrossListReferences({
      fullReference: 'SFS 1995:1554',
      title: 'Årsredovisningslag',
      originalIndex: '6',
      originalSection: '01',
    })
    expect(refs).toContain('miljo-sverige')
  })

  it('SFS 2003:778 appears in arbetsmiljo, arbetsmiljo-tjansteforetag', () => {
    const refs = getCrossListReferences({
      fullReference: 'SFS 2003:778',
      title: 'Lag om skydd mot olyckor',
      originalIndex: '1',
      originalSection: '08',
    })
    expect(refs).toContain('arbetsmiljo')
    expect(refs).toContain('arbetsmiljo-tjansteforetag')
    expect(refs).not.toContain('fastighet-bygg')
  })

  it('SFS 2020:614 appears in fastighet-bygg only', () => {
    const refs = getCrossListReferences({
      fullReference: 'SFS 2020:614',
      title: 'Avfallsförordning',
      originalIndex: '1',
      originalSection: '02',
    })
    expect(refs).toContain('fastighet-bygg')
    expect(refs).not.toContain('arbetsmiljo')
  })

  it('reference not in any overlap list returns empty array', () => {
    const refs = getCrossListReferences({
      fullReference: 'SFS 2008:486',
      title: 'Marknadsföringslag',
      originalIndex: '7',
      originalSection: '01',
    })
    expect(refs).toEqual([])
  })

  it('SRVFS 2004:3 appears in arbetsmiljo and arbetsmiljo-tjansteforetag', () => {
    const refs = getCrossListReferences({
      fullReference: 'SRVFS 2004:3',
      title: 'Systematiskt brandskyddsarbete',
      originalIndex: '2',
      originalSection: '08',
    })
    expect(refs).toContain('arbetsmiljo')
    expect(refs).toContain('arbetsmiljo-tjansteforetag')
  })
})

describe('Story 12.5: csvEuToCelex conversion (Test 8)', () => {
  let csvEuToCelex: typeof import('@/scripts/seed-miljo-template').csvEuToCelex

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-miljo-template')
    csvEuToCelex = mod.csvEuToCelex
  })

  it('converts (EG) nr 1907/2006 to CELEX 32006R1907', () => {
    expect(csvEuToCelex('(EG) nr 1907/2006')).toBe('32006R1907')
  })

  it('converts (EG) nr 1272/2008 to CELEX 32008R1272', () => {
    expect(csvEuToCelex('(EG) nr 1272/2008')).toBe('32008R1272')
  })

  it('converts (EU) nr 1021/2019 to CELEX 32019R1021', () => {
    expect(csvEuToCelex('(EU) nr 1021/2019')).toBe('32019R1021')
  })

  it('converts (EU) nr 573/2024 to CELEX 32024R0573', () => {
    expect(csvEuToCelex('(EU) nr 573/2024')).toBe('32024R0573')
  })

  it('converts (EU) nr 590/2024 to CELEX 32024R0590', () => {
    expect(csvEuToCelex('(EU) nr 590/2024')).toBe('32024R0590')
  })

  it('converts (EU) 40/2025 (without nr) to CELEX 32025R0040', () => {
    expect(csvEuToCelex('(EU) 40/2025')).toBe('32025R0040')
  })

  it('converts (EG) nr 166/2006 to CELEX 32006R0166', () => {
    expect(csvEuToCelex('(EG) nr 166/2006')).toBe('32006R0166')
  })

  it('converts (EG) nr 440/2008 to CELEX 32008R0440', () => {
    expect(csvEuToCelex('(EG) nr 440/2008')).toBe('32008R0440')
  })

  it('converts (EU) nr 649/2012 to CELEX 32012R0649', () => {
    expect(csvEuToCelex('(EU) nr 649/2012')).toBe('32012R0649')
  })

  it('converts (EU) nr 852/2020 to CELEX 32020R0852', () => {
    expect(csvEuToCelex('(EU) nr 852/2020')).toBe('32020R0852')
  })

  it('converts (EU) nr 956/2023 to CELEX 32023R0956', () => {
    expect(csvEuToCelex('(EU) nr 956/2023')).toBe('32023R0956')
  })

  it('converts (EU) nr 1115/2023 to CELEX 32023R1115', () => {
    expect(csvEuToCelex('(EU) nr 1115/2023')).toBe('32023R1115')
  })

  it('converts (EU) nr 1542/2023 to CELEX 32023R1542', () => {
    expect(csvEuToCelex('(EU) nr 1542/2023')).toBe('32023R1542')
  })

  it('converts (EU) nr 2772/2023 to CELEX 32023R2772', () => {
    expect(csvEuToCelex('(EU) nr 2772/2023')).toBe('32023R2772')
  })

  it('returns null for non-EU references', () => {
    expect(csvEuToCelex('SFS 1998:808')).toBeNull()
  })
})

describe('Story 12.5: normalizeForMatching', () => {
  let normalizeForMatching: typeof import('@/scripts/seed-miljo-template').normalizeForMatching

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-miljo-template')
    normalizeForMatching = mod.normalizeForMatching
  })

  it('lowercases and strips Swedish diacritics', () => {
    expect(normalizeForMatching('SRVFS 2004:3')).toBe('srvfs 2004:3')
    expect(normalizeForMatching('ELSÄK-FS 2022:1')).toBe('elsak-fs 2022:1')
  })

  it('handles ö, ä, å correctly', () => {
    expect(normalizeForMatching('Miljö')).toBe('miljo')
    expect(normalizeForMatching('Räddningsverket')).toBe('raddningsverket')
    expect(normalizeForMatching('Strålsäkerhet')).toBe('stralsakerhet')
  })
})

describe('Story 12.5: isDocumentReference', () => {
  let isDocumentReference: typeof import('@/scripts/seed-miljo-template').isDocumentReference

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-miljo-template')
    isDocumentReference = mod.isDocumentReference
  })

  it('accepts all Miljö document prefixes', () => {
    expect(isDocumentReference('SFS 1998:808')).toBe(true)
    expect(isDocumentReference('NFS 2020:5')).toBe(true)
    expect(isDocumentReference('MSBFS 2024:10')).toBe(true)
    expect(isDocumentReference('KIFS 2017:7')).toBe(true)
    expect(isDocumentReference('BFS 2011:16')).toBe(true)
    expect(isDocumentReference('SRVFS 2004:3')).toBe(true)
    expect(isDocumentReference('SCB-FS 2024:25')).toBe(true)
    expect(isDocumentReference('SSMFS 2018:2')).toBe(true)
    expect(isDocumentReference('STAFS 2020:1')).toBe(true)
    expect(isDocumentReference('(EU) nr 573/2024')).toBe(true)
    expect(isDocumentReference('(EG) nr 1907/2006')).toBe(true)
  })

  it('rejects non-document-reference strings', () => {
    expect(isDocumentReference('---')).toBe(false)
    expect(isDocumentReference('Index')).toBe(false)
    expect(isDocumentReference('51')).toBe(false)
    expect(isDocumentReference('Source Type')).toBe(false)
  })
})

describe('Story 12.5: parseFrontmatter', () => {
  let parseFrontmatter: typeof import('@/scripts/seed-miljo-template').parseFrontmatter

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-miljo-template')
    parseFrontmatter = mod.parseFrontmatter
  })

  it('extracts document_count from YAML frontmatter', () => {
    const result = parseFrontmatter(
      '---\ndocument_count: 98\nsection_count: 9\n---'
    )
    expect(result.totalDocuments).toBe(98)
  })

  it('returns 0 if no document_count found', () => {
    const result = parseFrontmatter('---\nno_such_field: 42\n---')
    expect(result.totalDocuments).toBe(0)
  })
})

// ============================================================================
// Analysis File Parsing Tests
// ============================================================================

describe('Story 12.5: parseAnalysisFile', () => {
  let parseAnalysisFile: typeof import('@/scripts/seed-miljo-template').parseAnalysisFile

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-miljo-template')
    parseAnalysisFile = mod.parseAnalysisFile
  })

  it('parses markdown table rows from Miljö analysis file format', () => {
    mockReadFileSync.mockReturnValue(
      `---
document_count: 3
---
### Section 01 -- Övergripande
| #   | SFS/AFS Number | Official Statute Title | Last Amendment |
| --- | -------------- | ---------------------- | -------------- |
| 1   | SFS 1998:808   | Miljöbalk (1998:808)   | SFS 2025:1317  |
| 2   | SFS 2012:259   | Förordning (2012:259)  | SFS 2024:1011  |
### Section 02 -- Avfallshantering
| #   | SFS/AFS Number | Official Statute Title | Last Amendment |
| --- | -------------- | ---------------------- | -------------- |
| 1   | NFS 2020:5     | Naturvårdsverkets f.   | --             |
`
    )

    const entries = parseAnalysisFile('/fake/path.md')
    expect(entries).toHaveLength(3)
    expect(entries[0]!.fullReference).toBe('SFS 1998:808')
    expect(entries[0]!.title).toBe('Miljöbalk (1998:808)')
    expect(entries[0]!.originalSection).toBe('01')
    expect(entries[2]!.fullReference).toBe('NFS 2020:5')
    expect(entries[2]!.originalSection).toBe('02')
  })

  it('skips header and separator rows', () => {
    mockReadFileSync.mockReturnValue(
      `### Section 01 -- Test
| #   | SFS/AFS Number | Official Statute Title | Last Amendment |
| --- | -------------- | ---------------------- | -------------- |
| 1   | SFS 1998:808   | Miljöbalk              | --             |
`
    )

    const entries = parseAnalysisFile('/fake/path.md')
    expect(entries).toHaveLength(1)
  })

  it('handles EU references correctly', () => {
    mockReadFileSync.mockReturnValue(
      `### Section 03 -- Kemikalier
| #   | SFS/AFS Number    | Official Statute Title | Last Amendment |
| --- | ----------------- | ---------------------- | -------------- |
| 1   | (EG) nr 1907/2006 | REACH                  | --             |
| 2   | (EU) 40/2025      | Förpackningar          | --             |
`
    )

    const entries = parseAnalysisFile('/fake/path.md')
    expect(entries).toHaveLength(2)
    expect(entries[0]!.fullReference).toBe('(EG) nr 1907/2006')
    expect(entries[1]!.fullReference).toBe('(EU) 40/2025')
  })

  it('handles BFS with OVK suffix', () => {
    mockReadFileSync.mockReturnValue(
      `### Section 05 -- Utsläpp
| #   | SFS/AFS Number      | Official Statute Title | Last Amendment |
| --- | ------------------- | ---------------------- | -------------- |
| 1   | BFS 2011:16 - OVK 1 | OVK                    | --             |
`
    )

    const entries = parseAnalysisFile('/fake/path.md')
    expect(entries).toHaveLength(1)
    expect(entries[0]!.fullReference).toBe('BFS 2011:16 - OVK 1')
  })

  it('handles all 10 Miljö document prefixes', () => {
    mockReadFileSync.mockReturnValue(
      `### Section 01 -- All types
| # | SFS/AFS Number | Title | Amend |
| - | -------------- | ----- | ----- |
| 1 | SFS 1998:808 | Miljöbalk | -- |
| 2 | NFS 2020:5 | NV foreskrift | -- |
| 3 | MSBFS 2024:10 | MSB foreskrift | -- |
| 4 | KIFS 2017:7 | KemI foreskrift | -- |
| 5 | BFS 2011:16 | Boverket foreskrift | -- |
| 6 | SRVFS 2004:3 | Raddning | -- |
| 7 | SCB-FS 2024:25 | SCB foreskrift | -- |
| 8 | SSMFS 2018:2 | SSM foreskrift | -- |
| 9 | STAFS 2020:1 | Swedac foreskrift | -- |
| 10 | (EU) nr 573/2024 | F-gas | -- |
`
    )

    const entries = parseAnalysisFile('/fake/path.md')
    expect(entries).toHaveLength(10)
  })
})

// ============================================================================
// Tjänsteföretag Parsing Tests
// ============================================================================

describe('Story 12.5: parseTjansteforetagFile', () => {
  let parseTjansteforetagFile: typeof import('@/scripts/seed-miljo-template').parseTjansteforetagFile

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-miljo-template')
    parseTjansteforetagFile = mod.parseTjansteforetagFile
  })

  it('extracts service company document references (normalized)', () => {
    mockReadFileSync.mockReturnValue(
      `## Docs
| Index | SFS/Ref | Title | Source Type | In Parent? |
| ----- | ------- | ----- | ----------- | ---------- |
| 0100  | SFS 1998:808 | Miljöbalk Kap 2 | Lag | Yes |
| 0110  | SFS 2012:259 | Förordning | Förordning | Yes |
| 0300  | (EG) nr 1907/2006 | REACH | EU-förordning | Yes |
`
    )

    const refs = parseTjansteforetagFile('/fake/path.md')
    expect(refs.size).toBe(3)
    expect(refs.has(normalizeForMatchingHelper('SFS 1998:808'))).toBe(true)
    expect(refs.has(normalizeForMatchingHelper('SFS 2012:259'))).toBe(true)
    expect(refs.has(normalizeForMatchingHelper('(EG) nr 1907/2006'))).toBe(true)
  })

  it('deduplicates Miljöbalk chapter references to single SFS 1998:808', () => {
    mockReadFileSync.mockReturnValue(
      `## Docs
| Index | SFS/Ref | Title | Source Type | In Parent? |
| ----- | ------- | ----- | ----------- | ---------- |
| 0100  | SFS 1998:808 | Miljöbalk Kap 2 | Lag | Yes |
| 0200  | SFS 1998:808 | Miljöbalk Kap 15 | Lag | Yes |
| 0320  | SFS 1998:808 | Miljöbalk Kap 14 | Lag | Yes |
`
    )

    const refs = parseTjansteforetagFile('/fake/path.md')
    // All three Miljöbalk chapters map to the same SFS 1998:808
    expect(refs.size).toBe(1)
    expect(refs.has(normalizeForMatchingHelper('SFS 1998:808'))).toBe(true)
  })

  it('handles BFS without OVK suffix in table', () => {
    mockReadFileSync.mockReturnValue(
      `## Docs
| Index | SFS/Ref | Title | Source Type | In Parent? |
| ----- | ------- | ----- | ----------- | ---------- |
| 0440  | BFS 2011:16 | OVK | Myndighetsföreskrift | Yes |
`
    )

    const refs = parseTjansteforetagFile('/fake/path.md')
    expect(refs.has(normalizeForMatchingHelper('BFS 2011:16'))).toBe(true)
  })
})

/** Helper to replicate normalizeForMatching without importing */
function normalizeForMatchingHelper(ref: string): string {
  return ref
    .replace(/ä/g, 'a')
    .replace(/Ä/g, 'A')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/å/g, 'a')
    .replace(/Å/g, 'A')
    .toLowerCase()
}

// ============================================================================
// Seed Function Integration Tests (mocked Prisma + fs)
// ============================================================================

const MOCK_ANALYSIS_CONTENT = `---
document_count: 5
---
### Section 01 -- Övergripande
| #   | SFS/AFS Number | Official Statute Title | Last Amendment |
| --- | -------------- | ---------------------- | -------------- |
| 1   | SFS 1998:808   | Miljöbalk (1998:808)   | SFS 2025:1317  |
| 2   | SFS 2012:259   | Förordning (2012:259) om miljösanktionsavgifter | SFS 2024:1011 |
### Section 02 -- Avfall
| #   | SFS/AFS Number | Official Statute Title | Last Amendment |
| --- | -------------- | ---------------------- | -------------- |
| 1   | NFS 2020:5     | Naturvårdsverkets föreskrifter | -- |
### Section 03 -- Kemikalier
| #   | SFS/AFS Number    | Official Statute Title | Last Amendment |
| --- | ----------------- | ---------------------- | -------------- |
| 1   | (EG) nr 1907/2006 | REACH                  | --             |
| 2   | KIFS 2017:7       | Kemiska produkter      | --             |
`

const MOCK_TJANSTEFORETAG_CONTENT = `## Docs
| Index | SFS/Ref | Title | Source Type | In Parent? |
| ----- | ------- | ----- | ----------- | ---------- |
| 0100  | SFS 1998:808 | Miljöbalk Kap 2 | Lag | Yes |
| 0300  | (EG) nr 1907/2006 | REACH | EU-förordning | Yes |
| 0330  | KIFS 2017:7 | Kemiska produkter | Myndighetsföreskrift | Yes |
`

const MOCK_CSV_CONTENT = `Laglista,Section Number,Section Name,Index,SFS Number,Amendment SFS,Document Name,Notisum Comment,Summary,Compliance,Link
Miljö,01,Övergripande,1,SFS 1998:808,SFS 2025:1317,Miljöbalk,,,,
Miljö,01,Övergripande,2,SFS 2012:259,SFS 2024:1011,Förordning om miljösanktionsavgifter,,,,
Miljö,02,Avfall,1,NFS 2020:5,,Naturvårdsverkets föreskrifter,,,,
Miljö,03,Kemikalier,1,(EG) nr 1907/2006,,REACH,,,,
Miljö,03,Kemikalier,2,KIFS 2017:7,,Kemiska produkter,,,,
`

function setupFsMock() {
  mockReadFileSync.mockImplementation((filePath: unknown) => {
    const p = String(filePath)
    if (p.includes('03-miljo.md')) return MOCK_ANALYSIS_CONTENT
    if (p.includes('04-miljo-tjansteforetag.md'))
      return MOCK_TJANSTEFORETAG_CONTENT
    if (p.includes('laglistor-all-combined.csv')) return MOCK_CSV_CONTENT
    throw new Error(`Unexpected file read: ${p}`)
  })
}

function setupPrismaMock() {
  Object.values(mockPrisma).forEach((namespace) => {
    if (namespace && typeof namespace === 'object') {
      Object.values(namespace).forEach((fn) => {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          ;(fn as ReturnType<typeof vi.fn>).mockReset()
        }
      })
    }
  })

  mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' })
  mockPrisma.lawListTemplate.findUnique.mockResolvedValue(null)
  mockPrisma.lawListTemplate.upsert.mockResolvedValue({
    id: 'template-1',
    slug: 'miljo',
  })
  mockPrisma.lawListTemplate.update.mockResolvedValue({})
  mockPrisma.templateSection.upsert.mockResolvedValue({ id: 'section-1' })
  mockPrisma.templateSection.update.mockResolvedValue({})
  mockPrisma.templateItem.upsert.mockResolvedValue({ id: 'item-1' })

  mockPrisma.legalDocument.findUnique.mockImplementation(
    (args: { where: { document_number: string } }) => {
      const docNum = args.where.document_number
      return Promise.resolve({
        id: `doc-${docNum.replace(/\s+/g, '-')}`,
        summary: 'Test summary',
        kommentar: 'Vi ska testa',
      })
    }
  )
  mockPrisma.legalDocument.findMany.mockResolvedValue([])

  mockPrisma.euDocument.findUnique.mockImplementation(
    (args: { where: { celex_number: string } }) => {
      if (args.where.celex_number === '32006R1907') {
        return Promise.resolve({
          document: {
            id: 'doc-eu-reach',
            summary: 'REACH summary',
            kommentar: 'Vi ska följa REACH',
          },
        })
      }
      return Promise.resolve(null)
    }
  )
}

describe('Story 12.5: seed() correct record counts (Test 1)', () => {
  let seed: typeof import('@/scripts/seed-miljo-template').seed

  beforeEach(async () => {
    setupFsMock()
    setupPrismaMock()
    const mod = await import('@/scripts/seed-miljo-template')
    seed = mod.seed
  })

  it('creates 1 template, 1 section, and correct number of items', async () => {
    const result = await seed({ force: false, dryRun: false })

    expect(mockPrisma.lawListTemplate.upsert).toHaveBeenCalledTimes(1)
    expect(mockPrisma.templateSection.upsert).toHaveBeenCalledTimes(1)
    expect(result.itemsCreated).toBe(5)
    expect(result.templateId).toBe('template-1')
    expect(result.sectionId).toBe('section-1')
  })
})

describe('Story 12.5: index uniqueness (Test 2)', () => {
  let seed: typeof import('@/scripts/seed-miljo-template').seed

  beforeEach(async () => {
    setupFsMock()
    setupPrismaMock()
    const mod = await import('@/scripts/seed-miljo-template')
    seed = mod.seed
  })

  it('assigns sequential unique indexes', async () => {
    const upsertCalls: Array<{ create: { index: string } }> = []
    mockPrisma.templateItem.upsert.mockImplementation(
      (args: { create: { index: string } }) => {
        upsertCalls.push(args)
        return Promise.resolve({ id: `item-${args.create.index}` })
      }
    )

    await seed({ force: false, dryRun: false })

    const indexes = upsertCalls.map((c) => c.create.index)
    expect(indexes).toEqual(['001', '002', '003', '004', '005'])
    expect(new Set(indexes).size).toBe(indexes.length)
  })
})

describe('Story 12.5: is_service_company_relevant flags (Test 3)', () => {
  let seed: typeof import('@/scripts/seed-miljo-template').seed

  beforeEach(async () => {
    setupFsMock()
    setupPrismaMock()
    const mod = await import('@/scripts/seed-miljo-template')
    seed = mod.seed
  })

  it('sets is_service_company_relevant correctly', async () => {
    const upsertCalls: Array<{
      create: { index: string; is_service_company_relevant: boolean }
    }> = []
    mockPrisma.templateItem.upsert.mockImplementation(
      (args: {
        create: { index: string; is_service_company_relevant: boolean }
      }) => {
        upsertCalls.push(args)
        return Promise.resolve({ id: `item-${args.create.index}` })
      }
    )

    await seed({ force: false, dryRun: false })

    const trueCount = upsertCalls.filter(
      (c) => c.create.is_service_company_relevant
    ).length
    const falseCount = upsertCalls.filter(
      (c) => !c.create.is_service_company_relevant
    ).length
    // SFS 1998:808, (EG) nr 1907/2006, KIFS 2017:7 are in tjänsteföretag
    expect(trueCount).toBe(3)
    expect(falseCount).toBe(2) // SFS 2012:259 and NFS 2020:5
  })
})

describe('Story 12.5: document_id references resolve (Test 4)', () => {
  let seed: typeof import('@/scripts/seed-miljo-template').seed

  beforeEach(async () => {
    setupFsMock()
    setupPrismaMock()
    const mod = await import('@/scripts/seed-miljo-template')
    seed = mod.seed
  })

  it('all items have valid document references', async () => {
    const result = await seed({ force: false, dryRun: false })
    expect(result.itemsCreated).toBe(5)
    expect(result.missingDocuments).toHaveLength(0)
  })
})

describe('Story 12.5: idempotent seed (Test 9)', () => {
  let seed: typeof import('@/scripts/seed-miljo-template').seed

  beforeEach(async () => {
    setupFsMock()
    setupPrismaMock()
    const mod = await import('@/scripts/seed-miljo-template')
    seed = mod.seed
  })

  it('uses upsert — running twice does not create duplicates', async () => {
    await seed({ force: false, dryRun: false })
    const firstCallCount = mockPrisma.templateItem.upsert.mock.calls.length

    mockPrisma.templateItem.upsert.mockClear()
    mockPrisma.lawListTemplate.findUnique.mockResolvedValue(null)
    mockPrisma.lawListTemplate.upsert.mockClear()
    mockPrisma.lawListTemplate.upsert.mockResolvedValue({
      id: 'template-1',
      slug: 'miljo',
    })
    mockPrisma.templateSection.upsert.mockClear()
    mockPrisma.templateSection.upsert.mockResolvedValue({ id: 'section-1' })

    await seed({ force: true, dryRun: false })
    const secondCallCount = mockPrisma.templateItem.upsert.mock.calls.length

    expect(secondCallCount).toBe(firstCallCount)
    expect(mockPrisma.templateItem.upsert).toHaveBeenCalled()
  })
})

describe('Story 12.5: --dry-run mode (Test 10)', () => {
  let seed: typeof import('@/scripts/seed-miljo-template').seed

  beforeEach(async () => {
    setupFsMock()
    setupPrismaMock()
    const mod = await import('@/scripts/seed-miljo-template')
    seed = mod.seed
  })

  it('does not write to database in dry-run mode', async () => {
    const result = await seed({ force: false, dryRun: true })

    expect(mockPrisma.lawListTemplate.upsert).not.toHaveBeenCalled()
    expect(mockPrisma.templateSection.upsert).not.toHaveBeenCalled()
    expect(mockPrisma.templateItem.upsert).not.toHaveBeenCalled()
    expect(result.templateId).toBe('dry-run-template')
    expect(result.sectionId).toBe('dry-run-section')
    expect(result.itemsCreated).toBe(5)
  })
})

describe('Story 12.5: missing LegalDocument handling (Test 11)', () => {
  let seed: typeof import('@/scripts/seed-miljo-template').seed

  beforeEach(async () => {
    setupFsMock()
    setupPrismaMock()
    const mod = await import('@/scripts/seed-miljo-template')
    seed = mod.seed
  })

  it('logs missing documents and continues without crashing', async () => {
    mockPrisma.legalDocument.findUnique.mockImplementation(
      (args: { where: { document_number: string } }) => {
        if (args.where.document_number === 'NFS 2020:5') {
          return Promise.resolve(null)
        }
        return Promise.resolve({
          id: `doc-${args.where.document_number.replace(/\s+/g, '-')}`,
          summary: 'Test summary',
          kommentar: 'Vi ska testa',
        })
      }
    )

    const result = await seed({ force: false, dryRun: false })

    expect(result.itemsCreated).toBe(4)
    expect(result.missingDocuments).toHaveLength(1)
    expect(result.missingDocuments[0]).toContain('NFS 2020:5')
  })
})

describe('Story 12.5: existing template without --force (early exit)', () => {
  let seed: typeof import('@/scripts/seed-miljo-template').seed

  beforeEach(async () => {
    setupFsMock()
    setupPrismaMock()
    const mod = await import('@/scripts/seed-miljo-template')
    seed = mod.seed
  })

  it('exits early when template exists and --force not set', async () => {
    mockPrisma.lawListTemplate.findUnique.mockResolvedValue({
      id: 'existing-template',
      slug: 'miljo',
    })

    const result = await seed({ force: false, dryRun: false })

    expect(result.templateId).toBe('existing-template')
    expect(result.itemsCreated).toBe(0)
    expect(mockPrisma.templateItem.upsert).not.toHaveBeenCalled()
  })
})

describe('Story 12.5: parseArgs', () => {
  let parseArgs: typeof import('@/scripts/seed-miljo-template').parseArgs

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-miljo-template')
    parseArgs = mod.parseArgs
  })

  it('defaults to force=false, dryRun=false', () => {
    const original = process.argv
    process.argv = ['node', 'script.ts']
    const config = parseArgs()
    expect(config.force).toBe(false)
    expect(config.dryRun).toBe(false)
    process.argv = original
  })

  it('parses --force and --dry-run flags', () => {
    const original = process.argv
    process.argv = ['node', 'script.ts', '--force', '--dry-run']
    const config = parseArgs()
    expect(config.force).toBe(true)
    expect(config.dryRun).toBe(true)
    process.argv = original
  })
})

describe('Story 12.5: content_status set correctly', () => {
  let seed: typeof import('@/scripts/seed-miljo-template').seed

  beforeEach(async () => {
    setupFsMock()
    setupPrismaMock()
    const mod = await import('@/scripts/seed-miljo-template')
    seed = mod.seed
  })

  it('sets AI_GENERATED when summary exists, STUB when null', async () => {
    // Make NFS doc have null summary
    mockPrisma.legalDocument.findUnique.mockImplementation(
      (args: { where: { document_number: string } }) => {
        const docNum = args.where.document_number
        if (docNum === 'NFS 2020:5') {
          return Promise.resolve({
            id: 'doc-nfs-no-summary',
            summary: null,
            kommentar: null,
          })
        }
        return Promise.resolve({
          id: `doc-${docNum.replace(/\s+/g, '-')}`,
          summary: 'Test summary',
          kommentar: 'Vi ska testa',
        })
      }
    )

    const upsertCalls: Array<{
      create: { content_status: string; index: string }
    }> = []
    mockPrisma.templateItem.upsert.mockImplementation(
      (args: { create: { content_status: string; index: string } }) => {
        upsertCalls.push(args)
        return Promise.resolve({ id: `item-${args.create.index}` })
      }
    )

    await seed({ force: false, dryRun: false })

    const stubItems = upsertCalls.filter(
      (c) => c.create.content_status === 'STUB'
    )
    const aiItems = upsertCalls.filter(
      (c) => c.create.content_status === 'AI_GENERATED'
    )
    expect(stubItems).toHaveLength(1)
    expect(aiItems).toHaveLength(4)
  })
})

describe('Story 12.5: CSV amendment data for replaces_old_reference', () => {
  let seed: typeof import('@/scripts/seed-miljo-template').seed

  beforeEach(async () => {
    setupFsMock()
    setupPrismaMock()
    const mod = await import('@/scripts/seed-miljo-template')
    seed = mod.seed
  })

  it('uses CSV Amendment SFS for replaces_old_reference', async () => {
    const upsertCalls: Array<{
      create: { replaces_old_reference: string | null; index: string }
    }> = []
    mockPrisma.templateItem.upsert.mockImplementation(
      (args: {
        create: { replaces_old_reference: string | null; index: string }
      }) => {
        upsertCalls.push(args)
        return Promise.resolve({ id: `item-${args.create.index}` })
      }
    )

    await seed({ force: false, dryRun: false })

    // SFS 1998:808 has Amendment SFS = SFS 2025:1317 in CSV
    const miljobalken = upsertCalls.find((c) => c.create.index === '001')
    expect(miljobalken?.create.replaces_old_reference).toBe('SFS 2025:1317')

    // NFS 2020:5 has no Amendment SFS
    const nfs = upsertCalls.find((c) => c.create.index === '003')
    expect(nfs?.create.replaces_old_reference).toBeNull()
  })
})
