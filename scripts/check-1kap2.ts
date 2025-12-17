import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== Checking 1 kap. 2 § of SFS 1977:1160 ===\n')

  // Check base law section
  const baseSection = await prisma.lawSection.findFirst({
    where: {
      legal_document: { document_number: 'SFS 1977:1160' },
      chapter: '1',
      section: '2',
    },
    select: { text_content: true },
  })

  if (baseSection) {
    console.log('BASE LAW (LawSection):')
    console.log('Length:', baseSection.text_content.length)
    console.log('Full text:')
    console.log(baseSection.text_content)
    console.log('\n' + '-'.repeat(60) + '\n')
  }

  // Check amendments that affect this section
  const changes = await prisma.sectionChange.findMany({
    where: {
      amendment: { base_law_sfs: 'SFS 1977:1160' },
      chapter: '1',
      section: '2',
    },
    include: {
      amendment: { select: { sfs_number: true, effective_date: true } },
    },
    orderBy: { amendment: { effective_date: 'asc' } },
  })

  console.log(`Found ${changes.length} amendments to this section:\n`)

  for (const c of changes) {
    console.log(
      `${c.amendment.sfs_number} (${c.amendment.effective_date?.toISOString().split('T')[0] || 'no date'}):`
    )
    console.log(`  Change type: ${c.change_type}`)
    if (c.new_text) {
      console.log(`  Text length: ${c.new_text.length}`)
      // Show text around "3 och" to see if there's a cutoff
      const idx = c.new_text.indexOf('3 och')
      if (idx >= 0) {
        const context = c.new_text.substring(idx, idx + 50)
        console.log(`  Around "3 och": "${context}"`)
      }
      // Show last 100 chars
      console.log(`  Last 100 chars: "...${c.new_text.slice(-100)}"`)
    } else {
      console.log('  (no new_text)')
    }
    console.log('')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
