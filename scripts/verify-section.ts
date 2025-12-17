import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const section = await prisma.sectionChange.findFirst({
    where: {
      amendment: { sfs_number: 'SFS 2008:934' },
      chapter: '3',
      section: '6',
    },
    select: { new_text: true },
  })

  if (section?.new_text) {
    console.log('=== Current state of SFS 2008:934 - 3 kap. 6 § ===')

    // Check if these patterns exist
    const check = ['arbets- ', 'projekte- ', 'anlägg- ']
    for (const p of check) {
      const found = section.new_text.includes(p)
      console.log(`"${p}": ${found ? 'STILL EXISTS' : 'not found (fixed)'}`)
    }

    // Check for the fixed versions
    const fixed = ['arbetsmiljösynpunkter', 'projektering', 'anläggningsarbete']
    console.log('\nFixed versions:')
    for (const f of fixed) {
      const found = section.new_text.includes(f)
      console.log(`"${f}": ${found ? 'EXISTS' : 'NOT FOUND'}`)
    }

    console.log('\nFirst 400 chars:')
    console.log(section.new_text.substring(0, 400))
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
