/**
 * Check full history coverage for Arbetsmiljölag
 */
import { compareLawVersions } from '../lib/legal-document/version-diff'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const baseLawSfs = 'SFS 1977:1160'
  const dateA = new Date('1977-01-01')
  const dateB = new Date('2028-07-01')

  console.log('=== Full History Check for Arbetsmiljölag (1977:1160) ===')
  console.log(
    `Date range: ${dateA.toISOString().split('T')[0]} to ${dateB.toISOString().split('T')[0]}`
  )
  console.log('')

  // Get diff
  const diff = await compareLawVersions(baseLawSfs, dateA, dateB)

  if (!diff) {
    console.log('Could not get diff')
    return
  }

  console.log('=== Diff Summary ===')
  console.log(JSON.stringify(diff.summary, null, 2))
  console.log('')

  // Count changed sections
  const changedSections = diff.sections.filter(
    (s) => s.changeType !== 'unchanged'
  )
  console.log(`Changed sections in diff: ${changedSections.length}`)
  console.log(
    `Unchanged sections: ${diff.sections.length - changedSections.length}`
  )
  console.log('')

  // List amendments between dates
  console.log('=== Amendments between dates (from diff) ===')
  console.log(`Count: ${diff.amendmentsBetween.length}`)
  for (const a of diff.amendmentsBetween.slice(0, 10)) {
    console.log(
      `  ${a.sfsNumber} (${a.effectiveDate.toISOString().split('T')[0]})`
    )
  }
  if (diff.amendmentsBetween.length > 10) {
    console.log(`  ... and ${diff.amendmentsBetween.length - 10} more`)
  }
  console.log('')

  // Compare with DB
  console.log('=== DB Stats ===')
  const dbAmendments = await prisma.amendmentDocument.count({
    where: { base_law_sfs: baseLawSfs },
  })
  const dbSectionChanges = await prisma.sectionChange.count({
    where: { amendment: { base_law_sfs: baseLawSfs } },
  })
  console.log(`Amendments in DB: ${dbAmendments}`)
  console.log(`SectionChanges in DB: ${dbSectionChanges}`)
  console.log('')

  // Get unique sections that have changes in DB
  const uniqueSections = await prisma.sectionChange.findMany({
    where: { amendment: { base_law_sfs: baseLawSfs } },
    select: { chapter: true, section: true },
    distinct: ['chapter', 'section'],
  })
  console.log(`Unique sections with changes in DB: ${uniqueSections.length}`)
  console.log('')

  // Check for sections with changes that appear unchanged in diff
  console.log('=== Checking for missing changes ===')
  const unchangedInDiff = new Set(
    diff.sections
      .filter((s) => s.changeType === 'unchanged')
      .map((s) => `${s.chapter || ''}:${s.section}`)
  )

  const changedInDb = new Set(
    uniqueSections.map((s) => `${s.chapter || ''}:${s.section}`)
  )

  const missingFromDiff: string[] = []
  for (const key of changedInDb) {
    if (unchangedInDiff.has(key)) {
      missingFromDiff.push(key)
    }
  }

  if (missingFromDiff.length > 0) {
    console.log(
      `Sections with DB changes but marked unchanged in diff: ${missingFromDiff.length}`
    )
    for (const key of missingFromDiff.slice(0, 20)) {
      const [chapter, section] = key.split(':')
      // Get the changes for this section
      const changes = await prisma.sectionChange.findMany({
        where: {
          chapter: chapter || null,
          section,
          amendment: { base_law_sfs: baseLawSfs },
        },
        include: {
          amendment: { select: { sfs_number: true, effective_date: true } },
        },
      })
      console.log(
        `  ${chapter ? chapter + ' kap. ' : ''}${section} § - ${changes.length} changes:`
      )
      for (const c of changes.slice(0, 3)) {
        const date =
          c.amendment.effective_date?.toISOString().split('T')[0] || 'no date'
        const hasText = c.new_text ? 'has text' : 'NO TEXT'
        console.log(
          `    ${c.change_type} (${c.amendment.sfs_number}, ${date}) - ${hasText}`
        )
      }
    }
  } else {
    console.log('All sections with DB changes appear in diff!')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
