/**
 * Check what's missing for specific orphan base laws
 */

import { prisma } from '../lib/prisma'

async function main() {
  const missingBaseLaws = [
    'SFS 1980:789',
    'SFS 2017:267',
    'SFS 2022:771',
    'SFS 2023:362',
    'SFS 2023:657',
    'SFS 2024:332',
    'SFS 2024:388',
    'SFS 1995:974',
  ]

  console.log('Checking missing base laws...\n')

  for (const baseLaw of missingBaseLaws) {
    // Check if in legal_documents
    const exists = await prisma.legalDocument.findUnique({
      where: { document_number: baseLaw },
      select: { id: true, title: true, content_type: true },
    })

    // Check Riksdagen API
    const sfsNum = baseLaw.replace('SFS ', '')
    const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&bet=${sfsNum}`
    let apiExists = false
    let apiTitle = ''

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Laglig.se/1.0' },
      })
      const data = await response.json()
      const docs = data.dokumentlista.dokument || []
      if (docs.length > 0) {
        apiExists = true
        apiTitle = docs[0].titel
      }
    } catch {
      // ignore
    }

    console.log(`${baseLaw}:`)
    console.log(`  In DB: ${exists ? `YES (${exists.content_type})` : 'NO'}`)
    console.log(`  In API: ${apiExists ? `YES - ${apiTitle}` : 'NO'}`)
    console.log()
  }

  await prisma.$disconnect()
}

main().catch(console.error)
