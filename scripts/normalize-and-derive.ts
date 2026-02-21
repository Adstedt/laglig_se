#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Story 14.1, Task 9 — Normalize HTML & Derive JSON/Markdown
 *
 * Two-phase batch script:
 *   Phase A: Normalize html_content to canonical HTML for non-conforming content types
 *   Phase B: Derive json_content and markdown_content from canonical HTML
 *
 * Usage:
 *   npx tsx scripts/normalize-and-derive.ts
 *   npx tsx scripts/normalize-and-derive.ts --dry-run
 *   npx tsx scripts/normalize-and-derive.ts --phase A
 *   npx tsx scripts/normalize-and-derive.ts --phase B
 *   npx tsx scripts/normalize-and-derive.ts --content-type SFS_LAW --limit 10
 *   npx tsx scripts/normalize-and-derive.ts --resume
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import * as fs from 'fs'
import { PrismaClient, ContentType } from '@prisma/client'
import { normalizeSfsLaw } from '../lib/transforms/normalizers/sfs-law-normalizer'
import { parseCanonicalHtml } from '../lib/transforms/canonical-html-parser'
import { validateCanonicalJson } from '../lib/transforms/validate-document-json'
import {
  htmlToMarkdown,
  htmlToPlainText,
} from '../lib/transforms/html-to-markdown'

const prisma = new PrismaClient()

// ============================================================================
// CLI Configuration
// ============================================================================

type Phase = 'A' | 'B' | 'both'

interface ScriptConfig {
  dryRun: boolean
  limit: number
  contentType: ContentType | null
  phase: Phase
  resume: boolean
}

function parseArgs(): ScriptConfig {
  const cfg: ScriptConfig = {
    dryRun: false,
    limit: 0,
    contentType: null,
    phase: 'both',
    resume: false,
  }

  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') cfg.dryRun = true
    else if (arg === '--resume') cfg.resume = true
    else if (arg === '--limit' && argv[i + 1]) {
      cfg.limit = parseInt(argv[i + 1]!, 10)
      i++
    } else if (arg === '--content-type' && argv[i + 1]) {
      cfg.contentType = argv[i + 1]! as ContentType
      i++
    } else if (arg === '--phase' && argv[i + 1]) {
      cfg.phase = argv[i + 1]! as Phase
      i++
    }
  }

  return cfg
}

// ============================================================================
// Progress Tracking
// ============================================================================

const PROGRESS_FILE = resolve(process.cwd(), 'data/derive-progress.json')

interface ProgressData {
  phaseA: { completed: string[]; lastRun: string | null }
  phaseB: { completed: string[]; lastRun: string | null }
}

function loadProgress(): ProgressData {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8')) as ProgressData
    }
  } catch {
    // Corrupted file — start fresh
  }
  return {
    phaseA: { completed: [], lastRun: null },
    phaseB: { completed: [], lastRun: null },
  }
}

