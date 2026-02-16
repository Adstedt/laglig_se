#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Story 12.4: Seed Arbetsmiljö Template (Gold Standard)
 *
 * Creates the Arbetsmiljö LawListTemplate with 1 placeholder section
 * and 112 TemplateItems referencing existing LegalDocument records.
 *
 * Usage:
 *   npx tsx scripts/seed-arbetsmiljo-template.ts
 *   npx tsx scripts/seed-arbetsmiljo-template.ts --dry-run
 *   npx tsx scripts/seed-arbetsmiljo-template.ts --force
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
const ANALYSIS_FILE = path.join(ANALYSIS_DIR, '01-arbetsmiljo.md')
const TJANSTEFORETAG_FILE = path.join(
  ANALYSIS_DIR,
  '02-arbetsmiljo-tjansteforetag.md'
)
const CSV_FILE = path.join(DATA_DIR, 'laglistor-all-combined.csv')

// ============================================================================
// AFS Old-to-Chapter Mapping
// ============================================================================

/**
 * Maps old AFS number → { parent AFS, chapter number } for SPLIT documents.
 * Built from cross-referencing the AFS registry chapters with analysis file
 * "(ersätter AFS YYYY:N)" entries and chapter titles.
 */
export const OLD_AFS_TO_CHAPTER: Record<
  string,
  { parent: string; chapter: number }
> = {
  // AFS 2023:2 chapters (kap. 2-9)
  'AFS 2015:4': { parent: 'AFS 2023:2', chapter: 2 }, // OSA
  'AFS 2020:5': { parent: 'AFS 2023:2', chapter: 3 }, // Arbetsanpassning
  'AFS 1999:7': { parent: 'AFS 2023:2', chapter: 4 }, // Första hjälpen
  'AFS 1993:2': { parent: 'AFS 2023:2', chapter: 5 }, // Våld och hot
  'AFS 1982:3': { parent: 'AFS 2023:2', chapter: 6 }, // Ensamarbete
  'AFS 2007:5': { parent: 'AFS 2023:2', chapter: 7 }, // Gravida
  'AFS 2012:3': { parent: 'AFS 2023:2', chapter: 8 }, // Minderåriga
  'AFS 1982:17': { parent: 'AFS 2023:2', chapter: 9 }, // Anteckningar övertid

  // AFS 2023:9 chapters (kap. 2-6)
  'AFS 2004:3': { parent: 'AFS 2023:9', chapter: 4 }, // Stegar och arbetsbockar

  // AFS 2023:10 chapters (kap. 2-13)
  'AFS 2005:16': { parent: 'AFS 2023:10', chapter: 2 }, // Buller
  'AFS 2005:15': { parent: 'AFS 2023:10', chapter: 3 }, // Vibrationer
  'AFS 1981:14': { parent: 'AFS 2023:10', chapter: 4 }, // Fall
  'AFS 1981:15': { parent: 'AFS 2023:10', chapter: 5 }, // Ras
  'AFS 2012:2': { parent: 'AFS 2023:10', chapter: 6 }, // Belastningsergonomi
  'AFS 2011:19': { parent: 'AFS 2023:10', chapter: 7 }, // Kemiska riskkällor
  'AFS 2015:2': { parent: 'AFS 2023:10', chapter: 8 }, // Kvarts
  'AFS 2004:1': { parent: 'AFS 2023:10', chapter: 8 }, // Syntetiska fibrer (same ch.)
  'AFS 2003:3': { parent: 'AFS 2023:10', chapter: 9 }, // Explosionsfarlig miljö
  'AFS 1992:9': { parent: 'AFS 2023:10', chapter: 9 }, // Smältsvetsning (same ch.)
  'AFS 1988:4': { parent: 'AFS 2023:10', chapter: 10 }, // Blybatterier
  'AFS 1997:7': { parent: 'AFS 2023:10', chapter: 10 }, // Gaser (same ch.)
  'AFS 1998:6': { parent: 'AFS 2023:10', chapter: 10 }, // Bekämpningsmedel (same ch.)
  'AFS 2018:4': { parent: 'AFS 2023:10', chapter: 11 }, // Smittrisker
  'AFS 2009:7': { parent: 'AFS 2023:10', chapter: 12 }, // Artificiell optisk strålning
  'AFS 2016:3': { parent: 'AFS 2023:10', chapter: 13 }, // Elektromagnetiska fält
  'AFS 2018:1': { parent: 'AFS 2023:10', chapter: 7 }, // Gränsvärden (part of kemiska)

  // AFS 2023:11 chapters (kap. 2-15)
  'AFS 2006:4': { parent: 'AFS 2023:11', chapter: 2 }, // Arbetsutrustning
  'AFS 1998:5': { parent: 'AFS 2023:11', chapter: 3 }, // Bildskärmar
  'AFS 2006:5': { parent: 'AFS 2023:11', chapter: 4 }, // Truckar
  'AFS 2012:1': { parent: 'AFS 2023:11', chapter: 5 }, // Motorsågar
  'AFS 2004:3_11': { parent: 'AFS 2023:11', chapter: 7 }, // Stegar (användning) — synthetic key
  'AFS 2013:4': { parent: 'AFS 2023:11', chapter: 8 }, // Ställningar
  'AFS 2017:3': { parent: 'AFS 2023:11', chapter: 9 }, // Trycksatta (användning)
  'AFS 2006:6': { parent: 'AFS 2023:11', chapter: 11 }, // Lyftanordningar
  'AFS 2006:7': { parent: 'AFS 2023:11', chapter: 12 }, // Personlyft
  'AFS 2003:6': { parent: 'AFS 2023:11', chapter: 13 }, // Besiktning lyft
  'AFS 1999:8': { parent: 'AFS 2023:11', chapter: 14 }, // Pressar
  'AFS 2001:3': { parent: 'AFS 2023:11', chapter: 15 }, // PPE

  // AFS 2023:12 — KEEP_WHOLE (no chapter split in DB)
  'AFS 2020:1': { parent: 'AFS 2023:12', chapter: 0 }, // Entire document
  // AFS 1998:5 is mapped to 2023:11 kap. 3 above (bildskärm)
  // The 2023:12 (ersätter AFS 1998:5) entry maps to the same parent (keep-whole)

  // AFS 2023:13 chapters
  'AFS 2006:1': { parent: 'AFS 2023:13', chapter: 3 }, // Asbest
  'AFS 1999:3': { parent: 'AFS 2023:3', chapter: 0 }, // AFS 2023:3 is KEEP_WHOLE

  // AFS 2023:15
  'AFS 2019:3': { parent: 'AFS 2023:15', chapter: 0 }, // SPLIT but only 1 reference
}

