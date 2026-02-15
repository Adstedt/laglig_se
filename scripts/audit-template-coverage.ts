#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Story 9.4: Comprehensive Audit Script for Template Document Coverage
 *
 * Parses data/seed-template-documents.csv, expands AFS chapter splits,
 * and checks every document against the legal_documents DB for:
 *   - Record existence
 *   - html_content or full_text populated
 *   - summary (summering) populated
 *   - kommentar populated
 *
 * EU documents are reported separately (informational) and excluded from
 * the PASS/FAIL gate.
 *
 * Usage:
 *   pnpm tsx scripts/audit-template-coverage.ts
 */

import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'

// ============================================================================
// Types
// ============================================================================

export interface CsvRow {
  doc_number: string
  authority: string
  short_name: string
  template: string
  needs_chapter_split: boolean
  chapter_count: number
  ingestion_source: string
  notes: string
}

export interface ExpandedEntry {
  /** The document_number to look up in the DB */
  lookupNumber: string
  /** The original CSV doc_number (before substitution/expansion) */
  originalCsvNumber: string
  authority: string
  short_name: string
  template: string
  isChapterEntry: boolean
  isEu: boolean
  /** True if this is a parent of chapter-split entries (chapters discovered from DB) */
  isChapterSplitParent?: boolean
}

export interface AuditResult {
  entry: ExpandedEntry
  exists: boolean
  hasContent: boolean
  hasSummary: boolean
  hasKommentar: boolean
  dbDocumentNumber: string | null
  contentLength: number
}

export interface AuditReport {
  nonEuResults: AuditResult[]
  euResults: AuditResult[]
  totalExpanded: number
  nonEuTotal: number
  euTotal: number
  nonEuFound: number
  nonEuWithContent: number
  nonEuWithSummary: number
  nonEuWithKommentar: number
  euFound: number
  euWithContent: number
  pass: boolean
}

// ============================================================================
// Constants
// ============================================================================

/** Known document_number substitutions (CSV value → DB value) */
export const SUBSTITUTION_MAP: Record<string, string> = {
  'SCB-FS 2024:25': 'SCB-FS 2025:19',
}

/** CSV authority prefix → DB document_number prefix normalization */
export const PREFIX_NORMALIZATION: Record<string, string> = {
  'ELSAK-FS': 'ELSÄK-FS',
}

/** EU authorities in the CSV */
const EU_AUTHORITY = 'EU'

// ============================================================================
// CSV Parsing
// ============================================================================

export function parseCsv(csvContent: string): CsvRow[] {
  const lines = csvContent.trim().split('\n')
  // Skip header
  const header = lines[0]
  if (!header) return []
  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || !line.trim()) continue
    // Handle quoted fields (notes may contain commas)
    const fields = parseCsvLine(line)
    rows.push({
      doc_number: fields[0]?.trim() ?? '',
      authority: fields[1]?.trim() ?? '',
      short_name: fields[2]?.trim() ?? '',
      template: fields[3]?.trim() ?? '',
      needs_chapter_split: fields[4]?.trim().toLowerCase() === 'yes',
      chapter_count: parseInt(fields[5]?.trim() || '0', 10) || 0,
      ingestion_source: fields[6]?.trim() ?? '',
      notes: fields[7]?.trim() ?? '',
    })
  }
  return rows
}

/** Parse a single CSV line respecting quoted fields */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

// ============================================================================
// Normalization & Expansion
// ============================================================================

/** Normalize a document number: apply prefix normalization + substitution map */
export function normalizeDocNumber(docNumber: string): string {
  let normalized = docNumber
  // Apply prefix normalization (e.g., ELSAK-FS → ELSÄK-FS)
  for (const [from, to] of Object.entries(PREFIX_NORMALIZATION)) {
    if (normalized.startsWith(from)) {
      normalized = to + normalized.slice(from.length)
    }
  }
  // Apply substitution map (e.g., SCB-FS 2024:25 → SCB-FS 2025:19)
  if (SUBSTITUTION_MAP[normalized]) {
    normalized = SUBSTITUTION_MAP[normalized]
  }
  return normalized
}

