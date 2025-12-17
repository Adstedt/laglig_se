/**
 * Find documents that are truly in API but not in our DB
 */

import { prisma } from '../lib/prisma'

async function fetchAllFromApi(): Promise<Set<string>> {
  const allSfs = new Set<string>()
  let page = 1
  let hasMore = true

  console.log('Fetching all SFS numbers from API...')

  while (hasMore) {
    const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=100&p=${page}`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Laglig.se/1.0' },
    })
    const data = await response.json()
    const docs = data.dokumentlista.dokument || []
    const totalPages = parseInt(data.dokumentlista['@sidor'], 10) || 1

    for (const doc of docs) {
      allSfs.add(`SFS ${doc.beteckning}`)
    }

    console.log(
      `  Page ${page}/${totalPages}: ${docs.length} docs, total collected: ${allSfs.size}`
    )

    hasMore = page < totalPages
    page++

    await new Promise((r) => setTimeout(r, 100))
  }

  return allSfs
}

async function main() {
  // Get all SFS from API
  const apiSfs = await fetchAllFromApi()
  console.log(`\nAPI total unique SFS numbers: ${apiSfs.size}`)

  // Get all SFS from DB
  const dbDocs = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_LAW' },
    select: { document_number: true },
  })
  const dbSfs = new Set(dbDocs.map((d) => d.document_number))
  console.log(`DB total SFS numbers: ${dbSfs.size}`)

  // Find missing
  const missing: string[] = []
  for (const sfs of apiSfs) {
    if (!dbSfs.has(sfs)) {
      missing.push(sfs)
    }
  }

  // Find extra (in DB but not API)
  const extra: string[] = []
  for (const sfs of dbSfs) {
    if (!apiSfs.has(sfs)) {
      extra.push(sfs)
    }
  }

  console.log(`\nMissing from DB: ${missing.length}`)
  console.log(`Extra in DB (not in API): ${extra.length}`)

  if (missing.length > 0) {
    console.log('\nMissing SFS numbers (first 50):')
    missing.slice(0, 50).forEach((s) => console.log(`  ${s}`))
  }

  if (extra.length > 0) {
    console.log('\nExtra in DB (first 20):')
    extra.slice(0, 20).forEach((s) => console.log(`  ${s}`))
  }

  await prisma.$disconnect()
}

main().catch(console.error)
