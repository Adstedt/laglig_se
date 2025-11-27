#!/usr/bin/env tsx
import { prisma } from '../lib/prisma'

async function checkHTML() {
  const law = await prisma.legalDocument.findFirst({
    where: { content_type: 'SFS_LAW' },
    select: {
      document_number: true,
      html_content: true,
      full_text: true,
    },
  })

  console.log('Law:', law?.document_number)
  console.log('HTML content exists:', !!law?.html_content)
  console.log('HTML length:', law?.html_content?.length || 0)
  console.log('Full text length:', law?.full_text?.length || 0)
  console.log('\nFirst 200 chars of HTML:')
  console.log(law?.html_content?.substring(0, 200))

  await prisma.$disconnect()
}

checkHTML()
