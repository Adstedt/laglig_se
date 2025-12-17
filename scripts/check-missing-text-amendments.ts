/**
 * Check why amendments for 1977:1160 have no section text
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Amendments with Missing Section Text for 1977:1160 ===\n')

  // Get amendments with 0% text coverage
  const amendments = await prisma.amendmentDocument.findMany({
    where: { base_law_sfs: 'SFS 1977:1160' },
    include: {
      section_changes: {
        select: {
          chapter: true,
          section: true,
          change_type: true,
          new_text: true,
        },
      },
    },
    orderBy: { effective_date: 'asc' },
  })

  const problemAmendments = amendments.filter((a) => {
    const withText = a.section_changes.filter((c) => c.new_text !== null).length
    return (
      a.section_changes.length > 0 && withText < a.section_changes.length * 0.5
    )
  })

  console.log(
    `Amendments with <50% text coverage: ${problemAmendments.length}\n`
  )

  for (const a of problemAmendments) {
    const date = a.effective_date?.toISOString().split('T')[0] || 'no date'
    const withText = a.section_changes.filter((c) => c.new_text !== null).length
    const total = a.section_changes.length

    console.log(`\n=== ${a.sfs_number} (${date}) ===`)
    console.log(`Title: ${a.title}`)
    console.log(`Section changes: ${withText}/${total} have text`)
    console.log(`Parse status: ${a.parse_status}`)
    console.log(`Parse error: ${a.parse_error || 'none'}`)

    // Show section change types
    const byType: Record<string, number> = {}
    const byTypeWithText: Record<string, number> = {}
    for (const c of a.section_changes) {
      byType[c.change_type] = (byType[c.change_type] || 0) + 1
      if (c.new_text) {
        byTypeWithText[c.change_type] = (byTypeWithText[c.change_type] || 0) + 1
      }
    }
    console.log('By change type:')
    for (const [type, count] of Object.entries(byType)) {
      const withTextCount = byTypeWithText[type] || 0
      console.log(`  ${type}: ${withTextCount}/${count} with text`)
    }

    // Show markdown preview
    if (a.markdown_content) {
      console.log('\nMarkdown preview (first 800 chars):')
      console.log('---')
      console.log(a.markdown_content.substring(0, 800))
      console.log('---')
    }
  }

  // Check what the markdown looks like for one with good coverage
  console.log('\n\n=== For comparison: Amendment with good coverage ===')
  const goodAmendment = amendments.find((a) => {
    const withText = a.section_changes.filter((c) => c.new_text !== null).length
    return a.section_changes.length > 0 && withText === a.section_changes.length
  })

  if (goodAmendment) {
    console.log(`\n${goodAmendment.sfs_number}`)
    console.log(`Section changes: ${goodAmendment.section_changes.length}`)
    console.log('Markdown preview (first 800 chars):')
    console.log('---')
    console.log(goodAmendment.markdown_content?.substring(0, 800))
    console.log('---')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
