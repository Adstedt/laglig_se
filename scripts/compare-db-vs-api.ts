/* eslint-disable no-console */
/**
 * Compare DB vs API - Check if we're caught up
 *
 * Fetches newest 300 from API and verifies each exists in our DB
 */

import { prisma } from '../lib/prisma'

interface RiksdagenDocument {
  dok_id: string
  beteckning: string
  publicerad: string
}

async function fetchApiDocs(page: number): Promise<RiksdagenDocument[]> {
  const url = new URL('https://data.riksdagen.se/dokumentlista/')
  url.searchParams.set('doktyp', 'sfs')
  url.searchParams.set('utformat', 'json')
  url.searchParams.set('sz', '100')
  url.searchParams.set('p', page.toString())
  url.searchParams.set('sort', 'publicerad')
  url.searchParams.set('sortorder', 'desc')

  const response = await fetch(url.toString())
  const data = await response.json()
  return data.dokumentlista.dokument || []
}

async function main() {
  console.log('='.repeat(60))
  console.log('DB vs API Comparison')
  console.log('='.repeat(60))
  console.log('')

  // Get newest 300 from API (by publicerad)
  console.log('Fetching newest 300 from API (by publicerad)...')
  const apiDocs: RiksdagenDocument[] = []
  for (let page = 1; page <= 3; page++) {
    const docs = await fetchApiDocs(page)
    apiDocs.push(...docs)
    console.log(`  Page ${page}: ${docs.length} docs`)
  }

  // Filter to only those with SFS numbers
  const apiWithSfs = apiDocs.filter((d) => d.beteckning)
  console.log(`  Total with SFS number: ${apiWithSfs.length}`)

  console.log('')
  console.log('Checking each API doc against our DB...')
  console.log('')

  const missing: { sfs: string; publicerad: string }[] = []
  const found: string[] = []

  let pageNum = 1
  for (let i = 0; i < apiWithSfs.length; i++) {
    // Print page header every 100 docs
    if (i % 100 === 0) {
      console.log(
        `--- Page ${pageNum} (${i + 1}-${Math.min(i + 100, apiWithSfs.length)}) ---`
      )
      pageNum++
    }

    const doc = apiWithSfs[i]
    const sfs = `SFS ${doc.beteckning}`
    const exists = await prisma.legalDocument.findUnique({
      where: { document_number: sfs },
      select: { id: true },
    })

    if (exists) {
      found.push(sfs)
      console.log(
        `  [✓] ${sfs.padEnd(20)} exists (publicerad: ${doc.publicerad})`
      )
    } else {
      missing.push({ sfs, publicerad: doc.publicerad })
      console.log(
        `  [✗] ${sfs.padEnd(20)} MISSING (publicerad: ${doc.publicerad})`
      )
    }
  }

  console.log('')

  console.log('─'.repeat(60))
  console.log('RESULTS')
  console.log('─'.repeat(60))
  console.log('')

  // Show API newest
  const newestApi = apiWithSfs[0]
  if (newestApi) {
    console.log(
      `API newest:  SFS ${newestApi.beteckning} (publicerad: ${newestApi.publicerad})`
    )
    const inDb = found.includes(`SFS ${newestApi.beteckning}`)
    console.log(`In our DB:   ${inDb ? '✓ Yes' : '✗ NO'}`)
  }

  console.log('')
  console.log(`Checked:     ${apiWithSfs.length} API docs`)
  console.log(`Found in DB: ${found.length}`)
  console.log(`Missing:     ${missing.length}`)

  if (missing.length === 0) {
    console.log('')
    console.log('✓ All 300 newest API docs exist in our DB - we are caught up!')
  } else {
    console.log('')
    console.log('⚠ MISSING from our DB:')
    missing.forEach((m) =>
      console.log(`    ${m.sfs} (publicerad: ${m.publicerad})`)
    )
  }

  await prisma.$disconnect()
}

main().catch(console.error)
