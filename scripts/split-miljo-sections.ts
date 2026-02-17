#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Split the Miljö template from 1 placeholder section ("Alla bestämmelser")
 * into 9 thematic sections optimized for SMB compliance officers.
 *
 * Follows the same pattern as split-arbetsmiljo-sections.ts:
 * - Merges Notisum S07 (Brand/explosiva) + S08 (Brandskydd) → our S07
 * - Dissolves Notisum S09 (47-doc catch-all) into thematic sections
 * - Creates 2 new sections: S08 (Strålskydd) + S09 (Klimat & hållbarhet)
 *
 * Usage:
 *   npx tsx scripts/split-miljo-sections.ts --dry-run
 *   npx tsx scripts/split-miljo-sections.ts
 */

import { PrismaClient } from '@prisma/client'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import * as path from 'node:path'
import { config } from 'dotenv'
config({ path: resolve(process.cwd(), '.env.local') })

import {
  parseAnalysisFile,
  normalizeDocumentNumber,
  csvEuToCelex,
  type AnalysisEntry,
} from './seed-miljo-template'

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
const ANALYSIS_FILE = path.join(ANALYSIS_DIR, '03-miljo.md')

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
    name: 'Övergripande miljölagstiftning',
    description:
      'Grundläggande ramverk för alla organisationer med miljöpåverkan — Miljöbalken, plan- och bygglagstiftning, miljösanktionsavgifter, årsredovisningens hållbarhetskrav, marknadsföring med miljöpåståenden, energideklarationer och rapporteringsskyldigheter.',
    position: 1,
  },
  {
    number: '02',
    name: 'Avfall, återvinning & producentansvar',
    description:
      'Hela avfallskedjan från klassificering och spårning till deponering, transport och rapportering. Inkluderar producentansvar för förpackningar, batterier, elutrustning, engångsplast och den nya EU-förpackningsförordningen.',
    position: 2,
  },
  {
    number: '03',
    name: 'Kemikalier, bekämpningsmedel & farliga ämnen',
    description:
      'Kemikaliehantering i hela leveranskedjan — REACH-registrering, CLP-klassificering, POPs, produktanmälan, PCB-sanering, bekämpningsmedel och biocider, organiska lösningsmedel, kemikalieskatt samt import- och exportkontroll av farliga kemikalier.',
    position: 3,
  },
  {
    number: '04',
    name: 'Tillstånd, miljöprövning & egenkontroll',
    description:
      'Regler för tillståndspliktiga och anmälningspliktiga verksamheter — industriutsläpp, miljöbedömning, verksamhetsklassificering, tillsynsavgifter, miljörapportering, egenkontroll, mätning och provtagning, utsläppsregister och ackreditering.',
    position: 4,
  },
  {
    number: '05',
    name: 'Utsläpp & emissioner',
    description:
      'Kontroll av utsläpp till luft, vatten och mark — fluorerade växthusgaser, ozonnedbrytande ämnen, avgasrening, ventilationskontroll och medelstora förbränningsanläggningar.',
    position: 5,
  },
  {
    number: '06',
    name: 'Transport av farligt gods',
    description:
      'Regler för väg- och järnvägstransport av farligt gods — ramlag och förordning, ADR-S detaljregler, säkerhetsrådgivare och transportabla tryckbärande anordningar.',
    position: 6,
  },
  {
    number: '07',
    name: 'Brand, explosion & räddningstjänst',
    description:
      'Samlad reglering för brand- och explosionssäkerhet — hantering av brandfarliga och explosiva varor, tillståndsplikt, ATEX-zonindelning, cisterner, sotning och brandskyddskontroll, systematiskt brandskyddsarbete, Seveso-regler för allvarliga kemikalieolyckor och räddningstjänstens ramlag.',
    position: 7,
  },
  {
    number: '08',
    name: 'Strålskydd',
    description:
      'Strålskyddslagstiftning — ramlag, förordning, anmälningsplikt för verksamheter med strålning samt hantering av naturligt förekommande radioaktivt avfall.',
    position: 8,
  },
  {
    number: '09',
    name: 'Klimat, energi & hållbarhetsrapportering',
    description:
      'Klimatrelaterade skyldigheter och hållbarhetsrapportering — EU:s taxonomi, CBAM gränsjusteringsmekanism, ESRS rapporteringsstandarder, klimatdeklarationer för byggnader, energikartläggning, ekodesign och avskogningsfria leveranskedjor.',
    position: 9,
  },
]

