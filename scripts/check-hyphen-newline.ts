/**
 * Check if hyphenation artifacts have newlines after them
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get a sample of texts
  const changes = await prisma.sectionChange.findMany({
    where: {
      new_text: { not: null },
      amendment: { base_law_sfs: 'SFS 1977:1160' },
    },
    select: { new_text: true, chapter: true, section: true },
    take: 20,
  })

  console.log('Checking for hyphen patterns...\n')

  // Pattern 1: hyphen followed by newline
  const hyphenNewline = /[a-zåäö]-\n[a-zåäö]/gi

  // Pattern 2: hyphen NOT followed by newline (mid-line)
  const hyphenMidLine = /[a-zåäö]-[a-zåäö]/g

  let hyphenNewlineCount = 0
  let hyphenMidLineCount = 0

  for (const c of changes) {
    const text = c.new_text!

    const newlineMatches = text.match(hyphenNewline) || []
    const midLineMatches = text.match(hyphenMidLine) || []

    if (newlineMatches.length > 0) {
      console.log(`${c.chapter} kap. ${c.section} §:`)
      console.log(`  Hyphen+newline patterns: ${newlineMatches.length}`)
      for (const m of newlineMatches.slice(0, 3)) {
        // Show context around the match
        const idx = text.indexOf(m)
        const context = text
          .substring(Math.max(0, idx - 20), idx + 30)
          .replace(/\n/g, '↵')
        console.log(`    "...${context}..."`)
      }
      hyphenNewlineCount += newlineMatches.length
    }

    hyphenMidLineCount += midLineMatches.length
  }

  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  console.log(`Hyphen + newline (line-break artifacts): ${hyphenNewlineCount}`)
  console.log(`Hyphen mid-line (intentional): ${hyphenMidLineCount}`)

  if (hyphenNewlineCount === 0) {
    console.log('\n⚠️  No hyphen+newline patterns found!')
    console.log('The line breaks may have been stripped during extraction.')
    console.log('Let me show some hyphenated words to see the actual format:')

    for (const c of changes.slice(0, 5)) {
      const matches = c.new_text!.match(/\S+-\S+/g) || []
      if (matches.length > 0) {
        console.log(`\n${c.chapter} kap. ${c.section} §:`)
        for (const m of matches.slice(0, 5)) {
          console.log(`  "${m}"`)
        }
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
