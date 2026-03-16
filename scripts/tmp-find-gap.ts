/**
 * Fetch ALL SFS doc numbers from Riksdag API year by year,
 * then compare with our DB SFS_LAW records.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'
const prisma = new PrismaClient()

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchYearDocs(year: string): Promise<string[]> {
  const docs: string[] = []
  let page = 1
  while (true) {
    const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=200&p=${page}&rm=${year}`
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Laglig.se/1.0' },
    })
    if (!res.ok) break
    const data = await res.json()
    const results = data.dokumentlista?.dokument
    if (!results || results.length === 0) break
    for (const d of results) {
      docs.push(`SFS ${d.beteckning}`)
    }
    const totalPages = parseInt(data.dokumentlista?.['@sidor'] || '1', 10)
    if (page >= totalPages) break
    page++
    await sleep(200)
  }
  return docs
}

async function main() {
  const apiDocNumbers = new Set<string>()

  // Fetch year by year: 1700s to 2026
  // Most years before 1900 have 0 docs, so this is fast
  console.log('Fetching all SFS docs from Riksdag API, year by year...')

  for (let year = 2026; year >= 1700; year--) {
    await sleep(250)
    const docs = await fetchYearDocs(String(year))
    if (docs.length > 0) {
      for (const d of docs) apiDocNumbers.add(d)
      process.stdout.write(
        `  ${year}: ${docs.length} docs (total: ${apiDocNumbers.size})\n`
      )
    }
  }

  // Also fetch N-prefix years (normeringsföreskrifter)
  for (let year = 2026; year >= 2015; year--) {
    await sleep(250)
    const docs = await fetchYearDocs(`N${year}`)
    if (docs.length > 0) {
      for (const d of docs) apiDocNumbers.add(d)
      process.stdout.write(
        `  N${year}: ${docs.length} docs (total: ${apiDocNumbers.size})\n`
      )
    }
  }

  console.log(`\nAPI total unique: ${apiDocNumbers.size}`)

  // Get DB SFS_LAW doc numbers
  const dbDocs = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_LAW' },
    select: { document_number: true },
  })
  const dbSet = new Set(dbDocs.map((d) => d.document_number))
  console.log(`DB SFS_LAW: ${dbSet.size}`)

  // Compare
  const inApiNotDb: string[] = []
  for (const d of apiDocNumbers) {
    if (!dbSet.has(d)) inApiNotDb.push(d)
  }

  const inDbNotApi: string[] = []
  for (const d of dbSet) {
    if (!apiDocNumbers.has(d)) inDbNotApi.push(d)
  }

  console.log(`\nIn API but NOT in DB: ${inApiNotDb.length}`)
  console.log(`In DB but NOT in API: ${inDbNotApi.length}`)

  // Breakdown missing by year
  if (inApiNotDb.length > 0) {
    const byYear = new Map<string, string[]>()
    for (const d of inApiNotDb) {
      const year = d.match(/\d{4}/)?.[0] || 'unknown'
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year)!.push(d)
    }

    console.log('\nMissing from DB by year:')
    for (const [year, docs] of [...byYear.entries()].sort((a, b) =>
      b[0].localeCompare(a[0])
    )) {
      console.log(`  ${year}: ${docs.length}`)
    }

    // Save full list
    writeFileSync(
      'data/missing-sfs-laws.json',
      JSON.stringify(inApiNotDb.sort(), null, 2)
    )
    console.log(`\nFull missing list saved to data/missing-sfs-laws.json`)
  }

  // Breakdown extras by year
  if (inDbNotApi.length > 0) {
    const byYear = new Map<string, string[]>()
    for (const d of inDbNotApi) {
      const year = d.match(/\d{4}/)?.[0] || 'unknown'
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year)!.push(d)
    }

    console.log('\nIn DB but not in API, by year:')
    for (const [year, docs] of [...byYear.entries()].sort((a, b) =>
      b[0].localeCompare(a[0])
    )) {
      if (docs.length >= 3) console.log(`  ${year}: ${docs.length}`)
    }

    writeFileSync(
      'data/extra-sfs-laws.json',
      JSON.stringify(inDbNotApi.sort(), null, 2)
    )
    console.log(`Full extras list saved to data/extra-sfs-laws.json`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
