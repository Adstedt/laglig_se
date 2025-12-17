/**
 * Check if amendments with 0% text coverage have source content
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Checking Amendment Content ===\n')

  const problemAmendments = ['SFS 2003:365', 'SFS 2008:934', 'SFS 2013:610']

  for (const sfs of problemAmendments) {
    const amendment = await prisma.amendmentDocument.findFirst({
      where: { sfs_number: sfs },
      select: {
        sfs_number: true,
        title: true,
        parse_status: true,
        markdown_content: true,
        full_text: true,
        section_changes: {
          select: {
            chapter: true,
            section: true,
            change_type: true,
            new_text: true,
          },
        },
      },
    })

    if (amendment) {
      console.log(`=== ${amendment.sfs_number} ===`)
      console.log(`Title: ${amendment.title}`)
      console.log(`Parse status: ${amendment.parse_status}`)
      console.log(
        `Has markdown: ${amendment.markdown_content ? amendment.markdown_content.length + ' chars' : 'NO'}`
      )
      console.log(
        `Has full_text: ${amendment.full_text ? amendment.full_text.length + ' chars' : 'NO'}`
      )
      console.log(`Section changes: ${amendment.section_changes.length}`)

      // Show first 3 section changes
      console.log('Sample changes:')
      for (const c of amendment.section_changes.slice(0, 3)) {
        console.log(
          `  ${c.chapter} kap. ${c.section} §: ${c.change_type} - ${c.new_text ? 'HAS TEXT' : 'NO TEXT'}`
        )
      }

      // Show a snippet of the content
      const content = amendment.markdown_content || amendment.full_text || ''
      if (content) {
        console.log('Content preview:')
        console.log(content.substring(0, 500))
      }
      console.log('\n---\n')
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
