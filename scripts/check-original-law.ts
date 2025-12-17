import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Check if we have the original law text stored
  const law = await prisma.legalDocument.findFirst({
    where: {
      document_number: { contains: '1977:1160' },
      content_type: 'SFS_LAW',
    },
    select: {
      id: true,
      document_number: true,
      title: true,
      effective_date: true,
      _count: { select: { law_sections: true } },
    },
  })

  console.log('=== Current Law Document ===')
  console.log('Document:', law?.document_number)
  console.log('Title:', law?.title)
  console.log('Effective date:', law?.effective_date)
  console.log('Section count:', law?._count.law_sections)

  if (!law) return

  // Check a few sections to see what text we have
  const sections = await prisma.lawSection.findMany({
    where: { legal_document_id: law.id, chapter: '4' },
    select: { chapter: true, section: true, text_content: true },
    orderBy: { section: 'asc' },
    take: 5,
  })

  console.log('\n=== Sample sections (4 kap.) ===')
  for (const s of sections) {
    console.log(
      s.chapter +
        ' kap. ' +
        s.section +
        ' § - ' +
        s.text_content.length +
        ' chars'
    )
    console.log('  Preview: ' + s.text_content.substring(0, 100) + '...\n')
  }

  // Check the earliest amendment we have
  const earliestAmendment = await prisma.amendmentDocument.findFirst({
    where: { base_law_sfs: 'SFS 1977:1160' },
    orderBy: { effective_date: 'asc' },
    select: {
      sfs_number: true,
      effective_date: true,
      _count: { select: { section_changes: true } },
    },
  })

  console.log('=== Earliest Amendment ===')
  console.log('SFS:', earliestAmendment?.sfs_number)
  console.log('Effective:', earliestAmendment?.effective_date)
  console.log('Section changes:', earliestAmendment?._count.section_changes)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
