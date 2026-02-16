#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Story 12.5: Seed Miljö Template
 *
 * Creates the Miljö LawListTemplate with 1 placeholder section
 * and 98 TemplateItems referencing existing LegalDocument records.
 *
 * Usage:
 *   npx tsx scripts/seed-miljo-template.ts
 *   npx tsx scripts/seed-miljo-template.ts --dry-run
 *   npx tsx scripts/seed-miljo-template.ts --force
 */

import { PrismaClient } from '@prisma/client'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { config } from 'dotenv'
config({ path: resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

// ============================================================================
// Configuration
// ============================================================================

export interface SeedConfig {
  force: boolean
  dryRun: boolean
}

export function parseArgs(): SeedConfig {
  const args = process.argv.slice(2)
  const config: SeedConfig = { force: false, dryRun: false }
  for (const arg of args) {
    if (arg === '--force') config.force = true
    if (arg === '--dry-run') config.dryRun = true
  }
  return config
}

// ============================================================================
// File Paths
// ============================================================================

const DATA_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data/notisum-amnesfokus'
)
const ANALYSIS_DIR = path.join(DATA_DIR, 'analysis')
const ANALYSIS_FILE = path.join(ANALYSIS_DIR, '03-miljo.md')
const TJANSTEFORETAG_FILE = path.join(
  ANALYSIS_DIR,
  '04-miljo-tjansteforetag.md'
)
const CSV_FILE = path.join(DATA_DIR, 'laglistor-all-combined.csv')

// ============================================================================
// Regulatory Body Mapping
// ============================================================================

export const REGULATORY_BODY_MAP: Record<string, string> = {
  SFS: 'Riksdagen',
  NFS: 'Naturvårdsverket',
  MSBFS: 'MSB',
  KIFS: 'Kemikalieinspektionen',
  BFS: 'Boverket',
  SRVFS: 'Räddningsverket',
  'SCB-FS': 'SCB',
  SSMFS: 'Strålsäkerhetsmyndigheten',
  STAFS: 'Swedac',
  '(EU)': 'EU',
  '(EG)': 'EU',
}

// ============================================================================
// Parsing Helpers
// ============================================================================

export interface AnalysisEntry {
  /** Original SFS/Reference column value */
  fullReference: string
  /** Title from the analysis file */
  title: string
  /** Original section index */
  originalIndex: string
  /** Section number from analysis file (01-09) */
  originalSection: string
}

/** Extract base document number, stripping (ersätter ...) clause */
export function extractBaseDocumentNumber(ref: string): string {
  return ref.replace(/\s*\(ers[aä]tter\s+.*?\)\s*$/i, '').trim()
}

/** Extract the old reference from (ersätter ...) clause */
export function extractReplacesReference(ref: string): string | null {
  const match = ref.match(/\(ers[aä]tter\s+(.*?)\)/i)
  return match ? match[1]!.trim() : null
}

/** Normalize reference for fuzzy string matching (strip diacritics, lowercase) */
export function normalizeForMatching(ref: string): string {
  return ref
    .replace(/ä/g, 'a')
    .replace(/Ä/g, 'A')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/å/g, 'a')
    .replace(/Å/g, 'A')
    .toLowerCase()
}

/** Normalize document number for DB lookup */
export function normalizeDocumentNumber(ref: string): string {
  // Strip " - OVK 1" or similar suffixes
  const normalized = ref.replace(/\s+-\s+OVK\s+\d+$/i, '')
  return normalized.trim()
}

/** Classify source_type from document_number and title */
export function classifySourceType(docNumber: string, title: string): string {
  if (docNumber.startsWith('(EU)') || docNumber.startsWith('(EG)')) {
    return 'eu-forordning'
  }
  if (docNumber.startsWith('NFS')) return 'foreskrift'
  if (docNumber.startsWith('MSBFS')) return 'foreskrift'
  if (docNumber.startsWith('KIFS')) return 'foreskrift'
  if (docNumber.startsWith('BFS')) return 'foreskrift'
  if (docNumber.startsWith('SRVFS')) return 'allmanna-rad'
  if (docNumber.startsWith('SCB-FS')) return 'foreskrift'
  if (docNumber.startsWith('SSMFS')) return 'foreskrift'
  if (docNumber.startsWith('STAFS')) return 'foreskrift'

  // SFS: distinguish lag vs förordning by title
  if (docNumber.startsWith('SFS')) {
    const lower = title.toLowerCase()
    if (lower.includes('förordning') || lower.includes('forordning')) {
      return 'forordning'
    }
    return 'lag'
  }

  return 'foreskrift'
}

