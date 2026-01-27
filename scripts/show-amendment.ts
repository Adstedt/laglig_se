import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const sfsNumber = process.argv[2] || '2025:1'

  const doc = await prisma.amendmentDocument.findUnique({
    where: { sfs_number: sfsNumber },
    include: { section_changes: { orderBy: { sort_order: 'asc' } } },
  })

  if (!doc) {
    console.log(`${sfsNumber} not found`)
    await prisma.$disconnect()
    return
  }

  console.log('='.repeat(60))
  console.log('SFS:', doc.sfs_number)
  console.log('Title:', doc.title)
  console.log('Base Law:', doc.base_law_sfs, '-', doc.base_law_name)
  console.log('Effective:', doc.effective_date?.toISOString().split('T')[0])
  console.log('Confidence:', doc.confidence)
  console.log('='.repeat(60))
  console.log('Section changes:', doc.section_changes.length)
  console.log()

  doc.section_changes.forEach((sc, i) => {
    const loc = sc.chapter
      ? `${sc.chapter} kap. ${sc.section} §`
      : `${sc.section} §`
    console.log(`--- ${i + 1}. ${loc} [${sc.change_type}] ---`)
    console.log('Description:', sc.description || '(none)')
    if (sc.new_text) {
      console.log(
        'newText:',
        sc.new_text.substring(0, 300) + (sc.new_text.length > 300 ? '...' : '')
      )
    } else {
      console.log('newText: NULL')
    }
    console.log()
  })

  await prisma.$disconnect()
}

main().catch(console.error)