// ============================================================================
// Routing Maps
// ============================================================================

/**
 * Maps Notisum section numbers (01-09) to new section numbers.
 * S01-S07 stay 1:1. S08 merges into S07 (brand + brandskydd).
 * S09 is dissolved — each doc routed individually via SECTION_09_ROUTING.
 */
export const NOTISUM_TO_NEW_SECTION: Record<string, string> = {
  '01': '01', // Övergripande → Övergripande
  '02': '02', // Avfall → Avfall
  '03': '03', // Kemikalier → Kemikalier
  '04': '04', // Tillstånd → Tillstånd
  '05': '05', // Utsläpp → Utsläpp
  '06': '06', // Transport → Transport
  '07': '07', // Brand/explosiva → Brand, explosion & räddningstjänst
  '08': '07', // Brandskydd → MERGE into Brand, explosion & räddningstjänst
}

/**
 * Routes each Section 09 document to a specific new section.
 * Keyed by fullReference from the analysis file.
 * All 47 S09 entries must be accounted for here.
 */
export const SECTION_09_ROUTING: Record<string, string> = {
  // → 01 (Övergripande)
  'NFS 2004:15': '01', // buller från byggplatser — adjacent to plan- och bygglag

  // → 02 (Avfall & producentansvar)
  'SFS 2001:512': '02', // deponering av avfall
  'NFS 2004:10': '02', // deponering, mottagningskriterier
  'SFS 2008:834': '02', // producentansvar batterier
  'SFS 2012:861': '02', // RoHS — farliga ämnen i elektronik
  'SFS 2021:1002': '02', // producentansvar elutrustning
  'SFS 2021:996': '02', // engångsplastprodukter
  'SFS 2022:1276': '02', // producentansvar elutrustning (kompletterande)
  '(EU) nr 1542/2023': '02', // EU-batteriförordning

  // → 03 (Kemikalier)
  'SFS 1998:944': '03', // förbud kemiska produkter
  '(EG) nr 440/2008': '03', // REACH testmetoder
  '(EU) nr 649/2012': '03', // PIC — export/import farliga kemikalier
  'SFS 2013:254': '03', // organiska lösningsmedel
  'SFS 2014:425': '03', // bekämpningsmedel
  'KIFS 2022:3': '03', // KemI bekämpningsmedelsföreskrifter
  'NFS 2015:2': '03', // växtskyddsmedel
  'NFS 2015:3': '03', // biocidprodukter
  'SFS 2016:402': '03', // biologisk bekämpning
  'SFS 2016:1067': '03', // kemikalieskatt lag
  'SFS 2017:214': '03', // kemikalieskatt förordning

  // → 04 (Tillstånd & egenkontroll)
  '(EG) nr 166/2006': '04', // E-PRTR utsläppsregister
  'SFS 2007:667': '04', // allvarliga miljöskador
  'SFS 2016:986': '04', // miljöbedömningar (specifik)
  'STAFS 2020:1': '04', // ackreditering

  // → 05 (Utsläpp & emissioner)
  'SFS 2018:471': '05', // medelstora förbränningsanläggningar

  // → 06 (Transport)
  'MSBFS 2011:3': '06', // transportabla tryckbärande anordningar

  // → 07 (Brand, explosion & räddningstjänst)
  'SFS 1999:381': '07', // Sevesolagen
  'SFS 2015:236': '07', // Sevesoförordningen
  'MSBFS 2015:8': '07', // Seveso MSB-föreskrifter
  'SFS 2003:789': '07', // förordning om skydd mot olyckor
  'MSBFS 2014:6': '07', // sotning och brandskyddskontroll
  'MSBFS 2025:2': '07', // hantering av explosiva varor
  'MSBFS 2016:4': '07', // tillstånd explosiva varor
  'MSBFS 2018:3': '07', // cisterner med rörledningar

  // → 08 (Strålskydd)
  'SFS 2018:396': '08', // strålskyddslag
  'SFS 2018:506': '08', // strålskyddsförordning
  'SSMFS 2018:2': '08', // anmälningspliktiga verksamheter
  'NFS 2018:11': '08', // radioaktivt avfall

  // → 09 (Klimat, energi & hållbarhet)
  'SFS 2008:112': '09', // ekodesign
  'SFS 2014:266': '09', // energikartläggning lag
  'SFS 2014:347': '09', // energikartläggning förordning
  '(EU) nr 852/2020': '09', // taxonomi
  'SFS 2021:787': '09', // klimatdeklaration lag
  'SFS 2021:789': '09', // klimatdeklaration förordning
  '(EU) nr 956/2023': '09', // CBAM
  '(EU) nr 1115/2023': '09', // avskogningsfria leveranskedjor
  '(EU) nr 2772/2023': '09', // ESRS hållbarhetsrapportering
}

