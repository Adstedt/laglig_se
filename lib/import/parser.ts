/**
 * Story 24.2: Parser library for Epic 24 import pipeline.
 *
 * Pure functions only — no I/O, no Prisma, no Anthropic. Server-action callers
 * (`app/actions/law-list-import.ts`) handle persistence + auth + workspace
 * scoping.
 *
 * Three input shapes (xlsx/csv/paste) → normalised `ParsedRow[]`. The
 * `detectColumns` heuristic maps source column names to canonical Laglig
 * fields (titel, sfs_nummer, omrade, lagansvarig, kommentar) using a header-
 * regex + content-pattern combined score (see AC 6 for the worked example).
 *
 * SECURITY: this module is server-only. Parser deps (`xlsx`, `papaparse`)
 * must never appear in the client bundle. Enforce via `'use server'` on the
 * server-action file (parser is imported only from there + tests).
 */

import * as XLSX from 'xlsx'
import Papa from 'papaparse'

// ============================================================================
// Types
// ============================================================================

export interface ParsedRow {
  /** 0-based row order from the source. */
  index: number
  /** Source row keyed by detected column name. */
  raw: Record<string, string>
  /** Header order, kept for downstream column-mapping UIs. */
  columns: string[]
}

export interface ParseResult {
  rows: ParsedRow[]
  /** True iff source contained more than MAX_ROWS data rows; only the first MAX_ROWS are returned. */
  truncated: boolean
}

export interface ColumnMapping {
  titel: string | null
  sfs_nummer: string | null
  omrade: string | null
  lagansvarig: string | null
  kommentar: string | null
  /** Per-mapping 0.0–1.0 confidence (header score + content score, clamped). */
  _confidence: Record<
    'titel' | 'sfs_nummer' | 'omrade' | 'lagansvarig' | 'kommentar',
    number
  >
}

const MAX_ROWS = 1000

// ============================================================================
// parseExcel — first sheet, first MAX_ROWS data rows
// ============================================================================

export function parseExcel(buffer: Buffer | ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { rows: [], truncated: false }
  }
  if (workbook.SheetNames.length > 1) {
    console.warn(
      `[parseExcel] Workbook has ${workbook.SheetNames.length} sheets; only the first ("${sheetName}") will be processed.`
    )
  }
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    return { rows: [], truncated: false }
  }

  // sheet_to_json with header:1 returns array-of-arrays where row 0 is the header.
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  })
  if (aoa.length === 0) {
    return { rows: [], truncated: false }
  }

  const headerRow = aoa[0] ?? []
  const columns = headerRow.map((h) => String(h ?? '').trim())
  // Drop trailing empty columns.
  while (columns.length > 0 && columns[columns.length - 1] === '') {
    columns.pop()
  }
  if (columns.length === 0) {
    return { rows: [], truncated: false }
  }

  const allDataRows = aoa.slice(1)
  const truncated = allDataRows.length > MAX_ROWS
  const dataRows = truncated ? allDataRows.slice(0, MAX_ROWS) : allDataRows

  const rows: ParsedRow[] = dataRows.map((row, idx) => {
    const raw: Record<string, string> = {}
    columns.forEach((col, i) => {
      const cell = row[i]
      raw[col] = cell == null ? '' : String(cell).trim()
    })
    return { index: idx, raw, columns }
  })

  return { rows, truncated }
}

// ============================================================================
// parseCsv — auto-detect delimiter, strip BOM, trim header whitespace
// ============================================================================

export function parseCsv(text: string): ParseResult {
  // Strip UTF-8 BOM if present (Excel-exported CSVs often include it).
  const stripped = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  const result = Papa.parse<Record<string, string>>(stripped, {
    header: true,
    skipEmptyLines: 'greedy',
    delimiter: '', // empty string = auto-detect (Papa Parse convention)
    transformHeader: (h) => h.trim(),
  })

  if (result.errors.length > 0) {
    // Log non-fatal parse warnings but proceed with whatever rows we got.
    for (const err of result.errors.slice(0, 3)) {
      console.warn(`[parseCsv] ${err.type}: ${err.message} at row ${err.row}`)
    }
  }

  const allRows = result.data
  const truncated = allRows.length > MAX_ROWS
  const dataRows = truncated ? allRows.slice(0, MAX_ROWS) : allRows
  const columns = result.meta.fields?.map((f) => f.trim()) ?? []

  const rows: ParsedRow[] = dataRows.map((row, idx) => {
    const raw: Record<string, string> = {}
    for (const col of columns) {
      const value = row[col]
      raw[col] = value == null ? '' : String(value).trim()
    }
    return { index: idx, raw, columns }
  })

  return { rows, truncated }
}

// ============================================================================
// parsePaste — TSV (Excel copy/paste) or single-column titles-only
// ============================================================================

export function parsePaste(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)

  if (lines.length === 0) {
    return { rows: [], truncated: false }
  }

  // Sniff TSV via tab presence on row 1.
  const firstLine = lines[0] ?? ''
  const isTsv = firstLine.includes('\t')

  if (isTsv) {
    const columns = firstLine.split('\t').map((c) => c.trim())
    const allDataLines = lines.slice(1)
    const truncated = allDataLines.length > MAX_ROWS
    const dataLines = truncated ? allDataLines.slice(0, MAX_ROWS) : allDataLines

    const rows: ParsedRow[] = dataLines.map((line, idx) => {
      const cells = line.split('\t')
      const raw: Record<string, string> = {}
      columns.forEach((col, i) => {
        raw[col] = (cells[i] ?? '').trim()
      })
      return { index: idx, raw, columns }
    })
    return { rows, truncated }
  }

  // Single-column fallback: header inferred as "titel".
  const columns = ['titel']
  const truncated = lines.length > MAX_ROWS
  const dataLines = truncated ? lines.slice(0, MAX_ROWS) : lines
  const rows: ParsedRow[] = dataLines.map((line, idx) => ({
    index: idx,
    raw: { titel: line.trim() },
    columns,
  }))
  return { rows, truncated }
}