/**
 * Expand CSV rows to individual DB lookup entries.
 *
 * For AFS chapter-split documents, we include the parent entry as a
 * non-chapter entry. The actual chapter entries will be discovered
 * from the DB during the audit (since chapter numbering starts at 2
 * and actual counts may differ from the CSV's initial plan).
 */
export function expandCsvRows(rows: CsvRow[]): ExpandedEntry[] {
  const entries: ExpandedEntry[] = []
  for (const row of rows) {
    const isEu = row.authority === EU_AUTHORITY
    // For chapter-split AFS docs, include the parent only.
    // Chapters are discovered from DB during audit.
    entries.push({
      lookupNumber: normalizeDocNumber(row.doc_number),
      originalCsvNumber: row.doc_number,
      authority: row.authority,
      short_name: row.short_name,
      template: row.template,
      isChapterEntry: false,
      isEu,
      isChapterSplitParent: row.needs_chapter_split && row.chapter_count > 0,
    })
  }
  return entries
}

// ============================================================================
// EU CELEX Conversion
// ============================================================================

/**
 * Convert EU CSV format to CELEX number.
 * CSV formats: `(EG) nr 1907/2006`, `(EU) nr 2016/679`, `(EU) nr 40/2025`
 * CELEX format: `3{YYYY}R{NNNN}` (padded to 4 digits)
 *
 * EU numbering convention:
 *   - Old style (pre-Lisbon): NUMBER/YEAR — e.g., 1907/2006
 *   - New style (post-Lisbon): YEAR/NUMBER — e.g., 2016/679
 * Heuristic: if the second part is 4 digits and >= 1990, it's the year.
 * Otherwise the first part is the year.
 */
export function csvEuToCelex(csvDocNumber: string): string | null {
  // Match patterns like: (EG) nr 1907/2006 or (EU) nr 2016/679
  const match = csvDocNumber.match(/\(E[GU]\)\s*(?:nr\s+)?(\d+)\/(\d+)/)
  if (!match) return null
  const part1 = match[1]
  const part2 = match[2]
  if (!part1 || !part2) return null

  let year: string
  let number: string
  const part2Num = parseInt(part2, 10)
  if (part2.length === 4 && part2Num >= 1990) {
    // Old format: NUMBER/YEAR (e.g., 1907/2006)
    year = part2
    number = part1
  } else {
    // New format: YEAR/NUMBER (e.g., 2019/1021)
    year = part1
    number = part2
  }

  const paddedNumber = number.padStart(4, '0')
  return `3${year}R${paddedNumber}`
}

// ============================================================================
// Database Queries
// ============================================================================

export interface DbLookupResult {
  document_number: string
  has_content: boolean
  content_length: number
  has_summary: boolean
  has_kommentar: boolean
}

/** Look up a non-EU document by document_number (exact match) */
export async function lookupNonEuDocument(
  prisma: PrismaClient,
  lookupNumber: string
): Promise<DbLookupResult | null> {
  const doc = await prisma.legalDocument.findUnique({
    where: { document_number: lookupNumber },
    select: {
      document_number: true,
      html_content: true,
      full_text: true,
      summary: true,
      kommentar: true,
    },
  })
  if (!doc) return null
  const htmlLen = doc.html_content?.length ?? 0
  const textLen = doc.full_text?.length ?? 0
  return {
    document_number: doc.document_number,
    has_content: htmlLen > 0 || textLen > 0,
    content_length: Math.max(htmlLen, textLen),
    has_summary: (doc.summary?.length ?? 0) > 0,
    has_kommentar: (doc.kommentar?.length ?? 0) > 0,
  }
}

