#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * UAT: Normalize 30 documents (10 amendments + 10 SFS laws + 10 agency docs)
 * and write results to DB for review.
 *
 * Usage:
 *   npx tsx scripts/uat-normalize-30.ts            # dry run
 *   npx tsx scripts/uat-normalize-30.ts --write     # apply to DB
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import * as cheerio from 'cheerio'
import { normalizeSfsAmendment } from '../lib/transforms/normalizers/sfs-amendment-normalizer'
import { normalizeSfsLaw } from '../lib/transforms/normalizers/sfs-law-normalizer'

const prisma = new PrismaClient()
const WRITE = process.argv.includes('--write')
const SAMPLE = 10

// ============================================================================
// Helpers
// ============================================================================

function countKey(html: string, selector: string): number {
  return cheerio.load(html)(selector).length
}

function summarize(html: string) {
  return {
    paragraf: countKey(html, 'a.paragraf'),
    kapitel: countKey(html, 'section.kapitel'),
    paragraphs: countKey(html, 'h3.paragraph'),
    pText: countKey(html, 'p.text'),
    wrapper: html.includes('class="legal-document"')
      ? 'legal-document'
      : html.includes('class="sfs"')
        ? 'sfs'
        : 'other',
  }
}

interface DocRow {
  id: string
  document_number: string
  title: string
  html_content: string | null
}

async function processDoc(
  doc: DocRow,
  normalizer: (_html: string) => string,
  _label: string
): Promise<boolean> {
  const html = doc.html_content!
  const before = summarize(html)

  try {
    const result = normalizer(html)
    const after = summarize(result)
    const changed = result !== html

    const status = changed ? '✓' : '–'
    console.log(
      `  ${status} ${doc.document_number} — ${doc.title.substring(0, 60)}`
    )
    if (changed) {
      console.log(
        `      wrapper: ${before.wrapper}→${after.wrapper} | a.paragraf: ${before.paragraf}→${after.paragraf} | kapitel: ${before.kapitel}→${after.kapitel} | p.text: ${before.pText}→${after.pText}`
      )

      if (WRITE) {
        await prisma.legalDocument.update({
          where: { id: doc.id },
          data: { html_content: result },
        })
        console.log(`      → Written to DB`)
      }
    } else {
      console.log(`      (unchanged — already canonical or not applicable)`)
    }

    return changed
  } catch (err) {
    console.log(
      `  ✗ ${doc.document_number}: ${err instanceof Error ? err.message : err}`
    )
    return false
  }
}

// ============================================================================
// Agency normalizer: simple class="sfs" → class="legal-document" rename
// ============================================================================

