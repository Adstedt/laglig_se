#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Story 12.1: Agency Regulation Stub Ingestion Script
 *
 * Reads analysis files (01, 02, 03) and the combined CSV to extract
 * all non-SFS, non-EU document references (AFS, BFS, NFS, KIFS, MSBFS,
 * ELSÄK-FS, SRVFS, and other agency prefixes).
 *
 * Creates LegalDocument stub records with content_type AGENCY_REGULATION.
 * Idempotent: re-running does not create duplicates (upserts on document_number).
 *
 * Usage:
 *   pnpm tsx scripts/ingest-agency-stubs.ts
 *   pnpm tsx scripts/ingest-agency-stubs.ts --dry-run
 */

import { PrismaClient, ContentType, DocumentStatus } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

// ============================================================================
// Configuration
// ============================================================================

const DATA_DIR = path.resolve(__dirname, '../data/notisum-amnesfokus')
const ANALYSIS_DIR = path.join(DATA_DIR, 'analysis')
const CSV_FILE = path.join(DATA_DIR, 'laglistor-all-combined.csv')

const ANALYSIS_FILES = [
  { file: '01-arbetsmiljo.md', listName: 'Arbetsmiljö' },
  {
    file: '02-arbetsmiljo-tjansteforetag.md',
    listName: 'Arbetsmiljö för tjänsteföretag',
  },
  { file: '03-miljo.md', listName: 'Miljö' },
]

const TARGET_LIST_NAMES = ANALYSIS_FILES.map((f) => f.listName)

// ============================================================================
// Agency Prefix -> Regulatory Body Mapping
// ============================================================================

const REGULATORY_BODY_MAP: Record<string, string> = {
  AFS: 'Arbetsmiljöverket',
  BFS: 'Boverket',
  NFS: 'Naturvårdsverket',
  KIFS: 'Kemikalieinspektionen',
  MSBFS: 'MSB (Myndigheten för samhällsskydd och beredskap)',
  'ELSÄK-FS': 'Elsäkerhetsverket',
  'ELSAK-FS': 'Elsäkerhetsverket',
  SRVFS: 'Räddningsverket (legacy)',
  SKVFS: 'Skatteverket',
  'HSLF-FS': 'Socialstyrelsen',
  SOSFS: 'Socialstyrelsen',
  TSFS: 'Transportstyrelsen',
  SJVFS: 'Jordbruksverket',
  LMFS: 'Lantmäteriet',
  SSMFS: 'Strålsäkerhetsmyndigheten',
  'SCB-FS': 'Statistiska centralbyrån',
  STEMFS: 'Energimyndigheten',
  SvKFS: 'Svenska kraftnät',
  FFFS: 'Finansinspektionen',
  FKFS: 'Försäkringskassan',
  HVMFS: 'Havs- och vattenmyndigheten',
  IMYFS: 'Integritetsskyddsmyndigheten',
  MIGRFS: 'Migrationsverket',
  PMFS: 'Polismyndigheten',
  PTSFS: 'Post- och telestyrelsen',
  SLVFS: 'Livsmedelsverket',
  LIVSFS: 'Livsmedelsverket',
  STAFS: 'Swedac',
}

// ============================================================================
// Source Type Classification
// ============================================================================

function classifySourceType(title: string): string {
  const lower = title.toLowerCase()
  if (lower.includes('allmänna råd') || lower.includes('allmanna rad'))
    return 'föreskrifter och allmänna råd'
  if (lower.includes('föreskrift') || lower.includes('foreskrift'))
    return 'föreskrift'
  return 'föreskrift'
}

// ============================================================================
// Parsing Helpers
// ============================================================================

const AGENCY_PREFIX_PATTERN = /^([A-ZÄÖÅa-zäöå]+-?FS)\s/

function isAgencyReference(ref: string): boolean {
  if (
    ref.startsWith('SFS ') ||
    ref.startsWith('(EU)') ||
    ref.startsWith('(EG)')
  )
    return false
  return AGENCY_PREFIX_PATTERN.test(ref)
}

function extractPrefix(ref: string): string | null {
  const match = ref.match(AGENCY_PREFIX_PATTERN)
  return match ? match[1]! : null
}

function normalizePrefix(prefix: string): string {
  // Normalize ASCII to Swedish variants
  if (prefix === 'ELSAK-FS') return 'ELSÄK-FS'
  return prefix
}

/**
 * Extract the base document number, stripping the (ersätter ...) clause.
 */
