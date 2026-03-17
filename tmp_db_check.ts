import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const total = await prisma.legalDocument.count({
    where: { content_type: 'SFS_AMENDMENT' },
  })
  const withHtml = await prisma.legalDocument.count({
    where: { content_type: 'SFS_AMENDMENT', html_content: { not: null } },
  })
  const withoutHtml = total - withHtml
  const withMarkdown = await prisma.legalDocument.count({
    where: { content_type: 'SFS_AMENDMENT', markdown_content: { not: null } },
  })
  const totalAmendments = await prisma.amendmentDocument.count({
    where: { parse_status: 'COMPLETED' },
  })
  const sectionChanges = await prisma.sectionChange.count()
  const noContent = await prisma.legalDocument.count({
    where: {
      content_type: 'SFS_AMENDMENT',
      html_content: null,
      markdown_content: null,
    },
  })

  console.log('=== DATABASE STATE (after Part 2) ===')
  console.log('LegalDocument (SFS_AMENDMENT):')
  console.log('  Total:', total)
  console.log(
    '  With html_content:',
    withHtml,
    '(' + ((withHtml / total) * 100).toFixed(1) + '%)'
  )
  console.log(
    '  Without html_content:',
    withoutHtml,
    '(' + ((withoutHtml / total) * 100).toFixed(1) + '%)'
  )
  console.log(
    '  With markdown_content:',
    withMarkdown,
    '(' + ((withMarkdown / total) * 100).toFixed(1) + '%)'
  )
  console.log('  No content at all:', noContent)
  console.log('')
  console.log('AmendmentDocument (COMPLETED):', totalAmendments)
  console.log('SectionChanges total:', sectionChanges)

  await prisma.$disconnect()
}
main()
