/**
 * Debug why texts are being marked as semantically equal when they're not
 */
import { getLawVersionAtDate } from '../lib/legal-document/version-reconstruction'
import {
  areTextsSemanticallyEqual,
  compareSectionText,
} from '../lib/legal-document/version-diff'

async function main() {
  const baseLaw = 'SFS 1977:1160'
  const dateA = new Date('2011-08-01')
  const dateB = new Date('2014-07-01')

  const versionA = await getLawVersionAtDate(baseLaw, dateA)
  const versionB = await getLawVersionAtDate(baseLaw, dateB)

  if (!versionA || !versionB) {
    console.log('Versions not found')
    return
  }

  // Test 4 kap. 3 §
  const sectionA = versionA.sections.find(
    (s) => s.chapter === '4' && s.section === '3'
  )
  const sectionB = versionB.sections.find(
    (s) => s.chapter === '4' && s.section === '3'
  )

  if (!sectionA || !sectionB) {
    console.log('Sections not found')
    return
  }

  console.log('=== 4 kap. 3 § Text Comparison ===\n')
  console.log('Text A length:', sectionA.textContent.length)
  console.log('Text B length:', sectionB.textContent.length)

  console.log('\n--- Text A (first 500 chars) ---')
  console.log(sectionA.textContent.substring(0, 500))

  console.log('\n--- Text B (first 500 chars) ---')
  console.log(sectionB.textContent.substring(0, 500))

  console.log('\n=== Semantic Comparison ===')
  const semanticallyEqual = areTextsSemanticallyEqual(
    sectionA.textContent,
    sectionB.textContent
  )
  console.log('areTextsSemanticallyEqual:', semanticallyEqual)

  console.log('\n=== Line Diff ===')
  const lineDiff = compareSectionText(
    sectionA.textContent,
    sectionB.textContent
  )
  console.log('Number of diff parts:', lineDiff.length)

  const added = lineDiff.filter((d) => d.added)
  const removed = lineDiff.filter((d) => d.removed)
  const unchanged = lineDiff.filter((d) => !d.added && !d.removed)

  console.log('Added parts:', added.length)
  console.log('Removed parts:', removed.length)
  console.log('Unchanged parts:', unchanged.length)

  if (added.length > 0) {
    console.log('\nFirst added part:', added[0].value.substring(0, 100))
  }
  if (removed.length > 0) {
    console.log('\nFirst removed part:', removed[0].value.substring(0, 100))
  }

  // Let's manually normalize and compare
  console.log('\n=== Manual Normalization Test ===')

  // Simple normalize function (copy the logic from version-diff.ts)
  function simpleNormalize(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\d+\s*[a-z]?\s*§\s*/gi, '')
      .replace(/\d+\s*kap\.\s*/gi, '')
      .replace(/§/g, '')
      .replace(/\.?\s*Lag\s*\(\d{4}:\d+\)/gi, '')
      .replace(/SFS\s*\d{4}:\d+/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .trim()
      .replace(/\.\s*$/, '')
  }

  const normalizedA = simpleNormalize(sectionA.textContent)
  const normalizedB = simpleNormalize(sectionB.textContent)

  console.log('Normalized A length:', normalizedA.length)
  console.log('Normalized B length:', normalizedB.length)
  console.log('Normalized texts equal:', normalizedA === normalizedB)

  if (normalizedA !== normalizedB) {
    // Find first difference
    for (let i = 0; i < Math.min(normalizedA.length, normalizedB.length); i++) {
      if (normalizedA[i] !== normalizedB[i]) {
        console.log('\nFirst difference at position:', i)
        console.log(
          'Context A:',
          normalizedA.substring(Math.max(0, i - 30), i + 50)
        )
        console.log(
          'Context B:',
          normalizedB.substring(Math.max(0, i - 30), i + 50)
        )
        break
      }
    }
  }
}

main().catch(console.error)
