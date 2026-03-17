import { prisma } from '../lib/prisma'

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { slug: 'afs-2023-10-kap-11' },
    select: { json_content: true, document_number: true },
  })

  if (!doc) {
    console.log('not found')
    await prisma.$disconnect()
    return
  }

  const json = doc.json_content as any
  if (!json) {
    console.log('no json_content')
    await prisma.$disconnect()
    return
  }

  console.log('doc_num:', doc.document_number)
  console.log('Top-level keys:', Object.keys(json))

  // Show first few chapters/sections
  if (json.chapters) {
    for (const ch of json.chapters.slice(0, 2)) {
      console.log(`\nChapter ${ch.number}: ${ch.title}`)
      if (ch.sections) {
        for (const s of ch.sections.slice(0, 3)) {
          console.log(`  § ${s.number}:`, JSON.stringify(s).slice(0, 200))
        }
      }
    }
  }

  // Check if sections have anchorId or id field
  if (json.chapters?.[0]?.sections?.[0]) {
    console.log(
      '\nFull first section keys:',
      Object.keys(json.chapters[0].sections[0])
    )
    console.log(
      'Full first section:',
      JSON.stringify(json.chapters[0].sections[0], null, 2).slice(0, 500)
    )
  }

  // Check if it's a flat structure
  if (json.sections) {
    console.log('\nFlat sections (first 3):')
    for (const s of json.sections.slice(0, 3)) {
      console.log(`  Keys: ${Object.keys(s).join(', ')}`)
      console.log(`  § ${s.number}:`, JSON.stringify(s).slice(0, 200))
    }
  }

  await prisma.$disconnect()
}
main()