// ============================================================================
// detectColumns — header regex + content pattern combined score
// ============================================================================

// Header regex matches the worked example in the story AC ("Lagens namn"
// → 0.5 via /lag|namn/). Partial substring matching preferred over `^...$`
// anchors so multi-word Swedish headers like "Lagens namn", "SFS-nr",
// "Rättsområde" are recognised.
const HEADER_REGEX = {
  titel: /(titel|namn|lagstiftning|title|name|^lag$|^lag\b)/i,
  sfs_nummer: /(sfs|nummer|^nr$|^nr\b)/i,
  omrade: /(område|omrade|kategori|rättsområde|category|area)/i,
  lagansvarig: /(lagansvarig|ansvarig|owner|responsible)/i,
  kommentar: /(kommentar|^note$|notes|anteckning|description)/i,
} as const

type CanonicalField = keyof typeof HEADER_REGEX

const SAMPLE_SIZE = 10

const SWEDISH_LAW_HINT_RE =
  /(lag|förordning|föreskrift|kungörelse|stadga|balk|act|regulation)/i
const STARTS_CAPITAL_RE = /^[A-ZÅÄÖ]/
const SFS_PATTERN_RE = /\b\d{4}:\d{1,5}\b/
const NAME_PATTERN_RE = /^[A-ZÅÄÖ][a-zåäö]+(\s+[A-ZÅÄÖ][a-zåäö]+)+$/
const EMAIL_PATTERN_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function ratio(values: string[], predicate: (_v: string) => boolean): number {
  if (values.length === 0) return 0
  let count = 0
  for (const v of values) if (predicate(v)) count++
  return count / values.length
}

function contentScore(field: CanonicalField, samples: string[]): number {
  const nonEmpty = samples.filter((s) => s.trim().length > 0)
  if (nonEmpty.length === 0) return 0

  switch (field) {
    case 'titel': {
      const r = ratio(
        nonEmpty,
        (v) => SWEDISH_LAW_HINT_RE.test(v) || STARTS_CAPITAL_RE.test(v)
      )
      return r > 0.5 ? 0.4 : 0
    }
    case 'sfs_nummer': {
      const r = ratio(nonEmpty, (v) => SFS_PATTERN_RE.test(v))
      return r > 0.5 ? 0.5 : 0
    }
    case 'omrade': {
      const r = ratio(nonEmpty, (v) => v.length <= 30 && !/^\d+$/.test(v))
      return r > 0.5 ? 0.2 : 0
    }
    case 'lagansvarig': {
      const r = ratio(
        nonEmpty,
        (v) => NAME_PATTERN_RE.test(v) || EMAIL_PATTERN_RE.test(v)
      )
      return r > 0.3 ? 0.3 : 0
    }
    case 'kommentar': {
      const r = ratio(nonEmpty, (v) => v.length > 50)
      return r > 0.3 ? 0.2 : 0
    }
  }
}

export function detectColumns(rows: ParsedRow[]): ColumnMapping {
  const columns = rows[0]?.columns ?? []
  const samples = rows.slice(0, SAMPLE_SIZE)

  // Build per-column sample arrays once.
  const samplesByColumn: Record<string, string[]> = {}
  for (const col of columns) {
    samplesByColumn[col] = samples.map((r) => r.raw[col] ?? '')
  }

  const mapping: ColumnMapping = {
    titel: null,
    sfs_nummer: null,
    omrade: null,
    lagansvarig: null,
    kommentar: null,
    _confidence: {
      titel: 0,
      sfs_nummer: 0,
      omrade: 0,
      lagansvarig: 0,
      kommentar: 0,
    },
  }

  const fields: CanonicalField[] = [
    'titel',
    'sfs_nummer',
    'omrade',
    'lagansvarig',
    'kommentar',
  ]

  // Process fields in priority order; once a column is claimed by a higher-
  // priority field, it cannot be re-mapped to a lower-priority one. Prevents
  // the single-column-paste edge case where the only column would otherwise
  // match titel + omrade simultaneously via content heuristics.
  const claimed = new Set<string>()

  for (const field of fields) {
    let bestColumn: string | null = null
    let bestScore = 0

    for (const col of columns) {
      if (claimed.has(col)) continue
      const headerScore = HEADER_REGEX[field].test(col) ? 0.5 : 0
      const cScore = contentScore(field, samplesByColumn[col] ?? [])
      const total = Math.min(1.0, headerScore + cScore)

      if (total > bestScore) {
        bestScore = total
        bestColumn = col
      }
      // Tie-break: leftmost column wins (already implicit since we iterate left-to-right and only swap on strictly-greater).
    }

    if (bestColumn !== null && bestScore > 0) {
      mapping[field] = bestColumn
      mapping._confidence[field] = bestScore
      claimed.add(bestColumn)
    }
  }

  return mapping
}
