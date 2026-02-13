/**
 * Migration script: Move `id` from `section.ann` to child `h3.paragraph`
 *
 * This makes existing amendment HTML compatible with StickyDocNav (TOC sidebar)
 * which requires headings to have id/name attributes for navigation.
 *
 * Transform:
 *   <section class="ann" id="X">
 *     <div class="element-body annzone">
 *       <h3 class="paragraph">...</h3>
 *   →
 *   <section class="ann">
 *     <div class="element-body annzone">
 *       <h3 class="paragraph" id="X">...</h3>
 *
 * Also handles group headers:
 *   <section class="group ann N2" id="X">
 *   →
 *   <section class="group ann N2">
 *   (h3.group already has its own id from the LLM, so just remove section id)
 *
 * Pure DOM manipulation via cheerio — no LLM, zero cost.
 *
 * Usage:
 *   npx tsx scripts/migrate-amendment-heading-ids.ts [--dry-run]
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import * as cheerio from 'cheerio'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

function transformHtml(html: string): { transformed: string; changes: number } {
  const $ = cheerio.load(html, { decodeEntities: false })
  let changes = 0

  // Move id from section.ann to child h3.paragraph
  $('section.ann[id]').each(function () {
    const section = $(this)
    const id = section.attr('id')
    if (!id) return

    // Skip group sections — their h3.group already has its own id
    if (section.hasClass('group')) {
      section.removeAttr('id')
      changes++
      return
    }

    const h3 = section.find('h3.paragraph').first()
    if (h3.length > 0 && !h3.attr('id')) {
      h3.attr('id', id)
      section.removeAttr('id')
      changes++
    }
  })

  return { transformed: $.html(), changes }
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE RUN ===')
  console.log('')

  // Find all amendments with html_content
  const docs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_AMENDMENT',
      html_content: { not: null },
    },
    select: {
      id: true,
      document_number: true,
      html_content: true,
    },
  })

  console.log(`Found ${docs.length} amendments with html_content`)

  let updated = 0
  let skipped = 0
  let errors = 0

  for (const doc of docs) {
    try {
      const { transformed, changes } = transformHtml(doc.html_content!)

      if (changes === 0) {
        skipped++
        continue
      }

      if (!DRY_RUN) {
        await prisma.legalDocument.update({
          where: { id: doc.id },
          data: { html_content: transformed },
        })
      }

      updated++
      console.log(
        `  ${DRY_RUN ? '[DRY]' : '[OK]'} ${doc.document_number}: ${changes} heading IDs moved`
      )
    } catch (err) {
      errors++
      console.error(`  [ERR] ${doc.document_number}: ${err}`)
    }
  }

  console.log('')
  console.log(
    `Done. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`
  )

  await prisma.$disconnect()
}

main()