/** Look up an EU document by CELEX number, with fallback to ILIKE on document_number */
export async function lookupEuDocument(
  prisma: PrismaClient,
  csvDocNumber: string
): Promise<DbLookupResult | null> {
  const celex = csvEuToCelex(csvDocNumber)

  // Try CELEX lookup first
  if (celex) {
    const euDoc = await prisma.euDocument.findUnique({
      where: { celex_number: celex },
      select: {
        document: {
          select: {
            document_number: true,
            html_content: true,
            full_text: true,
            summary: true,
            kommentar: true,
          },
        },
      },
    })
    if (euDoc?.document) {
      const d = euDoc.document
      const htmlLen = d.html_content?.length ?? 0
      const textLen = d.full_text?.length ?? 0
      return {
        document_number: d.document_number,
        has_content: htmlLen > 0 || textLen > 0,
        content_length: Math.max(htmlLen, textLen),
        has_summary: (d.summary?.length ?? 0) > 0,
        has_kommentar: (d.kommentar?.length ?? 0) > 0,
      }
    }
  }

  // Fallback: extract numeric pattern for contains match
  const numberMatch = csvDocNumber.match(/(\d+)\/(\d{4})/)
  if (numberMatch) {
    const docs = await prisma.legalDocument.findMany({
      where: {
        document_number: { contains: `${numberMatch[1]}/${numberMatch[2]}` },
        content_type: { in: ['EU_REGULATION', 'EU_DIRECTIVE'] },
      },
      select: {
        document_number: true,
        html_content: true,
        full_text: true,
        summary: true,
        kommentar: true,
      },
      take: 1,
    })
    if (docs[0]) {
      const d = docs[0]
      const htmlLen = d.html_content?.length ?? 0
      const textLen = d.full_text?.length ?? 0
      return {
        document_number: d.document_number,
        has_content: htmlLen > 0 || textLen > 0,
        content_length: Math.max(htmlLen, textLen),
        has_summary: (d.summary?.length ?? 0) > 0,
        has_kommentar: (d.kommentar?.length ?? 0) > 0,
      }
    }
  }

  return null
}

// ============================================================================
// Audit Logic
// ============================================================================

/** Discover all chapter entries for an AFS parent from the DB */
export async function discoverChapterEntries(
  prisma: PrismaClient,
  parentDocNumber: string
): Promise<DbLookupResult[]> {
  const docs = await prisma.legalDocument.findMany({
    where: {
      document_number: { startsWith: `${parentDocNumber} kap.` },
    },
    select: {
      document_number: true,
      html_content: true,
      full_text: true,
      summary: true,
      kommentar: true,
    },
    orderBy: { document_number: 'asc' },
  })
  return docs.map((d) => {
    const htmlLen = d.html_content?.length ?? 0
    const textLen = d.full_text?.length ?? 0
    return {
      document_number: d.document_number,
      has_content: htmlLen > 0 || textLen > 0,
      content_length: Math.max(htmlLen, textLen),
      has_summary: (d.summary?.length ?? 0) > 0,
      has_kommentar: (d.kommentar?.length ?? 0) > 0,
    }
  })
}

