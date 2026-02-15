#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Story 9.4, Task 3: Fix Missing/Empty SFS Documents
 *
 * Targeted script to fix SFS 1999:381 (Sevesolagen) which exists
 * in the DB but has no content (wrong title and empty fields).
 *
 * SFS 1977:480 and SFS 1999:678 already have full content — verified
 * during Task 2 baseline audit.
 *
 * Usage:
 *   pnpm tsx scripts/fix-sfs-gaps.ts
 *   pnpm tsx scripts/fix-sfs-gaps.ts --dry-run
 */

import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { config } from 'dotenv'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { fetchLawHTML, fetchLawFullText } from '../lib/external/riksdagen'

const prisma = new PrismaClient()

interface SfsFixTarget {
  documentNumber: string
  dokId: string
  expectedTitle: string
}

const FIX_TARGETS: SfsFixTarget[] = [
  {
    documentNumber: 'SFS 1999:381',
    dokId: 'sfs-1999-381',
    expectedTitle:
      'Lag (1999:381) om åtgärder för att förebygga och begränsa följderna av allvarliga kemikalieolyckor',
  },
]

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('DRY RUN — no DB changes will be made\n')

  for (const target of FIX_TARGETS) {
    console.log(`\n=== Fixing ${target.documentNumber} ===`)
    console.log(`dok_id: ${target.dokId}`)

    // Fetch content from Riksdagen API
    console.log('Fetching HTML...')
    const htmlContent = await fetchLawHTML(target.dokId)
    console.log('Fetching full text...')
    const fullText = await fetchLawFullText(target.dokId)

    if (!htmlContent && !fullText) {
      console.log(
        `  WARNING: No content returned from Riksdagen API for ${target.dokId}`
      )
      console.log('  Trying alternate dok_id format...')

      // Try without prefix
      const altDokId = target.dokId.replace('sfs-', 'SFS ')
      console.log(`  Trying ${altDokId}...`)
      // Skip alternate for now — investigate manually if needed
      console.log(
        `  SKIPPED: ${target.documentNumber} — no content from API. Investigate manually.`
      )
      continue
    }

    console.log(
      `  HTML: ${htmlContent ? `${htmlContent.length} chars` : 'NULL'}`
    )
    console.log(`  Text: ${fullText ? `${fullText.length} chars` : 'NULL'}`)

    if (dryRun) {
      console.log('  DRY RUN: Would update DB record')
      continue
    }

    // Update the existing record
    const sourceUrl = `https://data.riksdagen.se/dokument/${target.dokId}`
    const result = await prisma.legalDocument.update({
      where: { document_number: target.documentNumber },
      data: {
        title: target.expectedTitle,
        html_content: htmlContent,
        full_text: fullText,
        source_url: sourceUrl,
        metadata: {
          dokId: target.dokId,
          fullTextUrl: `${sourceUrl}.html`,
        },
      },
    })
    console.log(`  Updated: ${result.document_number} — ${result.title}`)
  }

  // Verify
  if (!dryRun) {
    console.log('\n=== Verification ===')
    for (const target of FIX_TARGETS) {
      const doc = await prisma.legalDocument.findUnique({
        where: { document_number: target.documentNumber },
        select: {
          document_number: true,
          title: true,
          full_text: true,
          html_content: true,
        },
      })
      if (doc) {
        console.log(`${doc.document_number}: ${doc.title}`)
        console.log(
          `  full_text: ${doc.full_text ? `${doc.full_text.length} chars` : 'NULL'}`
        )
        console.log(
          `  html_content: ${doc.html_content ? `${doc.html_content.length} chars` : 'NULL'}`
        )
      }
    }
  }

  await prisma.$disconnect()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('Fix failed:', err)
    process.exit(1)
  })
}