function saveProgress(progress: ProgressData): void {
  const dir = resolve(process.cwd(), 'data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

// ============================================================================
// Phase A: Normalize HTML
// ============================================================================

/** Content types that need normalization in Phase A */
const PHASE_A_TYPES: ContentType[] = [
  ContentType.SFS_LAW,
  // AGENCY_REGULATION and EU types handled below with metadata checks
  ContentType.AGENCY_REGULATION,
  ContentType.EU_REGULATION,
  ContentType.EU_DIRECTIVE,
]

interface PhaseStats {
  processed: number
  skipped: number
  errors: number
  total: number
}

function logProgress(label: string, stats: PhaseStats, extra?: string): void {
  const pct =
    stats.total > 0 ? ((stats.processed / stats.total) * 100).toFixed(1) : '0.0'
  const parts = [
    `[${label}] Processed ${stats.processed}/${stats.total} (${pct}%)`,
  ]
  if (stats.skipped > 0) parts.push(`Skipped: ${stats.skipped}`)
  if (stats.errors > 0) parts.push(`Errors: ${stats.errors}`)
  if (extra) parts.push(extra)
  console.log(parts.join(' | '))
}

async function runPhaseA(cfg: ScriptConfig): Promise<PhaseStats> {
  console.log('\n=== Phase A: Normalize HTML ===\n')

  const progress = cfg.resume ? loadProgress() : loadProgress()
  const completedSet = new Set(progress.phaseA.completed)

  // Determine which content types to process
  const typesToProcess = cfg.contentType
    ? [cfg.contentType].filter((t) => PHASE_A_TYPES.includes(t))
    : PHASE_A_TYPES

  if (typesToProcess.length === 0) {
    console.log('No normalizable content types selected. Skipping Phase A.')
    return { processed: 0, skipped: 0, errors: 0, total: 0 }
  }

  const totalStats: PhaseStats = {
    processed: 0,
    skipped: 0,
    errors: 0,
    total: 0,
  }

  for (const ct of typesToProcess) {
    const stats = await normalizeContentType(ct, cfg, completedSet, progress)
    totalStats.processed += stats.processed
    totalStats.skipped += stats.skipped
    totalStats.errors += stats.errors
    totalStats.total += stats.total
  }

  progress.phaseA.lastRun = new Date().toISOString()
  if (!cfg.dryRun) saveProgress(progress)

  return totalStats
}

async function normalizeContentType(
  contentType: ContentType,
  cfg: ScriptConfig,
  completedSet: Set<string>,
  progress: ProgressData
): Promise<PhaseStats> {
  const stats: PhaseStats = { processed: 0, skipped: 0, errors: 0, total: 0 }

  // Query documents that have html_content
  const where: Record<string, unknown> = {
    content_type: contentType,
    html_content: { not: null },
  }

  // For agency regs, only process html-scraped ones (AFS from av.se)
  // LLM-ingested ones already conform
  if (contentType === ContentType.AGENCY_REGULATION) {
    where.metadata = { path: ['method'], equals: 'html-scraping' }
  }

  // Step 1: Fetch IDs only (lightweight query)
  const docIds = await prisma.legalDocument.findMany({
    where,
    select: { id: true, document_number: true },
    orderBy: { document_number: 'asc' },
    ...(cfg.limit > 0 ? { take: cfg.limit } : {}),
  })

  stats.total = docIds.length
  console.log(`\n  [${contentType}] Found ${docIds.length} documents`)

  // Step 2: Process one at a time (fetch html_content per doc)
  for (const { id, document_number } of docIds) {
    if (completedSet.has(`A:${id}`)) {
      stats.skipped++
      continue
    }

    try {
      const doc = await prisma.legalDocument.findUnique({
        where: { id },
        select: {
          id: true,
          document_number: true,
          title: true,
          html_content: true,
          content_type: true,
        },
      })

      if (!doc || !doc.html_content) {
        stats.skipped++
        continue
      }

      const normalized = normalizeHtml(
        doc.html_content,
        doc.document_number,
        doc.title,
        doc.content_type
      )

      if (normalized === null) {
        // Already canonical or not applicable
        stats.skipped++
        completedSet.add(`A:${doc.id}`)
        progress.phaseA.completed.push(`A:${doc.id}`)
        continue
      }

      if (cfg.dryRun) {
        console.log(`    [DRY] Would normalize: ${doc.document_number}`)
      } else {
        await prisma.legalDocument.update({
          where: { id: doc.id },
          data: { html_content: normalized },
        })
      }

      stats.processed++
      completedSet.add(`A:${doc.id}`)
      progress.phaseA.completed.push(`A:${doc.id}`)

      if (stats.processed % 100 === 0) {
        logProgress(contentType, stats)
        if (!cfg.dryRun) saveProgress(progress)
      }
    } catch (err) {
      stats.errors++
      console.error(
        `    ERROR [${document_number}]: ${err instanceof Error ? err.message : err}`
      )
    }
  }

  logProgress(contentType, stats, 'done')
  return stats
}

function normalizeHtml(
  html: string,
  documentNumber: string,
  title: string,
  contentType: ContentType
): string | null {
  // Already canonical — skip
  if (html.includes('<article class="legal-document"')) {
    return null
  }

  switch (contentType) {
    case ContentType.SFS_LAW:
      return normalizeSfsLaw(html, { documentNumber, title })

    case ContentType.AGENCY_REGULATION:
      // AFS html-scraped docs: the transformer now produces canonical output,
      // but existing DB rows have old format. Re-running ingestion is the
      // correct approach for these. For the batch script, skip if already
      // canonical (checked above), otherwise flag as needing re-ingestion.
      console.log(
        `    SKIP [${documentNumber}]: AFS re-ingestion needed (not in-place normalizable)`
      )
      return null

    case ContentType.EU_REGULATION:
    case ContentType.EU_DIRECTIVE:
      // EU docs: the transformer now produces canonical output, but existing
      // DB rows have old format. Similar to AFS, re-running ingestion is correct.
      console.log(
        `    SKIP [${documentNumber}]: EU re-ingestion needed (not in-place normalizable)`
      )
      return null

    default:
      return null
  }
}

// ============================================================================
// Phase B: Derive JSON + Markdown
// ============================================================================

/** Content types to derive in Phase B — all types with html_content */
const PHASE_B_TYPES: ContentType[] = [
  ContentType.SFS_LAW,
  ContentType.SFS_AMENDMENT,
  ContentType.AGENCY_REGULATION,
  ContentType.EU_REGULATION,
  ContentType.EU_DIRECTIVE,
]

async function runPhaseB(cfg: ScriptConfig): Promise<PhaseStats> {
  console.log('\n=== Phase B: Derive JSON + Markdown ===\n')

  const progress = cfg.resume ? loadProgress() : loadProgress()
  const completedSet = new Set(progress.phaseB.completed)

  const typesToProcess = cfg.contentType
    ? [cfg.contentType].filter((t) => PHASE_B_TYPES.includes(t))
    : PHASE_B_TYPES

  if (typesToProcess.length === 0) {
    console.log('No derivable content types selected. Skipping Phase B.')
    return { processed: 0, skipped: 0, errors: 0, total: 0 }
  }

  const totalStats: PhaseStats = {
    processed: 0,
    skipped: 0,
    errors: 0,
    total: 0,
  }
  let validationErrors = 0

  for (const ct of typesToProcess) {
    const where: Record<string, unknown> = {
      content_type: ct,
      html_content: { not: null },
    }

    const docs = await prisma.legalDocument.findMany({
      where,
      select: {
        id: true,
        document_number: true,
        html_content: true,
        content_type: true,
      },
      orderBy: { document_number: 'asc' },
      ...(cfg.limit > 0 ? { take: cfg.limit } : {}),
    })

    totalStats.total += docs.length
    console.log(`  [${ct}] Found ${docs.length} documents`)

    for (const doc of docs) {
      if (completedSet.has(`B:${doc.id}`)) {
        totalStats.skipped++
        continue
      }

      try {
        const html = doc.html_content!

        // Only derive from canonical HTML
        if (!html.includes('<article class="legal-document"')) {
          totalStats.skipped++
          continue
        }

        // Derive JSON
        const jsonContent = parseCanonicalHtml(html)

        // Validate
        const validation = validateCanonicalJson(jsonContent)
        if (!validation.valid) {
          validationErrors++
          console.warn(
            `    WARN [${doc.document_number}]: JSON validation failed: ${validation.errors[0]}`
          )
          // Continue anyway — store the JSON but log the issue
        }

        // Derive markdown
        const markdownContent = htmlToMarkdown(html)

        // Derive plain text
        const fullText = htmlToPlainText(html)

        if (cfg.dryRun) {
          console.log(
            `    [DRY] Would derive: ${doc.document_number} ` +
              `(json: ${JSON.stringify(jsonContent).length} bytes, ` +
              `md: ${markdownContent.length} chars, ` +
              `valid: ${validation.valid})`
          )
        } else {
          await prisma.legalDocument.update({
            where: { id: doc.id },
            data: {
              json_content: jsonContent as unknown as Record<string, unknown>,
              markdown_content: markdownContent,
              full_text: fullText,
            },
          })
        }

        totalStats.processed++
        completedSet.add(`B:${doc.id}`)
        progress.phaseB.completed.push(`B:${doc.id}`)

        if (totalStats.processed % 100 === 0) {
          logProgress(ct, totalStats)
          if (!cfg.dryRun) saveProgress(progress)
        }
      } catch (err) {
        totalStats.errors++
        console.error(
          `    ERROR [${doc.document_number}]: ${err instanceof Error ? err.message : err}`
        )
      }
    }

    logProgress(ct, totalStats)
  }

  if (validationErrors > 0) {
    console.log(
      `\n  ⚠ ${validationErrors} documents had JSON validation warnings`
    )
  }

  progress.phaseB.lastRun = new Date().toISOString()
  if (!cfg.dryRun) saveProgress(progress)

  return totalStats
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const cfg = parseArgs()

  console.log('normalize-and-derive.ts — Story 14.1, Task 9')
  console.log(`  Phase: ${cfg.phase}`)
  console.log(`  Dry run: ${cfg.dryRun}`)
  console.log(`  Content type: ${cfg.contentType ?? 'all'}`)
  console.log(`  Limit: ${cfg.limit || 'none'}`)
  console.log(`  Resume: ${cfg.resume}`)

  const start = Date.now()
  let phaseAStats: PhaseStats | null = null
  let phaseBStats: PhaseStats | null = null

  if (cfg.phase === 'A' || cfg.phase === 'both') {
    phaseAStats = await runPhaseA(cfg)
  }

  if (cfg.phase === 'B' || cfg.phase === 'both') {
    phaseBStats = await runPhaseB(cfg)
  }

  // Summary report
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log('\n=== Summary ===\n')
  if (phaseAStats) {
    console.log(
      `  Phase A: ${phaseAStats.processed} normalized, ${phaseAStats.skipped} skipped, ${phaseAStats.errors} errors (of ${phaseAStats.total})`
    )
  }
  if (phaseBStats) {
    console.log(
      `  Phase B: ${phaseBStats.processed} derived, ${phaseBStats.skipped} skipped, ${phaseBStats.errors} errors (of ${phaseBStats.total})`
    )
  }
  console.log(`  Duration: ${elapsed}s`)
  if (cfg.dryRun) console.log('  (DRY RUN — no database changes made)')
}

main()
  .catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
