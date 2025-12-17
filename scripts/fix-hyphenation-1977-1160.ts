/**
 * Fix hyphenation artifacts for SFS 1977:1160 only (test baseline)
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Swedish conjunctions that follow hyphens intentionally (e.g., "plan- och bygglagen")
const INTENTIONAL_CONJUNCTIONS = new Set(['och', 'eller', 'samt', 'respektive'])

// Known intentional prefixes that should keep their hyphen
const INTENTIONAL_PREFIXES = new Set([
  'e',
  'f',
  'i',
  'a',
  'u',
  'n', // single letter prefixes
  'eu',
  'it',
  'tv',
  'ce',
  'uk',
  'us', // country/tech abbreviations
  'icke',
  'själv',
  'semi',
  'anti',
  'pre',
  'post',
  'ex',
  'vice', // actual prefixes
  // Common Swedish legal/regulatory abbreviations
  'lss',
  'mrv',
  'aif',
  'euf',
  'nis',
  'dna',
  'rna',
  'hiv',
  'bnp',
  'gdp',
  'csirt',
  'safe',
  'glp',
  'goc',
  'roc',
  'otc',
  'esf',
  'euf',
  'fatca',
  'atpl',
  'nace',
  'pair',
  'novo',
  'dals',
  'öster',
])

// Find all hyphen+newline patterns and return the fixes needed
function findHyphenationFixes(text: string): Map<string, string> {
  const fixes = new Map<string, string>()
  const pattern = /([a-zåäöéü]+)-\n([a-zåäöéü]+)/gi

  let match
  while ((match = pattern.exec(text)) !== null) {
    const leftPart = match[1]
    const rightPart = match[2]

    if (INTENTIONAL_CONJUNCTIONS.has(rightPart.toLowerCase())) {
      continue
    }

    const broken = `${leftPart}-${rightPart}`
    const fixed = `${leftPart}${rightPart}`
    fixes.set(broken.toLowerCase(), fixed.toLowerCase())
  }

  return fixes
}

// Find hyphenated words in new_text that are likely LLM artifacts (no newline)
function findLLMArtifacts(text: string): Map<string, string> {
  const fixes = new Map<string, string>()
  // Pattern: letter + hyphen + letter (NOT followed by newline, which is handled separately)
  const pattern = /([a-zåäöéü]{3,})-([a-zåäöéü]{3,})/gi

  let match
  while ((match = pattern.exec(text)) !== null) {
    const leftPart = match[1]
    const rightPart = match[2]

    // Skip if right part is a conjunction
    if (INTENTIONAL_CONJUNCTIONS.has(rightPart.toLowerCase())) {
      continue
    }

    // Skip if left part is a known intentional prefix
    if (INTENTIONAL_PREFIXES.has(leftPart.toLowerCase())) {
      continue
    }

    // Skip if this looks like an intentional compound (both parts are substantial words)
    // Heuristic: if right part ends with common word endings, it's likely a broken word
    const brokenWordEndings = [
      'mitté',
      'ning',
      'het',
      'else',
      'ande',
      'tion',
      'erna',
      'aren',
      'arna',
      'ighet',
    ]
    const looksLikeBrokenWord = brokenWordEndings.some((ending) =>
      rightPart.toLowerCase().endsWith(ending)
    )

    if (looksLikeBrokenWord) {
      const broken = `${leftPart}-${rightPart}`
      const fixed = `${leftPart}${rightPart}`
      fixes.set(broken.toLowerCase(), fixed.toLowerCase())
    }
  }

  return fixes
}

// Apply fixes to text
function applyFixes(text: string, fixes: Map<string, string>): string {
  let result = text

  // Apply map-based fixes (for cases where LLM removed newline but kept hyphen)
  for (const [broken, fixed] of fixes) {
    const regex = new RegExp(
      broken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'gi'
    )
    result = result.replace(regex, (match) => {
      if (match[0] === match[0].toUpperCase()) {
        return fixed.charAt(0).toUpperCase() + fixed.slice(1)
      }
      return fixed
    })
  }

  // Fix hyphen+newline directly
  result = result.replace(
    /([a-zåäöéü]+)-\n([a-zåäöéü]+)/gi,
    (match, left, right) => {
      if (INTENTIONAL_CONJUNCTIONS.has(right.toLowerCase())) {
        return match
      }
      return left + right
    }
  )

  // Fix hyphen+space directly (LLM sometimes converts newline to space)
  result = result.replace(
    /([a-zåäöéü]+)- ([a-zåäöéü]+)/gi,
    (match, left, right) => {
      if (INTENTIONAL_CONJUNCTIONS.has(right.toLowerCase())) {
        return match
      }
      // Skip known intentional prefixes
      if (INTENTIONAL_PREFIXES.has(left.toLowerCase())) {
        return match
      }
      return left + right
    }
  )

  return result
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = !args.includes('--apply')

  console.log('='.repeat(70))
  console.log(
    dryRun
      ? 'PREVIEW MODE - SFS 1977:1160 only'
      : 'APPLYING FIXES - SFS 1977:1160 only'
  )
  console.log('='.repeat(70))

  // Get amendments for 1977:1160
  const amendments = await prisma.amendmentDocument.findMany({
    where: { base_law_sfs: 'SFS 1977:1160' },
    select: {
      id: true,
      sfs_number: true,
      full_text: true,
      markdown_content: true,
    },
  })

  console.log(`\nFound ${amendments.length} amendments for SFS 1977:1160`)

  let amendmentsWithIssues = 0
  let sectionsFixed = 0
  let totalPatterns = 0

  for (const amendment of amendments) {
    // Build fixes map from full_text (raw PDF) - catches hyphen+newline patterns
    const pdfFixes = amendment.full_text
      ? findHyphenationFixes(amendment.full_text)
      : new Map<string, string>()

    // Get section changes for this amendment
    const sectionChanges = await prisma.sectionChange.findMany({
      where: { amendment_id: amendment.id, new_text: { not: null } },
      select: { id: true, chapter: true, section: true, new_text: true },
    })

    // Check each section for issues
    let amendmentHasIssues = false
    const sectionFixes: {
      chapter: string | null
      section: string
      before: string
      after: string
    }[] = []

    for (const sc of sectionChanges) {
      if (!sc.new_text) continue

      // Also find LLM artifacts directly in new_text (hyphen without newline)
      const llmFixes = findLLMArtifacts(sc.new_text)

      // Merge both fix maps
      const allFixes = new Map([...pdfFixes, ...llmFixes])

      const fixedText = applyFixes(sc.new_text, allFixes)

      if (fixedText !== sc.new_text) {
        amendmentHasIssues = true

        // Count patterns fixed
        const hyphenNewlineCount = (
          sc.new_text.match(/[a-zåäöéü]+-\n[a-zåäöéü]+/gi) || []
        ).length
        totalPatterns += hyphenNewlineCount

        sectionFixes.push({
          chapter: sc.chapter,
          section: sc.section,
          before: sc.new_text.substring(0, 100).replace(/\n/g, '↵'),
          after: fixedText.substring(0, 100).replace(/\n/g, '↵'),
        })

        if (!dryRun) {
          await prisma.sectionChange.update({
            where: { id: sc.id },
            data: { new_text: fixedText },
          })
          sectionsFixed++
        }
      }
    }

    if (amendmentHasIssues) {
      amendmentsWithIssues++
      console.log(`\n${amendment.sfs_number}:`)

      if (dryRun) {
        for (const fix of sectionFixes.slice(0, 3)) {
          console.log(`  ${fix.chapter || ''} kap. ${fix.section} §:`)
          console.log(`    Before: "${fix.before}..."`)
          console.log(`    After:  "${fix.after}..."`)
        }
        if (sectionFixes.length > 3) {
          console.log(`  ... and ${sectionFixes.length - 3} more sections`)
        }
      } else {
        console.log(`  Fixed ${sectionFixes.length} sections`)
      }

      // Also fix full_text and markdown_content if applying (use pdfFixes only for raw PDF text)
      if (!dryRun && amendment.full_text) {
        const fixedFullText = applyFixes(amendment.full_text, pdfFixes)
        const fixedMarkdown = amendment.markdown_content
          ? applyFixes(amendment.markdown_content, pdfFixes)
          : null

        await prisma.amendmentDocument.update({
          where: { id: amendment.id },
          data: {
            full_text: fixedFullText,
            markdown_content: fixedMarkdown,
          },
        })
      }
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log(`Amendments scanned: ${amendments.length}`)
  console.log(`Amendments with hyphenation issues: ${amendmentsWithIssues}`)
  console.log(`Total hyphen+newline patterns: ${totalPatterns}`)

  if (dryRun) {
    console.log(
      `\nSections that would be fixed: ${sectionChanges.length > 0 ? 'see above' : '0'}`
    )
    console.log('\n⚠️  This was a PREVIEW. Run with --apply to make changes.')
  } else {
    console.log(`Sections fixed: ${sectionsFixed}`)
    console.log('\n✓ Changes applied to database')
  }
}

// Helper to count total section changes
const _sectionChanges: unknown[] = []

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
