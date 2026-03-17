#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Find and repair amendments with empty a.paragraf IDs (broken by previous normalizer).
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import * as cheerio from 'cheerio'
import { normalizeSfsAmendment } from '../lib/transforms/normalizers/sfs-amendment-normalizer'

const prisma = new PrismaClient()
const WRITE = process.argv.includes('--write')

async function main() {
  console.log(
    `Mode: ${WRITE ? 'WRITE TO DB' : 'DRY RUN (use --write to apply)'}\n`
  )

  // Find all amendments that have the broken pattern: a.paragraf with empty id
  const amendments = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_AMENDMENT',
      html_content: { contains: 'class="paragraf" id=""' },
    },
    select: {
      id: true,
      document_number: true,
      title: true,
      html_content: true,
    },
    orderBy: { document_number: 'desc' },
  })

  console.log(
    `Found ${amendments.length} amendments with empty a.paragraf IDs:\n`
  )

  let repaired = 0
  for (const doc of amendments) {
    const html = doc.html_content!
    const $before = cheerio.load(html)
    const emptyBefore = $before('a.paragraf[id=""]').length

    const result = normalizeSfsAmendment(html, {
      documentNumber: doc.document_number,
      title: doc.title,
    })

    const $after = cheerio.load(result)
    const emptyAfter = $after('a.paragraf[id=""]').length
    const changed = result !== html

    if (changed) {
      repaired++
      console.log(
        `✓ ${doc.document_number} — empty IDs: ${emptyBefore}→${emptyAfter}`
      )

      // Show the repaired anchor IDs
      $after('a.paragraf').each((_, el) => {
        const id = $after(el).attr('id')
        const text = $after(el).text().trim()
        console.log(`    ${text} → id="${id}"`)
      })

      if (WRITE) {
        await prisma.legalDocument.update({
          where: { id: doc.id },
          data: { html_content: result },
        })
        console.log(`    → Written to DB`)
      }
    } else {
      console.log(`– ${doc.document_number} (unchanged)`)
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`  Total found: ${amendments.length}`)
  console.log(`  Repaired: ${repaired}`)
  if (!WRITE && repaired > 0) console.log(`\n  Run with --write to apply`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
