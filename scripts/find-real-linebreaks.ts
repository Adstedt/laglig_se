/**
 * Find REAL line-break artifacts by looking for patterns where:
 * - The hyphen splits a common Swedish word
 * - Neither part is a recognizable prefix/abbreviation
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Known intentional prefixes (should keep hyphen)
const INTENTIONAL_PREFIXES = new Set([
  'e',
  'a',
  'f',
  'i',
  'u',
  'n',
  'h',
  'c',
  'p',
  's',
  't', // single letters
  'eu',
  'ees',
  'eg',
  'ap',
  'tv',
  'it',
  'va',
  'ce',
  'se',
  'rh',
  'dna',
  'cas',
  'aif',
  'kn',
  'sce',
  'otc',
  'esf',
  'cbe',
  'euf',
  'efta',
  'solas',
  'fatca',
  'icke',
  'text',
  'pepp',
  'mrv',
  'pnr',
  'amu',
  'glp',
  'lss',
  'ece',
  'hns',
  'cpv',
  'första',
  'andra',
  'tredje',
  'fjärde',
  'femte',
  'sjätte', // ordinals for ranges
  'tgl',
  'tco',
  'metoxi',
  'acetoxi',
  'hydroxi',
  'benso',
  'tetrahydro', // chemistry
])

// Common Swedish word endings that suggest a broken word
const BROKEN_WORD_ENDINGS = [
  'ning',
  'het',
  'else',
  'ande',
  'tion',
  'ighet',
  'skap',
  'samhet',
  'else',
  'ning',
  'lig',
  'liga',
  'ande',
  'erna',
  'aren',
  'arna',
]

async function main() {
  console.log('Scanning for REAL line-break artifacts...\n')

  const changes = await prisma.sectionChange.findMany({
    where: { new_text: { not: null } },
    select: { new_text: true },
  })

  const sections = await prisma.lawSection.findMany({
    select: { text_content: true },
  })

  const allTexts = [
    ...changes.map((c) => c.new_text!),
    ...sections.map((s) => s.text_content),
  ]

  const hyphenatedWords = new Map<string, number>()

  for (const text of allTexts) {
    const matches = text.match(/[a-zåäöéüA-ZÅÄÖÉÜ]+-[a-zåäöéüA-ZÅÄÖÉÜ]+/g) || []
    for (const match of matches) {
      hyphenatedWords.set(
        match.toLowerCase(),
        (hyphenatedWords.get(match.toLowerCase()) || 0) + 1
      )
    }
  }

  const realLineBreaks: [string, number, string][] = []

  for (const [word, count] of hyphenatedWords.entries()) {
    const parts = word.split('-')
    const left = parts[0]
    const right = parts[1]

    // Skip if left part is a known intentional prefix
    if (INTENTIONAL_PREFIXES.has(left)) continue

    // Skip if it's an ordinal range (första-tredje, etc)
    if (
      /^(första|andra|tredje|fjärde|femte|sjätte|sjunde|åttonde|nionde|tionde)$/.test(
        left
      )
    )
      continue

    // Skip very short parts (likely abbreviations)
    if (left.length <= 2) continue

    // Check if this looks like a broken word
    // A broken word typically has a fragment that matches common word endings
    const combined = left + right

    // Check if right part looks like a word ending
    const looksLikeBrokenWord = BROKEN_WORD_ENDINGS.some(
      (ending) =>
        right.endsWith(ending) || right === ending.substring(0, right.length)
    )

    // Also check for very specific patterns we saw
    const isKnownBrokenPattern =
      /^(verk|förord|männis|reger|gäl|änd|an|skydds|föran)$/.test(left)

    if (looksLikeBrokenWord || isKnownBrokenPattern) {
      // Final check: make sure the combined word looks Swedish
      // Skip if left part looks like an abbreviation (all caps or ends with common abbrev patterns)
      if (!/^[A-ZÅÄÖ]{2,}$/.test(parts[0])) {
        realLineBreaks.push([word, count, combined])
      }
    }
  }

  // Sort by count
  realLineBreaks.sort((a, b) => b[1] - a[1])

  console.log('='.repeat(70))
  console.log('REAL LINE-BREAK ARTIFACTS (high confidence):')
  console.log('='.repeat(70))

  let totalOccurrences = 0
  for (const [word, count, fixed] of realLineBreaks) {
    console.log(`  "${word}" → "${fixed}" (${count}x)`)
    totalOccurrences += count
  }

  console.log('\n' + '='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log(`Unique broken words found: ${realLineBreaks.length}`)
  console.log(`Total occurrences: ${totalOccurrences}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
