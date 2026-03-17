#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Rename wrapper class on agency regulation docs:
 *   class="sfs" → class="legal-document"
 *
 * These are PDF-ingested agency docs where the LLM used the old wrapper class name.
 * Inner structure is already correct — just the outer wrapper needs renaming.
 *
 * Usage:
 *   npx tsx scripts/tmp-rename-agency-wrapper.ts          # dry run
 *   npx tsx scripts/tmp-rename-agency-wrapper.ts --apply   # write to DB
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const DRY_RUN = !process.argv.includes('--apply')

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLYING'}`)

  const docs = await prisma.legalDocument.findMany({
    where: { content_type: 'AGENCY_REGULATION' },
    select: { id: true, document_number: true, html_content: true },
  })

  let needsRename = 0
  let alreadyCanonical = 0
  let noHtml = 0
  let updated = 0

  for (const doc of docs) {
    if (!doc.html_content) {
      noHtml++
      continue
    }

    if (doc.html_content.includes('class="legal-document"')) {
      alreadyCanonical++
      continue
    }

    if (doc.html_content.includes('class="sfs"')) {
      needsRename++

      if (!DRY_RUN) {
        const newHtml = doc.html_content.replace(
          /class="sfs"/g,
          'class="legal-document"'
        )
        await prisma.legalDocument.update({
          where: { id: doc.id },
          data: { html_content: newHtml },
        })
        updated++
        if (updated % 20 === 0) console.log(`  Updated ${updated}...`)
      }
    }
  }

  console.log(`\nResults:`)
  console.log(`  Already canonical:  ${alreadyCanonical}`)
  console.log(`  Needs rename:       ${needsRename}`)
  console.log(`  No HTML:            ${noHtml}`)
  console.log(`  Total:              ${docs.length}`)

  if (!DRY_RUN) {
    console.log(`\n  Updated: ${updated}`)
  } else {
    console.log(`\nDry run. Use --apply to write.`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
