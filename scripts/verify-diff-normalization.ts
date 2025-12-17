/**
 * Verify that diff normalization isn't stripping important content
 *
 * Compares original text vs normalized text and flags significant losses
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// The OLD aggressive normalization (what was being used)
function oldNormalization(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\d+\s*[a-z]?\s*§\s*/gi, '') // Removes "1 §", "2 a §"
    .replace(/\d+\s*kap\.\s*/gi, '') // Removes "5 kap."
    .replace(/§/g, '') // Removes standalone §
    .replace(/\.?\s*Lag\s*\(\d{4}:\d+\)/gi, '') // Removes "Lag (2021:1099)"
    .replace(/SFS\s*\d{4}:\d+/gi, '') // Removes "SFS 2021:1099"
    .replace(/\s+/g, ' ')
    .trim()
}

// The NEW light normalization (what should be used for display)
function newNormalization(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\.?\s*Lag\s*\(\d{4}:\d+\)/gi, '') // Only remove law citations
    .replace(/\s+/g, ' ')
    .trim()
}

interface ContentLoss {
  sfsNumber: string
  chapter: string | null
  section: string
  originalLength: number
  oldNormalizedLength: number
  newNormalizedLength: number
  lostContent: string[]
}

async function main() {
  console.log('Analyzing content loss from diff normalization...\n')

  // Get sample of section changes
  const changes = await prisma.sectionChange.findMany({
    where: { new_text: { not: null } },
    include: { amendment: { select: { sfs_number: true } } },
    take: 1000,
  })

  const losses: ContentLoss[] = []
  let totalOldLoss = 0
  let totalNewLoss = 0

  for (const c of changes) {
    if (!c.new_text) continue

    const original = c.new_text
    const oldNorm = oldNormalization(original)
    const newNorm = newNormalization(original)

    const oldLossPercent =
      ((original.length - oldNorm.length) / original.length) * 100
    const newLossPercent =
      ((original.length - newNorm.length) / original.length) * 100

    totalOldLoss += oldLossPercent
    totalNewLoss += newLossPercent

    // Flag significant losses (>5% content removed by old method)
    if (oldLossPercent > 5) {
      // Find what was lost
      const lostContent: string[] = []

      // Check for specific patterns
      const sectionRefs = original.match(/\d+\s*[a-z]?\s*§/gi) || []
      const chapterRefs = original.match(/\d+\s*kap\./gi) || []
      const sfsRefs = original.match(/SFS\s*\d{4}:\d+/gi) || []
      const lawCitations = original.match(/Lag\s*\(\d{4}:\d+\)/gi) || []

      if (sectionRefs.length > 0)
        lostContent.push(`Section refs: ${sectionRefs.join(', ')}`)
      if (chapterRefs.length > 0)
        lostContent.push(`Chapter refs: ${chapterRefs.join(', ')}`)
      if (sfsRefs.length > 0)
        lostContent.push(`SFS refs: ${sfsRefs.join(', ')}`)
      if (lawCitations.length > 0)
        lostContent.push(`Law citations: ${lawCitations.join(', ')}`)

      losses.push({
        sfsNumber: c.amendment.sfs_number,
        chapter: c.chapter,
        section: c.section,
        originalLength: original.length,
        oldNormalizedLength: oldNorm.length,
        newNormalizedLength: newNorm.length,
        lostContent,
      })
    }
  }

  console.log('='.repeat(70))
  console.log('CONTENT LOSS ANALYSIS')
  console.log('='.repeat(70))
  console.log(`\nSections analyzed: ${changes.length}`)
  console.log(
    `Average content loss (OLD normalization): ${(totalOldLoss / changes.length).toFixed(2)}%`
  )
  console.log(
    `Average content loss (NEW normalization): ${(totalNewLoss / changes.length).toFixed(2)}%`
  )

  console.log(
    `\n\nSections with >5% content loss (OLD method): ${losses.length}`
  )

  // Show worst cases
  losses.sort(
    (a, b) =>
      b.originalLength -
      b.oldNormalizedLength -
      (a.originalLength - a.oldNormalizedLength)
  )

  console.log('\n' + '='.repeat(70))
  console.log('WORST CASES (showing top 10)')
  console.log('='.repeat(70))

  for (const loss of losses.slice(0, 10)) {
    const oldLoss = loss.originalLength - loss.oldNormalizedLength
    const newLoss = loss.originalLength - loss.newNormalizedLength
    console.log(
      `\n${loss.sfsNumber} - ${loss.chapter || ''} kap. ${loss.section} §:`
    )
    console.log(`  Original: ${loss.originalLength} chars`)
    console.log(
      `  OLD normalization lost: ${oldLoss} chars (${((oldLoss / loss.originalLength) * 100).toFixed(1)}%)`
    )
    console.log(
      `  NEW normalization lost: ${newLoss} chars (${((newLoss / loss.originalLength) * 100).toFixed(1)}%)`
    )
    console.log(`  Content stripped: ${loss.lostContent.join('; ')}`)
  }

  console.log('\n' + '='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log(
    `\nThe OLD normalization was stripping section/chapter references from ${losses.length} sections.`
  )
  console.log(
    'The NEW normalization preserves this content for accurate diff display.'
  )
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
