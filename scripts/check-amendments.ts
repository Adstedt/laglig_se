import { prisma } from '../lib/prisma'

async function check() {
  // Find Arbetsmiljölagen - search by document number pattern
  const law = await prisma.legalDocument.findFirst({
    where: { document_number: { contains: '1977:1160' } },
    select: { id: true, title: true, document_number: true, full_text: true }
  })

  if (!law) {
    console.log('Law not found')
    return
  }

  console.log('Law:', law.title)
  console.log('Document Number:', law.document_number)
  console.log('ID:', law.id)

  // Check existing amendments
  const amendments = await prisma.amendment.findMany({
    where: { base_document_id: law.id },
    select: { amending_law_title: true, affected_sections: true }
  })

  console.log('\nExisting amendments in DB:', amendments.length)
  amendments.slice(0, 10).forEach(a => console.log(' -', a.amending_law_title, a.affected_sections))

  // Check version records
  const versions = await prisma.documentVersion.findMany({
    where: { document_id: law.id }
  })
  console.log('\nVersions in DB:', versions.length)

  // Count Lag() patterns in text
  if (law.full_text) {
    const pattern = /Lag\s*\((\d{4}:\d+)\)/g
    const matches = [...law.full_text.matchAll(pattern)]
    const uniqueSfs = new Set(matches.map(m => m[1]))
    console.log('\nUnique Lag() patterns in text:', uniqueSfs.size)
    console.log('All:', [...uniqueSfs].join(', '))
  }

  await prisma.$disconnect()
}

check()
