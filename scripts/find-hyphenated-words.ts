/**
 * Find all hyphenated words in the database to identify patterns
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Scanning database for hyphenated words...\n')

  // Get all section changes with text
  const changes = await prisma.sectionChange.findMany({
    where: { new_text: { not: null } },
    select: { new_text: true },
  })

  // Also get LawSection texts
  const sections = await prisma.lawSection.findMany({
    select: { text_content: true },
  })

  const allTexts = [
    ...changes.map((c) => c.new_text!),
    ...sections.map((s) => s.text_content),
  ]

  // Find all hyphenated words
  const hyphenatedWords = new Map<string, number>()

  for (const text of allTexts) {
    // Match words with hyphens between letters
    const matches = text.match(/[a-zåäöéüA-ZÅÄÖÉÜ]+-[a-zåäöéüA-ZÅÄÖÉÜ]+/g) || []
    for (const match of matches) {
      hyphenatedWords.set(
        match.toLowerCase(),
        (hyphenatedWords.get(match.toLowerCase()) || 0) + 1
      )
    }
  }

  // Sort by frequency
  const sorted = [...hyphenatedWords.entries()].sort((a, b) => b[1] - a[1])

  // Categorize
  const likelyIntentional: [string, number][] = []
  const likelyLineBreak: [string, number][] = []
  const uncertain: [string, number][] = []

  for (const [word, count] of sorted) {
    const parts = word.split('-')
    const leftLen = parts[0].length
    const rightLen = parts[1].length

    // Heuristics for intentional vs line-break:
    // - Single letter on left (e-post, i-land) → likely intentional
    // - Very short parts (2-3 chars) that look like prefixes → uncertain
    // - Both parts are fragments (not standalone words) → likely line-break

    if (leftLen === 1 || rightLen === 1) {
      likelyIntentional.push([word, count])
    } else if (
      leftLen <= 3 &&
      /^(för|och|med|vid|mot|som|den|det|ett|och)$/.test(parts[0])
    ) {
      // Common Swedish words - might be intentional
      uncertain.push([word, count])
    } else if (leftLen >= 3 && rightLen >= 3) {
      // Both parts substantial - could be either
      // Check if it looks like a broken word
      const _combined = parts.join('')
      // Common line-break patterns end in fragments like -ras, -ning, -het, -ande
      if (
        /^(männis|föran|reger|gäll|änd|ord|an|skydds|arbets)/.test(parts[0]) ||
        /(ing|het|ande|else|ras|ning|tion|kors|erna|erna|ighet)$/.test(parts[1])
      ) {
        likelyLineBreak.push([word, count])
      } else {
        uncertain.push([word, count])
      }
    } else {
      uncertain.push([word, count])
    }
  }

  console.log('='.repeat(70))
  console.log('LIKELY INTENTIONAL HYPHENS (should keep):')
  console.log('='.repeat(70))
  for (const [word, count] of likelyIntentional.slice(0, 30)) {
    console.log(`  ${word} (${count}x)`)
  }
  if (likelyIntentional.length > 30) {
    console.log(`  ... and ${likelyIntentional.length - 30} more`)
  }

  console.log('\n' + '='.repeat(70))
  console.log('LIKELY LINE-BREAK ARTIFACTS (should remove hyphen):')
  console.log('='.repeat(70))
  for (const [word, count] of likelyLineBreak.slice(0, 30)) {
    const fixed = word.replace(/-/g, '')
    console.log(`  ${word} → ${fixed} (${count}x)`)
  }
  if (likelyLineBreak.length > 30) {
    console.log(`  ... and ${likelyLineBreak.length - 30} more`)
  }

  console.log('\n' + '='.repeat(70))
  console.log('UNCERTAIN (need manual review):')
  console.log('='.repeat(70))
  for (const [word, count] of uncertain.slice(0, 50)) {
    console.log(`  ${word} (${count}x)`)
  }
  if (uncertain.length > 50) {
    console.log(`  ... and ${uncertain.length - 50} more`)
  }

  console.log('\n' + '='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log(`Total unique hyphenated words: ${hyphenatedWords.size}`)
  console.log(`Likely intentional: ${likelyIntentional.length}`)
  console.log(`Likely line-break: ${likelyLineBreak.length}`)
  console.log(`Uncertain: ${uncertain.length}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
