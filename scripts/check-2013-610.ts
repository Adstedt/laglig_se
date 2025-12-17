import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Get the amendment first
  const amendment = await prisma.amendmentDocument.findUnique({
    where: { sfs_number: 'SFS 2013:610' },
    select: {
      id: true,
      sfs_number: true,
      parse_status: true,
      full_text: true,
      markdown_content: true,
    },
  })

  if (!amendment) {
    console.log('Amendment not found')
    return
  }

  console.log('=== SFS 2013:610 Amendment ===')
  console.log('ID:', amendment.id)
  console.log('Parse status:', amendment.parse_status)
  console.log('Full text length:', amendment.full_text?.length || 0)
  console.log('Markdown length:', amendment.markdown_content?.length || 0)

  // Get section changes using amendment_id
  const sectionChanges = await prisma.sectionChange.findMany({
    where: { amendment_id: amendment.id },
    select: { chapter: true, section: true, change_type: true, new_text: true },
  })

  const withText = sectionChanges.filter((s) => s.new_text !== null)
  const withoutText = sectionChanges.filter((s) => s.new_text === null)

  console.log('\n=== Section Changes ===')
  console.log('Total:', sectionChanges.length)
  console.log('With text:', withText.length)
  console.log('Without text:', withoutText.length)

  console.log('\n=== Sections WITH text ===')
  for (const s of withText) {
    const textLen = s.new_text ? s.new_text.length : 0
    console.log(
      ' ',
      s.chapter || '-',
      'kap.',
      s.section,
      '§ -',
      s.change_type,
      '(' + textLen + ' chars)'
    )
  }

  console.log('\n=== Sections WITHOUT text ===')
  for (const s of withoutText) {
    console.log(' ', s.chapter || '-', 'kap.', s.section, '§ -', s.change_type)
  }

  // Check if the full_text contains these section references
  console.log('\n=== Checking if full_text contains section references ===')
  for (const s of withoutText.slice(0, 5)) {
    const sectionRef = s.section + ' §'
    const chapterRef = s.chapter + ' kap.'
    const foundSection = amendment.full_text?.includes(sectionRef)
    const foundChapter = amendment.full_text?.includes(chapterRef)
    console.log(
      ' "' + (s.chapter || '') + ' kap. ' + s.section + ' §" - section:',
      foundSection ? 'YES' : 'NO',
      '/ chapter:',
      foundChapter ? 'YES' : 'NO'
    )
  }

  // Show the first 1500 chars of full text
  console.log('\n=== Full Text Preview (first 1500 chars) ===')
  console.log(amendment.full_text?.substring(0, 1500))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
