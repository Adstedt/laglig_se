/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function check() {
  const total = await prisma.legalDocument.count({
    where: { content_type: { in: ['EU_REGULATION', 'EU_DIRECTIVE'] } },
  })

  const withHtml = await prisma.legalDocument.count({
    where: {
      content_type: { in: ['EU_REGULATION', 'EU_DIRECTIVE'] },
      html_content: { not: null },
    },
  })

  const withFullText = await prisma.legalDocument.count({
    where: {
      content_type: { in: ['EU_REGULATION', 'EU_DIRECTIVE'] },
      full_text: { not: null },
    },
  })

  // Sample some without content
  const withoutHtml = await prisma.legalDocument.findMany({
    where: {
      content_type: { in: ['EU_REGULATION', 'EU_DIRECTIVE'] },
      html_content: null,
    },
    take: 10,
    select: { document_number: true, title: true },
  })

  // Check specific document
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'CELEX 32020L1057' },
    include: { eu_document: true },
  })

  console.log('=== EU Document Content Stats ===')
  console.log('Total EU documents:', total)
  console.log(
    'With HTML content:',
    withHtml,
    `(${((withHtml / total) * 100).toFixed(1)}%)`
  )
  console.log(
    'With full_text:',
    withFullText,
    `(${((withFullText / total) * 100).toFixed(1)}%)`
  )
  console.log('')
  console.log('=== CELEX 32020L1057 ===')
  console.log('Found:', !!doc)
  if (doc) {
    console.log('html_content length:', doc.html_content?.length || 0)
    console.log('full_text length:', doc.full_text?.length || 0)
  }

  console.log('')
  console.log('=== Sample docs without HTML ===')
  withoutHtml.forEach((d) =>
    console.log('-', d.document_number, d.title?.substring(0, 60))
  )

  await prisma.$disconnect()
}

check()
