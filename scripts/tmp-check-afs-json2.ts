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
  console.log('doc_num:', doc.document_number)

  // Check divisions
  if (json.divisions) {
    console.log('Divisions:', json.divisions.length)
    for (const d of json.divisions.slice(0, 1)) {
      console.log('Division:', JSON.stringify(d).slice(0, 300))
      if (d.chapters) {
        for (const ch of d.chapters.slice(0, 1)) {
          console.log('  Chapter keys:', Object.keys(ch))
          if (ch.sections) {
            for (const s of ch.sections.slice(0, 3)) {
              console.log('  Section keys:', Object.keys(s))
              console.log('  Section:', JSON.stringify(s).slice(0, 300))
            }
          }
        }
      }
    }
  }

  // Also check a flat AFS (SSMFS)
  const ssmfs = await prisma.legalDocument.findFirst({
    where: { slug: 'ssmfs-2018-8' },
    select: { json_content: true, document_number: true, html_content: true },
  })
  if (ssmfs) {
    console.log('\n--- SSMFS ---')
    console.log('doc_num:', ssmfs.document_number)
    const j2 = ssmfs.json_content as any
    if (j2) {
      console.log('Top keys:', Object.keys(j2))
      if (j2.chapters) {
        const ch = j2.chapters[0]
        if (ch?.sections?.[0]) {
          console.log('First section keys:', Object.keys(ch.sections[0]))
          console.log(
            'First section:',
            JSON.stringify(ch.sections[0]).slice(0, 300)
          )
        }
      }
    }
    // Check HTML anchor IDs
    const html = ssmfs.html_content || ''
    const ids = [...html.matchAll(/id="([^"]+)"/g)]
    console.log('HTML anchor IDs (first 10):')
    for (const m of ids.slice(0, 10)) console.log(' ', m[1])
  }

  await prisma.$disconnect()
}
main()
