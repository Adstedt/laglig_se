#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Test the amendment normalizer on real DB data and optionally write back.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import * as cheerio from 'cheerio'
import { normalizeSfsAmendment } from '../lib/transforms/normalizers/sfs-amendment-normalizer'

const prisma = new PrismaClient()
const WRITE_TO_DB = process.argv.includes('--write')
const SAMPLE_SIZE = 10

function countMarkers(html: string) {
  const $ = cheerio.load(html)
  return {
    'div.N2': $('div.N2').length,
    'section.ann': $('section.ann').length,
    'div.annzone': $('div.annzone').length,
    'sup.footnote': $('sup.footnote').length,
    'a.paragraf': $('a.paragraf').length,
    'h3.paragraph': $('h3.paragraph').length,
    'article.sfs': $('article.sfs').length,
    'article.legal-document': $('article.legal-document').length,
  }
}

async function main() {
  console.log(
    `Mode: ${WRITE_TO_DB ? 'WRITE TO DB' : 'dry run (use --write to apply)'}\n`
  )

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

  const notisumAmendments = amendments.filter(
    (a) =>
      a.html_content &&
      (a.html_content.includes('annzone') ||
        a.html_content.includes('class="ann"'))
  )

  const sample = notisumAmendments.slice(0, SAMPLE_SIZE)
  console.log(`Processing ${sample.length} amendments:\n`)

  let success = 0
  let errors = 0

  for (const doc of sample) {
    const html = doc.html_content!
    const before = countMarkers(html)

    try {
      const result = normalizeSfsAmendment(html, {
        documentNumber: doc.document_number,
        title: doc.title,
      })
      const after = countMarkers(result)
      const changed = result !== html

      if (changed) {
        success++
        console.log(`✓ ${doc.document_number}`)
        console.log(
          `    wrappers: N2 ${before['div.N2']}→${after['div.N2']}, ann ${before['section.ann']}→${after['section.ann']}, annzone ${before['div.annzone']}→${after['div.annzone']}`
        )
        console.log(
          `    footnotes: sup.footnote ${before['sup.footnote']}→${after['sup.footnote']}`
        )
        console.log(
          `    anchors: a.paragraf ${before['a.paragraf']}→${after['a.paragraf']}`
        )
        console.log(
          `    wrapper: ${before['article.sfs'] ? 'sfs→legal-document' : 'legal-document (unchanged)'}`
        )

        if (WRITE_TO_DB) {
          await prisma.legalDocument.update({
            where: { id: doc.id },
            data: { html_content: result },
          })
          console.log(`    → Written to DB`)
        }
      } else {
        console.log(`– ${doc.document_number} (unchanged)`)
      }
    } catch (err) {
      errors++
      console.log(
        `✗ ${doc.document_number}: ${err instanceof Error ? err.message : err}`
      )
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`  Normalized: ${success}`)
  console.log(`  Errors: ${errors}`)
  if (!WRITE_TO_DB && success > 0)
    console.log(`\n  Run with --write to apply changes to DB`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
