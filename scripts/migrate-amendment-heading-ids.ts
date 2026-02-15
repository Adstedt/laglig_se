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

  // Pre-transform all docs in memory (cheerio is CPU-bound, no I/O)
  const pending: {
    id: string
    document_number: string
    html: string
    changes: number
  }[] = []

  for (const doc of docs) {
    try {
      const { transformed, changes } = transformHtml(doc.html_content!)
      if (changes === 0) {
        skipped++
        continue
      }
      pending.push({
        id: doc.id,
        document_number: doc.document_number!,
        html: transformed,
        changes,
      })
    } catch (err) {
      errors++
      console.error(`  [ERR] ${doc.document_number}: ${err}`)
    }
  }

  console.log(
    `  ${pending.length} documents need updates, ${skipped} already correct`
  )

  if (!DRY_RUN) {
    // Batch updates in chunks of 5 (Prisma default pool ≈ 10 connections)
    const CHUNK_SIZE = 5
    for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
      const chunk = pending.slice(i, i + CHUNK_SIZE)
      await Promise.all(
        chunk.map((doc) =>
          prisma.legalDocument
            .update({ where: { id: doc.id }, data: { html_content: doc.html } })
            .then(() => {
              updated++
            })
            .catch((err) => {
              errors++
              console.error(`  [ERR] ${doc.document_number}: ${err}`)
            })
        )
      )
      const progress = Math.min(i + CHUNK_SIZE, pending.length)
      if (progress % 500 === 0 || progress === pending.length) {
        process.stdout.write(`\r  Updated ${progress}/${pending.length}`)
      }
    }
    console.log('') // newline after progress
  } else {
    updated = pending.length
    for (const doc of pending) {
      console.log(
        `  [DRY] ${doc.document_number}: ${doc.changes} heading IDs moved`
      )
    }
  }

  console.log('')
  console.log(
    `Done. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`
  )

  await prisma.$disconnect()
}

main()
