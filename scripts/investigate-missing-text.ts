/**
 * Investigate why so many section changes are missing text
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Investigating missing text for SFS 1977:1160...\n')

  // Get all amendments for this law
  const amendments = await prisma.amendmentDocument.findMany({
    where: { base_law_sfs: 'SFS 1977:1160' },
    select: {
      sfs_number: true,
      effective_date: true,
      full_text: true,
      markdown_content: true,
      parse_status: true,
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

  console.log(`Found ${amendments.length} amendments\n`)

  let totalChanges = 0
  let withText = 0
  let withoutText = 0

  for (const a of amendments) {
    const changes = a.section_changes
    const hasText = changes.filter((c) => c.new_text !== null).length
    const missingText = changes.filter((c) => c.new_text === null).length

    totalChanges += changes.length
    withText += hasText
    withoutText += missingText

    if (missingText > 0) {
      console.log(
        `\n${a.sfs_number} (${a.effective_date?.toISOString().split('T')[0] || 'no date'}):`
      )
      console.log(`  Parse status: ${a.parse_status}`)
      console.log(
        `  Has full_text: ${a.full_text ? `Yes (${a.full_text.length} chars)` : 'No'}`
      )
      console.log(
        `  Has markdown: ${a.markdown_content ? `Yes (${a.markdown_content.length} chars)` : 'No'}`
      )
      console.log(
        `  Section changes: ${hasText} with text, ${missingText} without`
      )

      // Show which sections are missing
      const missing = changes.filter((c) => c.new_text === null)
      console.log(
        `  Missing text for: ${missing.map((c) => `${c.chapter || ''} kap. ${c.section} § (${c.change_type})`).join(', ')}`
      )

      // Check if full_text contains section references
      if (a.full_text) {
        for (const m of missing.slice(0, 3)) {
          const sectionRef = `${m.section} §`
          const found = a.full_text.includes(sectionRef)
          console.log(
            `    -> "${sectionRef}" in full_text: ${found ? 'YES' : 'NO'}`
          )
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  console.log(`Total section changes: ${totalChanges}`)
  console.log(
    `With text: ${withText} (${((withText / totalChanges) * 100).toFixed(1)}%)`
  )
  console.log(
    `Without text: ${withoutText} (${((withoutText / totalChanges) * 100).toFixed(1)}%)`
  )
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
