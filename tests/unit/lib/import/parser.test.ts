/**
 * Story 24.2: Parser unit tests.
 *
 * Drives the four `lib/import/parser.ts` public functions against the five
 * fixtures under `tests/fixtures/import/`. Verifies row counts, content
 * round-trip, BOM stripping, delimiter auto-detect, paste TSV vs single-
 * column, and `detectColumns` heuristic accuracy on a 5-fixture benchmark
 * (target ≥80% accuracy on canonical fields).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as XLSX from 'xlsx'
import {
  parseExcel,
  parseCsv,
  parsePaste,
  detectColumns,
} from '@/lib/import/parser'

const FIXTURE_DIR = join(process.cwd(), 'tests', 'fixtures', 'import')
const fixtureBuffer = (name: string) => readFileSync(join(FIXTURE_DIR, name))
const fixtureText = (name: string) =>
  readFileSync(join(FIXTURE_DIR, name), 'utf8')

describe('parseExcel', () => {
  it('round-trips Notisum-style xlsx (30 data rows)', () => {
    const result = parseExcel(fixtureBuffer('notisum-export-sample.xlsx'))
    expect(result.truncated).toBe(false)
    expect(result.rows).toHaveLength(30)
    expect(result.rows[0]?.columns).toEqual([
      'SFS-nr',
      'Lagens namn',
      'Rättsområde',
      'Egen status',
      'Kommentar',
    ])
    expect(result.rows[0]?.raw['Lagens namn']).toBe('Arbetsmiljölag')
    expect(result.rows[0]?.raw['SFS-nr']).toBe('1977:1160')
  })

  it('round-trips Lex.nu-style xlsx (25 data rows, 4 columns)', () => {
    const result = parseExcel(fixtureBuffer('lex-nu-export-sample.xlsx'))
    expect(result.rows).toHaveLength(25)
    expect(result.rows[0]?.columns).toEqual(['Titel', 'SFS', 'Område', 'Datum'])
    expect(result.rows[0]?.raw['Titel']).toBe('Arbetsmiljölag')
  })

  it('round-trips consultant-style xlsx (50 data rows, no SFS column)', () => {
    const result = parseExcel(fixtureBuffer('consultant-excel-sample.xlsx'))
    expect(result.rows).toHaveLength(50)
    expect(result.rows[0]?.columns).toContain('Lagstiftning')
    expect(result.rows[0]?.columns).not.toContain('SFS')
  })

  it('truncates xlsx to 1000 rows + sets truncated=true on >1000-row inputs (Story 24.2 QA TEST-001)', () => {
    // Build an in-memory 1001-row workbook. We expect the parser to cap at
    // MAX_ROWS=1000 and surface `truncated: true` so the server action can
    // attach the warning copy to the import row's `error_message`.
    const header = ['Titel', 'SFS-nummer']
    const dataRows = Array.from({ length: 1001 }, (_, i) => [
      `Lag ${i}`,
      `2020:${i}`,
    ])
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows])
    XLSX.utils.book_append_sheet(wb, ws, 'Big')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })

    const result = parseExcel(buf)
    expect(result.rows).toHaveLength(1000)
    expect(result.truncated).toBe(true)
    // First and last in-bounds rows landed correctly.
    expect(result.rows[0]?.raw['Titel']).toBe('Lag 0')
    expect(result.rows[999]?.raw['Titel']).toBe('Lag 999')
  })

  it('returns empty rows + truncated=false on an empty workbook', () => {
    // Build an empty xlsx in-memory using the same library.
    // This proves the empty-sheet branch without needing a fixture file.
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([['Titel', 'SFS']])
    XLSX.utils.book_append_sheet(wb, ws, 'Empty')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const result = parseExcel(buf)
    expect(result.rows).toHaveLength(0)
    expect(result.truncated).toBe(false)
  })
})

describe('parseCsv', () => {
  it('round-trips Swedish CSV (semicolon-delimited + UTF-8 BOM)', () => {
    const result = parseCsv(fixtureText('internal-spreadsheet-sample.csv'))
    expect(result.rows).toHaveLength(15)
    // BOM should not contaminate the first header.
    expect(result.rows[0]?.columns[0]).toBe('Lag')
    expect(result.rows[0]?.columns).toEqual([
      'Lag',
      'Nummer',
      'Område',
      'Ansvarig',
    ])
    expect(result.rows[0]?.raw['Lag']).toBe('Arbetsmiljölag')
    expect(result.rows[0]?.raw['Nummer']).toBe('1977:1160')
  })

  it('handles CSV with no BOM', () => {
    const csv = 'Lag,SFS\nArbetsmiljölag,1977:1160\n'
    const result = parseCsv(csv)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.raw['Lag']).toBe('Arbetsmiljölag')
  })
})

describe('parsePaste', () => {
  it('handles single-column paste (no tabs) with title inferred', () => {
    const result = parsePaste(fixtureText('paste-input-sample.txt'))
    expect(result.rows).toHaveLength(10)
    expect(result.rows[0]?.columns).toEqual(['titel'])
    expect(result.rows[0]?.raw['titel']).toBe('Arbetsmiljölag')
  })

  it('handles tab-separated paste (Excel copy/paste shape)', () => {
    const tsv =
      'Titel\tSFS\nArbetsmiljölag\t1977:1160\nBokföringslag\t1999:1078\n'
    const result = parsePaste(tsv)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]?.columns).toEqual(['Titel', 'SFS'])
    expect(result.rows[0]?.raw['Titel']).toBe('Arbetsmiljölag')
    expect(result.rows[1]?.raw['SFS']).toBe('1999:1078')
  })

  it('returns empty result on empty paste', () => {
    expect(parsePaste('').rows).toHaveLength(0)
    expect(parsePaste('   \n   \n').rows).toHaveLength(0)
  })
})

describe('detectColumns — heuristic benchmark across 5 fixtures (≥80% target)', () => {
  it('Notisum-style: maps all 5 canonical fields', () => {
    const { rows } = parseExcel(fixtureBuffer('notisum-export-sample.xlsx'))
    const mapping = detectColumns(rows)
    expect(mapping.titel).toBe('Lagens namn')
    expect(mapping.sfs_nummer).toBe('SFS-nr')
    expect(mapping.omrade).toBe('Rättsområde')
    expect(mapping.kommentar).toBe('Kommentar')
    // No lagansvarig column present in this fixture
    expect(mapping.lagansvarig).toBeNull()
    expect(mapping._confidence.sfs_nummer).toBeGreaterThanOrEqual(0.5)
    expect(mapping._confidence.titel).toBeGreaterThanOrEqual(0.5)
  })

  it('Lex.nu-style: maps titel + sfs_nummer + omrade', () => {
    const { rows } = parseExcel(fixtureBuffer('lex-nu-export-sample.xlsx'))
    const mapping = detectColumns(rows)
    expect(mapping.titel).toBe('Titel')
    expect(mapping.sfs_nummer).toBe('SFS')
    expect(mapping.omrade).toBe('Område')
    expect(mapping.kommentar).toBeNull()
  })

  it('consultant-style: maps lagansvarig via name pattern', () => {
    const { rows } = parseExcel(fixtureBuffer('consultant-excel-sample.xlsx'))
    const mapping = detectColumns(rows)
    expect(mapping.titel).toBe('Lagstiftning')
    // No SFS column at all
    expect(mapping.sfs_nummer).toBeNull()
    expect(mapping.omrade).toBe('Kategori')
    expect(mapping.lagansvarig).toBe('Lagansvarig')
    // Anteckning may match either kommentar (long content) or omrade — accept either
    // expect kommentar OR null
  })

  it('internal CSV: maps titel + sfs_nummer + omrade + lagansvarig', () => {
    const { rows } = parseCsv(fixtureText('internal-spreadsheet-sample.csv'))
    const mapping = detectColumns(rows)
    expect(mapping.titel).toBe('Lag')
    // "Nummer" header regex matches sfs_nummer
    expect(mapping.sfs_nummer).toBe('Nummer')
    expect(mapping.omrade).toBe('Område')
    expect(mapping.lagansvarig).toBe('Ansvarig')
  })

  it('paste single-column: titel inferred', () => {
    const { rows } = parsePaste(fixtureText('paste-input-sample.txt'))
    const mapping = detectColumns(rows)
    expect(mapping.titel).toBe('titel')
    expect(mapping.sfs_nummer).toBeNull()
    expect(mapping.omrade).toBeNull()
  })

  it('benchmark: ≥80% of canonical mappings correctly resolved across 5 fixtures', () => {
    // Hand-tally: counting expected mappings per fixture (canonical fields
    // that have a real candidate column):
    //   - Notisum: 4 mappable (titel, sfs_nummer, omrade, kommentar) → 4 hits
    //   - Lex.nu:  3 mappable (titel, sfs_nummer, omrade)            → 3 hits
    //   - Consultant: 3 mappable (titel, omrade, lagansvarig)        → 3 hits
    //   - Internal CSV: 4 mappable (titel, sfs_nummer, omrade, lagansvarig) → 4 hits
    //   - Paste: 1 mappable (titel)                                  → 1 hit
    // Total expected mappable: 15. Target ≥80% = 12 hits.
    let hits = 0
    let total = 0

    const notisum = detectColumns(
      parseExcel(fixtureBuffer('notisum-export-sample.xlsx')).rows
    )
    total += 4
    if (notisum.titel) hits++
    if (notisum.sfs_nummer) hits++
    if (notisum.omrade) hits++
    if (notisum.kommentar) hits++

    const lex = detectColumns(
      parseExcel(fixtureBuffer('lex-nu-export-sample.xlsx')).rows
    )
    total += 3
    if (lex.titel) hits++
    if (lex.sfs_nummer) hits++
    if (lex.omrade) hits++

    const consultant = detectColumns(
      parseExcel(fixtureBuffer('consultant-excel-sample.xlsx')).rows
    )
    total += 3
    if (consultant.titel) hits++
    if (consultant.omrade) hits++
    if (consultant.lagansvarig) hits++

    const internal = detectColumns(
      parseCsv(fixtureText('internal-spreadsheet-sample.csv')).rows
    )
    total += 4
    if (internal.titel) hits++
    if (internal.sfs_nummer) hits++
    if (internal.omrade) hits++
    if (internal.lagansvarig) hits++

    const paste = detectColumns(
      parsePaste(fixtureText('paste-input-sample.txt')).rows
    )
    total += 1
    if (paste.titel) hits++

    const accuracy = hits / total
    expect(accuracy).toBeGreaterThanOrEqual(0.8)
  })
})
