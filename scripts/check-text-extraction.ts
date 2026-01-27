import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const changes = await prisma.sectionChange.findMany({
    select: {
      chapter: true,
      section: true,
      change_type: true,
      new_text: true,
      old_text: true,
      amendment: { select: { sfs_number: true } },
    },
    take: 10,
  })

  console.log('Checking new_text field in section_changes:\n')
  changes.forEach((c) => {
    const loc = c.chapter
      ? `${c.chapter} kap. ${c.section} §`
      : `${c.section} §`
    console.log(c.amendment.sfs_number, '|', loc, '|', c.change_type)
    console.log(
      '  new_text:',
      c.new_text ? c.new_text.substring(0, 100) + '...' : 'NULL'
    )
    console.log(
      '  old_text:',
      c.old_text ? c.old_text.substring(0, 100) + '...' : 'NULL'
    )
    console.log()
  })

  // Count how many have text
  const withNewText = await prisma.sectionChange.count({
    where: { new_text: { not: null } },
  })
  const withOldText = await prisma.sectionChange.count({
    where: { old_text: { not: null } },
  })
  const total = await prisma.sectionChange.count()
  console.log('='.repeat(50))
  console.log('Section changes with new_text:', withNewText, '/', total)
  console.log('Section changes with old_text:', withOldText, '/', total)

  await prisma.$disconnect()
}

main().catch(console.error)
