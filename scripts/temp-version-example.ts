import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Find a section with multiple amendments
  const sectionHistory = await prisma.sectionChange.groupBy({
    by: ['chapter', 'section'],
    where: { amendment: { base_law_sfs: 'SFS 1977:1160' } },
    _count: true,
    orderBy: { _count: { section: 'desc' } },
    take: 10,
  })

  console.log('=== Sections with most amendments (Arbetsmiljölagen) ===\n')
  for (const s of sectionHistory) {
    console.log(
      `${s.chapter ? s.chapter + ' kap. ' : ''}${s.section} § - ${s._count} amendments`
    )
  }

  // Pick one with good history - let's use 6 kap. 17 § which had 2 changes
  const targetChapter = '6'
  const targetSection = '17'

  console.log(
    `\n=== Full history for ${targetChapter} kap. ${targetSection} § ===\n`
  )

  const changes = await prisma.sectionChange.findMany({
    where: {
      amendment: { base_law_sfs: 'SFS 1977:1160' },
      chapter: targetChapter,
      section: targetSection,
    },
    include: {
      amendment: {
        select: { sfs_number: true, effective_date: true, title: true },
      },
    },
    orderBy: { amendment: { effective_date: 'asc' } },
  })

  for (const c of changes) {
    const eff =
      c.amendment.effective_date?.toISOString().split('T')[0] || 'unknown'
    console.log(
      `[${c.amendment.sfs_number}] ${c.change_type} - effective ${eff}`
    )
    console.log(`Title: ${c.amendment.title}`)
    console.log(`New text:\n${c.new_text?.substring(0, 300)}...`)
    console.log('\n---\n')
  }

  // Now get current HTML for this section
  const law = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1977:1160' },
    select: { html_content: true },
  })

  if (law?.html_content) {
    // Extract section K6P17
    const regex =
      /<a class="paragraf" name="K6P17"[^>]*>.*?<\/a>\s*([\s\S]*?)(?=<a class="paragraf"|<h3|<\/div>|$)/i
    const match = law.html_content.match(regex)

    console.log('=== Current HTML for 6 kap. 17 § ===\n')
    if (match) {
      console.log(match[0].substring(0, 500))
    } else {
      // Try simpler approach - find by name and get surrounding text
      const idx = law.html_content.indexOf('name="K6P17"')
      if (idx > -1) {
        console.log(law.html_content.substring(idx - 50, idx + 600))
      }
    }
  }

  await prisma.$disconnect()
}

main()
