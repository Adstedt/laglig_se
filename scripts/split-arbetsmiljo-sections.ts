#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Split the Arbetsmiljö template from 1 placeholder section ("Alla bestämmelser")
 * into 8 thematic sections optimized for SMB compliance officers.
 *
 * Usage:
 *   npx tsx scripts/split-arbetsmiljo-sections.ts --dry-run
 *   npx tsx scripts/split-arbetsmiljo-sections.ts
 */

import { PrismaClient } from '@prisma/client'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import * as path from 'node:path'
import { config } from 'dotenv'
config({ path: resolve(process.cwd(), '.env.local') })

import {
  parseAnalysisFile,
  resolveDocumentNumber,
  csvEuToCelex,
  type AnalysisEntry,
} from './seed-arbetsmiljo-template'

const prisma = new PrismaClient()

// ============================================================================
// Configuration
// ============================================================================

export interface SplitConfig {
  dryRun: boolean
}

export function parseArgs(): SplitConfig {
  const args = process.argv.slice(2)
  return { dryRun: args.includes('--dry-run') }
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

// ============================================================================
// Section Definitions
// ============================================================================

export interface SectionDefinition {
  number: string
  name: string
  description: string
  position: number
}

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    number: '01',
    name: 'Alla arbetsgivares skyldigheter',
    description:
      'Grundläggande lagar och regler som gäller alla arbetsgivare oavsett bransch — arbetsmiljölagen, systematiskt arbetsmiljöarbete, organisatorisk och social arbetsmiljö, medicinska kontroller och första hjälpen.',
    position: 1,
  },
  {
    number: '02',
    name: 'Anställda, rättigheter & HR',
    description:
      'Regler kring anställningsförhållanden, dataskydd, diskriminering, arbetstid, ledigheter, visselblåsning och fackliga rättigheter. Relevant för alla som arbetar med personalfrågor.',
    position: 2,
  },
  {
    number: '03',
    name: 'Arbetsplatsen & dess utformning',
    description:
      'Krav på arbetsplatsens fysiska utformning, skydd vid fall och ras, samt särskilda regler för gravida, minderåriga, ensamarbetare och inhyrd personal. Inkluderar även byggarbetsmiljösamordning och våld och hot.',
    position: 3,
  },
  {
    number: '04',
    name: 'Ergonomi & fysiska belastningar',
    description:
      'Regler om ergonomi, buller, vibrationer, ventilation, elektromagnetiska fält och personlig skyddsutrustning — fysiska faktorer som påverkar hälsan på arbetsplatsen.',
    position: 4,
  },
  {
    number: '05',
    name: 'Maskiner, lyft & teknisk utrustning',
    description:
      'Säkerhetskrav för maskiner, truckar, bildskärmsarbete, stegar, ställningar, lyftanordningar, motorsågar, pressar och tryckkärl. Gäller både produktkrav och användning.',
    position: 5,
  },
  {
    number: '06',
    name: 'Farliga ämnen & exponeringar',
    description:
      'Kemiska, biologiska och fysikaliska hälsorisker — kemikaliehantering, REACH, CLP, asbest, kvarts, gaser, svetsning, strålskydd, smitta och gränsvärden för luftföroreningar.',
    position: 6,
  },
  {
    number: '07',
    name: 'Brand, el & installationssäkerhet',
    description:
      'Brandskydd, hantering av brandfarliga och explosiva varor, elsäkerhet och krav på elinstallationer. Samlade regler för den som ansvarar för fastighet och anläggning.',
    position: 7,
  },
  {
    number: '08',
    name: 'Transport, kör- & vilotider',
    description:
      'Regler för transport av farligt gods, kör- och vilotider, färdskrivare och utstationering av arbetstagare. Relevant för verksamheter med yrkesförare eller godstransporter.',
    position: 8,
  },
]

// ============================================================================
// Routing Maps
// ============================================================================

/**
 * Maps Notisum section numbers (01-08) to new section numbers.
 * S06→07 (brand merged with el), S07→07, S08→06 (chemicals renamed)
 */
