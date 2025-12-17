import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const law = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1977:1160' },
    select: {
      id: true,
      title: true,
      document_number: true,
      html_content: true,
    },
  })

  if (law) {
    console.log('Law:', law.document_number, '-', law.title)
    console.log('HTML length:', law.html_content?.length || 0)
    console.log('\n--- First 5000 chars of HTML ---\n')
    console.log(law.html_content?.substring(0, 5000))
  } else {
    console.log('Law not found')
  }

  // Also check section changes
  const changes = await prisma.sectionChange.findMany({
    where: { amendment: { base_law_sfs: 'SFS 1977:1160' } },
    include: {
      amendment: { select: { sfs_number: true, effective_date: true } },
    },
    orderBy: [{ amendment: { effective_date: 'desc' } }],
    take: 10,
  })

  console.log('\n--- Recent SectionChanges for this law ---\n')
  for (const c of changes) {
    const chap = c.chapter ? `${c.chapter} kap. ` : ''
    const eff =
      c.amendment.effective_date?.toISOString().split('T')[0] || 'unknown'
    console.log(
      `[${c.amendment.sfs_number}] ${chap}${c.section} § - ${c.change_type} (${eff})`
    )
    if (c.new_text) {
      console.log(`  new_text: ${c.new_text.substring(0, 120)}...`)
    }
  }

  await prisma.$disconnect()
}

main()
