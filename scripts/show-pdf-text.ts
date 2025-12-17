/**
 * Show raw full_text from PDF extraction to see line break issues
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get an amendment with known issues
  const amendment = await prisma.amendmentDocument.findUnique({
    where: { sfs_number: 'SFS 2002:585' },
  })

  if (amendment?.full_text) {
    console.log('='.repeat(70))
    console.log(`Amendment: ${amendment.sfs_number}`)
    console.log(`Full text length: ${amendment.full_text.length} chars`)
    console.log('='.repeat(70))
    console.log('')
    console.log('FULL TEXT FROM PDF (first 2000 chars, newlines as ↵):')
    console.log('---')
    const rawDisplay = amendment.full_text
      .substring(0, 2000)
      .replace(/\n/g, '↵\n')
    console.log(rawDisplay)
    console.log('---')
  }

  // Also check the section change text that was extracted
  const changes = await prisma.sectionChange.findMany({
    where: { amendment: { sfs_number: 'SFS 2002:585' } },
    orderBy: { sort_order: 'asc' },
  })

  console.log('\n')
  console.log('='.repeat(70))
  console.log('SECTION CHANGES EXTRACTED:')
  console.log('='.repeat(70))

  for (const c of changes) {
    console.log(
      `\n${c.chapter ? c.chapter + ' kap. ' : ''}${c.section} § (${c.change_type}):`
    )
    if (c.new_text) {
      const rawDisplay = c.new_text.replace(/\n/g, '↵\n')
      console.log('---')
      console.log(rawDisplay)
      console.log('---')
    } else {
      console.log('[no text]')
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
