#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Backfill EU Template Documents
 *
 * Fetches raw HTML for the 18 EU template documents (needed by seed templates),
 * transforms them through the EU HTML transformer, and updates the database.
 *
 * Handles three scenarios:
 * 1. Empty shells (no html_content) → fetch from CELLAR + transform
 * 2. Raw CELLAR HTML (not yet transformed) → transform in place
 * 3. Already transformed (has article.sfs) → skip unless --force
 *
 * Usage:
 *   npx tsx scripts/backfill-eu-template-docs.ts
 *   npx tsx scripts/backfill-eu-template-docs.ts --dry-run
 *   npx tsx scripts/backfill-eu-template-docs.ts --force
 *   npx tsx scripts/backfill-eu-template-docs.ts --filter 32016R0679
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { PrismaClient } from '@prisma/client'
import { fetchDocumentContentViaCellar } from '../lib/external/eurlex'
import {
  transformEuHtml,
  type EuDocumentInfo,
} from '../lib/eu/eu-html-transformer'
import {
  htmlToMarkdown,
  htmlToPlainText,
} from '../lib/transforms/html-to-markdown'

const prisma = new PrismaClient()

// ============================================================================
// The 18 template CELEX numbers
// ============================================================================

const TEMPLATE_CELEX = [
  '32006R1907', // REACH
  '32008R1272', // CLP
  '32019R1021', // POPs
  '32016R0679', // GDPR
  '32006R0561', // Driving & rest times
  '32014R0165', // Tachographs
  '32023R1230', // Machinery
  '32006R0166', // E-PRTR
  '32008R0440', // REACH test methods
  '32012R0649', // PIC
  '32020R0852', // Taxonomy
  '32024R0573', // AI Act (recast numbering)
  '32024R0590', // Packaging & packaging waste
  '32023R0956', // CBAM
  '32023R1115', // Deforestation
  '32023R1542', // Battery
  '32023R2772', // ESRS
  '32025R0040', // Omnibus simplification
]

// ============================================================================
// CLI
// ============================================================================

const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')
const FILTER_ARG = (() => {
  const idx = process.argv.indexOf('--filter')
  return idx >= 0 ? process.argv[idx + 1] : null
})()

// ============================================================================
// Helpers
// ============================================================================

function isAlreadyTransformed(html: string): boolean {
  return html.includes('<article class="sfs"')
}

/**
 * Parse a CELEX number to extract a display document number.
 * e.g. "32016R0679" → "(EU) 2016/679"
 */
function celexToDocNumber(celex: string): string {
  const match = celex.match(/^3(\d{4})[A-Z](\d+)$/)
  if (!match) return celex
  const year = parseInt(match[1]!, 10)
  const number = parseInt(match[2]!, 10)
  const prefix = year < 2009 ? '(EG) nr' : '(EU)'
  return `${prefix} ${number}/${year}`
}

/**
 * Extract a short/popular title from the full legal title.
 * Removes the standard prefix and keeps the descriptive part.
 */
function extractShortTitle(title: string): string | undefined {
  // Try to find a parenthetical abbreviation like (GDPR), (REACH), etc.
  const abbrMatch = title.match(/\(([A-ZÅÄÖ]{2,})\)/)
  if (abbrMatch) return abbrMatch[0]

  // Trim overly long titles
  if (title.length > 100) {
    return undefined
  }
  return undefined
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const startTime = Date.now()

  console.log('='.repeat(60))
  console.log('EU Template Document Backfill')
  console.log('='.repeat(60))
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Force: ${FORCE}`)
  if (FILTER_ARG) console.log(`Filter: ${FILTER_ARG}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log()

  // Filter target list
  let targets = [...TEMPLATE_CELEX]
  if (FILTER_ARG) {
    targets = targets.filter((c) =>
      c.toLowerCase().includes(FILTER_ARG.toLowerCase())
    )
  }

  console.log(
    `Processing ${targets.length} of ${TEMPLATE_CELEX.length} documents`
  )
  console.log()

  let fetched = 0
  let transformed = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < targets.length; i++) {
    const celex = targets[i]!
    console.log(`[${i + 1}/${targets.length}] ${celex}`)

    try {
      // Find the document in DB via EuDocument relation
      const euDoc = await prisma.euDocument.findUnique({
        where: { celex_number: celex },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              document_number: true,
              html_content: true,
            },
          },
        },
      })

      if (!euDoc) {
        console.log(`  [SKIP] Not found in database`)
        skipped++
        continue
      }

      const legalDoc = euDoc.document
      const currentHtml = legalDoc.html_content

      // Check if already transformed
      if (currentHtml && isAlreadyTransformed(currentHtml) && !FORCE) {
        console.log(`  [SKIP] Already transformed`)
        skipped++
        continue
      }

      // Determine raw HTML to transform
      // When --force on already-transformed HTML, we must re-fetch from CELLAR
      // because the transformed HTML no longer has the ELI structure needed.
      const needsFetch =
        !currentHtml ||
        currentHtml.length < 500 ||
        (FORCE && isAlreadyTransformed(currentHtml))

      let rawHtml: string

      if (needsFetch) {
        console.log(`  Fetching from CELLAR...`)
        const content = await fetchDocumentContentViaCellar(celex)
        if (!content) {
          console.log(`  [FAIL] Could not fetch content from CELLAR`)
          failed++
          continue
        }
        rawHtml = content.html
        fetched++
        console.log(`  Fetched: ${rawHtml.length.toLocaleString()} chars`)
      } else {
        rawHtml = currentHtml!
        console.log(
          `  Using existing HTML: ${rawHtml.length.toLocaleString()} chars`
        )
      }

      // Build document info for transformer
      const docInfo: EuDocumentInfo = {
        celex,
        documentNumber: legalDoc.document_number || celexToDocNumber(celex),
        shortTitle: extractShortTitle(legalDoc.title),
      }

      // Transform
      const result = transformEuHtml(rawHtml, docInfo)
      console.log(
        `  Transformed: ${result.structureType}, ${result.stats.chapterCount} chapters, ${result.stats.articleCount} articles, ${result.stats.footnoteCount} footnotes, ${result.stats.tableCount} tables`
      )

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would update ${celex}`)
        transformed++
        continue
      }

      // Derive plain text and markdown from the transformed HTML
      const fullText = htmlToPlainText(result.html)
      const markdownContent = htmlToMarkdown(result.html)

      // Update the LegalDocument
      await prisma.legalDocument.update({
        where: { id: legalDoc.id },
        data: {
          html_content: result.html,
          full_text: fullText,
          markdown_content: markdownContent,
          updated_at: new Date(),
        },
      })

      transformed++
      console.log(`  [OK] Updated`)
    } catch (err) {
      console.error(
        `  [FAIL] ${err instanceof Error ? err.message : String(err)}`
      )
      failed++
    }

    // Rate limit between CELLAR requests
    if (i < targets.length - 1) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log()
  console.log('='.repeat(60))
  console.log('Results')
  console.log('='.repeat(60))
  console.log(`  Fetched from CELLAR: ${fetched}`)
  console.log(`  Transformed: ${transformed}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Duration: ${elapsed}s`)
  console.log('='.repeat(60))

  if (failed > 0) {
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error('Fatal:', e)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
