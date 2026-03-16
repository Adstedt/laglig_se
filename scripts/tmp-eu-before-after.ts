/**
 * EU Transformer Before/After — Pick 5 EU docs, show current DB state,
 * then re-transform and show what would change.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import * as cheerio from 'cheerio'
import { fetchDocumentContentViaCellar } from '../lib/external/eurlex'
import {
  transformEuHtml,
  type EuDocumentInfo,
} from '../lib/eu/eu-html-transformer'

const prisma = new PrismaClient()

// 5 docs: 2 big chaptered, 2 mid-sized flat, 1 small
const TEST_CELEX = [
  '32016R0679', // GDPR — big, chaptered (11 chapters, 99 articles)
  '32006R1907', // REACH — huge, chaptered
  '32006R0561', // Driving & rest times — mid, flat
  '32020R0852', // Taxonomy — mid, chaptered
  '32023R0956', // CBAM — mid, chaptered
]

function analyzeHtml(html: string): Record<string, number | boolean | string> {
  const $ = cheerio.load(html)
  return {
    length: html.length,
    'article.legal-document': $('article.legal-document').length,
    'div.body': $('div.body').length,
    'div.preamble': $('div.preamble').length,
    'section.kapitel': $('section.kapitel').length,
    'h2.kapitel-rubrik': $('h2.kapitel-rubrik').length,
    'a.paragraf': $('a.paragraf').length,
    'h3.paragraph': $('h3.paragraph').length,
    'p.text': $('p.text').length,
    'p (no class)': $('p:not([class])').length,
    'sup.footnote-ref': $('sup.footnote-ref').length,
    'table.legal-table': $('table.legal-table').length,
    'table (total)': $('table').length,
    'div.lovhead': $('div.lovhead').length,
  }
}

async function main() {
  for (const celex of TEST_CELEX) {
    console.log('='.repeat(70))
    console.log(`CELEX: ${celex}`)
    console.log('='.repeat(70))

    // 1. Get current DB state
    const doc = await prisma.legalDocument.findFirst({
      where: { document_number: { contains: celex } },
      select: {
        document_number: true,
        title: true,
        html_content: true,
        slug: true,
      },
    })

    if (!doc) {
      console.log('  NOT FOUND IN DB\n')
      continue
    }

    console.log(`  Doc: ${doc.document_number}`)
    console.log(`  Title: ${(doc.title || '').substring(0, 70)}`)

    const currentHtml = doc.html_content || ''
    if (currentHtml) {
      console.log('\n  BEFORE (current DB):')
      const before = analyzeHtml(currentHtml)
      for (const [k, v] of Object.entries(before)) {
        console.log(`    ${k}: ${v}`)
      }
    } else {
      console.log('  NO HTML CONTENT IN DB')
    }

    // 2. Fetch from CELLAR and transform
    console.log('\n  Fetching from CELLAR...')
    try {
      const cellarResult = await fetchDocumentContentViaCellar(celex)
      if (!cellarResult) {
        console.log('  CELLAR returned empty/unavailable\n')
        continue
      }

      console.log(`  Raw CELLAR HTML: ${cellarResult.html.length} chars`)

      const docInfo: EuDocumentInfo = {
        celex,
        documentNumber: doc.document_number,
        shortTitle: doc.title || undefined,
      }

      const result = transformEuHtml(cellarResult.html, docInfo)

      console.log(`\n  AFTER (fresh transform):`)
      console.log(`    structureType: ${result.structureType}`)
      console.log(
        `    stats: chapters=${result.stats.chapterCount}, articles=${result.stats.articleCount}, recitals=${result.stats.recitalCount}, footnotes=${result.stats.footnoteCount}, tables=${result.stats.tableCount}`
      )

      const after = analyzeHtml(result.html)
      for (const [k, v] of Object.entries(after)) {
        console.log(`    ${k}: ${v}`)
      }

      // Highlight differences
      if (currentHtml) {
        const beforeStats = analyzeHtml(currentHtml)
        const diffs: string[] = []
        for (const key of Object.keys(after)) {
          if (beforeStats[key] !== after[key]) {
            diffs.push(`${key}: ${beforeStats[key]} → ${after[key]}`)
          }
        }
        if (diffs.length > 0) {
          console.log('\n  CHANGES:')
          for (const d of diffs) {
            console.log(`    ${d}`)
          }
        } else {
          console.log('\n  NO CHANGES (already transformed)')
        }
      }
    } catch (err) {
      console.log(`  FETCH ERROR: ${err instanceof Error ? err.message : err}`)
    }

    console.log()
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
