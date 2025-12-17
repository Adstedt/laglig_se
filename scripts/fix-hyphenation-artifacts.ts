/**
 * Fix hyphenation artifacts in database
 *
 * Strategy:
 * 1. Find hyphen+newline patterns in full_text (raw PDF)
 * 2. Build a map of broken → fixed words
 * 3. Apply fixes to both full_text and new_text
 *
 * This is safe because hyphen+newline ONLY occurs at PDF line breaks,
 * never in intentional compound words.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface _FixResult {
  amendmentSfs: string
  fullTextFixes: number
  sectionTextFixes: number
  wordsFixed: string[]
}

// Swedish conjunctions that follow hyphens intentionally (e.g., "plan- och bygglagen")
const INTENTIONAL_CONJUNCTIONS = new Set(['och', 'eller', 'samt', 'respektive'])

// Find all hyphen+newline patterns and return the fixes needed
function findHyphenationFixes(text: string): Map<string, string> {
  const fixes = new Map<string, string>()

  // Pattern: letter(s) + hyphen + newline + letter(s)
  // Capture the broken word parts
  const pattern = /([a-zåäöéü]+)-\n([a-zåäöéü]+)/gi

  let match
  while ((match = pattern.exec(text)) !== null) {
    const leftPart = match[1]
    const rightPart = match[2]

    // Skip intentional constructs like "plan- och" (Swedish compound abbreviation)
    if (INTENTIONAL_CONJUNCTIONS.has(rightPart.toLowerCase())) {
      continue
    }

    const broken = `${leftPart}-${rightPart}` // "änd-ras" (without newline)
    const fixed = `${leftPart}${rightPart}` // "ändras"
    fixes.set(broken.toLowerCase(), fixed.toLowerCase())
  }

  return fixes
}

// Apply fixes to text (case-insensitive replacement)
function applyFixes(text: string, fixes: Map<string, string>): string {
  let result = text

  for (const [broken, fixed] of fixes) {
    // Replace with case preservation
    const regex = new RegExp(
      broken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'gi'
    )
    result = result.replace(regex, (match) => {
      // Preserve original case
      if (match[0] === match[0].toUpperCase()) {
        return fixed.charAt(0).toUpperCase() + fixed.slice(1)
      }
      return fixed
    })
  }

  // Also fix the hyphen+newline directly in full_text (but preserve conjunctions)
  result = result.replace(
    /([a-zåäöéü]+)-\n([a-zåäöéü]+)/gi,
    (match, left, right) => {
      if (INTENTIONAL_CONJUNCTIONS.has(right.toLowerCase())) {
        return match // Keep original including newline for conjunctions
      }
      return left + right
    }
  )

  return result
}

async function previewFixes(): Promise<void> {
  console.log('='.repeat(70))
  console.log('PREVIEW MODE - No changes will be made')
  console.log('='.repeat(70))
  console.log('')

  // Count total amendments with full_text
  const totalCount = await prisma.amendmentDocument.count({
    where: { full_text: { not: null } },
  })
  console.log(`Found ${totalCount} amendments with PDF text`)

  let totalFullTextFixes = 0
  let amendmentsWithFixes = 0
  const allWordsFixed = new Set<string>()
  const BATCH_SIZE = 500

  // Process in batches
  for (let skip = 0; skip < totalCount; skip += BATCH_SIZE) {
    const amendments = await prisma.amendmentDocument.findMany({
      where: { full_text: { not: null } },
      select: { id: true, sfs_number: true, full_text: true },
      skip,
      take: BATCH_SIZE,
    })

    for (const amendment of amendments) {
      if (!amendment.full_text) continue

      const fixes = findHyphenationFixes(amendment.full_text)

      if (fixes.size === 0) continue

      amendmentsWithFixes++

      // Only print first 20 amendments with issues
      if (amendmentsWithFixes <= 20) {
        console.log(`\n${amendment.sfs_number}:`)
        console.log(`  Broken words found in PDF: ${fixes.size}`)

        for (const [broken, fixed] of fixes) {
          console.log(`    "${broken}" → "${fixed}"`)
        }
      }

      for (const [broken, fixed] of fixes) {
        allWordsFixed.add(`${broken} → ${fixed}`)
      }

      totalFullTextFixes += fixes.size
    }

    if (skip + BATCH_SIZE < totalCount) {
      console.log(
        `\n... processed ${Math.min(skip + BATCH_SIZE, totalCount)}/${totalCount}`
      )
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('PREVIEW SUMMARY')
  console.log('='.repeat(70))
  console.log(`Amendments scanned: ${totalCount}`)
  console.log(`Amendments with hyphenation issues: ${amendmentsWithFixes}`)
  console.log(`Total broken word patterns to fix: ${totalFullTextFixes}`)
  console.log(`\nUnique word fixes (first 30):`)
  for (const fix of [...allWordsFixed].slice(0, 30)) {
    console.log(`  ${fix}`)
  }
  if (allWordsFixed.size > 30) {
    console.log(`  ... and ${allWordsFixed.size - 30} more`)
  }
}

async function applyAllFixes(): Promise<void> {
  console.log('='.repeat(70))
  console.log('APPLYING FIXES')
  console.log('='.repeat(70))
  console.log('')

  const totalCount = await prisma.amendmentDocument.count({
    where: { full_text: { not: null } },
  })
  console.log(`Processing ${totalCount} amendments...`)

  let amendmentsFixed = 0
  let sectionsFixed = 0
  const BATCH_SIZE = 100

  for (let skip = 0; skip < totalCount; skip += BATCH_SIZE) {
    const amendments = await prisma.amendmentDocument.findMany({
      where: { full_text: { not: null } },
      select: {
        id: true,
        sfs_number: true,
        full_text: true,
        markdown_content: true,
      },
      skip,
      take: BATCH_SIZE,
    })

    for (const amendment of amendments) {
      if (!amendment.full_text) continue

      const fixes = findHyphenationFixes(amendment.full_text)

      if (fixes.size === 0) continue

      // Fix full_text
      const fixedFullText = applyFixes(amendment.full_text, fixes)

      // Fix markdown_content if exists
      const fixedMarkdown = amendment.markdown_content
        ? applyFixes(amendment.markdown_content, fixes)
        : null

      // Update amendment
      await prisma.amendmentDocument.update({
        where: { id: amendment.id },
        data: {
          full_text: fixedFullText,
          markdown_content: fixedMarkdown,
        },
      })

      amendmentsFixed++

      // Get and fix section changes for this amendment
      const sectionChanges = await prisma.sectionChange.findMany({
        where: { amendment_id: amendment.id, new_text: { not: null } },
      })

      for (const change of sectionChanges) {
        if (!change.new_text) continue

        const fixedText = applyFixes(change.new_text, fixes)

        if (fixedText !== change.new_text) {
          await prisma.sectionChange.update({
            where: { id: change.id },
            data: { new_text: fixedText },
          })
          sectionsFixed++
        }
      }
    }

    console.log(
      `Progress: ${Math.min(skip + BATCH_SIZE, totalCount)}/${totalCount} (${amendmentsFixed} fixed)`
    )
  }

  console.log('\n' + '='.repeat(70))
  console.log('COMPLETE')
  console.log('='.repeat(70))
  console.log(`Amendments fixed: ${amendmentsFixed}`)
  console.log(`Section texts fixed: ${sectionsFixed}`)
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = !args.includes('--apply')

  if (dryRun) {
    await previewFixes()
    console.log('\n⚠️  This was a PREVIEW. Run with --apply to make changes.')
  } else {
    console.log('⚠️  APPLYING CHANGES TO DATABASE\n')
    await applyAllFixes()
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