export function extractBaseDocumentNumber(ref: string): string {
  return ref.replace(/\s*\(ers[aä]tter\s+.*?\)\s*$/, '').trim()
}

/**
 * Extract the old reference from the (ersätter ...) clause, if present.
 */
function extractReplacesReference(ref: string): string | null {
  const match = ref.match(/\(ers[aä]tter\s+(.*?)\)/)
  return match ? match[1]!.trim() : null
}

/**
 * Generate a URL-safe slug from a document number.
 * e.g., "AFS 2023:1" -> "afs-2023-1"
 */
export function generateSlug(documentNumber: string): string {
  return documentNumber
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/:/g, '-')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ============================================================================
// CSV Parser
// ============================================================================

interface CsvRow {
  laglista: string
  sectionNumber: string
  sectionName: string
  index: string
  sfsNumber: string
  amendmentSfs: string
  documentName: string
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let field = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(field)
      field = ''
    } else {
      field += ch
    }
  }
  fields.push(field)
  return fields
}

function parseCsv(): CsvRow[] {
  const content = fs.readFileSync(CSV_FILE, 'utf8')
  const lines = content.split('\n').slice(1) // skip header
  const rows: CsvRow[] = []

  for (const line of lines) {
    if (!line.trim()) continue
    const fields = parseCsvLine(line)
    rows.push({
      laglista: (fields[0] ?? '').trim(),
      sectionNumber: (fields[1] ?? '').trim(),
      sectionName: (fields[2] ?? '').trim(),
      index: (fields[3] ?? '').trim(),
      sfsNumber: (fields[4] ?? '').trim(),
      amendmentSfs: (fields[5] ?? '').trim(),
      documentName: (fields[6] ?? '').trim(),
    })
  }

  return rows
}

// ============================================================================
// Analysis File Parser
// ============================================================================

interface AnalysisRef {
  fullReference: string
  title: string
  analysisFile: string
}

function parseAnalysisFile(fileName: string): AnalysisRef[] {
  const filePath = path.join(ANALYSIS_DIR, fileName)
  const content = fs.readFileSync(filePath, 'utf8')
  const refs: AnalysisRef[] = []

  for (const line of content.split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line.split('|').filter((c) => c.trim())
    if (cells.length < 3) continue

    const ref = cells[1]?.trim() ?? ''
    const title = cells[2]?.trim() ?? ''

    // Skip headers and separators
    if (
      !ref ||
      ref.includes('---') ||
      ref.includes('Reference') ||
      ref.includes('Index')
    )
      continue

    // Only agency references
    if (
      ref.startsWith('SFS') ||
      ref.startsWith('(EU)') ||
      ref.startsWith('(EG)')
    )
      continue
    if (!isAgencyReference(ref)) continue

    refs.push({ fullReference: ref, title, analysisFile: fileName })
  }

  return refs
}

// ============================================================================
// Stub Record Assembly
// ============================================================================

interface AgencyStub {
  documentNumber: string
  title: string
  slug: string
  regulatoryBody: string
  sourceType: string
  replacesOldReferences: string[]
  analysisFiles: string[]
  prefix: string
}

function cleanTitle(title: string): string {
  // Remove common CSV artifacts like "BeteckningAFS 2023:1..."
  let cleaned = title.replace(
    /^Beteckning[A-ZÄÖÅ]+-?FS\s+[\d:]+\s*(\([^)]+\))?\s*/i,
    ''
  )
  // Remove stray AFS amendment references at start
  cleaned = cleaned.replace(/^AFS\s+\d{4}:\d+\s*/i, '')
  return cleaned.trim()
}

