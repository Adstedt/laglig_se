/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function check() {
  const stats = await prisma.legalDocument.groupBy({
    by: ['status'],
    _count: true
  })
  console.log('Dokumentstatus i databasen:')
  stats.forEach(s => console.log('-', s.status, ':', s._count))

  // Kolla om det finns upphävda
  const repealed = await prisma.legalDocument.findMany({
    where: { status: 'REPEALED' },
    select: { title: true, document_number: true },
    take: 5
  })
  console.log('\nUpphävda dokument (max 5):')
  if (repealed.length === 0) {
    console.log('  (inga hittades)')
  } else {
    repealed.forEach(r => console.log('-', r.document_number, r.title))
  }
}

check().finally(() => prisma.$disconnect())
