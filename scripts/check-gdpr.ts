/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function check() {
  // Kolla om det finns lagar med dataskydd/personuppgift i titel
  const laws = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_LAW',
      OR: [
        { title: { contains: 'dataskydd', mode: 'insensitive' } },
        { title: { contains: 'personuppgift', mode: 'insensitive' } },
      ]
    },
    select: { title: true, document_number: true },
    take: 5
  })
  console.log('Lagar med dataskydd/personuppgift i titel:')
  laws.forEach(l => console.log('-', l.document_number, l.title))

  // Kolla om summary innehåller GDPR
  const withGDPR = await prisma.legalDocument.findMany({
    where: {
      summary: { contains: 'GDPR', mode: 'insensitive' }
    },
    select: { title: true, document_number: true, content_type: true },
    take: 10
  })
  console.log('\nDokument med GDPR i summary:')
  withGDPR.forEach(l => console.log('-', l.content_type, l.document_number, l.title))

  // Kolla totalt antal SFS-lagar
  const sfsCount = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW' }
  })
  console.log('\nTotalt antal SFS-lagar:', sfsCount)
}

check().finally(() => prisma.$disconnect())
