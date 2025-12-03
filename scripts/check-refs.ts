import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const totalRefs = await prisma.crossReference.count()
  console.log('Total cross_references:', totalRefs)

  const refs = await prisma.crossReference.findMany({
    where: {
      source_document: { content_type: 'COURT_CASE_AD' },
    },
    include: {
      source_document: { select: { document_number: true } },
      target_document: { select: { document_number: true } },
    },
    take: 10,
  })

  console.log('')
  console.log('Sample cross-references (Court Case -> SFS Law):')
  for (const ref of refs) {
    console.log(
      ' ',
      ref.source_document.document_number,
      '->',
      ref.target_document.document_number
    )
    console.log('    Context:', ref.context?.substring(0, 60) || 'N/A')
  }

  await prisma.$disconnect()
}
main()
