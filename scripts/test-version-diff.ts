/**
 * Test diff generation between law versions
 */
import {
  compareSectionText,
  compareLawVersions,
  generateUnifiedDiff,
  getChangedSections,
  formatSectionRef,
} from '../lib/legal-document/version-diff'

async function main() {
  console.log('=== Testing Version Diff Generation ===\n')

  // 1. Test basic text diff
  console.log('--- Basic Text Diff ---')
  const textA = `1 §   Lagens ändamål är att förebygga ohälsa och olycksfall i arbetet.

Arbetsgivaren ska vidta alla åtgärder som behövs.`

  const textB = `1 §   Lagens ändamål är att förebygga ohälsa och olycksfall i arbetet samt att även i övrigt uppnå en god arbetsmiljö.

Arbetsgivaren ska vidta alla åtgärder som behövs för att förebygga att arbetstagaren utsätts för ohälsa eller olycksfall.`

  const lineDiff = compareSectionText(textA, textB)
  console.log('Line diff result:')
  for (const part of lineDiff) {
    const prefix = part.added ? '+' : part.removed ? '-' : ' '
    const lines = part.value.split('\n').filter((l) => l.length > 0)
    for (const line of lines) {
      console.log(
        `  ${prefix} ${line.substring(0, 70)}${line.length > 70 ? '...' : ''}`
      )
    }
  }

  // 2. Test unified diff output
  console.log('\n--- Unified Diff ---')
  const unifiedDiff = generateUnifiedDiff(
    textA,
    textB,
    '2010-01-01',
    '2020-01-01'
  )
  console.log(unifiedDiff.substring(0, 500))

  // 3. Test law version comparison
  console.log('\n--- Law Version Comparison ---')
  const testLaw = '1977:1160' // Arbetsmiljölagen

  // Compare 2010 vs 2020
  const date2010 = new Date('2010-01-01')
  const date2020 = new Date('2020-01-01')

  console.log(`Comparing ${testLaw} between 2010-01-01 and 2020-01-01...`)

  const diff = await compareLawVersions(testLaw, date2010, date2020)

  if (diff) {
    console.log('\nSummary:')
    console.log(`  Sections added: ${diff.summary.sectionsAdded}`)
    console.log(`  Sections removed: ${diff.summary.sectionsRemoved}`)
    console.log(`  Sections modified: ${diff.summary.sectionsModified}`)
    console.log(`  Sections unchanged: ${diff.summary.sectionsUnchanged}`)
    console.log(`  Total lines added: ${diff.summary.totalLinesAdded}`)
    console.log(`  Total lines removed: ${diff.summary.totalLinesRemoved}`)

    console.log(`\nAmendments between dates: ${diff.amendmentsBetween.length}`)
    for (const a of diff.amendmentsBetween.slice(0, 5)) {
      console.log(
        `  - ${a.sfsNumber} (${a.effectiveDate.toISOString().split('T')[0]})`
      )
    }

    // Show changed sections
    const changed = getChangedSections(diff)
    console.log(`\nChanged sections (${changed.length}):`)
    for (const s of changed.slice(0, 10)) {
      const ref = formatSectionRef(s.chapter, s.section)
      console.log(
        `  ${ref}: ${s.changeType} (+${s.linesAdded}/-${s.linesRemoved})`
      )

      // Show a preview of the diff for modified sections
      if (s.changeType === 'modified' && s.lineDiff) {
        console.log('    Preview:')
        let previewLines = 0
        for (const part of s.lineDiff) {
          if (previewLines >= 3) break
          if (part.added || part.removed) {
            const prefix = part.added ? '    +' : '    -'
            const line = part.value.split('\n')[0]
            console.log(`${prefix} ${line.substring(0, 60)}...`)
            previewLines++
          }
        }
      }
    }

    if (changed.length > 10) {
      console.log(`  ... and ${changed.length - 10} more`)
    }
  } else {
    console.log('Could not generate diff')
  }

  // 4. Test with a shorter time range
  console.log('\n--- Short Time Range Comparison ---')
  const date2022 = new Date('2022-01-01')
  const dateCurrent = new Date()

  console.log(`Comparing ${testLaw} between 2022-01-01 and now...`)

  const recentDiff = await compareLawVersions(testLaw, date2022, dateCurrent)

  if (recentDiff) {
    console.log('\nSummary:')
    console.log(`  Sections added: ${recentDiff.summary.sectionsAdded}`)
    console.log(`  Sections removed: ${recentDiff.summary.sectionsRemoved}`)
    console.log(`  Sections modified: ${recentDiff.summary.sectionsModified}`)
    console.log(`  Amendments between: ${recentDiff.amendmentsBetween.length}`)

    const recentChanged = getChangedSections(recentDiff)
    if (recentChanged.length > 0) {
      console.log('\nChanged sections:')
      for (const s of recentChanged) {
        const ref = formatSectionRef(s.chapter, s.section)
        console.log(`  ${ref}: ${s.changeType}`)
      }
    } else {
      console.log('\nNo changes detected in this period')
    }
  }

  console.log('\n=== Test Complete ===')
  process.exit(0)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