export async function runAudit(
  prisma: PrismaClient,
  entries: ExpandedEntry[]
): Promise<AuditReport> {
  const nonEuEntries = entries.filter((e) => !e.isEu)
  const euEntries = entries.filter((e) => e.isEu)

  const nonEuResults: AuditResult[] = []
  const euResults: AuditResult[] = []

  // Non-EU lookups
  for (const entry of nonEuEntries) {
    // Check the entry itself (parent or standalone)
    const result = await lookupNonEuDocument(prisma, entry.lookupNumber)
    nonEuResults.push({
      entry,
      exists: result !== null,
      hasContent: result?.has_content ?? false,
      hasSummary: result?.has_summary ?? false,
      hasKommentar: result?.has_kommentar ?? false,
      dbDocumentNumber: result?.document_number ?? null,
      contentLength: result?.content_length ?? 0,
    })

    // For chapter-split parents, discover and check all chapter entries from DB
    if (entry.isChapterSplitParent) {
      const chapters = await discoverChapterEntries(prisma, entry.lookupNumber)
      for (const ch of chapters) {
        nonEuResults.push({
          entry: {
            lookupNumber: ch.document_number,
            originalCsvNumber: entry.originalCsvNumber,
            authority: entry.authority,
            short_name: entry.short_name,
            template: entry.template,
            isChapterEntry: true,
            isEu: false,
          },
          exists: true,
          hasContent: ch.has_content,
          hasSummary: ch.has_summary,
          hasKommentar: ch.has_kommentar,
          dbDocumentNumber: ch.document_number,
          contentLength: ch.content_length,
        })
      }
    }
  }

  // EU lookups
  for (const entry of euEntries) {
    const result = await lookupEuDocument(prisma, entry.originalCsvNumber)
    euResults.push({
      entry,
      exists: result !== null,
      hasContent: result?.has_content ?? false,
      hasSummary: result?.has_summary ?? false,
      hasKommentar: result?.has_kommentar ?? false,
      dbDocumentNumber: result?.document_number ?? null,
      contentLength: result?.content_length ?? 0,
    })
  }

  const nonEuFound = nonEuResults.filter((r) => r.exists).length
  const nonEuWithContent = nonEuResults.filter((r) => r.hasContent).length
  const nonEuWithSummary = nonEuResults.filter((r) => r.hasSummary).length
  const nonEuWithKommentar = nonEuResults.filter((r) => r.hasKommentar).length
  const nonEuTotal = nonEuResults.length
  const euFound = euResults.filter((r) => r.exists).length
  const euWithContent = euResults.filter((r) => r.hasContent).length

  // PASS/FAIL: non-EU only. All must exist with content, summary, and kommentar.
  const pass =
    nonEuFound === nonEuTotal &&
    nonEuWithContent === nonEuTotal &&
    nonEuWithSummary === nonEuTotal &&
    nonEuWithKommentar === nonEuTotal

  return {
    nonEuResults,
    euResults,
    totalExpanded: nonEuTotal + euResults.length,
    nonEuTotal,
    euTotal: euEntries.length,
    nonEuFound,
    nonEuWithContent,
    nonEuWithSummary,
    nonEuWithKommentar,
    euFound,
    euWithContent,
    pass,
  }
}

// ============================================================================
// Report Formatting
// ============================================================================