export const NOTISUM_TO_NEW_SECTION: Record<string, string> = {
  '01': '01',
  '02': '02',
  '03': '03',
  '04': '04',
  '05': '05',
  '06': '07', // Brand → Brand, el & installationssäkerhet (merged)
  '07': '07', // El → Brand, el & installationssäkerhet (merged)
  '08': '06', // Kemiska risker → Farliga ämnen & exponeringar (renamed)
}

/**
 * Overrides for specific entries within Notisum S01-S08.
 * Keyed by fullReference. Takes priority over NOTISUM_TO_NEW_SECTION.
 */
export const SECTION_OVERRIDES: Record<string, string> = {
  // EM fields from Notisum S07 → our S04 (physical exposure hazard, not installation)
  'AFS 2023:10 (ersatter AFS 2016:3)': '04',
}

/**
 * Routes each Section 09 document to a specific new section.
 * Keyed by fullReference from the analysis file (ASCII encoding).
 * All 43 S09 entries must be accounted for here.
 */
export const SECTION_09_ROUTING: Record<string, string> = {
  // → 02 (HR)
  'SKVFS 2015:6': '02',

  // → 03 (Arbetsplats)
  'AFS 2023:2 (ersatter AFS 1993:2)': '03',

  // → 05 (Maskiner)
  'AFS 2023:5': '05',
  'AFS 2023:11 (ersatter AFS 2013:4)': '05',
  'AFS 2023:11 (ersatter AFS 2012:1)': '05',
  'AFS 2023:11 (ersatter AFS 2006:7)': '05',
  'AFS 2023:11 (ersatter AFS 2006:6)': '05',
  'AFS 2023:11 (ersatter AFS 2003:6)': '05',
  'AFS 2023:11 (ersatter AFS 1999:8)': '05',
  'AFS 2023:11': '05',

  // → 06 (Farliga ämnen)
  'AFS 2023:10 (ersatter AFS 2018:4)': '06', // smittrisker
  'AFS 2023:10 (ersatter AFS 2018:1)': '06', // gränsvärden
  'AFS 2023:10 (ersatter AFS 2015:2)': '06', // kvarts
  'AFS 2023:10 (ersatter AFS 2009:7)': '06', // optisk strålning
  'AFS 2023:10 (ersatter AFS 2004:1)': '06', // syntetiska fibrer
  'AFS 2023:10 (ersatter AFS 2003:3)': '06', // explosionsfarlig
  'AFS 2023:10 (ersatter AFS 1998:6)': '06', // bekämpningsmedel
  'AFS 2023:10 (ersatter AFS 1997:7)': '06', // gaser
  'AFS 2023:10 (ersatter AFS 1992:9)': '06', // svetsning
  'AFS 2023:13 (ersatter AFS 2006:1)': '06', // asbest
  'AFS 2023:14 (ersatter AFS 2018:1)': '06', // gränsvärden (separate AFS)
  '(EU) nr 1021/2019': '06', // POPs
  'KIFS 2022:3': '06', // bekämpningsmedel
  'SFS 2007:19': '06', // PCB
  'SFS 2018:396': '06', // strålskyddslag
  'SFS 2018:506': '06', // strålskyddsförordning

  // → 07 (Brand/el)
  'SFS 2003:789': '07', // skydd mot olyckor förordning
  'MSBFS 2013:3': '07', // tillstånd brandfarliga
  'MSBFS 2025:2': '07', // explosiva varor
  'ELSAK-FS 2017:2': '07', // elinstallationsarbete
  'ELSAK-FS 2017:3': '07', // elinstallationsföretag

  // → 08 (Transport)
  'SFS 1999:678': '08', // utstationering
  'SFS 1994:1297': '08', // vilotider
  'SFS 2004:865': '08', // kör- och vilotider
  'SFS 2005:395': '08', // arbetstid vägtransport
  'SFS 2006:263': '08', // transport farligt gods lag
  'SFS 2006:311': '08', // transport farligt gods förordning
  'SFS 2017:319': '08', // utstationering förordning
  'SFS 2022:469': '08', // utstationering förare
  '(EG) nr 561/2006': '08', // kör- och vilotider EU
  '(EU) nr 165/2014': '08', // färdskrivare EU
  'MSBFS 2015:9': '08', // säkerhetsrådgivare transport
  'MSBFS 2024:10': '08', // ADR-S
}

// ============================================================================
// Routing Logic
// ============================================================================

