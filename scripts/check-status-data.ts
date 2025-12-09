/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function check() {
  // Kolla metadata-fältet för några dokument
  const samples = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_LAW' },
    select: {
      title: true,
      document_number: true,
      metadata: true,
      full_text: true
    },
    take: 5
  })

  console.log('=== Sample SFS-lagar metadata ===\n')
  for (const doc of samples) {
    console.log('Dokument:', doc.document_number, doc.title)
    console.log('Metadata:', JSON.stringify(doc.metadata, null, 2))

    // Kolla om full_text innehåller "upphävd" eller "upphört"
    if (doc.full_text) {
      const hasUpphavd = doc.full_text.toLowerCase().includes('upphävd')
      const hasUpphort = doc.full_text.toLowerCase().includes('upphört')
      const _hasGallande = doc.full_text.toLowerCase().includes('gällande')
      console.log('Innehåller "upphävd":', hasUpphavd)
      console.log('Innehåller "upphört":', hasUpphort)
    }
    console.log('---\n')
  }

  // Sök efter dokument som KAN vara upphävda
  console.log('\n=== Dokument med "upphävd" i titel ===')
  const maybeRepealed = await prisma.legalDocument.findMany({
    where: {
      OR: [
        { title: { contains: 'upphävd', mode: 'insensitive' } },
        { title: { contains: 'upphört', mode: 'insensitive' } },
      ]
    },
    select: { title: true, document_number: true, content_type: true },
    take: 10
  })
  console.log('Hittade:', maybeRepealed.length)
  maybeRepealed.forEach(d => console.log('-', d.content_type, d.document_number, d.title))

  // Kolla metadata-nycklar som finns
  console.log('\n=== Unika metadata-nycklar (sample) ===')
  const metaSample = await prisma.$queryRaw<any[]>`
    SELECT DISTINCT jsonb_object_keys(metadata) as key
    FROM legal_documents
    WHERE metadata IS NOT NULL
    LIMIT 50
  `
  console.log(metaSample.map(m => m.key))
}

check().finally(() => prisma.$disconnect())