/** Get regulatory body from document_number prefix */
export function getRegulatoryBody(docNumber: string): string {
  if (docNumber.startsWith('NFS')) return REGULATORY_BODY_MAP['NFS']!
  if (docNumber.startsWith('MSBFS')) return REGULATORY_BODY_MAP['MSBFS']!
  if (docNumber.startsWith('KIFS')) return REGULATORY_BODY_MAP['KIFS']!
  if (docNumber.startsWith('BFS')) return REGULATORY_BODY_MAP['BFS']!
  if (docNumber.startsWith('SRVFS')) return REGULATORY_BODY_MAP['SRVFS']!
  if (docNumber.startsWith('SCB-FS')) return REGULATORY_BODY_MAP['SCB-FS']!
  if (docNumber.startsWith('SSMFS')) return REGULATORY_BODY_MAP['SSMFS']!
  if (docNumber.startsWith('STAFS')) return REGULATORY_BODY_MAP['STAFS']!
  if (docNumber.startsWith('SFS')) return REGULATORY_BODY_MAP['SFS']!
  if (docNumber.startsWith('(EU)') || docNumber.startsWith('(EG)'))
    return REGULATORY_BODY_MAP['(EU)']!
  return 'Okänd'
}

// ============================================================================
// Analysis File Parser
// ============================================================================

export interface YamlFrontmatter {
  totalDocuments: number
}

export function parseFrontmatter(content: string): YamlFrontmatter {
  const match = content.match(/document_count:\s*(\d+)/)
  return {
    totalDocuments: match ? parseInt(match[1]!, 10) : 0,
  }
}

/**
 * Parse all document entries from the analysis markdown file.
 * Extracts rows from markdown tables across all 9 sections.
 *
 * Table format: | # | SFS/AFS Number | Official Statute Title | Last Amendment |
 */