function assembleStubs(
  analysisRefs: AnalysisRef[],
  csvRows: CsvRow[]
): Map<string, AgencyStub> {
  const stubs = new Map<string, AgencyStub>()

  // Process analysis file refs first (cleaner titles)
  for (const ref of analysisRefs) {
    const baseNum = extractBaseDocumentNumber(ref.fullReference)
    const prefix = normalizePrefix(extractPrefix(baseNum) ?? 'UNKNOWN')
    const replaces = extractReplacesReference(ref.fullReference)

    // Normalize document number to Swedish chars
    const normalizedBaseNum = baseNum.replace('ELSAK-FS', 'ELSÄK-FS')

    if (stubs.has(normalizedBaseNum)) {
      const existing = stubs.get(normalizedBaseNum)!
      if (replaces && !existing.replacesOldReferences.includes(replaces)) {
        existing.replacesOldReferences.push(replaces)
      }
      if (!existing.analysisFiles.includes(ref.analysisFile)) {
        existing.analysisFiles.push(ref.analysisFile)
      }
    } else {
      stubs.set(normalizedBaseNum, {
        documentNumber: normalizedBaseNum,
        title: ref.title,
        slug: generateSlug(normalizedBaseNum),
        regulatoryBody: REGULATORY_BODY_MAP[prefix] ?? prefix,
        sourceType: classifySourceType(ref.title),
        replacesOldReferences: replaces ? [replaces] : [],
        analysisFiles: [ref.analysisFile],
        prefix,
      })
    }
  }

  // Process CSV rows for additional refs not in analysis files
  const targetRows = csvRows.filter((r) =>
    TARGET_LIST_NAMES.includes(r.laglista)
  )
  for (const row of targetRows) {
    if (!isAgencyReference(row.sfsNumber)) continue

    const baseNum = extractBaseDocumentNumber(row.sfsNumber)
    const prefix = normalizePrefix(extractPrefix(baseNum) ?? 'UNKNOWN')

    const normalizedCsvBaseNum = baseNum.replace('ELSAK-FS', 'ELSÄK-FS')
    if (!stubs.has(normalizedCsvBaseNum)) {
      const title = cleanTitle(row.documentName)
      stubs.set(normalizedCsvBaseNum, {
        documentNumber: normalizedCsvBaseNum,
        title: title || normalizedCsvBaseNum,
        slug: generateSlug(normalizedCsvBaseNum),
        regulatoryBody: REGULATORY_BODY_MAP[prefix] ?? prefix,
        sourceType: classifySourceType(row.documentName),
        replacesOldReferences: [],
        analysisFiles: [],
        prefix,
      })
    }
  }

  return stubs
}

// ============================================================================
// SFS & EU Reference Validation (Task 3)
// ============================================================================

interface ValidationResult {
  sfsTotal: number
  sfsFound: number
  sfsMissing: string[]
  euTotal: number
  euFound: number
  euMissing: string[]
}

async function validateExistingReferences(
  csvRows: CsvRow[],
  _analysisRefs: AnalysisRef[]
): Promise<ValidationResult> {
  // Collect all SFS and EU references from both sources
  const sfsRefs = new Set<string>()
  const euRefs = new Set<string>()

  // From CSV
  const targetRows = csvRows.filter((r) =>
    TARGET_LIST_NAMES.includes(r.laglista)
  )
  for (const row of targetRows) {
    if (row.sfsNumber.startsWith('SFS ')) {
      sfsRefs.add(row.sfsNumber)
    } else if (
      row.sfsNumber.startsWith('(EU)') ||
      row.sfsNumber.startsWith('(EG)')
    ) {
      euRefs.add(row.sfsNumber)
    }
  }

  // From analysis files (SFS/EU refs we skipped during agency extraction)
  for (const file of ANALYSIS_FILES) {
    const filePath = path.join(ANALYSIS_DIR, file.file)
    const content = fs.readFileSync(filePath, 'utf8')
    for (const line of content.split('\n')) {
      if (!line.startsWith('|')) continue
      const cells = line.split('|').filter((c) => c.trim())
      if (cells.length < 3) continue
      const ref = cells[1]?.trim() ?? ''
      if (
        !ref ||
        ref.includes('---') ||
        ref.includes('Reference') ||
        ref.includes('Index')
      )
        continue
      if (ref.startsWith('SFS ')) sfsRefs.add(ref)
      if (ref.startsWith('(EU)') || ref.startsWith('(EG)')) euRefs.add(ref)
    }
  }

  // Query DB for SFS references
  const sfsMissing: string[] = []
  for (const sfsRef of sfsRefs) {
    const found = await prisma.legalDocument.findFirst({
      where: { document_number: sfsRef },
      select: { id: true },
    })
    if (!found) sfsMissing.push(sfsRef)
  }

  // Query DB for EU references
  const euMissing: string[] = []
  for (const euRef of euRefs) {
    const found = await prisma.legalDocument.findFirst({
      where: { document_number: euRef },
      select: { id: true },
    })
    if (!found) euMissing.push(euRef)
  }

  return {
    sfsTotal: sfsRefs.size,
    sfsFound: sfsRefs.size - sfsMissing.length,
    sfsMissing,
    euTotal: euRefs.size,
    euFound: euRefs.size - euMissing.length,
    euMissing,
  }
}

