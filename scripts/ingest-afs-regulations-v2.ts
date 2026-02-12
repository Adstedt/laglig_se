#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Story 9.1 — Task 6: AFS Regulation Ingestion Pipeline (v2 — HTML Scraping)
 *
 * Scrapes consolidated AFS regulation text from av.se, transforms to our
 * Laglig schema, splits SPLIT-tier documents by chapter, and upserts to DB.
 *
 * Replaces the PDF→Claude pipeline with $0-cost HTML scraping.
 *
 * Usage:
 *   npx tsx scripts/ingest-afs-regulations-v2.ts
 *   npx tsx scripts/ingest-afs-regulations-v2.ts --dry-run
 *   npx tsx scripts/ingest-afs-regulations-v2.ts --limit 3
 *   npx tsx scripts/ingest-afs-regulations-v2.ts --force
 *   npx tsx scripts/ingest-afs-regulations-v2.ts --tier STANDALONE
 *   npx tsx scripts/ingest-afs-regulations-v2.ts --skip-existing
 *   npx tsx scripts/ingest-afs-regulations-v2.ts --filter AFS2023:10
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'node:url'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient, ContentType, DocumentStatus } from '@prisma/client'
import {
  AFS_REGISTRY,
  type AfsDocument,
  type AfsTier,
  getAfsByTier,
  generateAfsSlug,
  buildStandaloneMetadata,
  buildParentMetadata,
  buildChapterMetadata,
} from '../lib/agency/afs-registry'
import { AFS_URL_REGISTRY } from './download-afs-consolidated'
import { scrapeAfsPage, type ScrapeOutcome } from '../lib/agency/afs-scraper'
import { transformAfsHtml } from '../lib/agency/afs-html-transformer'
import { splitByChapters } from '../lib/agency/afs-chapter-splitter'
import {
  htmlToMarkdown,
  htmlToPlainText,
} from '../lib/transforms/html-to-markdown'
import type { Prisma } from '@prisma/client'
import type { AfsMetadata } from '../lib/agency/afs-registry'

const prisma = new PrismaClient()

/** Convert typed AfsMetadata to Prisma JSON input */
function toJsonMetadata(meta: AfsMetadata): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(meta)) as Prisma.InputJsonValue
}

// ============================================================================
// CLI Configuration
// ============================================================================

interface PipelineConfig {
  dryRun: boolean
  force: boolean
  skipExisting: boolean
  limit: number
  filter: string | null
  tier: AfsTier | null
}

function parseArgs(): PipelineConfig {
  const cfg: PipelineConfig = {
    dryRun: false,
    force: false,
    skipExisting: false,
    limit: 0,
    filter: null,
    tier: null,
  }

  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') cfg.dryRun = true
    else if (arg === '--force') cfg.force = true
    else if (arg === '--skip-existing') cfg.skipExisting = true
    else if (arg === '--limit' && argv[i + 1]) {
      cfg.limit = parseInt(argv[i + 1]!, 10)
      i++
    } else if (arg === '--filter' && argv[i + 1]) {
      cfg.filter = argv[i + 1]!
      i++
    } else if (arg === '--tier' && argv[i + 1]) {
      cfg.tier = argv[i + 1]! as AfsTier
      i++
    }
  }

  return cfg
}

// ============================================================================
// Processing Functions
// ============================================================================

async function processStandalone(
  doc: AfsDocument,
  scrapeResult: ScrapeOutcome,
  cfg: PipelineConfig
): Promise<number> {
  if (!scrapeResult.success) return 0
  const urls = AFS_URL_REGISTRY[doc.documentNumber]!
  const { html, stats } = transformAfsHtml(scrapeResult.data.provisionHtml, doc)

  console.log(
    `    Transform: ${stats.sectionSignCount} §, ${stats.allmanaRadCount} allmänna råd, ${stats.tableCount} tables, ${stats.footnoteCount} footnotes`
  )

  const markdownContent = htmlToMarkdown(html)
  const fullText = htmlToPlainText(html)
  const metadata = buildStandaloneMetadata(doc, urls.historikUrl)

  if (cfg.dryRun) {
    console.log(`    [DRY RUN] Would upsert: ${doc.documentNumber}`)
    writeReviewFile(doc.documentNumber, html)
    return 1
  }

  await prisma.legalDocument.upsert({
    where: { document_number: doc.documentNumber },
    update: {
      title: doc.title,
      slug: generateAfsSlug(doc.documentNumber),
      html_content: html,
      markdown_content: markdownContent,
      full_text: fullText,
      source_url: urls.pageUrl,
      status: DocumentStatus.ACTIVE,
      metadata: toJsonMetadata(metadata),
      updated_at: new Date(),
    },
    create: {
      document_number: doc.documentNumber,
      title: doc.title,
      slug: generateAfsSlug(doc.documentNumber),
      content_type: ContentType.AGENCY_REGULATION,
      html_content: html,
      markdown_content: markdownContent,
      full_text: fullText,
      source_url: urls.pageUrl,
      status: DocumentStatus.ACTIVE,
      metadata: toJsonMetadata(metadata),
    },
  })

  writeReviewFile(doc.documentNumber, html)
  console.log(`    [OK] Upserted: ${doc.documentNumber}`)
  return 1
}

