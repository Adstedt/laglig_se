/**
 * Database cleanup script: Remove hyphenation artifacts from law text
 *
 * This script fixes line-break hyphenation issues in existing law data.
 * Run with: pnpm tsx scripts/cleanup-hyphenation.ts
 *
 * Options:
 *   --dry-run    Show what would be changed without making changes
 *   --limit=N    Only process N documents (for testing)
 */

import { PrismaClient } from '@prisma/client'
import { cleanLineBreakHyphens } from '../lib/utils/text-cleanup'

const prisma = new PrismaClient()

// Pattern to detect potential hyphenation issues (lowercase letter-hyphen-lowercase letter)
const HYPHEN_PATTERN = /[a-zåäöéü]-[a-zåäöéü]/

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitArg = args.find((a) => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined

  console.log('=== Hyphenation Cleanup Script ===')
  console.log(
    `Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}`
  )
  if (limit) console.log(`Limit: ${limit} documents`)
  console.log('')

  let totalChecked = 0
  let totalIssues = 0
  let totalUpdated = 0

  // 1. Clean LegalDocument (laws)
  console.log('--- Checking LegalDocument (laws) ---')
  const legalDocs = await prisma.legalDocument.findMany({
    where: {
      OR: [
        { html_content: { contains: '-' } },
        { full_text: { contains: '-' } },
      ],
    },
    select: {
      id: true,
      document_number: true,
      title: true,
      html_content: true,
      full_text: true,
    },
    take: limit,
  })

  for (const doc of legalDocs) {
    totalChecked++
    const htmlHasIssue =
      doc.html_content && HYPHEN_PATTERN.test(doc.html_content)
    const textHasIssue = doc.full_text && HYPHEN_PATTERN.test(doc.full_text)

    if (!htmlHasIssue && !textHasIssue) continue

    const cleanedHtml = doc.html_content
      ? cleanLineBreakHyphens(doc.html_content)
      : null
    const cleanedText = doc.full_text
      ? cleanLineBreakHyphens(doc.full_text)
      : null

    const htmlChanged = cleanedHtml !== doc.html_content
    const textChanged = cleanedText !== doc.full_text

    if (!htmlChanged && !textChanged) continue

    totalIssues++

    // Find examples of hyphenation patterns
    const examples =
      (doc.html_content || doc.full_text || '')
        .match(/[a-zåäö]+-[a-zåäö]+/gi)
        ?.filter((m) => m.length > 3)
        ?.slice(0, 5) || []

    console.log(`\n  ${doc.document_number}: ${doc.title?.substring(0, 40)}...`)
    if (examples.length) {
      console.log(`    Examples: ${examples.join(', ')}`)
    }

    if (!dryRun) {
      await prisma.legalDocument.update({
        where: { id: doc.id },
        data: {
          html_content: cleanedHtml,
          full_text: cleanedText,
        },
      })
      totalUpdated++
      console.log(`    ✓ Updated`)
    } else {
      console.log(`    (would update)`)
    }
  }

  // 2. Clean AmendmentDocument
  console.log('\n--- Checking AmendmentDocument (amendments) ---')
  const amendments = await prisma.amendmentDocument.findMany({
    where: {
      OR: [
        { markdown_content: { contains: '-' } },
        { full_text: { contains: '-' } },
      ],
    },
    select: {
      id: true,
      sfs_number: true,
      markdown_content: true,
      full_text: true,
    },
    take: limit,
  })

  for (const doc of amendments) {
    totalChecked++
    const mdHasIssue =
      doc.markdown_content && HYPHEN_PATTERN.test(doc.markdown_content)
    const textHasIssue = doc.full_text && HYPHEN_PATTERN.test(doc.full_text)

    if (!mdHasIssue && !textHasIssue) continue

    const cleanedMd = doc.markdown_content
      ? cleanLineBreakHyphens(doc.markdown_content)
      : null
    const cleanedText = doc.full_text
      ? cleanLineBreakHyphens(doc.full_text)
      : null

    const mdChanged = cleanedMd !== doc.markdown_content
    const textChanged = cleanedText !== doc.full_text

    if (!mdChanged && !textChanged) continue

    totalIssues++

    const examples =
      (doc.markdown_content || doc.full_text || '')
        .match(/[a-zåäö]+-[a-zåäö]+/gi)
        ?.filter((m) => m.length > 3)
        ?.slice(0, 5) || []

    console.log(`\n  ${doc.sfs_number}`)
    if (examples.length) {
      console.log(`    Examples: ${examples.join(', ')}`)
    }

    if (!dryRun) {
      await prisma.amendmentDocument.update({
        where: { id: doc.id },
        data: {
          markdown_content: cleanedMd,
          full_text: cleanedText,
        },
      })
      totalUpdated++
      console.log(`    ✓ Updated`)
    } else {
      console.log(`    (would update)`)
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Documents checked: ${totalChecked}`)
  console.log(`Documents with hyphenation issues: ${totalIssues}`)
  console.log(`Documents updated: ${dryRun ? '0 (dry run)' : totalUpdated}`)

  if (dryRun && totalIssues > 0) {
    console.log('\nRun without --dry-run to apply changes.')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