// AFS documents with chapter-split in DB (SPLIT tier in registry)
const SPLIT_AFS = new Set([
  'AFS 2023:2',
  'AFS 2023:9',
  'AFS 2023:10',
  'AFS 2023:11',
  'AFS 2023:13',
  'AFS 2023:15',
])

// ============================================================================
// Regulatory Body Mapping
// ============================================================================

export const REGULATORY_BODY_MAP: Record<string, string> = {
  AFS: 'Arbetsmiljöverket',
  BFS: 'Boverket',
  MSBFS: 'MSB',
  'ELSÄK-FS': 'Elsäkerhetsverket',
  'ELSAK-FS': 'Elsäkerhetsverket',
  KIFS: 'Kemikalieinspektionen',
  SKVFS: 'Skatteverket',
  SRVFS: 'Räddningsverket',
  SFS: 'Riksdagen',
  '(EU)': 'EU',
  '(EG)': 'EU',
}

// ============================================================================
// Parsing Helpers
// ============================================================================

export interface AnalysisEntry {
  /** Original SFS/Reference column value, e.g., "AFS 2023:2 (ersätter AFS 2015:4)" */
  fullReference: string
  /** Title from the analysis file */
  title: string
  /** Original section index (ignored for section assignment, used for ordering) */
  originalIndex: string
  /** Section number from analysis file (01-09) */
  originalSection: string
}

/** Extract base document number, stripping (ersätter ...) clause */
export function extractBaseDocumentNumber(ref: string): string {
  return ref.replace(/\s*\(ers[aä]tter\s+.*?\)\s*$/i, '').trim()
}

