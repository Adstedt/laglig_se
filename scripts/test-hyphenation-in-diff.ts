/**
 * Test that hyphenation in DB text is normalized correctly
 */
import {
  compareSectionText,
  areTextsSemanticallyEqual,
} from '../lib/legal-document/version-diff'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Testing Hyphenation Normalization ===\n')

  // Get section 3:9 text from DB (has "föran-leda" in it)
  const sectionChange = await prisma.sectionChange.findFirst({
    where: {
      chapter: '3',
      section: '9',
      amendment: { base_law_sfs: 'SFS 1977:1160' },
    },
  })

  if (sectionChange?.new_text) {
    console.log(
      'DB text contains "föran-leda"?',
      sectionChange.new_text.includes('föran-leda')
    )
    console.log(
      'DB text contains "föranleda"?',
      sectionChange.new_text.includes('föranleda')
    )
    console.log('')

    // Test semantic equality with un-hyphenated version
    const hyphenatedText = sectionChange.new_text
    const cleanText = hyphenatedText.replace('föran-leda', 'föranleda')

    console.log('Hyphenated text snippet:', hyphenatedText.substring(0, 100))
    console.log('Clean text snippet:', cleanText.substring(0, 100))
    console.log('')
    console.log(
      'Are they semantically equal?',
      areTextsSemanticallyEqual(hyphenatedText, cleanText)
    )
    console.log('')

    // Test the diff output
    const diff = compareSectionText(hyphenatedText, cleanText)
    const hasChanges = diff.some((d) => d.added || d.removed)
    console.log('Word diff finds changes?', hasChanges)
    if (hasChanges) {
      console.log('Diff parts:')
      for (const part of diff) {
        if (part.added || part.removed) {
          console.log(`  ${part.added ? '+' : '-'} "${part.value}"`)
        }
      }
    }
  } else {
    console.log('Section 3:9 not found or has no text')
  }

  // Also test with specific hyphenation examples from earlier
  console.log('\n=== Testing specific hyphenation patterns ===\n')

  const testCases = [
    ['annan', 'an-nan'],
    ['människors', 'männis-kors'],
    ['föranleda', 'föran-leda'],
    ['första-tredje', 'förstatredje'], // This should NOT match
  ]

  for (const [clean, hyphenated] of testCases) {
    const equal = areTextsSemanticallyEqual(clean, hyphenated)
    console.log(
      `"${clean}" vs "${hyphenated}": ${equal ? 'EQUAL' : 'DIFFERENT'}`
    )
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
