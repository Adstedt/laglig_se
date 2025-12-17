/**
 * Investigate the parse status vs parse errors inconsistency
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Investigating Parse Status vs Errors ===\n')

  // Get all amendments for 1977:1160 with all fields
  const amendments = await prisma.amendmentDocument.findMany({
    where: { base_law_sfs: 'SFS 1977:1160' },
    select: {
      sfs_number: true,
      parse_status: true,
      parse_error: true,
      parsed_at: true,
      confidence: true,
      markdown_content: true,
      section_changes: {
        select: {
          chapter: true,
          section: true,
          change_type: true,
          new_text: true,
        },
      },
    },
    orderBy: { sfs_number: 'asc' },
  })

  console.log('All amendments:\n')
  for (const a of amendments) {
    const withText = a.section_changes.filter((c) => c.new_text !== null).length
    const total = a.section_changes.length
    const hasMarkdown = a.markdown_content
      ? `${a.markdown_content.length} chars`
      : 'NO'

    console.log(`${a.sfs_number}:`)
    console.log(`  parse_status: ${a.parse_status}`)
    console.log(`  parse_error: ${a.parse_error || 'null'}`)
    console.log(`  parsed_at: ${a.parsed_at?.toISOString() || 'null'}`)
    console.log(`  confidence: ${a.confidence}`)
    console.log(`  markdown: ${hasMarkdown}`)
    console.log(`  section_changes: ${withText}/${total} have text`)
    console.log('')
  }

  // Summary
  console.log('\n=== Summary ===')
  const byStatus: Record<string, number> = {}
  const withErrors = amendments.filter((a) => a.parse_error).length
  const withFullText = amendments.filter((a) => {
    const withText = a.section_changes.filter((c) => c.new_text !== null).length
    return a.section_changes.length > 0 && withText === a.section_changes.length
  }).length

  for (const a of amendments) {
    byStatus[a.parse_status || 'null'] =
      (byStatus[a.parse_status || 'null'] || 0) + 1
  }

  console.log('By parse_status:', byStatus)
  console.log(`Amendments with parse_error: ${withErrors}`)
  console.log(
    `Amendments with 100% text coverage: ${withFullText}/${amendments.length}`
  )
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
