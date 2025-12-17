/**
 * Investigate why API count doesn't match DB count even after sync
 */

import { prisma } from '../lib/prisma'

async function main() {
  const year = 2024

  // Get what API returns for this year
  const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=200&rm=${year}`
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Laglig.se/1.0' },
  })
  const data = await response.json()
  const apiDocs = data.dokumentlista.dokument || []

  console.log(`API returns ${apiDocs.length} documents for year ${year}`)

  // Check what SFS numbers the API has
  const apiSfsNumbers = new Set<string>()
  const nonStandardNumbers: string[] = []

  for (const doc of apiDocs) {
    const sfsNumber = `SFS ${doc.beteckning}`
    apiSfsNumbers.add(sfsNumber)

    // Check if it's a standard format
    if (!sfsNumber.match(/^SFS \d{4}:\d+$/)) {
      nonStandardNumbers.push(sfsNumber)
    }
  }

  console.log(`\nNon-standard SFS numbers in API:`)
  nonStandardNumbers.forEach((n) => console.log(`  ${n}`))

  // Get what we have in DB for this year
  const dbDocs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_LAW',
      document_number: { startsWith: `SFS ${year}:` },
    },
    select: { document_number: true },
  })

  console.log(`\nDB has ${dbDocs.length} documents for year ${year}`)

  // Find what's in API but not in DB
  const dbSfsNumbers = new Set(dbDocs.map((d) => d.document_number))
  const inApiNotDb: string[] = []
  const inDbNotApi: string[] = []

  for (const sfs of apiSfsNumbers) {
    if (!dbSfsNumbers.has(sfs)) {
      inApiNotDb.push(sfs)
    }
  }

  for (const sfs of dbSfsNumbers) {
    if (!apiSfsNumbers.has(sfs)) {
      inDbNotApi.push(sfs)
    }
  }

  console.log(`\nIn API but not in DB (${inApiNotDb.length}):`)
  inApiNotDb.slice(0, 20).forEach((n) => console.log(`  ${n}`))

  console.log(`\nIn DB but not in API (${inDbNotApi.length}):`)
  inDbNotApi.slice(0, 20).forEach((n) => console.log(`  ${n}`))

  // Check for N2024 prefix documents
  const n2024Docs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_LAW',
      document_number: { startsWith: 'SFS N2024' },
    },
    select: { document_number: true, title: true },
  })

  console.log(`\nDocuments with N2024 prefix in DB (${n2024Docs.length}):`)
  n2024Docs
    .slice(0, 10)
    .forEach((d) =>
      console.log(`  ${d.document_number}: ${d.title?.substring(0, 50)}...`)
    )

  await prisma.$disconnect()
}

main().catch(console.error)
