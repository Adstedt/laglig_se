import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Check SFS 2010:1543 (older version before 2022)
  const older = await prisma.sectionChange.findFirst({
    where: {
      amendment: { sfs_number: 'SFS 2010:1543' },
      chapter: '1',
      section: '2',
    },
    select: { new_text: true },
  })

  // Check SFS 2022:1109 (newer version)
  const newer = await prisma.sectionChange.findFirst({
    where: {
      amendment: { sfs_number: 'SFS 2022:1109' },
      chapter: '1',
      section: '2',
    },
    select: { new_text: true },
  })

  if (older?.new_text) {
    const idx = older.new_text.indexOf('3 och')
    console.log('=== OLDER (SFS 2010:1543) around "3 och 5 kap" ===')
    console.log(
      'JSON:',
      JSON.stringify(older.new_text.substring(idx, idx + 100))
    )
    console.log('\nReadable:')
    console.log(older.new_text.substring(idx, idx + 100))
  }

  if (newer?.new_text) {
    const idx = newer.new_text.indexOf('3 och')
    console.log('\n=== NEWER (SFS 2022:1109) around "3 och 5 kap" ===')
    console.log(
      'JSON:',
      JSON.stringify(newer.new_text.substring(idx, idx + 100))
    )
    console.log('\nReadable:')
    console.log(newer.new_text.substring(idx, idx + 100))
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