/** Extract the old AFS reference from (ersätter ...) clause */
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
  let normalized = ref.replace('ELSAK-FS', 'ELSÄK-FS')
  // Strip " - OVK 1" or similar suffixes
  normalized = normalized.replace(/\s+-\s+OVK\s+\d+$/i, '')
  return normalized.trim()
}

/**
 * Resolve the DB document_number for an analysis entry.
 * For SPLIT AFS documents, maps to chapter-level entries.
 */
export function resolveDocumentNumber(entry: AnalysisEntry): string {
  const base = normalizeDocumentNumber(
    extractBaseDocumentNumber(entry.fullReference)
  )
  const oldRef = extractReplacesReference(entry.fullReference)

  // For AFS entries with (ersätter ...) and a SPLIT parent, resolve to chapter
  if (oldRef && SPLIT_AFS.has(base)) {
    // Handle special case: AFS 2004:3 appears in both AFS 2023:9 and AFS 2023:11
    // Disambiguate by checking which parent the entry's base number points to
    let lookupKey = oldRef
    if (oldRef === 'AFS 2004:3' && base === 'AFS 2023:11') {
      lookupKey = 'AFS 2004:3_11'
    }
    // Also AFS 2017:3 appears in AFS 2023:9 (kap. 6) and AFS 2023:11 (kap. 9)
    if (oldRef === 'AFS 2017:3' && base === 'AFS 2023:9') {
      return `${base} kap. 6` // Trycksatta (produkt)
    }

    const mapping = OLD_AFS_TO_CHAPTER[lookupKey]
    if (mapping && mapping.parent === base && mapping.chapter > 0) {
      return `${base} kap. ${mapping.chapter}`
    }
  }

  // For AFS 2023:12 (KEEP_WHOLE) with (ersätter AFS 1998:5), the bildskärm provision
  // maps to AFS 2023:12 as a whole — but there's also an AFS 2023:11 entry for bildskärm.
  // The 2023:12 entry is about belysning vid bildskärm (lighting), 2023:11 is about usage.
  // Both are separate references. AFS 2023:12 is KEEP_WHOLE so use base.
  if (base === 'AFS 2023:12') {
    return base
  }

  return base
}

/** Classify source_type from document_number and title */
export function classifySourceType(docNumber: string, title: string): string {
  if (docNumber.startsWith('(EU)') || docNumber.startsWith('(EG)')) {
    return 'eu-forordning'
  }
  if (docNumber.startsWith('AFS')) return 'foreskrift'
  if (docNumber.startsWith('BFS')) return 'foreskrift'
  if (docNumber.startsWith('MSBFS')) return 'foreskrift'
  if (docNumber.startsWith('ELSAK-FS') || docNumber.startsWith('ELSÄK-FS'))
    return 'foreskrift'
  if (docNumber.startsWith('KIFS')) return 'foreskrift'
  if (docNumber.startsWith('SKVFS')) return 'foreskrift'
  if (docNumber.startsWith('SRVFS')) return 'allmanna-rad'

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
  if (docNumber.startsWith('AFS')) return REGULATORY_BODY_MAP['AFS']!
  if (docNumber.startsWith('BFS')) return REGULATORY_BODY_MAP['BFS']!
  if (docNumber.startsWith('MSBFS')) return REGULATORY_BODY_MAP['MSBFS']!
  if (docNumber.startsWith('ELSAK-FS') || docNumber.startsWith('ELSÄK-FS'))
    return REGULATORY_BODY_MAP['ELSÄK-FS']!
  if (docNumber.startsWith('KIFS')) return REGULATORY_BODY_MAP['KIFS']!
  if (docNumber.startsWith('SKVFS')) return REGULATORY_BODY_MAP['SKVFS']!
  if (docNumber.startsWith('SRVFS')) return REGULATORY_BODY_MAP['SRVFS']!
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
  const match = content.match(/total_documents:\s*(\d+)/)
  return {
    totalDocuments: match ? parseInt(match[1]!, 10) : 0,
  }
}

/**
 * Parse all document entries from the analysis markdown file.
 * Extracts rows from markdown tables across all 9 sections.
 */