/**
 * Determine the new section number for an analysis entry.
 * Priority: S09 routing > specific overrides > Notisum section map
 */
export function getNewSectionNumber(entry: AnalysisEntry): string {
  // S09: route individual documents
  if (entry.originalSection === '09') {
    const route = SECTION_09_ROUTING[entry.fullReference]
    if (route) return route
    throw new Error(
      `No routing defined for S09 entry: "${entry.fullReference}"`
    )
  }

  // Check overrides (e.g., EM fields from S07 → S04)
  const override = SECTION_OVERRIDES[entry.fullReference]
  if (override) return override

  // Default Notisum mapping
  const mapped = NOTISUM_TO_NEW_SECTION[entry.originalSection]
  if (mapped) return mapped

  throw new Error(
    `No mapping for Notisum section ${entry.originalSection}: "${entry.fullReference}"`
  )
}

// ============================================================================
// Split Logic
// ============================================================================

export interface SplitResult {
  sectionsCreated: number
  itemsUpdated: number
  itemsUnmatched: number
  unmatchedDocNumbers: string[]
  sectionCounts: Record<string, number>
}

export async function splitSections(config: SplitConfig): Promise<SplitResult> {
  const startTime = Date.now()
  console.log('='.repeat(60))
  console.log('Split Arbetsmiljö Template into 8 Sections')
  console.log('='.repeat(60))
  console.log(`Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log()

  // ── Step 1: Parse analysis file and build routing map ──────────────────
  console.log('--- Step 1: Building routing map ---')
  const entries = parseAnalysisFile(ANALYSIS_FILE)
  console.log(`  Parsed ${entries.length} entries from analysis file`)

  // Build map: resolved_document_number → new_section_number
  const docToSection = new Map<string, string>()
  const sectionAssignments: Record<string, string[]> = {}

  for (const entry of entries) {
    const newSection = getNewSectionNumber(entry)
    const docNumber = resolveDocumentNumber(entry)

    // First mapping wins (duplicates resolve to same doc, already handled by seed)
    if (!docToSection.has(docNumber)) {
      docToSection.set(docNumber, newSection)
    }

    // EU documents are stored in DB with CELEX numbers (e.g., "32016R0679")
    // but resolveDocumentNumber returns text format (e.g., "(EU) nr 679/2016").
    // Add CELEX key so we can match DB records.
    const celex = csvEuToCelex(entry.fullReference)
    if (celex && !docToSection.has(celex)) {
      docToSection.set(celex, newSection)
    }

    if (!sectionAssignments[newSection]) {
      sectionAssignments[newSection] = []
    }
    sectionAssignments[newSection]!.push(entry.fullReference)
  }

  console.log(`  Routing map: ${docToSection.size} unique document numbers`)
  for (const def of SECTION_DEFINITIONS) {
    const count = sectionAssignments[def.number]?.length ?? 0
    console.log(`    S${def.number} ${def.name}: ${count} entries`)
  }
  console.log()

  // ── Step 2: Fetch template and items ───────────────────────────────────
  console.log('--- Step 2: Fetching template and items ---')

  const template = config.dryRun
    ? null
    : await prisma.lawListTemplate.findUnique({
        where: { slug: 'arbetsmiljo' },
        include: {
          sections: true,
          items: {
            include: {
              document: {
                select: { id: true, document_number: true },
              },
            },
          },
        },
      })

  if (!config.dryRun && !template) {
    throw new Error('Template "arbetsmiljo" not found. Run seed script first.')
  }

  const items = template?.items ?? []
  console.log(`  Template items: ${items.length}`)
  console.log(`  Existing sections: ${template?.sections.length ?? 0}`)
  console.log()

  // ── Step 3: Create/upsert 8 sections ──────────────────────────────────
  console.log('--- Step 3: Creating 8 sections ---')
  const sectionIdMap = new Map<string, string>() // section_number → section_id

  for (const def of SECTION_DEFINITIONS) {
    if (!config.dryRun) {
      const section = await prisma.templateSection.upsert({
        where: {
          template_id_section_number: {
            template_id: template!.id,
            section_number: def.number,
          },
        },
        update: {
          name: def.name,
          description: def.description,
          position: def.position,
        },
        create: {
          template_id: template!.id,
          section_number: def.number,
          name: def.name,
          description: def.description,
          position: def.position,
        },
      })
      sectionIdMap.set(def.number, section.id)
      console.log(`  S${def.number}: ${def.name} (${section.id})`)
    } else {
      sectionIdMap.set(def.number, `dry-run-section-${def.number}`)
      console.log(`  [DRY RUN] S${def.number}: ${def.name}`)
    }
  }
  console.log()

  // ── Step 4: Update items' section_id ──────────────────────────────────
  console.log('--- Step 4: Updating items ---')
  let itemsUpdated = 0
  const unmatchedDocNumbers: string[] = []
  const sectionCounts: Record<string, number> = {}
  const positionCounters: Record<string, number> = {}

  for (const def of SECTION_DEFINITIONS) {
    sectionCounts[def.number] = 0
    positionCounters[def.number] = 0
  }

  for (const item of items) {
    const docNumber = item.document.document_number
    const newSectionNumber = docToSection.get(docNumber)

    if (!newSectionNumber) {
      unmatchedDocNumbers.push(docNumber)
      console.log(`  WARNING: No routing for document: ${docNumber}`)
      continue
    }

    const newSectionId = sectionIdMap.get(newSectionNumber)
    if (!newSectionId) {
      console.log(`  ERROR: No section_id for section ${newSectionNumber}`)
      continue
    }

    positionCounters[newSectionNumber] =
      (positionCounters[newSectionNumber] ?? 0) + 1
    sectionCounts[newSectionNumber] = (sectionCounts[newSectionNumber] ?? 0) + 1

    if (!config.dryRun) {
      await prisma.templateItem.update({
        where: { id: item.id },
        data: {
          section_id: newSectionId,
          position: positionCounters[newSectionNumber]!,
        },
      })
    }
    itemsUpdated++
  }

  console.log(`  Items updated: ${itemsUpdated}`)
  if (unmatchedDocNumbers.length > 0) {
    console.log(`  Unmatched: ${unmatchedDocNumbers.length}`)
    for (const doc of unmatchedDocNumbers) {
      console.log(`    - ${doc}`)
    }
  }
  console.log()

  // ── Step 5: Clean up old sections ──────────────────────────────────────
  console.log('--- Step 5: Cleaning up ---')
  if (!config.dryRun && template) {
    const newSectionNumbers = new Set(SECTION_DEFINITIONS.map((d) => d.number))
    for (const oldSection of template.sections) {
      if (!newSectionNumbers.has(oldSection.section_number)) {
        const remainingItems = await prisma.templateItem.count({
          where: { section_id: oldSection.id },
        })
        if (remainingItems === 0) {
          await prisma.templateSection.delete({
            where: { id: oldSection.id },
          })
          console.log(
            `  Deleted old section: ${oldSection.section_number} "${oldSection.name}"`
          )
        } else {
          console.log(
            `  WARNING: Old section ${oldSection.section_number} still has ${remainingItems} items`
          )
        }
      }
    }
  }

  // ── Step 6: Update counts ─────────────────────────────────────────────
  console.log('--- Step 6: Updating counts ---')
  for (const def of SECTION_DEFINITIONS) {
    const count = sectionCounts[def.number] ?? 0
    if (!config.dryRun) {
      const sectionId = sectionIdMap.get(def.number)!
      await prisma.templateSection.update({
        where: { id: sectionId },
        data: { item_count: count },
      })
    }
    console.log(`  S${def.number}: ${count} items`)
  }

  if (!config.dryRun && template) {
    await prisma.lawListTemplate.update({
      where: { id: template.id },
      data: { section_count: SECTION_DEFINITIONS.length },
    })
  }
  console.log(`  Template section_count: ${SECTION_DEFINITIONS.length}`)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log()
  console.log('='.repeat(60))
  console.log(
    `Done in ${elapsed}s — ${itemsUpdated} items across ${SECTION_DEFINITIONS.length} sections`
  )
  console.log('='.repeat(60))

  return {
    sectionsCreated: SECTION_DEFINITIONS.length,
    itemsUpdated,
    itemsUnmatched: unmatchedDocNumbers.length,
    unmatchedDocNumbers,
    sectionCounts,
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const config = parseArgs()
  await splitSections(config)
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
