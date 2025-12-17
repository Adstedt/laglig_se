import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Check SFS 2009:422
  const amendment = await prisma.amendmentDocument.findUnique({
    where: { sfs_number: 'SFS 2009:422' },
    select: { full_text: true },
  })

  const section = await prisma.sectionChange.findFirst({
    where: {
      amendment: { sfs_number: 'SFS 2009:422' },
      chapter: '7',
      section: '13',
    },
    select: { new_text: true },
  })

  console.log('=== SFS 2009:422 - 7 kap. 13 § ===')

  // Check full_text for skyddskom pattern
  if (amendment?.full_text) {
    const idx = amendment.full_text.indexOf('skyddskom')
    if (idx >= 0) {
      const context = amendment.full_text.substring(idx, idx + 20)
      console.log('In full_text:', JSON.stringify(context))
      console.log('Char codes around hyphen:')
      for (let i = 0; i < context.length && i < 15; i++) {
        const code = context.charCodeAt(i)
        const name = code === 10 ? 'LF' : code === 13 ? 'CR' : context[i]
        console.log(`  [${i}] "${name}" = ${code}`)
      }
    } else {
      console.log('skyddskom not found in full_text')
    }
  } else {
    console.log('No full_text for this amendment')
  }

  // Check new_text
  console.log('')
  if (section?.new_text) {
    const idx = section.new_text.indexOf('skyddskom')
    if (idx >= 0) {
      const context = section.new_text.substring(idx, idx + 20)
      console.log('In new_text:', JSON.stringify(context))
      console.log('Char codes around hyphen:')
      for (let i = 0; i < context.length && i < 15; i++) {
        const code = context.charCodeAt(i)
        const name = code === 10 ? 'LF' : code === 13 ? 'CR' : context[i]
        console.log(`  [${i}] "${name}" = ${code}`)
      }
    } else {
      console.log('skyddskom not found in new_text')
    }
  } else {
    console.log('No new_text for this section')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
