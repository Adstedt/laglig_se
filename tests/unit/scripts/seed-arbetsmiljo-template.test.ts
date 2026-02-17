/**
 * Story 12.4: Unit Tests for Seed Arbetsmiljö Template
 *
 * Tests cover: record counts, index uniqueness, service company flags,
 * document resolution, replaces_old_reference parsing, source_type
 * classification, regulatory_body mapping, cross_list_references,
 * idempotency, dry-run mode, and missing document handling.
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

describe('Story 12.4: extractBaseDocumentNumber', () => {
  let extractBaseDocumentNumber: typeof import('@/scripts/seed-arbetsmiljo-template').extractBaseDocumentNumber

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
    extractBaseDocumentNumber = mod.extractBaseDocumentNumber
  })

  it('strips (ersätter ...) clause', () => {
    expect(extractBaseDocumentNumber('AFS 2023:2 (ersätter AFS 2015:4)')).toBe(
      'AFS 2023:2'
    )
  })

  it('returns unchanged for references without ersätter', () => {
    expect(extractBaseDocumentNumber('SFS 1977:1160')).toBe('SFS 1977:1160')
  })
})

describe('Story 12.4: replaces_old_reference parsed correctly (Test 5)', () => {
  let extractReplacesReference: typeof import('@/scripts/seed-arbetsmiljo-template').extractReplacesReference

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
    extractReplacesReference = mod.extractReplacesReference
  })

  it('extracts old AFS reference from ersätter notation', () => {
    expect(extractReplacesReference('AFS 2023:1 (ersätter AFS 2001:1)')).toBe(
      'AFS 2001:1'
    )
  })

  it('returns null for references without ersätter', () => {
    expect(extractReplacesReference('SFS 1977:1160')).toBeNull()
  })

  it('extracts old reference with AFS 2023:2 multi-chapter', () => {
    expect(extractReplacesReference('AFS 2023:2 (ersätter AFS 1999:7)')).toBe(
      'AFS 1999:7'
    )
  })
})

describe('Story 12.4: source_type classification (Test 6)', () => {
  let classifySourceType: typeof import('@/scripts/seed-arbetsmiljo-template').classifySourceType

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
    classifySourceType = mod.classifySourceType
  })

  it('classifies SFS with "lag" in title as lag', () => {
    expect(classifySourceType('SFS 1977:1160', 'Arbetsmiljölag')).toBe('lag')
  })

  it('classifies SFS with "förordning" in title as forordning', () => {
    expect(classifySourceType('SFS 1977:1166', 'Arbetsmiljöförordning')).toBe(
      'forordning'
    )
  })

  it('classifies AFS as foreskrift', () => {
    expect(classifySourceType('AFS 2023:1', 'SAM')).toBe('foreskrift')
  })

  it('classifies BFS as foreskrift', () => {
    expect(classifySourceType('BFS 2011:16', 'OVK')).toBe('foreskrift')
  })

  it('classifies MSBFS as foreskrift', () => {
    expect(classifySourceType('MSBFS 2020:1', 'Brandfarliga')).toBe(
      'foreskrift'
    )
  })

  it('classifies ELSAK-FS as foreskrift', () => {
    expect(classifySourceType('ELSAK-FS 2022:1', 'Elsäkerhet')).toBe(
      'foreskrift'
    )
  })

  it('classifies KIFS as foreskrift', () => {
    expect(classifySourceType('KIFS 2017:7', 'Kemikalie')).toBe('foreskrift')
  })

  it('classifies SRVFS as allmanna-rad', () => {
    expect(classifySourceType('SRVFS 2004:3', 'Räddning')).toBe('allmanna-rad')
  })

  it('classifies (EU) as eu-forordning', () => {
    expect(classifySourceType('(EU) nr 679/2016', 'GDPR')).toBe('eu-forordning')
  })

  it('classifies (EG) as eu-forordning', () => {
    expect(classifySourceType('(EG) nr 1272/2008', 'CLP')).toBe('eu-forordning')
  })
})

describe('Story 12.4: regulatory_body mapping (Test 7)', () => {
  let getRegulatoryBody: typeof import('@/scripts/seed-arbetsmiljo-template').getRegulatoryBody

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
    getRegulatoryBody = mod.getRegulatoryBody
  })

  it('maps AFS to Arbetsmiljöverket', () => {
    expect(getRegulatoryBody('AFS 2023:1')).toBe('Arbetsmiljöverket')
  })

  it('maps SFS to Riksdagen', () => {
    expect(getRegulatoryBody('SFS 1977:1160')).toBe('Riksdagen')
  })

  it('maps BFS to Boverket', () => {
    expect(getRegulatoryBody('BFS 2011:16')).toBe('Boverket')
  })

  it('maps MSBFS to MSB', () => {
    expect(getRegulatoryBody('MSBFS 2020:1')).toBe('MSB')
  })

  it('maps ELSAK-FS to Elsäkerhetsverket', () => {
    expect(getRegulatoryBody('ELSAK-FS 2022:1')).toBe('Elsäkerhetsverket')
  })

  it('maps ELSÄK-FS to Elsäkerhetsverket', () => {
    expect(getRegulatoryBody('ELSÄK-FS 2022:1')).toBe('Elsäkerhetsverket')
  })

  it('maps KIFS to Kemikalieinspektionen', () => {
    expect(getRegulatoryBody('KIFS 2017:7')).toBe('Kemikalieinspektionen')
  })

  it('maps (EU) to EU', () => {
    expect(getRegulatoryBody('(EU) nr 679/2016')).toBe('EU')
  })

  it('maps (EG) to EU', () => {
    expect(getRegulatoryBody('(EG) nr 1272/2008')).toBe('EU')
  })

  it('maps SRVFS to Räddningsverket', () => {
    expect(getRegulatoryBody('SRVFS 2004:3')).toBe('Räddningsverket')
  })

  it('maps SKVFS to Skatteverket', () => {
    expect(getRegulatoryBody('SKVFS 2015:6')).toBe('Skatteverket')
  })
})

describe('Story 12.4: cross_list_references populated correctly (Test 8)', () => {
  let getCrossListReferences: typeof import('@/scripts/seed-arbetsmiljo-template').getCrossListReferences

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
    getCrossListReferences = mod.getCrossListReferences
  })

  it('GDPR appears in halsa and infosak', () => {
    const refs = getCrossListReferences({
      fullReference: '(EU) nr 679/2016',
      title: 'GDPR',
      originalIndex: '--',
      originalSection: '09',
    })
    expect(refs).toContain('halsa')
    expect(refs).toContain('infosak')
  })

  it('SFS 2007:19 appears in miljo, miljo-tjansteforetag, and fastighet-bygg', () => {
    const refs = getCrossListReferences({
      fullReference: 'SFS 2007:19',
      title: 'Lag om PCB',
      originalIndex: '--',
      originalSection: '09',
    })
    expect(refs).toContain('miljo')
    expect(refs).toContain('miljo-tjansteforetag')
    expect(refs).toContain('fastighet-bygg')
    expect(refs).toHaveLength(3)
  })

  it('AFS 2023:2 (ersätter AFS 2015:4) appears in miljo-sverige', () => {
    const refs = getCrossListReferences({
      fullReference: 'AFS 2023:2 (ersätter AFS 2015:4)',
      title: 'OSA',
      originalIndex: '1',
      originalSection: '02',
    })
    expect(refs).toContain('miljo-sverige')
  })

  it('reference not in any overlap list returns empty array', () => {
    // AFS 2023:4 (standalone, no ersätter) does not appear in any cross-list
    const refs = getCrossListReferences({
      fullReference: 'AFS 2023:4',
      title: 'Maskiner',
      originalIndex: '1',
      originalSection: '06',
    })
    expect(refs).toEqual([])
  })

  it('SKVFS 2015:6 appears in livsmedel', () => {
    const refs = getCrossListReferences({
      fullReference: 'SKVFS 2015:6',
      title: 'Skatteverkets föreskrifter',
      originalIndex: '--',
      originalSection: '09',
    })
    expect(refs).toContain('livsmedel')
  })
})

describe('Story 12.4: csvEuToCelex conversion', () => {
  let csvEuToCelex: typeof import('@/scripts/seed-arbetsmiljo-template').csvEuToCelex

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
    csvEuToCelex = mod.csvEuToCelex
  })

  it('converts (EU) nr 679/2016 to CELEX 32016R0679', () => {
    expect(csvEuToCelex('(EU) nr 679/2016')).toBe('32016R0679')
  })

  it('converts (EG) nr 1272/2008 to CELEX 32008R1272', () => {
    expect(csvEuToCelex('(EG) nr 1272/2008')).toBe('32008R1272')
  })

  it('converts (EU) nr 1021/2019 to CELEX 32019R1021', () => {
    expect(csvEuToCelex('(EU) nr 1021/2019')).toBe('32019R1021')
  })

  it('returns null for non-EU references', () => {
    expect(csvEuToCelex('SFS 1977:1160')).toBeNull()
  })
})

describe('Story 12.4: normalizeDocumentNumber', () => {
  let normalizeDocumentNumber: typeof import('@/scripts/seed-arbetsmiljo-template').normalizeDocumentNumber

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
    normalizeDocumentNumber = mod.normalizeDocumentNumber
  })

  it('normalizes ELSAK-FS to ELSÄK-FS', () => {
    expect(normalizeDocumentNumber('ELSAK-FS 2022:1')).toBe('ELSÄK-FS 2022:1')
  })

  it('strips OVK suffix from BFS', () => {
    expect(normalizeDocumentNumber('BFS 2011:16 - OVK 1')).toBe('BFS 2011:16')
  })

  it('leaves normal SFS unchanged', () => {
    expect(normalizeDocumentNumber('SFS 1977:1160')).toBe('SFS 1977:1160')
  })
})

describe('Story 12.4: resolveDocumentNumber', () => {
  let resolveDocumentNumber: typeof import('@/scripts/seed-arbetsmiljo-template').resolveDocumentNumber

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
    resolveDocumentNumber = mod.resolveDocumentNumber
  })

  it('resolves SPLIT AFS to chapter-level document_number', () => {
    expect(
      resolveDocumentNumber({
        fullReference: 'AFS 2023:2 (ersätter AFS 2015:4)',
        title: 'OSA',
        originalIndex: '1',
        originalSection: '02',
      })
    ).toBe('AFS 2023:2 kap. 2')
  })

  it('resolves KEEP_WHOLE AFS to parent document_number', () => {
    expect(
      resolveDocumentNumber({
        fullReference: 'AFS 2023:12 (ersätter AFS 2020:1)',
        title: 'Arbetsplatsens utformning',
        originalIndex: '1',
        originalSection: '04',
      })
    ).toBe('AFS 2023:12')
  })

  it('resolves non-AFS entry to base document_number', () => {
    expect(
      resolveDocumentNumber({
        fullReference: 'SFS 1977:1160',
        title: 'Arbetsmiljölag',
        originalIndex: '1',
        originalSection: '01',
      })
    ).toBe('SFS 1977:1160')
  })

  it('normalizes BFS with OVK suffix', () => {
    expect(
      resolveDocumentNumber({
        fullReference: 'BFS 2011:16 - OVK 1',
        title: 'OVK',
        originalIndex: '--',
        originalSection: '09',
      })
    ).toBe('BFS 2011:16')
  })

  it('disambiguates AFS 2004:3 between AFS 2023:9 and AFS 2023:11', () => {
    expect(
      resolveDocumentNumber({
        fullReference: 'AFS 2023:9 (ersätter AFS 2004:3)',
        title: 'Stegar',
        originalIndex: '3',
        originalSection: '06',
      })
    ).toBe('AFS 2023:9 kap. 4')

    expect(
      resolveDocumentNumber({
        fullReference: 'AFS 2023:11 (ersätter AFS 2004:3)',
        title: 'Stegar',
        originalIndex: '7',
        originalSection: '06',
      })
    ).toBe('AFS 2023:11 kap. 7')
  })
})

// ============================================================================
// Analysis File Parsing Tests
// ============================================================================

describe('Story 12.4: parseAnalysisFile', () => {
  let parseAnalysisFile: typeof import('@/scripts/seed-arbetsmiljo-template').parseAnalysisFile

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
    parseAnalysisFile = mod.parseAnalysisFile
  })

  it('parses markdown table rows from analysis file', () => {
    mockReadFileSync.mockReturnValue(
      `---
total_documents: 3
---
### 2.1 Lagar och förordningar
| Index | SFS/Reference | Official Title |
| --- | --- | --- |
| 1 | SFS 1977:1160 | Arbetsmiljölag |
| 2 | SFS 1977:1166 | Arbetsmiljöförordning |
### 2.2 Föreskrifter
| Index | SFS/Reference | Official Title |
| --- | --- | --- |
| 1 | AFS 2023:1 (ersätter AFS 2001:1) | SAM |
`
    )

    const entries = parseAnalysisFile('/fake/path.md')
    expect(entries).toHaveLength(3)
    expect(entries[0]!.fullReference).toBe('SFS 1977:1160')
    expect(entries[0]!.title).toBe('Arbetsmiljölag')
    expect(entries[0]!.originalSection).toBe('01')
    expect(entries[2]!.fullReference).toBe('AFS 2023:1 (ersätter AFS 2001:1)')
    expect(entries[2]!.originalSection).toBe('02')
  })

  it('skips header and separator rows', () => {
    mockReadFileSync.mockReturnValue(
      `### 2.1 Test
| Index | SFS/Reference | Official Title |
| --- | --- | --- |
| 1 | SFS 1977:1160 | Lag |
`
    )

    const entries = parseAnalysisFile('/fake/path.md')
    expect(entries).toHaveLength(1)
  })
})

// ============================================================================
// Tjänsteföretag Parsing Tests
// ============================================================================

describe('Story 12.4: parseTjansteforetagFile', () => {
  let parseTjansteforetagFile: typeof import('@/scripts/seed-arbetsmiljo-template').parseTjansteforetagFile

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
    parseTjansteforetagFile = mod.parseTjansteforetagFile
  })

  it('extracts service company document references (normalized)', () => {
    mockReadFileSync.mockReturnValue(
      `## Docs
| # | SFS/AFS Number | Title | Amendment |
| --- | --- | --- | --- |
| 1 | SFS 1977:1160 | Arbetsmiljölag | SFS 2024:xxx |
| 2 | AFS 2023:1 (ersätter AFS 2001:1) | SAM | - |
`
    )

    const refs = parseTjansteforetagFile('/fake/path.md')
    expect(refs.size).toBe(2)
    // References are stored normalized (lowercase, diacritics stripped)
    expect(refs.has('sfs 1977:1160')).toBe(true)
    expect(refs.has('afs 2023:1 (ersatter afs 2001:1)')).toBe(true)
  })
})

// ============================================================================
// Seed Function Integration Tests (mocked Prisma + fs)
// ============================================================================

const MOCK_ANALYSIS_CONTENT = `---
total_documents: 5
---
### 2.1 Lagar
| Index | SFS/Reference | Official Title |
| --- | --- | --- |
| 1 | SFS 1977:1160 | Arbetsmiljölag |
| 2 | SFS 1977:1166 | Arbetsmiljöförordning |
### 2.2 Föreskrifter
| Index | SFS/Reference | Official Title |
| --- | --- | --- |
| 1 | AFS 2023:1 (ersätter AFS 2001:1) | SAM |
| 2 | AFS 2023:2 (ersätter AFS 2015:4) | OSA |
### 2.3 EU
| Index | SFS/Reference | Official Title |
| --- | --- | --- |
| 1 | (EU) nr 679/2016 | GDPR |
`

const MOCK_TJANSTEFORETAG_CONTENT = `## Docs
| # | SFS/AFS Number | Title | Amendment |
| --- | --- | --- | --- |
| 1 | SFS 1977:1160 | Arbetsmiljölag | - |
| 2 | AFS 2023:1 (ersätter AFS 2001:1) | SAM | - |
| 3 | AFS 2023:2 (ersätter AFS 2015:4) | OSA | - |
`

const MOCK_CSV_CONTENT = `Laglista,Section Number,Section Name,Index,SFS Number,Amendment SFS,Document Name,Notisum Comment,Summary,Compliance,Link
Arbetsmiljö,01,Lagar,1,SFS 1977:1160,,Arbetsmiljölag,,,,
Arbetsmiljö,01,Lagar,2,SFS 1977:1166,,Arbetsmiljöförordning,,,,
Arbetsmiljö,02,Föreskrifter,1,AFS 2023:1 (ersätter AFS 2001:1),,SAM,,,,
Arbetsmiljö,02,Föreskrifter,2,AFS 2023:2 (ersätter AFS 2015:4),,OSA,,,,
Arbetsmiljö,03,EU,1,(EU) nr 679/2016,,GDPR,,,,
`

function setupFsMock() {
  mockReadFileSync.mockImplementation((filePath: unknown) => {
    const p = String(filePath)
    if (p.includes('01-arbetsmiljo.md')) return MOCK_ANALYSIS_CONTENT
    if (p.includes('02-arbetsmiljo-tjansteforetag.md'))
      return MOCK_TJANSTEFORETAG_CONTENT
    if (p.includes('laglistor-all-combined.csv')) return MOCK_CSV_CONTENT
    throw new Error(`Unexpected file read: ${p}`)
  })
}

function setupPrismaMock() {
  // Reset all mock calls
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
    slug: 'arbetsmiljo',
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
      if (args.where.celex_number === '32016R0679') {
        return Promise.resolve({
          document: {
            id: 'doc-eu-gdpr',
            summary: 'GDPR summary',
            kommentar: 'Vi ska följa GDPR',
          },
        })
      }
      return Promise.resolve(null)
    }
  )
}

describe('Story 12.4: seed() correct record counts (Test 1)', () => {
  let seed: typeof import('@/scripts/seed-arbetsmiljo-template').seed

  beforeEach(async () => {
    setupFsMock()
    setupPrismaMock()
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
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

describe('Story 12.4: index uniqueness (Test 2)', () => {
  let seed: typeof import('@/scripts/seed-arbetsmiljo-template').seed

  beforeEach(async () => {
    setupFsMock()
    setupPrismaMock()
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
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

describe('Story 12.4: is_service_company_relevant flags (Test 3)', () => {
  let seed: typeof import('@/scripts/seed-arbetsmiljo-template').seed

  beforeEach(async () => {
    setupFsMock()
    setupPrismaMock()
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
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
    // SFS 1977:1160, AFS 2023:1, AFS 2023:2 are in tjänsteföretag
    expect(trueCount).toBe(3)
    expect(falseCount).toBe(2) // SFS 1977:1166 and (EU) nr 679/2016
  })
})

describe('Story 12.4: document_id references resolve (Test 4)', () => {
  let seed: typeof import('@/scripts/seed-arbetsmiljo-template').seed

  beforeEach(async () => {
    setupFsMock()
    setupPrismaMock()
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
    seed = mod.seed
  })

  it('all items have valid document references', async () => {
    const result = await seed({ force: false, dryRun: false })
    expect(result.itemsCreated).toBe(5)
    expect(result.missingDocuments).toHaveLength(0)
  })
})

describe('Story 12.4: idempotent seed (Test 9)', () => {
  let seed: typeof import('@/scripts/seed-arbetsmiljo-template').seed

  beforeEach(async () => {
    setupFsMock()
    setupPrismaMock()
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
    seed = mod.seed
  })

  it('uses upsert — running twice does not create duplicates', async () => {
    await seed({ force: false, dryRun: false })
    const firstCallCount = mockPrisma.templateItem.upsert.mock.calls.length

    // Reset counters but keep mock implementations
    mockPrisma.templateItem.upsert.mockClear()
    mockPrisma.lawListTemplate.findUnique.mockResolvedValue(null)
    mockPrisma.lawListTemplate.upsert.mockClear()
    mockPrisma.lawListTemplate.upsert.mockResolvedValue({
      id: 'template-1',
      slug: 'arbetsmiljo',
    })
    mockPrisma.templateSection.upsert.mockClear()
    mockPrisma.templateSection.upsert.mockResolvedValue({ id: 'section-1' })

    await seed({ force: true, dryRun: false })
    const secondCallCount = mockPrisma.templateItem.upsert.mock.calls.length

    expect(secondCallCount).toBe(firstCallCount)
    expect(mockPrisma.templateItem.upsert).toHaveBeenCalled()
  })
})

describe('Story 12.4: --dry-run mode (Test 10)', () => {
  let seed: typeof import('@/scripts/seed-arbetsmiljo-template').seed

  beforeEach(async () => {
    setupFsMock()
    setupPrismaMock()
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
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

describe('Story 12.4: missing LegalDocument handling (Test 11)', () => {
  let seed: typeof import('@/scripts/seed-arbetsmiljo-template').seed

  beforeEach(async () => {
    setupFsMock()
    setupPrismaMock()
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
    seed = mod.seed
  })

  it('logs missing documents and continues without crashing', async () => {
    mockPrisma.legalDocument.findUnique.mockImplementation(
      (args: { where: { document_number: string } }) => {
        if (args.where.document_number === 'SFS 1977:1166') {
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
    expect(result.missingDocuments[0]).toContain('SFS 1977:1166')
  })
})

describe('Story 12.4: existing template without --force (early exit)', () => {
  let seed: typeof import('@/scripts/seed-arbetsmiljo-template').seed

  beforeEach(async () => {
    setupFsMock()
    setupPrismaMock()
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
    seed = mod.seed
  })

  it('exits early when template exists and --force not set', async () => {
    mockPrisma.lawListTemplate.findUnique.mockResolvedValue({
      id: 'existing-template',
      slug: 'arbetsmiljo',
    })

    const result = await seed({ force: false, dryRun: false })

    expect(result.templateId).toBe('existing-template')
    expect(result.itemsCreated).toBe(0)
    expect(mockPrisma.templateItem.upsert).not.toHaveBeenCalled()
  })
})

describe('Story 12.4: parseArgs', () => {
  let parseArgs: typeof import('@/scripts/seed-arbetsmiljo-template').parseArgs

  beforeEach(async () => {
    const mod = await import('@/scripts/seed-arbetsmiljo-template')
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