export function parseAnalysisFile(filePath: string): AnalysisEntry[] {
  const content = fs.readFileSync(filePath, 'utf8')
  const entries: AnalysisEntry[] = []
  let currentSection = ''

  for (const line of content.split('\n')) {
    // Track current section
    const sectionMatch = line.match(/^###\s+\d+\.(\d+)\s+/)
    if (sectionMatch) {
      // Extract section number like "2.1" → "01", "2.2" → "02", etc.
      const subNum = parseInt(sectionMatch[1]!, 10)
      currentSection = String(subNum).padStart(2, '0')
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
      refCell.includes('SFS/Reference') ||
      refCell.includes('Index')
    )
      continue

    // Must be a valid document reference
    const isDocRef =
      refCell.startsWith('SFS') ||
      refCell.startsWith('(EU)') ||
      refCell.startsWith('(EG)') ||
      refCell.startsWith('AFS') ||
      refCell.startsWith('BFS') ||
      refCell.startsWith('MSBFS') ||
      refCell.startsWith('ELSAK-FS') ||
      refCell.startsWith('ELSÄK-FS') ||
      refCell.startsWith('KIFS') ||
      refCell.startsWith('SKVFS') ||
      refCell.startsWith('SRVFS')
    if (!isDocRef) continue

    entries.push({
      fullReference: refCell,
      title: titleCell,
      originalIndex: indexCell,
      originalSection: currentSection,
    })
  }

  return entries
}

/**
 * Parse the tjänsteföretag file to get the 55 service-company document_numbers.
 * Returns a Set of normalized document references for matching.
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

    // The table format differs: | # | SFS/AFS Number | Title | Amendment |
    const refCell = cells[1] ?? ''
    if (
      refCell.includes('---') ||
      refCell.includes('SFS/AFS') ||
      refCell.includes('Number') ||
      refCell.includes('#')
    )
      continue

    const isDocRef =
      refCell.startsWith('SFS') ||
      refCell.startsWith('(EU)') ||
      refCell.startsWith('(EG)') ||
      refCell.startsWith('AFS') ||
      refCell.startsWith('BFS') ||
      refCell.startsWith('MSBFS') ||
      refCell.startsWith('ELSAK-FS') ||
      refCell.startsWith('ELSÄK-FS') ||
      refCell.startsWith('KIFS') ||
      refCell.startsWith('SKVFS') ||
      refCell.startsWith('SRVFS')
    if (!isDocRef) continue

    // Store normalized reference for fuzzy matching across files
    // (file 01 uses ASCII "ersatter", file 02 uses Swedish "ersätter")
    refs.add(normalizeForMatching(refCell))
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

export function parseCsvForArbetsmiljo(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n').slice(1) // skip header
  const rows: CsvRow[] = []

  for (const line of lines) {
    if (!line.trim()) continue
    const fields = parseCsvLine(line)
    const laglista = (fields[0] ?? '').trim()
    if (laglista !== 'Arbetsmiljö') continue

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
 * Sets of full reference strings from the analysis file that appear
 * in both Arbetsmiljö and the other list.
 *
 * Note: "arbetsmiljo-tjansteforetag" overlap is handled via
 * is_service_company_relevant flag, not cross_list_references.
 */
export const CROSS_LIST_OVERLAPS: Record<string, Set<string>> = {
  miljo: new Set([
    '(EG) nr 1272/2008',
    '(EG) nr 1907/2006',
    '(EU) nr 1021/2019',
    'BFS 2011:16 - OVK 1',
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
  'miljo-sverige': new Set([
    '(EU) nr 679/2016',
    'AFS 2023:1 (ersätter AFS 2001:1)',
    'AFS 2023:10 (ersätter AFS 2005:16)',
    'AFS 2023:11 (ersätter AFS 2006:4)',
    'AFS 2023:12 (ersätter AFS 2020:1)',
    'AFS 2023:15 (ersätter AFS 2019:3)',
    'AFS 2023:2 (ersätter AFS 1982:17)',
    'AFS 2023:2 (ersätter AFS 1999:7)',
    'AFS 2023:2 (ersätter AFS 2007:5)',
    'AFS 2023:2 (ersätter AFS 2012:3)',
    'AFS 2023:2 (ersätter AFS 2015:4)',
    'AFS 2023:2 (ersätter AFS 2020:5)',
    'SFS 1974:358',
    'SFS 1974:981',
    'SFS 1976:580',
    'SFS 1977:1160',
    'SFS 1977:1166',
    'SFS 1977:284',
    'SFS 1977:480',
    'SFS 1982:673',
    'SFS 1982:80',
    'SFS 1986:163',
    'SFS 1988:1465',
    'SFS 1991:1046',
    'SFS 1991:1047',
    'SFS 1995:584',
    'SFS 1998:209',
    'SFS 2002:293',
    'SFS 2005:395',
    'SFS 2008:565',
    'SFS 2008:567',
    'SFS 2012:854',
    'SFS 2017:319',
    'SFS 2018:218',
    'SFS 2021:890',
    'SFS 2022:469',
    'SKVFS 2015:6',
  ]),
  'miljo-tjansteforetag': new Set([
    '(EG) nr 1272/2008',
    '(EG) nr 1907/2006',
    'BFS 2011:16 - OVK 1',
    'KIFS 2017:7',
    'MSBFS 2020:1',
    'MSBFS 2023:2',
    'SFS 2003:778',
    'SFS 2007:19',
    'SFS 2010:1011',
    'SFS 2010:1075',
    'SRVFS 2004:3',
  ]),
  'fastighet-bygg': new Set([
    'AFS 2023:11 (ersätter AFS 2013:4)',
    'AFS 2023:12 (ersätter AFS 2020:1)',
    'AFS 2023:3 (ersätter AFS 1999:3)',
    'BFS 2011:16 - OVK 1',
    'ELSÄK-FS 2022:1',
    'SFS 2007:19',
    'SFS 2016:732',
    'SFS 2018:396',
    'SFS 2021:890',
  ]),
  halsa: new Set([
    '(EU) nr 679/2016',
    'SFS 2008:567',
    'SFS 2018:218',
    'SFS 2021:890',
  ]),
  infosak: new Set(['(EU) nr 679/2016', 'SFS 2018:218']),
  livsmedel: new Set(['SKVFS 2015:6']),
}

/**
 * Get cross_list_references for a given analysis entry.
 * Matches by the full reference string (including ersätter notation)
 * and also by base document number for non-AFS entries.
 */
export function getCrossListReferences(entry: AnalysisEntry): string[] {
  const refs: string[] = []
  const baseRef = normalizeDocumentNumber(
    extractBaseDocumentNumber(entry.fullReference)
  )

  for (const [slug, docSet] of Object.entries(CROSS_LIST_OVERLAPS)) {
    // Check full reference match (including ersätter)
    if (docSet.has(entry.fullReference)) {
      refs.push(slug)
      continue
    }
    // Also check by base reference for non-AFS entries
    // (cross-list data uses base refs for SFS/EU/MSBFS etc.)
    if (!entry.fullReference.startsWith('AFS') && docSet.has(baseRef)) {
      refs.push(slug)
      continue
    }
    // Check with ELSAK-FS normalization
    if (
      entry.fullReference.includes('ELSAK-FS') ||
      entry.fullReference.includes('ELSÄK-FS')
    ) {
      const normalized = entry.fullReference.replace('ELSAK-FS', 'ELSÄK-FS')
      if (docSet.has(normalized)) {
        refs.push(slug)
      }
    }
  }

  return refs.sort()
}

// ============================================================================
// EU Document Lookup Helper
// ============================================================================

/**
 * Convert EU CSV format to CELEX number for DB lookup.
 * e.g., "(EU) nr 679/2016" → "32016R0679"
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
  // Try to find existing user
  const existingUser = await prisma.user.findFirst({
    select: { id: true },
    orderBy: { created_at: 'asc' },
  })
  if (existingUser) return existingUser.id

  // Create system user
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
      // Find a match that also contains the year
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
  console.log('Seed Arbetsmiljö Template (Story 12.4)')
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

  const csvRows = parseCsvForArbetsmiljo(CSV_FILE)
  console.log(`  CSV: ${csvRows.length} Arbetsmiljö rows`)
  console.log()

  // ── Step 2: Create/upsert LawListTemplate ──────────────────────────────
  console.log('--- Step 2: Creating LawListTemplate ---')
  const userId = config.dryRun ? 'dry-run-user' : await findOrCreateSystemUser()

  let templateId = 'dry-run-template'
  if (!config.dryRun) {
    // Check if template exists
    const existing = await prisma.lawListTemplate.findUnique({
      where: { slug: 'arbetsmiljo' },
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
      where: { slug: 'arbetsmiljo' },
      update: {
        name: 'Arbetsmiljö',
        domain: 'arbetsmiljo',
        target_audience: 'Alla svenska arbetsgivare oavsett bransch',
        primary_regulatory_bodies: ['Arbetsmiljöverket', 'Riksdagen', 'EU'],
        status: 'DRAFT',
        version: 1,
        document_count: frontmatter.totalDocuments,
        section_count: 1,
        is_variant: false,
        parent_template_id: null,
        created_by: userId,
      },
      create: {
        name: 'Arbetsmiljö',
        slug: 'arbetsmiljo',
        domain: 'arbetsmiljo',
        target_audience: 'Alla svenska arbetsgivare oavsett bransch',
        primary_regulatory_bodies: ['Arbetsmiljöverket', 'Riksdagen', 'EU'],
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
    console.log('  [DRY RUN] Would create template: Arbetsmiljö')
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
    const resolvedDocNumber = resolveDocumentNumber(entry)
    const replaces = extractReplacesReference(entry.fullReference)

    // Check if this is a service-company-relevant document
    // Use normalized matching to handle ä/a encoding differences between files
    const isServiceCompanyRelevant = serviceCompanyRefs.has(
      normalizeForMatching(entry.fullReference)
    )

    // Look up document in DB
    const doc = config.dryRun
      ? { id: `mock-doc-${i}`, summary: 'mock', kommentar: 'mock' }
      : await lookupDocument(resolvedDocNumber, entry.fullReference)

    if (!doc) {
      missingDocuments.push(
        `${entry.fullReference} → ${resolvedDocNumber} (NOT FOUND)`
      )
      console.log(
        `  WARNING: Missing document: ${entry.fullReference} → ${resolvedDocNumber}`
      )
      continue
    }

    // Check for duplicate document_id
    if (usedDocumentIds.has(doc.id)) {
      duplicateDocuments.push(
        `${entry.fullReference} → ${resolvedDocNumber} (duplicate of existing item)`
      )
      console.log(
        `  SKIP: Duplicate document_id for ${entry.fullReference} → ${resolvedDocNumber}`
      )
      continue
    }
    usedDocumentIds.add(doc.id)

    // Track content status
    if (doc.summary) {
      contentVerification.withSummary++
    } else {
      contentVerification.missingSummary.push(resolvedDocNumber)
    }
    if (doc.kommentar) {
      contentVerification.withKommentar++
    } else {
      contentVerification.missingKommentar.push(resolvedDocNumber)
    }

    // Determine cross-list references
    const crossListRefs = getCrossListReferences(entry)

    // Assign sequential index
    itemIndex++
    const index = String(itemIndex).padStart(3, '0')

    const sourceType = classifySourceType(
      extractBaseDocumentNumber(entry.fullReference),
      entry.title
    )
    const regulatoryBody = getRegulatoryBody(
      extractBaseDocumentNumber(entry.fullReference)
    )

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
          replaces_old_reference: replaces ?? null,
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
          replaces_old_reference: replaces ?? null,
          cross_list_references: crossListRefs,
          content_status: doc.summary ? 'AI_GENERATED' : 'STUB',
        },
      })
    }

    if (itemIndex % 20 === 0 || itemIndex === 1) {
      console.log(
        `  [${itemIndex}] ${index}: ${entry.fullReference.substring(0, 50)} → ${resolvedDocNumber}`
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
  const serviceCompanyCount = analysisEntries.filter((e) =>
    serviceCompanyRefs.has(normalizeForMatching(e.fullReference))
  ).length
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
