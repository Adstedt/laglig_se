/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function main() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  console.log('Checking newly added laws from today...\n')

  const newLaws = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_LAW',
      created_at: { gte: today },
    },
    select: {
      document_number: true,
      html_content: true,
    },
    take: 5,
  })

  console.log('Sample of newly added laws:')
  for (const law of newLaws) {
    console.log(
      law.document_number,
      '- HTML:',
      law.html_content ? `YES (${law.html_content.length} chars)` : 'NO'
    )
  }

  const totalNew = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW', created_at: { gte: today } },
  })

  const newWithHtml = await prisma.legalDocument.count({
    where: {
      content_type: 'SFS_LAW',
      created_at: { gte: today },
      html_content: { not: null },
    },
  })

  console.log('')
  console.log('New laws today:', totalNew)
  console.log('With HTML:', newWithHtml)
  console.log('Without HTML:', totalNew - newWithHtml)

  await prisma.$disconnect()
}

main().catch(console.error)
