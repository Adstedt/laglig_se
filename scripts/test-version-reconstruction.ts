/**
 * Test version reconstruction with real law data
 */
import {
  getSectionTextAtDate,
  getLawVersionAtDate,
  getSectionHistory,
  getLawAmendmentTimeline,
  getAvailableVersionDates,
} from '../lib/legal-document/version-reconstruction'

async function main() {
  // Test with Arbetsmiljölagen (SFS 1977:1160) - a well-amended law
  const testLaw = '1977:1160'

  console.log('=== Testing Version Reconstruction ===\n')
  console.log(`Test law: SFS ${testLaw} (Arbetsmiljölagen)\n`)

  // 1. Get amendment timeline
  console.log('--- Amendment Timeline ---')
  const timeline = await getLawAmendmentTimeline(testLaw)
  console.log(`Total amendments: ${timeline.length}`)
  console.log('\nRecent amendments:')
  for (const a of timeline.slice(0, 5)) {
    const date = a.effectiveDate?.toISOString().split('T')[0] || 'unknown'
    console.log(`  ${a.sfsNumber} (${date}): ${a.sectionCount} sections`)
    console.log(
      `    - Amended: ${a.changeTypes.amended}, New: ${a.changeTypes.new}, Repealed: ${a.changeTypes.repealed}`
    )
  }

  // 2. Get available version dates
  console.log('\n--- Available Version Dates ---')
  const dates = await getAvailableVersionDates(testLaw)
  console.log(`Total version dates: ${dates.length}`)
  console.log(
    'Recent dates:',
    dates
      .slice(0, 5)
      .map((d) => d.toISOString().split('T')[0])
      .join(', ')
  )
  console.log(
    'Oldest dates:',
    dates
      .slice(-5)
      .map((d) => d.toISOString().split('T')[0])
      .join(', ')
  )

  // 3. Get section history for a specific section
  console.log('\n--- Section History (1 kap. 1 §) ---')
  const sectionHistory = await getSectionHistory(testLaw, '1', '1')
  console.log(`History entries: ${sectionHistory.length}`)
  for (const entry of sectionHistory.slice(0, 5)) {
    const date = entry.effectiveDate?.toISOString().split('T')[0] || 'current'
    const textPreview =
      entry.textContent?.substring(0, 80).replace(/\n/g, ' ') || '(no text)'
    console.log(
      `  ${date} [${entry.changeType}] ${entry.amendmentSfs || 'original'}`
    )
    console.log(`    "${textPreview}..."`)
  }

  // 4. Test getLawVersionAtDate with different dates
  console.log('\n--- Law Version at Different Dates ---')

  // Current version
  const currentVersion = await getLawVersionAtDate(testLaw, new Date())
  if (currentVersion) {
    console.log(
      `\nCurrent version (${new Date().toISOString().split('T')[0]}):`
    )
    console.log(`  Title: ${currentVersion.title}`)
    console.log(`  Sections: ${currentVersion.meta.historicalSectionCount}`)
    console.log(
      `  Amendments since: ${currentVersion.meta.amendmentsBetween.length}`
    )
  }

  // Version from 5 years ago
  const fiveYearsAgo = new Date()
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
  const oldVersion = await getLawVersionAtDate(testLaw, fiveYearsAgo)
  if (oldVersion) {
    console.log(`\nVersion from ${fiveYearsAgo.toISOString().split('T')[0]}:`)
    console.log(`  Sections: ${oldVersion.meta.historicalSectionCount}`)
    console.log(`  Sections added later: ${oldVersion.meta.sectionsAddedLater}`)
    console.log(
      `  Amendments since: ${oldVersion.meta.amendmentsBetween.length}`
    )

    // Show some sample sections
    console.log('\n  Sample sections:')
    for (const s of oldVersion.sections.slice(0, 3)) {
      const ref = s.chapter
        ? `${s.chapter} kap. ${s.section} §`
        : `${s.section} §`
      const sourceInfo =
        s.source.type === 'current'
          ? '(unchanged)'
          : s.source.type === 'amendment'
            ? `(from ${s.source.sfsNumber})`
            : '(not exists)'
      console.log(`    ${ref} ${sourceInfo}`)
    }
  }

  // Version from 2010
  const year2010 = new Date('2010-01-01')
  const version2010 = await getLawVersionAtDate(testLaw, year2010)
  if (version2010) {
    console.log(`\nVersion from 2010-01-01:`)
    console.log(`  Sections: ${version2010.meta.historicalSectionCount}`)
    console.log(
      `  Sections added later: ${version2010.meta.sectionsAddedLater}`
    )
    console.log(
      `  Amendments since: ${version2010.meta.amendmentsBetween.length}`
    )
  }

  // 5. Test getSectionTextAtDate
  console.log('\n--- Section Text at Different Dates ---')

  const testSection = { chapter: '1', section: '1' }

  // Current text
  const currentText = await getSectionTextAtDate(
    testLaw,
    testSection.chapter,
    testSection.section,
    new Date()
  )
  if (currentText) {
    console.log(`\n1 kap. 1 § current:`)
    console.log(`  Source: ${currentText.source.type}`)
    console.log(
      `  Text: "${currentText.textContent.substring(0, 100).replace(/\n/g, ' ')}..."`
    )
  }

  // Text from 2015
  const text2015 = await getSectionTextAtDate(
    testLaw,
    testSection.chapter,
    testSection.section,
    new Date('2015-01-01')
  )
  if (text2015) {
    console.log(`\n1 kap. 1 § at 2015-01-01:`)
    console.log(`  Source: ${text2015.source.type}`)
    if (text2015.source.type === 'amendment') {
      console.log(`  From amendment: ${text2015.source.sfsNumber}`)
    }
    console.log(
      `  Text: "${text2015.textContent.substring(0, 100).replace(/\n/g, ' ')}..."`
    )
  }

  console.log('\n=== Test Complete ===')
  process.exit(0)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