async function processSplit(
  doc: AfsDocument,
  scrapeResult: ScrapeOutcome,
  cfg: PipelineConfig
): Promise<number> {
  if (!scrapeResult.success) return 0
  const urls = AFS_URL_REGISTRY[doc.documentNumber]!
  const { html: fullHtml, stats } = transformAfsHtml(
    scrapeResult.data.provisionHtml,
    doc
  )

  console.log(
    `    Transform: ${stats.sectionSignCount} §, ${stats.allmanaRadCount} allmänna råd, ${stats.tableCount} tables, ${stats.footnoteCount} footnotes, ${stats.bilagaCount} bilagor`
  )

  const splitResult = splitByChapters(fullHtml, doc)
  console.log(`    Split: parent + ${splitResult.chapters.length} chapters`)

  // Build parent HTML (include transitional + unassigned appendices)
  let parentHtml = splitResult.parent.html
  if (splitResult.parent.unassignedAppendicesHtml) {
    parentHtml += `\n<div class="appendices">${splitResult.parent.unassignedAppendicesHtml}</div>`
  }
  if (splitResult.parent.transitionalHtml) {
    parentHtml += `\n${splitResult.parent.transitionalHtml}`
  }

  if (cfg.dryRun) {
    console.log(`    [DRY RUN] Would upsert parent: ${doc.documentNumber}`)
    for (const ch of splitResult.chapters) {
      console.log(`    [DRY RUN] Would upsert chapter: ${ch.documentNumber}`)
    }
    writeReviewFile(doc.documentNumber, fullHtml)
    return 1 + splitResult.chapters.length
  }

  // Transaction: parent + all chapters
  await prisma.$transaction(async (tx) => {
    const parentMetadata = buildParentMetadata(doc, urls.historikUrl)
    const parentMarkdown = htmlToMarkdown(parentHtml)
    const parentFullText = htmlToPlainText(parentHtml)

    await tx.legalDocument.upsert({
      where: { document_number: doc.documentNumber },
      update: {
        title: doc.title,
        slug: generateAfsSlug(doc.documentNumber),
        html_content: parentHtml,
        markdown_content: parentMarkdown,
        full_text: parentFullText,
        source_url: urls.pageUrl,
        status: DocumentStatus.ACTIVE,
        metadata: toJsonMetadata(parentMetadata),
        updated_at: new Date(),
      },
      create: {
        document_number: doc.documentNumber,
        title: doc.title,
        slug: generateAfsSlug(doc.documentNumber),
        content_type: ContentType.AGENCY_REGULATION,
        html_content: parentHtml,
        markdown_content: parentMarkdown,
        full_text: parentFullText,
        source_url: urls.pageUrl,
        status: DocumentStatus.ACTIVE,
        metadata: toJsonMetadata(parentMetadata),
      },
    })

    for (const ch of splitResult.chapters) {
      const chDoc = doc.chapters.find((c) => c.number === ch.chapterNumber)
      if (!chDoc) {
        throw new Error(
          `Chapter ${ch.chapterNumber} not found in registry for ${doc.documentNumber}`
        )
      }
      const chMetadata = buildChapterMetadata(doc, chDoc)
      const chMarkdown = htmlToMarkdown(ch.html)
      const chFullText = htmlToPlainText(ch.html)

      await tx.legalDocument.upsert({
        where: { document_number: ch.documentNumber },
        update: {
          title: ch.title,
          slug: generateAfsSlug(ch.documentNumber),
          html_content: ch.html,
          markdown_content: chMarkdown,
          full_text: chFullText,
          source_url: urls.pageUrl,
          status: DocumentStatus.ACTIVE,
          metadata: toJsonMetadata(chMetadata),
          updated_at: new Date(),
        },
        create: {
          document_number: ch.documentNumber,
          title: ch.title,
          slug: generateAfsSlug(ch.documentNumber),
          content_type: ContentType.AGENCY_REGULATION,
          html_content: ch.html,
          markdown_content: chMarkdown,
          full_text: chFullText,
          source_url: urls.pageUrl,
          status: DocumentStatus.ACTIVE,
          metadata: toJsonMetadata(chMetadata),
        },
      })
    }
  })

  writeReviewFile(doc.documentNumber, fullHtml)
  console.log(
    `    [OK] Upserted parent + ${splitResult.chapters.length} chapters`
  )
  return 1 + splitResult.chapters.length
}

// ============================================================================
// Review File Generation
// ============================================================================

