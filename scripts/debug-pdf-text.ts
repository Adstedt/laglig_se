/**
 * Debug script to check PDF text extraction quality
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { extractAffectedSections } from '../lib/external/pdf-parser'

const prisma = new PrismaClient()

async function main() {
  // Get documents with section changes to compare regex vs LLM parsing
  const docs = await prisma.amendmentDocument.findMany({
    where: {
      parse_status: 'COMPLETED',
      full_text: { not: null },
    },
    select: {
      sfs_number: true,
      full_text: true,
      section_changes: {
        select: { chapter: true, section: true, change_type: true },
        orderBy: { sort_order: 'asc' },
      },
    },
    orderBy: { sfs_number: 'asc' },
    // take: 10000  // All documents
  })

  console.log(
    `Comparing regex vs LLM section parsing for ${docs.length} documents\n`
  )

  let matches = 0
  let mismatches = 0
  let llmBetter = 0
  let regexBetter = 0

  for (const doc of docs) {
    const text = doc.full_text || ''

    // Run our regex-based extraction
    const regexSections = extractAffectedSections(text)
    const llmSections = doc.section_changes

    // Compare
    const regexCount = regexSections.length
    const llmCount = llmSections.length

    if (regexCount === llmCount) {
      matches++
    } else {
      mismatches++
      if (llmCount > regexCount) llmBetter++
      else regexBetter++
      // Only show first 5 mismatches in detail
      if (mismatches <= 5) {
        console.log('='.repeat(60))
        console.log(`SFS: ${doc.sfs_number}`)
        console.log(`  Regex found: ${regexCount} sections`)
        console.log(`  LLM found: ${llmCount} sections`)

        // Show differences
        console.log('\n  Regex results:')
        regexSections.forEach((s) => {
          const ch = s.chapter ? `${s.chapter} kap. ` : ''
          console.log(`    ${ch}${s.section} § - ${s.type}`)
        })

        console.log('\n  LLM results:')
        llmSections.forEach((s) => {
          const ch = s.chapter ? `${s.chapter} kap. ` : ''
          console.log(`    ${ch}${s.section} § - ${s.change_type}`)
        })

        // Show relevant text snippet
        console.log('\n  Text snippet (first 500 chars):')
        console.log('    ' + text.substring(0, 500).replace(/\n/g, '\n    '))
        console.log()
      }
    }
  }

  const matchRate = ((matches / docs.length) * 100).toFixed(1)
  const llmBetterRate = ((llmBetter / mismatches) * 100).toFixed(1)

  console.log('='.repeat(60))
  console.log(`Summary:`)
  console.log(`  Total documents: ${docs.length}`)
  console.log(`  Regex matches LLM: ${matches} (${matchRate}%)`)
  console.log(`  Mismatches: ${mismatches}`)
  console.log(
    `    - LLM found more: ${llmBetter} (${llmBetterRate}% of mismatches)`
  )
  console.log(`    - Regex found more: ${regexBetter}`)

  await prisma.$disconnect()
}

main().catch(console.error)