// ============================================================================
// Routing Logic
// ============================================================================

/**
 * Determine the new section number for an analysis entry.
 * Priority: S09 routing → Notisum section map
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

  // Default Notisum mapping
  const mapped = NOTISUM_TO_NEW_SECTION[entry.originalSection]
  if (mapped) return mapped

  throw new Error(
    `No mapping for Notisum section ${entry.originalSection}: "${entry.fullReference}"`
  )
}

/**
 * Resolve the DB document_number for matching against TemplateItem.document.
 * Handles OVK suffix stripping and EU CELEX conversion.
 */
export function resolveDocumentNumber(entry: AnalysisEntry): string {
  const base = entry.fullReference
    .replace(/\s*\(ers[aä]tter\s+.*?\)\s*$/i, '')
    .trim()
  return normalizeDocumentNumber(base)
}

/**
 * Convert Swedish EU reference to DB English format.
 * e.g., "(EU) nr 573/2024" → "Regulation (EU) 2024/573"
 *        "(EU) 40/2025"     → "Regulation (EU) 2025/40"
 *        "(EG) nr 1907/2006"→ "Regulation (EC) No 1907/2006"
 *
 * Some newer EU docs are stored with this English title format rather than CELEX.
 */
export function euToDbFormat(ref: string): string | null {
  const match = ref.match(/\((E[GU])\)\s*(?:nr\s+)?(\d+)\/(\d+)/)
  if (!match) return null
  const prefix = match[1]
  const part1 = match[2]!
  const part2 = match[3]!

  const part2Num = parseInt(part2, 10)
  let year: string
  let number: string
  if (part2.length === 4 && part2Num >= 1990) {
    year = part2
    number = part1
  } else {
    year = part1
    number = part2
  }

  return `Regulation (${prefix === 'EG' ? 'EC' : 'EU'}) ${year}/${number}`
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
  console.log('Split Miljö Template into 9 Sections')
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

    // EU documents may be stored in DB with CELEX numbers (e.g., "32006R1907")
    // or English title format (e.g., "Regulation (EU) 2024/573").
    // Add both alternate keys so we can match DB records.
    const celex = csvEuToCelex(entry.fullReference)
    if (celex && !docToSection.has(celex)) {
      docToSection.set(celex, newSection)
    }
    const dbFormat = euToDbFormat(entry.fullReference)
    if (dbFormat && !docToSection.has(dbFormat)) {
      docToSection.set(dbFormat, newSection)
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
        where: { slug: 'miljo' },
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
    throw new Error('Template "miljo" not found. Run seed script first.')
  }

  const items = template?.items ?? []
  console.log(`  Template items: ${items.length}`)
  console.log(`  Existing sections: ${template?.sections.length ?? 0}`)
  console.log()

  // ── Step 3: Create/upsert 9 sections ──────────────────────────────────
  console.log('--- Step 3: Creating 9 sections ---')
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