export function parseAnalysisFile(filePath: string): AnalysisEntry[] {
  const content = fs.readFileSync(filePath, 'utf8')
  const entries: AnalysisEntry[] = []
  let currentSection = ''

  for (const line of content.split('\n')) {
    // Track current section: "### Section 01 --" or "### 2.1"
    const sectionMatch = line.match(/^###\s+(?:Section\s+)?(\d+)/)
    if (sectionMatch) {
      const num = parseInt(sectionMatch[1]!, 10)
      currentSection = String(num).padStart(2, '0')
    }

    // Parse table rows
    if (!line.startsWith('|')) continue
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
    if (cells.length < 3) continue

    const indexCell = cells[0] ?? ''
    const refCell = cells[1] ?? ''
    const titleCell = cells[2] ?? ''

    // Skip headers and separators
    if (
      refCell.includes('---') ||
      refCell.includes('SFS/AFS') ||
      refCell.includes('SFS/Reference') ||
      refCell.includes('Index') ||
      refCell.includes('#')
    )
      continue

    // Must be a valid document reference
    if (!isDocumentReference(refCell)) continue

    entries.push({
      fullReference: refCell,
      title: titleCell,
      originalIndex: indexCell,
      originalSection: currentSection,
    })
  }

  return entries
}

/** Check if a cell value is a valid document reference */
export function isDocumentReference(ref: string): boolean {
  return (
    ref.startsWith('SFS') ||
    ref.startsWith('(EU)') ||
    ref.startsWith('(EG)') ||
    ref.startsWith('NFS') ||
    ref.startsWith('MSBFS') ||
    ref.startsWith('KIFS') ||
    ref.startsWith('BFS') ||
    ref.startsWith('SRVFS') ||
    ref.startsWith('SCB-FS') ||
    ref.startsWith('SSMFS') ||
    ref.startsWith('STAFS')
  )
}

/**
 * Parse the Miljö tjänsteföretag file (04) to get service-company document refs.
 * Returns a Set of normalized base document numbers for matching.
 *
 * NOTE: File 04 references Miljöbalk by chapter (Kap 2, Kap 14, Kap 15)
 * but the parent Miljö list uses "SFS 1998:808". Any Miljöbalk chapter
 * reference maps to SFS 1998:808.
 */
export function parseTjansteforetagFile(filePath: string): Set<string> {
  const content = fs.readFileSync(filePath, 'utf8')
  const refs = new Set<string>()

  for (const line of content.split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
    if (cells.length < 3) continue

    const refCell = cells[1] ?? ''
    if (
      refCell.includes('---') ||
      refCell.includes('SFS/') ||
      refCell.includes('Number') ||
      refCell.includes('Index') ||
      refCell.includes('#')
    )
      continue

    if (!isDocumentReference(refCell)) continue

    // Extract base document number (strip ersätter, normalize)
    const base = normalizeDocumentNumber(extractBaseDocumentNumber(refCell))
    refs.add(normalizeForMatching(base))
  }

  return refs
}

// ============================================================================
// CSV Parser (for Amendment SFS / ersätter data)
// ============================================================================

export interface CsvRow {
  laglista: string
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

export function parseCsvForMiljo(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n').slice(1) // skip header
  const rows: CsvRow[] = []

  for (const line of lines) {
    if (!line.trim()) continue
    const fields = parseCsvLine(line)
    const laglista = (fields[0] ?? '').trim()
    if (laglista !== 'Miljö') continue

    rows.push({
      laglista,
      sfsNumber: (fields[4] ?? '').trim(),
      amendmentSfs: (fields[5] ?? '').trim(),
      documentName: (fields[6] ?? '').trim(),
    })
  }

  return rows
}

// ============================================================================
// Cross-List Reference Data
// ============================================================================

/**
 * Hardcoded cross-list overlap data derived from the overlap matrix
 * and CSV cross-referencing. Keys are template slugs, values are
 * Sets of base document reference strings from the Miljö list that
 * also appear in the named list.
 *
 * Note: "miljo-tjansteforetag" overlap (30 docs) is handled via
 * is_service_company_relevant flag, not cross_list_references.
 */
export const CROSS_LIST_OVERLAPS: Record<string, Set<string>> = {
  // 22 shared with Arbetsmiljö (verified from CSV cross-referencing)
  arbetsmiljo: new Set([
    '(EG) nr 1272/2008',
    '(EG) nr 1907/2006',
    '(EU) nr 1021/2019',
    'BFS 2011:16',
    'KIFS 2017:7',
    'KIFS 2022:3',
    'MSBFS 2013:3',
    'MSBFS 2015:9',
    'MSBFS 2020:1',
    'MSBFS 2023:2',
    'MSBFS 2024:10',
    'MSBFS 2025:2',
    'SFS 2003:778',
    'SFS 2003:789',
    'SFS 2006:263',
    'SFS 2006:311',
    'SFS 2007:19',
    'SFS 2010:1011',
    'SFS 2010:1075',
    'SFS 2018:396',
    'SFS 2018:506',
    'SRVFS 2004:3',
  ]),
  // 9 shared with Arbetsmiljö tjänsteföretag (verified from CSV)
  'arbetsmiljo-tjansteforetag': new Set([
    '(EG) nr 1272/2008',
    '(EG) nr 1907/2006',
    'KIFS 2017:7',
    'MSBFS 2020:1',
    'MSBFS 2023:2',
    'SFS 2003:778',
    'SFS 2010:1011',
    'SFS 2010:1075',
    'SRVFS 2004:3',
  ]),
  // 14 shared with Fastighet-Bygg (verified from CSV)
  'fastighet-bygg': new Set([
    'BFS 2011:16',
    'MSBFS 2014:6',
    'NFS 2004:15',
    'SFS 1998:901',
    'SFS 2006:985',
    'SFS 2006:1592',
    'SFS 2007:19',
    'SFS 2010:900',
    'SFS 2011:338',
    'SFS 2018:396',
    'SFS 2020:614',
    'SFS 2021:787',
    'SFS 2021:789',
    'SFS 2022:1274',
  ]),
  // 1 shared with Hälsa (verified from CSV)
  halsa: new Set(['SSMFS 2018:2']),
  // 1 shared with Livsmedel (verified from CSV)
  livsmedel: new Set(['(EU) 40/2025']),
  // 1 shared with Miljö Sverige (verified from CSV)
  'miljo-sverige': new Set(['SFS 1995:1554']),
}

/**
 * Get cross_list_references for a given analysis entry.
 * Matches by base document number (after stripping ersätter and normalizing).
 */
export function getCrossListReferences(entry: AnalysisEntry): string[] {
  const refs: string[] = []
  const baseRef = extractBaseDocumentNumber(entry.fullReference)

  for (const [slug, docSet] of Object.entries(CROSS_LIST_OVERLAPS)) {
    // Check full reference match (including OVK suffix etc.)
    if (docSet.has(entry.fullReference)) {
      refs.push(slug)
      continue
    }
    // Check by base reference (stripped of ersätter)
    if (docSet.has(baseRef)) {
      refs.push(slug)
      continue
    }
    // Check normalized base (without OVK suffix)
    const normalized = normalizeDocumentNumber(baseRef)
    if (normalized !== baseRef && docSet.has(normalized)) {
      refs.push(slug)
    }
  }

  return refs.sort()
}

// ============================================================================
// EU Document Lookup Helper
// ============================================================================

/**
 * Convert EU reference format to CELEX number for DB lookup.
 * e.g., "(EU) nr 573/2024" → "32024R0573"
 *       "(EG) nr 1907/2006" → "32006R1907"
 *       "(EU) 40/2025" → "32025R0040"
 */
export function csvEuToCelex(csvDocNumber: string): string | null {
  const match = csvDocNumber.match(/\(E[GU]\)\s*(?:nr\s+)?(\d+)\/(\d+)/)
  if (!match) return null
  const part1 = match[1]
  const part2 = match[2]
  if (!part1 || !part2) return null

  let year: string
  let number: string
  const part2Num = parseInt(part2, 10)
  if (part2.length === 4 && part2Num >= 1990) {
    year = part2
    number = part1
  } else {
    year = part1
    number = part2
  }

  return `3${year}R${number.padStart(4, '0')}`
}

// ============================================================================
// Seed Logic
// ============================================================================

export interface SeedResult {
  templateId: string
  sectionId: string
  itemsCreated: number
  itemsSkipped: number
  missingDocuments: string[]
  duplicateDocuments: string[]
  contentVerification: {
    withSummary: number
    withKommentar: number
    missingSummary: string[]
    missingKommentar: string[]
  }
}

async function findOrCreateSystemUser(): Promise<string> {
  const existingUser = await prisma.user.findFirst({
    select: { id: true },
    orderBy: { created_at: 'asc' },
  })
  if (existingUser) return existingUser.id

  const systemUser = await prisma.user.create({
    data: {
      email: 'system@laglig.se',
      name: 'System',
    },
  })
  return systemUser.id
}

async function lookupDocument(
  docNumber: string,
  fullReference: string
): Promise<{
  id: string
  summary: string | null
  kommentar: string | null
} | null> {
  // For EU documents, look up via EuDocument → LegalDocument
  if (fullReference.startsWith('(EU)') || fullReference.startsWith('(EG)')) {
    const celex = csvEuToCelex(fullReference)
    if (celex) {
      const euDoc = await prisma.euDocument.findUnique({
        where: { celex_number: celex },
        select: {
          document: {
            select: { id: true, summary: true, kommentar: true },
          },
        },
      })
      if (euDoc?.document) return euDoc.document
    }

    // Fallback: try direct document_number match
    const directMatch = await prisma.legalDocument.findUnique({
      where: { document_number: docNumber },
      select: { id: true, summary: true, kommentar: true },
    })
    if (directMatch) return directMatch

    // Fallback: try ILIKE on document_number for EU number patterns
    const numberMatch = fullReference.match(/(\d+)\/(\d{4})/)
    if (numberMatch) {
      const fuzzyMatches = await prisma.legalDocument.findMany({
        where: {
          document_number: {
            contains: numberMatch[1]!,
            mode: 'insensitive' as const,
          },
        },
        select: {
          id: true,
          document_number: true,
          summary: true,
          kommentar: true,
        },
        take: 5,
      })
      const match = fuzzyMatches.find((m) =>
        m.document_number.includes(numberMatch[2]!)
      )
      if (match)
        return {
          id: match.id,
          summary: match.summary,
          kommentar: match.kommentar,
        }
    }
    return null
  }

  // For non-EU documents, exact match on document_number
  return prisma.legalDocument.findUnique({
    where: { document_number: docNumber },
    select: { id: true, summary: true, kommentar: true },
  })
}

export async function seed(config: SeedConfig): Promise<SeedResult> {
  const startTime = Date.now()
  console.log('='.repeat(60))
  console.log('Seed Miljö Template (Story 12.5)')
  console.log('='.repeat(60))
  console.log(`Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Force: ${config.force}`)
  console.log()

  // ── Step 1: Parse data sources ──────────────────────────────────────────
  console.log('--- Step 1: Parsing data sources ---')
  const analysisEntries = parseAnalysisFile(ANALYSIS_FILE)
  const frontmatter = parseFrontmatter(fs.readFileSync(ANALYSIS_FILE, 'utf8'))
  console.log(
    `  Analysis file: ${analysisEntries.length} entries (expected: ${frontmatter.totalDocuments})`
  )

  const serviceCompanyRefs = parseTjansteforetagFile(TJANSTEFORETAG_FILE)
  console.log(`  Tjänsteföretag file: ${serviceCompanyRefs.size} references`)

  const csvRows = parseCsvForMiljo(CSV_FILE)
  console.log(`  CSV: ${csvRows.length} Miljö rows`)
  console.log()

  // ── Step 2: Create/upsert LawListTemplate ──────────────────────────────
  console.log('--- Step 2: Creating LawListTemplate ---')
  const userId = config.dryRun ? 'dry-run-user' : await findOrCreateSystemUser()

  let templateId = 'dry-run-template'
  if (!config.dryRun) {
    const existing = await prisma.lawListTemplate.findUnique({
      where: { slug: 'miljo' },
    })
    if (existing && !config.force) {
      console.log('  Template already exists. Use --force to re-seed.')
      return {
        templateId: existing.id,
        sectionId: '',
        itemsCreated: 0,
        itemsSkipped: 0,
        missingDocuments: [],
        duplicateDocuments: [],
        contentVerification: {
          withSummary: 0,
          withKommentar: 0,
          missingSummary: [],
          missingKommentar: [],
        },
      }
    }

    const template = await prisma.lawListTemplate.upsert({
      where: { slug: 'miljo' },
      update: {
        name: 'Miljö',
        domain: 'miljo',
        target_audience:
          'Organisationer med miljöpåverkan — tillverkningsindustri, bygg, avfall, energi, fastighet och kemikaliehantering',
        primary_regulatory_bodies: [
          'Naturvårdsverket',
          'MSB',
          'Kemikalieinspektionen',
          'Riksdagen',
          'EU',
        ],
        status: 'DRAFT',
        version: 1,
        document_count: frontmatter.totalDocuments,
        section_count: 1,
        is_variant: false,
        parent_template_id: null,
        created_by: userId,
      },
      create: {
        name: 'Miljö',
        slug: 'miljo',
        domain: 'miljo',
        target_audience:
          'Organisationer med miljöpåverkan — tillverkningsindustri, bygg, avfall, energi, fastighet och kemikaliehantering',
        primary_regulatory_bodies: [
          'Naturvårdsverket',
          'MSB',
          'Kemikalieinspektionen',
          'Riksdagen',
          'EU',
        ],
        status: 'DRAFT',
        version: 1,
        document_count: frontmatter.totalDocuments,
        section_count: 1,
        is_variant: false,
        parent_template_id: null,
        created_by: userId,
      },
    })
    templateId = template.id
    console.log(`  Template upserted: ${template.id} (slug: ${template.slug})`)
  } else {
    console.log('  [DRY RUN] Would create template: Miljö')
  }

  // ── Step 3: Create placeholder TemplateSection ─────────────────────────
  console.log('--- Step 3: Creating placeholder TemplateSection ---')
  let sectionId = 'dry-run-section'
  if (!config.dryRun) {
    const section = await prisma.templateSection.upsert({
      where: {
        template_id_section_number: {
          template_id: templateId,
          section_number: '01',
        },
      },
      update: {
        name: 'Alla bestämmelser',
        description:
          'Flat list of all documents. Section groupings will be added in a future story.',
        position: 1.0,
        item_count: frontmatter.totalDocuments,
      },
      create: {
        template_id: templateId,
        section_number: '01',
        name: 'Alla bestämmelser',
        description:
          'Flat list of all documents. Section groupings will be added in a future story.',
        position: 1.0,
        item_count: frontmatter.totalDocuments,
      },
    })
    sectionId = section.id
    console.log(`  Section upserted: ${section.id}`)
  } else {
    console.log('  [DRY RUN] Would create section: Alla bestämmelser')
  }

  // ── Step 4: Create TemplateItems ───────────────────────────────────────
  console.log('--- Step 4: Creating TemplateItems ---')
  const missingDocuments: string[] = []
  const duplicateDocuments: string[] = []
  const usedDocumentIds = new Set<string>()
  let itemIndex = 0
  const contentVerification = {
    withSummary: 0,
    withKommentar: 0,
    missingSummary: [] as string[],
    missingKommentar: [] as string[],
  }

  // Build CSV amendment map for replaces_old_reference fallback
  const csvAmendmentMap = new Map<string, string>()
  for (const row of csvRows) {
    if (row.amendmentSfs) {
      csvAmendmentMap.set(row.sfsNumber, row.amendmentSfs)
    }
  }

  for (let i = 0; i < analysisEntries.length; i++) {
    const entry = analysisEntries[i]!
    const baseRef = extractBaseDocumentNumber(entry.fullReference)
    const docNumber = normalizeDocumentNumber(baseRef)
    const replaces =
      extractReplacesReference(entry.fullReference) ??
      csvAmendmentMap.get(baseRef) ??
      null

    // Check if this is a service-company-relevant document
    const normalizedBase = normalizeForMatching(docNumber)
    const isServiceCompanyRelevant = serviceCompanyRefs.has(normalizedBase)

    // Look up document in DB
    const doc = config.dryRun
      ? { id: `mock-doc-${i}`, summary: 'mock', kommentar: 'mock' }
      : await lookupDocument(docNumber, entry.fullReference)

    if (!doc) {
      missingDocuments.push(`${entry.fullReference} → ${docNumber} (NOT FOUND)`)
      console.log(
        `  WARNING: Missing document: ${entry.fullReference} → ${docNumber}`
      )
      continue
    }

    // Check for duplicate document_id
    if (usedDocumentIds.has(doc.id)) {
      duplicateDocuments.push(
        `${entry.fullReference} → ${docNumber} (duplicate of existing item)`
      )
      console.log(
        `  SKIP: Duplicate document_id for ${entry.fullReference} → ${docNumber}`
      )
      continue
    }
    usedDocumentIds.add(doc.id)

    // Track content status
    if (doc.summary) {
      contentVerification.withSummary++
    } else {
      contentVerification.missingSummary.push(docNumber)
    }
    if (doc.kommentar) {
      contentVerification.withKommentar++
    } else {
      contentVerification.missingKommentar.push(docNumber)
    }

    // Determine cross-list references
    const crossListRefs = getCrossListReferences(entry)

    // Assign sequential index
    itemIndex++
    const index = String(itemIndex).padStart(3, '0')

    const sourceType = classifySourceType(baseRef, entry.title)
    const regulatoryBody = getRegulatoryBody(baseRef)

    if (!config.dryRun) {
      await prisma.templateItem.upsert({
        where: {
          template_id_document_id: {
            template_id: templateId,
            document_id: doc.id,
          },
        },
        update: {
          section_id: sectionId,
          index,
          position: itemIndex,
          source_type: sourceType,
          regulatory_body: regulatoryBody,
          is_service_company_relevant: isServiceCompanyRelevant,
          replaces_old_reference: replaces,
          cross_list_references: crossListRefs,
          content_status: doc.summary ? 'AI_GENERATED' : 'STUB',
        },
        create: {
          template_id: templateId,
          section_id: sectionId,
          document_id: doc.id,
          index,
          position: itemIndex,
          source_type: sourceType,
          regulatory_body: regulatoryBody,
          is_service_company_relevant: isServiceCompanyRelevant,
          replaces_old_reference: replaces,
          cross_list_references: crossListRefs,
          content_status: doc.summary ? 'AI_GENERATED' : 'STUB',
        },
      })
    }

    if (itemIndex % 20 === 0 || itemIndex === 1) {
      console.log(
        `  [${itemIndex}] ${index}: ${entry.fullReference.substring(0, 50)} → ${docNumber}`
      )
    }
  }

  console.log(`  Items created: ${itemIndex}`)
  if (missingDocuments.length > 0) {
    console.log(`  Missing documents: ${missingDocuments.length}`)
  }
  if (duplicateDocuments.length > 0) {
    console.log(`  Duplicate documents: ${duplicateDocuments.length}`)
  }

  // Update denormalized count if actual differs from expected
  if (!config.dryRun && itemIndex !== frontmatter.totalDocuments) {
    await prisma.lawListTemplate.update({
      where: { id: templateId },
      data: { document_count: itemIndex },
    })
    await prisma.templateSection.update({
      where: { id: sectionId },
      data: { item_count: itemIndex },
    })
    console.log(
      `  Updated document_count to ${itemIndex} (expected ${frontmatter.totalDocuments})`
    )
  }

  // ── Step 5: Quality validation ─────────────────────────────────────────
  console.log()
  console.log('--- Step 5: Quality validation ---')

  // Check 1: Valid document references
  console.log(
    `  [${missingDocuments.length === 0 ? 'PASS' : 'WARN'}] Document references: ${itemIndex} resolved, ${missingDocuments.length} missing`
  )

  // Check 2: Index uniqueness (guaranteed by sequential assignment)
  console.log(`  [PASS] Index uniqueness: ${itemIndex} unique indexes`)

  // Check 3: Content verification
  console.log(
    `  [${contentVerification.missingSummary.length === 0 ? 'PASS' : 'WARN'}] Summaries: ${contentVerification.withSummary}/${itemIndex} have summary`
  )
  console.log(
    `  [${contentVerification.missingKommentar.length === 0 ? 'PASS' : 'WARN'}] Kommentar: ${contentVerification.withKommentar}/${itemIndex} have kommentar`
  )

  // Check 4: Service company flag count
  const serviceCompanyCount = analysisEntries.filter((e) => {
    const base = normalizeDocumentNumber(
      extractBaseDocumentNumber(e.fullReference)
    )
    return serviceCompanyRefs.has(normalizeForMatching(base))
  }).length
  console.log(`  [INFO] Service company relevant: ${serviceCompanyCount} items`)

  if (contentVerification.missingSummary.length > 0) {
    console.log('  Missing summaries:')
    for (const ref of contentVerification.missingSummary.slice(0, 10)) {
      console.log(`    - ${ref}`)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log()
  console.log('='.repeat(60))
  console.log(
    `Done in ${elapsed}s — ${itemIndex} items, ${missingDocuments.length} missing, ${duplicateDocuments.length} duplicates`
  )
  console.log('='.repeat(60))

  return {
    templateId,
    sectionId,
    itemsCreated: itemIndex,
    itemsSkipped: missingDocuments.length + duplicateDocuments.length,
    missingDocuments,
    duplicateDocuments,
    contentVerification,
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const config = parseArgs()
  await seed(config)
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1]!)) {
  main()
    .catch((e) => {
      console.error(e)
      void prisma.$disconnect()
      process.exit(1)
    })
    .finally(() => {
      void prisma.$disconnect()
    })
}