// ============================================================================
// Verification Query (Task 4)
// ============================================================================

interface VerificationResult {
  totalReferences: number
  resolvedCount: number
  unresolvedReferences: string[]
  stubsByPrefix: Record<string, number>
}

async function runVerificationQuery(
  csvRows: CsvRow[],
  _analysisRefs: AnalysisRef[]
): Promise<VerificationResult> {
  // Collect ALL unique document references across the 3 templates
  const allRefs = new Map<string, string>() // baseRef -> fullRef (for display)

  // From CSV
  const targetRows = csvRows.filter((r) =>
    TARGET_LIST_NAMES.includes(r.laglista)
  )
  for (const row of targetRows) {
    if (!row.sfsNumber) continue
    let base = isAgencyReference(row.sfsNumber)
      ? extractBaseDocumentNumber(row.sfsNumber)
      : row.sfsNumber
    base = base.replace('ELSAK-FS', 'ELSÄK-FS')
    if (!allRefs.has(base)) allRefs.set(base, row.sfsNumber)
  }

  // From analysis files - only parse document reference tables (have Index | SFS/Reference | Title format)
  for (const file of ANALYSIS_FILES) {
    const filePath = path.join(ANALYSIS_DIR, file.file)
    const content = fs.readFileSync(filePath, 'utf8')
    for (const line of content.split('\n')) {
      if (!line.startsWith('|')) continue
      const cells = line.split('|').filter((c) => c.trim())
      if (cells.length < 3) continue
      const ref = cells[1]?.trim() ?? ''
      if (
        !ref ||
        ref.includes('---') ||
        ref.includes('Reference') ||
        ref.includes('Index')
      )
        continue
      // Only include actual document references (SFS, EU, or agency regulation patterns)
      const isDocRef =
        ref.startsWith('SFS ') ||
        ref.startsWith('(EU)') ||
        ref.startsWith('(EG)') ||
        isAgencyReference(ref)
      if (!isDocRef) continue
      let base = isAgencyReference(ref) ? extractBaseDocumentNumber(ref) : ref
      base = base.replace('ELSAK-FS', 'ELSÄK-FS')
      if (!allRefs.has(base)) allRefs.set(base, ref)
    }
  }

  // Check each unique reference against DB
  const unresolved: string[] = []
  for (const [baseRef] of allRefs) {
    const found = await prisma.legalDocument.findFirst({
      where: { document_number: baseRef },
      select: { id: true },
    })
    if (!found) unresolved.push(baseRef)
  }

  // Count stubs by prefix
  const stubs = await prisma.legalDocument.findMany({
    where: { content_type: ContentType.AGENCY_REGULATION },
    select: { document_number: true },
  })
  const stubsByPrefix: Record<string, number> = {}
  for (const stub of stubs) {
    const prefix = extractPrefix(stub.document_number) ?? 'OTHER'
    stubsByPrefix[prefix] = (stubsByPrefix[prefix] ?? 0) + 1
  }

  return {
    totalReferences: allRefs.size,
    resolvedCount: allRefs.size - unresolved.length,
    unresolvedReferences: unresolved,
    stubsByPrefix,
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run')
  const startTime = Date.now()

  console.log('='.repeat(60))
  console.log('Agency Regulation Stub Ingestion Script (Story 12.1)')
  console.log('='.repeat(60))
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log()

  // Step 1: Parse data sources
  console.log('--- Step 1: Parsing data sources ---')

  const allAnalysisRefs: AnalysisRef[] = []
  for (const { file, listName } of ANALYSIS_FILES) {
    const refs = parseAnalysisFile(file)
    allAnalysisRefs.push(...refs)
    console.log(`  ${file}: ${refs.length} agency references (${listName})`)
  }

  const csvRows = parseCsv()
  const targetCsvRows = csvRows.filter((r) =>
    TARGET_LIST_NAMES.includes(r.laglista)
  )
  console.log(`  CSV: ${targetCsvRows.length} rows from target lists`)
  console.log()

  // Step 2: Assemble stubs
  console.log('--- Step 2: Assembling stub records ---')
  const stubs = assembleStubs(allAnalysisRefs, csvRows)
  console.log(`  ${stubs.size} unique agency regulation stubs to create`)

  const prefixCounts: Record<string, number> = {}
  for (const [, stub] of stubs) {
    prefixCounts[stub.prefix] = (prefixCounts[stub.prefix] ?? 0) + 1
  }
  for (const [prefix, count] of Object.entries(prefixCounts).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`    ${prefix}: ${count}`)
  }
  console.log()

  // Step 3: Upsert stubs into database
  console.log('--- Step 3: Upserting stub records ---')
  let created = 0
  let updated = 0
  let errors = 0

  for (const [, stub] of stubs) {
    if (isDryRun) {
      console.log(
        `  [DRY RUN] Would upsert: ${stub.documentNumber} (${stub.title.substring(0, 60)})`
      )
      continue
    }

    try {
      const existing = await prisma.legalDocument.findUnique({
        where: { document_number: stub.documentNumber },
        select: { id: true },
      })

      await prisma.legalDocument.upsert({
        where: { document_number: stub.documentNumber },
        update: {
          title: stub.title,
          slug: stub.slug,
          metadata: {
            regulatoryBody: stub.regulatoryBody,
            sourceType: stub.sourceType,
            replacesOldReferences: stub.replacesOldReferences,
            analysisFiles: stub.analysisFiles,
            prefix: stub.prefix,
          },
          updated_at: new Date(),
        },
        create: {
          document_number: stub.documentNumber,
          title: stub.title,
          slug: stub.slug,
          content_type: ContentType.AGENCY_REGULATION,
          status: DocumentStatus.ACTIVE,
          source_url: '',
          full_text: null,
          html_content: null,
          markdown_content: null,
          json_content: undefined,
          metadata: {
            regulatoryBody: stub.regulatoryBody,
            sourceType: stub.sourceType,
            replacesOldReferences: stub.replacesOldReferences,
            analysisFiles: stub.analysisFiles,
            prefix: stub.prefix,
          },
        },
      })

      if (existing) {
        updated++
      } else {
        created++
      }

      process.stdout.write(
        `  [${created + updated}/${stubs.size}] ${existing ? 'Updated' : 'Created'}: ${stub.documentNumber}\n`
      )
    } catch (error) {
      errors++
      console.error(
        `  ERROR upserting ${stub.documentNumber}:`,
        error instanceof Error ? error.message : error
      )
    }
  }

  if (!isDryRun) {
    console.log()
    console.log(
      `  Results: ${created} created, ${updated} updated, ${errors} errors`
    )
    console.log()
  }

  // Step 4: Validate existing SFS/EU references
  console.log('--- Step 4: Validating existing SFS/EU references ---')
  const validation = await validateExistingReferences(csvRows, allAnalysisRefs)

  console.log(
    `  SFS: ${validation.sfsFound} of ${validation.sfsTotal} references found, ${validation.sfsMissing.length} missing`
  )
  if (validation.sfsMissing.length > 0) {
    console.log('  Missing SFS references:')
    for (const ref of validation.sfsMissing.slice(0, 20)) {
      console.log(`    WARNING: ${ref}`)
    }
    if (validation.sfsMissing.length > 20) {
      console.log(`    ... and ${validation.sfsMissing.length - 20} more`)
    }
  }

  console.log(
    `  EU: ${validation.euFound} of ${validation.euTotal} references found, ${validation.euMissing.length} missing`
  )
  if (validation.euMissing.length > 0) {
    console.log('  Missing EU references:')
    for (const ref of validation.euMissing) {
      console.log(`    WARNING: ${ref}`)
    }
  }
  console.log()

  // Step 5: Verification query
  console.log('--- Step 5: Running verification query ---')
  const verification = await runVerificationQuery(csvRows, allAnalysisRefs)

  console.log(
    `  Total unique document references across 3 templates: ${verification.totalReferences}`
  )
  console.log(
    `  Resolved to LegalDocument: ${verification.resolvedCount}/${verification.totalReferences}`
  )
  if (verification.unresolvedReferences.length > 0) {
    console.log(
      `  UNRESOLVED references (${verification.unresolvedReferences.length}):`
    )
    for (const ref of verification.unresolvedReferences) {
      console.log(`    MISSING: ${ref}`)
    }
  } else {
    console.log('  ✓ All references resolved successfully!')
  }

  console.log()
  console.log('  Stubs by agency prefix:')
  for (const [prefix, count] of Object.entries(verification.stubsByPrefix).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`    ${prefix}: ${count}`)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log()
  console.log('='.repeat(60))
  console.log(`Done in ${elapsed}s`)
  console.log('='.repeat(60))
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
