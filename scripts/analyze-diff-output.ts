/**
 * Analyze what the actual diff API returns for 1977:1160
 */
import { compareLawVersions } from '../lib/legal-document/version-diff'

async function main() {
  console.log(
    'Analyzing diff output for SFS 1977:1160 (2000-01-01 to 2028-07-01)...\n'
  )

  const diff = await compareLawVersions(
    'SFS 1977:1160',
    new Date('2000-01-01'),
    new Date('2028-07-01')
  )

  if (!diff) {
    console.log('No diff returned')
    return
  }

  console.log('=== SUMMARY ===')
  console.log(`Sections added: ${diff.summary.sectionsAdded}`)
  console.log(`Sections removed: ${diff.summary.sectionsRemoved}`)
  console.log(`Sections modified: ${diff.summary.sectionsModified}`)
  console.log(`Sections unchanged: ${diff.summary.sectionsUnchanged}`)
  console.log(`Total lines added: ${diff.summary.totalLinesAdded}`)
  console.log(`Total lines removed: ${diff.summary.totalLinesRemoved}`)

  // Analyze modified sections
  const modifiedSections = diff.sections.filter(
    (s) => s.changeType === 'modified'
  )

  console.log(`\n=== MODIFIED SECTIONS (${modifiedSections.length}) ===`)

  let withDiff = 0
  let withoutDiff = 0
  let textUnavailable = 0

  for (const s of modifiedSections) {
    const _hasLineDiff = s.lineDiff && s.lineDiff.length > 0
    const hasActualChanges = s.linesAdded > 0 || s.linesRemoved > 0

    if (s.textUnavailable) {
      textUnavailable++
      console.log(
        `  ${s.chapter || ''} kap. ${s.section} §: TEXT UNAVAILABLE (amendments exist but no text)`
      )
    } else if (hasActualChanges) {
      withDiff++
      console.log(
        `  ${s.chapter || ''} kap. ${s.section} §: +${s.linesAdded}/-${s.linesRemoved} lines`
      )
    } else {
      withoutDiff++
      console.log(
        `  ${s.chapter || ''} kap. ${s.section} §: NO VISIBLE CHANGES (0/0 lines) - why?`
      )

      // Debug: check what's different
      if (s.textA && s.textB) {
        if (s.textA === s.textB) {
          console.log(`    -> textA === textB (identical)`)
        } else {
          console.log(
            `    -> textA (${s.textA.length} chars) !== textB (${s.textB.length} chars)`
          )
          // Show first difference
          for (let i = 0; i < Math.min(s.textA.length, s.textB.length); i++) {
            if (s.textA[i] !== s.textB[i]) {
              console.log(
                `    -> First diff at char ${i}: "${s.textA.substring(i, i + 20)}" vs "${s.textB.substring(i, i + 20)}"`
              )
              break
            }
          }
        }
      }
      if (s.amendmentsBetween && s.amendmentsBetween.length > 0) {
        console.log(
          `    -> Amendments between: ${s.amendmentsBetween.map((a) => a.sfsNumber).join(', ')}`
        )
      }
    }
  }

  console.log(`\n=== MODIFIED SECTIONS BREAKDOWN ===`)
  console.log(`With actual line changes: ${withDiff}`)
  console.log(`With 0/0 lines (no visible changes): ${withoutDiff}`)
  console.log(`Text unavailable: ${textUnavailable}`)

  // Check added sections
  const addedSections = diff.sections.filter((s) => s.changeType === 'added')
  console.log(`\n=== ADDED SECTIONS (${addedSections.length}) ===`)
  for (const s of addedSections) {
    console.log(
      `  ${s.chapter || ''} kap. ${s.section} §: +${s.linesAdded} lines`
    )
  }

  // Check removed sections
  const removedSections = diff.sections.filter(
    (s) => s.changeType === 'removed'
  )
  console.log(`\n=== REMOVED SECTIONS (${removedSections.length}) ===`)
  for (const s of removedSections) {
    console.log(
      `  ${s.chapter || ''} kap. ${s.section} §: -${s.linesRemoved} lines`
    )
  }
}

main().catch(console.error)
