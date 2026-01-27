/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function main() {
  const law = await prisma.legalDocument.findFirst({
    where: {
      slug: { contains: 'subventionsbrottslag' },
    },
    select: {
      title: true,
      document_number: true,
      status: true,
      effective_date: true,
      html_content: true,
    },
  })

  console.log('Status:', law?.status)
  console.log('Effective date:', law?.effective_date)
  console.log('Title:', law?.title)

  // Check for ikraftträdande pattern in HTML
  if (law?.html_content) {
    const match = law.html_content.match(
      /Träder i kraft[^<]*(\d{4}-\d{2}-\d{2})/
    )
    console.log('HTML effective date match:', match?.[1])

    // Check if WHOLE law has future date (at very start of document)
    const headerMatch = law.html_content
      .substring(0, 1000)
      .match(/\/Träder i kraft I:(\d{4}-\d{2}-\d{2})\//)
    console.log('Header effective date:', headerMatch?.[1])

    // Show first 500 chars
    console.log('\nFirst 500 chars of HTML:')
    console.log(law.html_content.substring(0, 500))
  }

  await prisma.$disconnect()
}
main()