export function formatReport(report: AuditReport): string {
  const lines: string[] = []

  lines.push('='.repeat(70))
  lines.push('TEMPLATE DOCUMENT COVERAGE AUDIT')
  lines.push('='.repeat(70))
  lines.push('')
  lines.push(`Total expanded entries: ${report.totalExpanded}`)
  lines.push(`  Non-EU: ${report.nonEuTotal}`)
  lines.push(`  EU:     ${report.euTotal}`)
  lines.push('')

  // Non-EU summary
  lines.push('-'.repeat(70))
  lines.push('NON-EU DOCUMENTS (PASS/FAIL GATE)')
  lines.push('-'.repeat(70))
  lines.push(`  Found:      ${report.nonEuFound}/${report.nonEuTotal}`)
  lines.push(`  Content:    ${report.nonEuWithContent}/${report.nonEuTotal}`)
  lines.push(`  Summary:    ${report.nonEuWithSummary}/${report.nonEuTotal}`)
  lines.push(`  Kommentar:  ${report.nonEuWithKommentar}/${report.nonEuTotal}`)
  lines.push('')

  // Group non-EU by authority
  const byAuthority = new Map<string, AuditResult[]>()
  for (const r of report.nonEuResults) {
    const auth = r.entry.authority
    if (!byAuthority.has(auth)) byAuthority.set(auth, [])
    byAuthority.get(auth)!.push(r)
  }

  for (const [auth, results] of byAuthority) {
    lines.push(`  ${auth} (${results.length} entries):`)
    for (const r of results) {
      const status = getStatusIcon(r)
      const suffix = r.entry.isChapterEntry ? ' [chapter]' : ''
      lines.push(`    ${status} ${r.entry.lookupNumber}${suffix}`)
      if (!r.exists) {
        lines.push(`       → NOT FOUND in DB`)
      } else {
        const issues: string[] = []
        if (!r.hasContent) issues.push('no content')
        if (!r.hasSummary) issues.push('no summary')
        if (!r.hasKommentar) issues.push('no kommentar')
        if (issues.length > 0) {
          lines.push(`       → Missing: ${issues.join(', ')}`)
        }
      }
    }
    lines.push('')
  }

  // Non-EU failures summary
  const nonEuFailures = report.nonEuResults.filter(
    (r) => !r.exists || !r.hasContent || !r.hasSummary || !r.hasKommentar
  )
  if (nonEuFailures.length > 0) {
    lines.push('-'.repeat(70))
    lines.push(`NON-EU FAILURES (${nonEuFailures.length}):`)
    lines.push('-'.repeat(70))
    for (const r of nonEuFailures) {
      const issues: string[] = []
      if (!r.exists) issues.push('NOT FOUND')
      else {
        if (!r.hasContent) issues.push('no content')
        if (!r.hasSummary) issues.push('no summary')
        if (!r.hasKommentar) issues.push('no kommentar')
      }
      lines.push(`  ${r.entry.lookupNumber} — ${issues.join(', ')}`)
    }
    lines.push('')
  }

  // EU diagnostic section
  lines.push('-'.repeat(70))
  lines.push('EU DOCUMENTS (INFORMATIONAL — NOT IN PASS/FAIL GATE)')
  lines.push('-'.repeat(70))
  lines.push(`  Present:      ${report.euFound}/${report.euTotal}`)
  lines.push(`  With content: ${report.euWithContent}/${report.euTotal}`)
  lines.push(
    `  Link-only:    ${report.euFound - report.euWithContent}/${report.euTotal}`
  )
  lines.push('')
  for (const r of report.euResults) {
    const celex = csvEuToCelex(r.entry.originalCsvNumber) ?? '???'
    const icon = r.exists ? (r.hasContent ? '✅' : '🔗') : '❌'
    const contentNote = r.exists
      ? r.hasContent
        ? `content: ${r.contentLength} chars`
        : 'link-only (no local content)'
      : 'NOT FOUND'
    lines.push(
      `  ${icon} ${r.entry.originalCsvNumber} [${celex}] — ${contentNote}`
    )
    if (r.exists) {
      const ai = []
      if (r.hasSummary) ai.push('summary ✓')
      else ai.push('summary ✗')
      if (r.hasKommentar) ai.push('kommentar ✓')
      else ai.push('kommentar ✗')
      lines.push(`     AI: ${ai.join(', ')}`)
    }
  }
  lines.push('')

  // Final verdict
  lines.push('='.repeat(70))
  lines.push(`RESULT: ${report.pass ? 'PASS ✅' : 'FAIL ❌'}`)
  lines.push('='.repeat(70))
  if (!report.pass) {
    lines.push(`  ${nonEuFailures.length} non-EU document(s) need attention`)
  }

  return lines.join('\n')
}

function getStatusIcon(r: AuditResult): string {
  if (!r.exists) return '❌'
  if (!r.hasContent) return '⚠️'
  if (!r.hasSummary || !r.hasKommentar) return '📝'
  return '✅'
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const csvPath = resolve(process.cwd(), 'data/seed-template-documents.csv')
  const csvContent = readFileSync(csvPath, 'utf-8')
  const rows = parseCsv(csvContent)
  console.log(`Parsed ${rows.length} CSV rows`)

  const entries = expandCsvRows(rows)
  console.log(`Expanded to ${entries.length} lookup entries`)
  console.log(`  Non-EU: ${entries.filter((e) => !e.isEu).length}`)
  console.log(`  EU:     ${entries.filter((e) => e.isEu).length}`)
  console.log('')

  const prisma = new PrismaClient()
  try {
    const report = await runAudit(prisma, entries)
    console.log(formatReport(report))
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('Audit failed:', err)
    process.exit(1)
  })
}