function writeReviewFile(docNumber: string, html: string): void {
  const reviewDir = path.resolve(__dirname, '../data/afs-review')
  fs.mkdirSync(reviewDir, { recursive: true })
  const fileName =
    docNumber.replace(/\s+/g, '-').replace(/:/g, '-').replace(/\./g, '') +
    '.html'
  const filePath = path.join(reviewDir, fileName)

  const reviewHtml = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <title>${docNumber}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }
    h1 { font-size: 1.5rem; border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    h2 { font-size: 1.3rem; margin-top: 2rem; color: #222; }
    h3 { font-size: 1.1rem; margin-top: 1.5rem; color: #333; }
    a.paragraf { font-weight: bold; display: block; margin-top: 1.5rem; padding-top: 0.5rem; border-top: 1px solid #e0e0e0; }
    .allmanna-rad { background: #f9f6f0; border-left: 3px solid #c9a96e; padding: 0.5rem 1rem; margin: 0.5rem 0; }
    .allmanna-rad-heading { font-weight: bold; margin: 0; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ccc; padding: 0.4rem 0.8rem; text-align: left; }
    th { background: #f5f5f5; }
    sup.footnote-ref { color: #0066cc; cursor: help; }
    .general-provisions-preamble { background: #f0f4f8; border-left: 3px solid #4a90d9; padding: 0.5rem 1rem; margin: 1rem 0; }
    .chapter-toc { background: #fafafa; border: 1px solid #e0e0e0; padding: 1rem; margin: 1rem 0; border-radius: 4px; }
    footer.back { border-top: 2px solid #999; margin-top: 2rem; padding-top: 1rem; color: #666; }
    .appendices { border-top: 1px dashed #999; margin-top: 2rem; padding-top: 1rem; }
  </style>
</head>
<body>
${html}
</body>
</html>`

  fs.writeFileSync(filePath, reviewHtml)
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const cfg = parseArgs()
  const startTime = Date.now()

  console.log('='.repeat(60))
  console.log('AFS Regulation Ingestion Pipeline v2 (HTML Scraping)')
  console.log('='.repeat(60))
  console.log(`Mode: ${cfg.dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Force: ${cfg.force}`)
  console.log(`Skip existing: ${cfg.skipExisting}`)
  if (cfg.filter) console.log(`Filter: ${cfg.filter}`)
  if (cfg.tier) console.log(`Tier: ${cfg.tier}`)
  if (cfg.limit > 0) console.log(`Limit: ${cfg.limit}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log()

  // Build document list
  let documents = [...AFS_REGISTRY]
  if (cfg.tier) {
    documents = getAfsByTier(cfg.tier)
  }
  if (cfg.filter) {
    const filterNormalized = cfg.filter.replace(/\s+/g, '').toUpperCase()
    documents = documents.filter((d) =>
      d.documentNumber
        .replace(/\s+/g, '')
        .toUpperCase()
        .includes(filterNormalized)
    )
  }
  if (cfg.limit > 0) {
    documents = documents.slice(0, cfg.limit)
  }

  console.log(
    `Processing ${documents.length} of ${AFS_REGISTRY.length} documents`
  )
  console.log()

  let totalEntries = 0
  let processed = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]!
    const urls = AFS_URL_REGISTRY[doc.documentNumber]

    console.log(
      `[${i + 1}/${documents.length}] ${doc.documentNumber}: ${doc.title} (${doc.tier})`
    )

    if (!urls) {
      console.error(`  [FAIL] No URL configured`)
      failed++
      continue
    }

    // Skip existing check
    if (cfg.skipExisting && !cfg.force) {
      const existing = await prisma.legalDocument.findUnique({
        where: { document_number: doc.documentNumber },
        select: { html_content: true },
      })
      if (existing?.html_content) {
        console.log(`  [SKIP] Already has content`)
        skipped++
        continue
      }
    }

    // Scrape
    console.log(`  Scraping: ${urls.pageUrl}`)
    const scrapeResult = await scrapeAfsPage(urls.pageUrl)

    if (!scrapeResult.success) {
      console.error(`  [FAIL] Scrape: ${scrapeResult.error}`)
      failed++
      continue
    }

    const { stats, sections } = scrapeResult.data
    console.log(
      `  Scraped: ${stats.sectionSignCount} §, ${stats.generalRecommendationCount} allmänna råd, ${stats.tableCount} tables, ${stats.footnoteCount} footnotes`
    )
    console.log(
      `  Sections: rules=${sections.hasRules}, transitional=${sections.hasTransitionalRegulations}, appendices=${sections.hasAppendices}`
    )

    try {
      let entries: number
      if (doc.tier === 'SPLIT') {
        entries = await processSplit(doc, scrapeResult, cfg)
      } else {
        entries = await processStandalone(doc, scrapeResult, cfg)
      }
      totalEntries += entries
      processed++
    } catch (err) {
      console.error(
        `  [FAIL] Processing: ${err instanceof Error ? err.message : err}`
      )
      failed++
    }

    // Rate limit between requests
    if (i < documents.length - 1) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log()
  console.log('='.repeat(60))
  console.log('Results')
  console.log('='.repeat(60))
  console.log(`  Processed: ${processed}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Total entries upserted: ${totalEntries}`)
  console.log(`  Duration: ${elapsed}s`)
  console.log(`  Cost: $0`)
  console.log('='.repeat(60))

  if (failed > 0) {
    process.exit(1)
  }
}

const isDirectExecution =
  typeof process !== 'undefined' &&
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isDirectExecution) {
  main()
    .catch((e) => {
      console.error('Fatal:', e)
      process.exit(1)
    })
    .finally(() => void prisma.$disconnect())
}
