/**
 * Test the diff output for a specific law and date range
 */
import {
  compareLawVersions,
  areTextsSemanticallyEqual,
} from '../lib/legal-document/version-diff'
import { getLawVersionAtDate } from '../lib/legal-document/version-reconstruction'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const baseLawSfs = 'SFS 1977:1160'
  const dateA = new Date('2001-01-01') // Before 2002:585 amendment
  const dateB = new Date('2003-01-01') // After 2002:585 amendment

  console.log('=== Testing Diff for Arbetsmiljölag (1977:1160) ===')
  console.log(`Date A: ${dateA.toISOString().split('T')[0]}`)
  console.log(`Date B: ${dateB.toISOString().split('T')[0]}`)
  console.log('')

  // Get versions
  const versionA = await getLawVersionAtDate(baseLawSfs, dateA)
  const versionB = await getLawVersionAtDate(baseLawSfs, dateB)

  if (!versionA || !versionB) {
    console.log('Could not get versions')
    return
  }

  console.log(`Version A sections: ${versionA.sections.length}`)
  console.log(`Version B sections: ${versionB.sections.length}`)

  // Look at specific sections that should have changed
  console.log('\n=== Section 3:2 Comparison ===')
  const sec3_2_A = versionA.sections.find(
    (s) => s.chapter === '3' && s.section === '2'
  )
  const sec3_2_B = versionB.sections.find(
    (s) => s.chapter === '3' && s.section === '2'
  )

  if (sec3_2_A && sec3_2_B) {
    console.log('Version A source:', JSON.stringify(sec3_2_A.source))
    console.log(
      'Version A text preview:',
      sec3_2_A.textContent.substring(0, 150)
    )
    console.log('')
    console.log('Version B source:', JSON.stringify(sec3_2_B.source))
    console.log(
      'Version B text preview:',
      sec3_2_B.textContent.substring(0, 150)
    )
    console.log('')
    console.log(
      'Semantically equal?',
      areTextsSemanticallyEqual(sec3_2_A.textContent, sec3_2_B.textContent)
    )
  }

  // Get the full diff
  console.log('\n=== Full Diff Summary ===')
  const diff = await compareLawVersions(baseLawSfs, dateA, dateB)
  if (diff) {
    console.log('Summary:', diff.summary)
    console.log('')
    console.log('Changed sections:')
    for (const s of diff.sections.filter((s) => s.changeType !== 'unchanged')) {
      console.log(`  ${s.chapter || ''}:${s.section} - ${s.changeType}`)
      if (s.lineDiff) {
        const addedWords = s.lineDiff
          .filter((d) => d.added)
          .map((d) => d.value.trim())
          .slice(0, 3)
        const removedWords = s.lineDiff
          .filter((d) => d.removed)
          .map((d) => d.value.trim())
          .slice(0, 3)
        if (addedWords.length)
          console.log(`    Added: "${addedWords.join('", "')}"`)
        if (removedWords.length)
          console.log(`    Removed: "${removedWords.join('", "')}"`)
      }
    }
  }

  // Check DB SectionChange for this amendment
  console.log('\n=== DB SectionChange for SFS 2002:585 (3 kap. 2 §) ===')
  const sectionChange = await prisma.sectionChange.findFirst({
    where: {
      chapter: '3',
      section: '2',
      amendment: { sfs_number: 'SFS 2002:585' },
    },
    include: { amendment: true },
  })
  if (sectionChange) {
    console.log('Change type:', sectionChange.change_type)
    console.log('New text preview:', sectionChange.new_text?.substring(0, 200))
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