function normalizeAgencyLlm(html: string): string {
  if (!html || html.includes('class="legal-document"')) return html
  if (!html.includes('class="sfs"')) return html
  return html.replace('class="sfs"', 'class="legal-document"')
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log(`\n=== UAT: Normalize 30 Documents ===`)
  console.log(
    `Mode: ${WRITE ? 'WRITE TO DB' : 'DRY RUN (use --write to apply)'}\n`
  )

  const results: { type: string; doc: string; title: string }[] = []

  // --- 10 SFS Amendments ---
  console.log(`\n--- SFS Amendments (sfs-amendment-normalizer) ---\n`)
  const amendments = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_AMENDMENT',
      html_content: { not: null },
    },
    select: {
      id: true,
      document_number: true,
      title: true,
      html_content: true,
    },
    orderBy: { document_number: 'desc' },
    take: 200,
  })

  // Pick ones that need normalization (have annzone/ann, don't have a.paragraf)
  const amendmentCandidates = amendments.filter(
    (a) =>
      a.html_content &&
      !a.html_content.includes('class="paragraf"') &&
      (a.html_content.includes('annzone') ||
        a.html_content.includes('class="ann"'))
  )
  // Pick a diverse set — some with chapters, some flat
  const withChapters = amendmentCandidates.filter((a) =>
    a.html_content!.includes('class="kapitel"')
  )
  const flat = amendmentCandidates.filter(
    (a) => !a.html_content!.includes('class="kapitel"')
  )
  const amendmentSample = [
    ...withChapters.slice(0, 5),
    ...flat.slice(0, 5),
  ].slice(0, SAMPLE)

  let amendCount = 0
  for (const doc of amendmentSample) {
    const changed = await processDoc(
      doc as DocRow,
      (html) =>
        normalizeSfsAmendment(html, {
          documentNumber: doc.document_number,
          title: doc.title,
        }),
      'amendment'
    )
    if (changed) {
      amendCount++
      results.push({
        type: 'SFS_AMENDMENT',
        doc: doc.document_number,
        title: doc.title,
      })
    }
  }

  // --- 10 SFS Laws ---
  console.log(`\n--- SFS Laws (sfs-law-normalizer) ---\n`)
  const laws = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_LAW',
      html_content: { not: null },
    },
    select: {
      id: true,
      document_number: true,
      title: true,
      html_content: true,
    },
    orderBy: { document_number: 'desc' },
    take: 200,
  })

  // Pick ones that need normalization (don't have article.legal-document)
  const lawCandidates = laws.filter(
    (l) => l.html_content && !l.html_content.includes('class="legal-document"')
  )
  // Mix of chaptered and flat
  const chaptered = lawCandidates.filter(
    (l) =>
      l.html_content!.includes('name="K1"') ||
      l.html_content!.includes('name="K2"')
  )
  const flatLaws = lawCandidates.filter(
    (l) => !l.html_content!.includes('name="K1"')
  )
  const lawSample = [...chaptered.slice(0, 6), ...flatLaws.slice(0, 4)].slice(
    0,
    SAMPLE
  )

  let lawCount = 0
  for (const doc of lawSample) {
    const changed = await processDoc(
      doc as DocRow,
      (html) =>
        normalizeSfsLaw(html, {
          documentNumber: doc.document_number,
          title: doc.title,
        }),
      'law'
    )
    if (changed) {
      lawCount++
      results.push({
        type: 'SFS_LAW',
        doc: doc.document_number,
        title: doc.title,
      })
    }
  }

  // --- 10 Agency Docs (LLM-ingested, not html-scraped) ---
  console.log(`\n--- Agency Regulations (class rename) ---\n`)
  const agencyDocs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'AGENCY_REGULATION',
      html_content: { not: null },
      NOT: {
        metadata: { path: ['method'], equals: 'html-scraping' },
      },
    },
    select: {
      id: true,
      document_number: true,
      title: true,
      html_content: true,
    },
    orderBy: { document_number: 'desc' },
    take: 200,
  })

  // Pick ones that still have class="sfs"
  const agencyCandidates = agencyDocs.filter(
    (a) => a.html_content && a.html_content.includes('class="sfs"')
  )
  const agencySample = agencyCandidates.slice(0, SAMPLE)

  let agencyCount = 0
  for (const doc of agencySample) {
    const changed = await processDoc(
      doc as DocRow,
      normalizeAgencyLlm,
      'agency'
    )
    if (changed) {
      agencyCount++
      results.push({
        type: 'AGENCY_REGULATION',
        doc: doc.document_number,
        title: doc.title,
      })
    }
  }

  // --- Summary ---
  console.log(`\n${'='.repeat(60)}`)
  console.log(`\n=== Summary ===\n`)
  console.log(
    `  Amendments normalized: ${amendCount}/${amendmentSample.length}`
  )
  console.log(`  SFS laws normalized:   ${lawCount}/${lawSample.length}`)
  console.log(`  Agency docs renamed:   ${agencyCount}/${agencySample.length}`)
  console.log(`  Total:                 ${results.length}\n`)

  if (results.length > 0) {
    console.log(`\n=== Review List ===\n`)
    for (const r of results) {
      console.log(`  [${r.type}] ${r.doc} — ${r.title.substring(0, 70)}`)
    }
  }

  if (!WRITE && results.length > 0) {
    console.log(`\n  Run with --write to apply changes to DB`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
