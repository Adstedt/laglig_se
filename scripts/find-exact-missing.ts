/**
 * Find exactly which documents are in API but not in DB
 * by checking each year individually
 */

import { prisma } from '../lib/prisma'

interface ApiDoc {
  dok_id: string
  beteckning: string
  titel: string
}

async function getApiDocsForYear(year: number): Promise<ApiDoc[]> {
  const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=200&rm=${year}`
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Laglig.se/1.0' },
  })
  const data = await response.json()
  return data.dokumentlista.dokument || []
}

async function main() {
  const missingDocs: Array<{
    year: number
    sfsNumber: string
    title: string
    dokId: string
  }> = []

  // Check all years from 1900 to 2025
  for (let year = 2025; year >= 1900; year--) {
    const apiDocs = await getApiDocsForYear(year)
    if (apiDocs.length === 0) continue

    for (const doc of apiDocs) {
      const sfsNumber = `SFS ${doc.beteckning}`

      // Check if in DB
      const exists = await prisma.legalDocument.findUnique({
        where: { document_number: sfsNumber },
        select: { id: true },
      })

      if (!exists) {
        missingDocs.push({
          year,
          sfsNumber,
          title: doc.titel,
          dokId: doc.dok_id,
        })
      }
    }

    // Progress
    if (year % 10 === 0) {
      console.log(
        `Checked year ${year}, found ${missingDocs.length} missing so far`
      )
    }

    await new Promise((r) => setTimeout(r, 100))
  }

  console.log('\n' + '='.repeat(60))
  console.log(`TOTAL MISSING: ${missingDocs.length}`)
  console.log('='.repeat(60))

  if (missingDocs.length > 0) {
    console.log('\nMissing documents:')
    missingDocs.forEach((d) => {
      console.log(
        `  ${d.sfsNumber} (${d.year}): ${d.title.substring(0, 60)}...`
      )
      console.log(`    dok_id: ${d.dokId}`)
    })
  }

  await prisma.$disconnect()
}

main().catch(console.error)
