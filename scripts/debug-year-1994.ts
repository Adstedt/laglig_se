/* eslint-disable no-console */
/**
 * Debug: Fetch all SFS from 1994 to investigate missing entries
 */

import * as fs from 'fs'

async function fetchPage(
  page: number
): Promise<{ documents: unknown[]; totalCount: number; totalPages: number }> {
  const url = new URL('https://data.riksdagen.se/dokumentlista/')
  url.searchParams.set('doktyp', 'sfs')
  url.searchParams.set('utformat', 'json')
  url.searchParams.set('sz', '500')
  url.searchParams.set('p', page.toString())
  url.searchParams.set('rm', '1994')

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Laglig.se/1.0 (Legal research; contact@laglig.se)',
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const totalCount = parseInt(data.dokumentlista['@traffar'], 10) || 0
  const totalPages = parseInt(data.dokumentlista['@sidor'], 10) || 1
  const documents = data.dokumentlista.dokument || []

  return { documents, totalCount, totalPages }
}

async function main() {
  console.log('Fetching all 1994 SFS documents...\n')

  const firstPage = await fetchPage(1)
  console.log(
    `API reports: ${firstPage.totalCount} documents in ${firstPage.totalPages} pages`
  )

  const allDocs: { beteckning: string; dok_id: string; title: string }[] = []
  const byBeteckning = new Map<string, string[]>()

  for (const doc of firstPage.documents) {
    allDocs.push({
      beteckning: doc.beteckning,
      dok_id: doc.dok_id,
      title: doc.titel?.replace(/\n/g, ' ').substring(0, 50),
    })

    if (!byBeteckning.has(doc.beteckning)) {
      byBeteckning.set(doc.beteckning, [])
    }
    byBeteckning.get(doc.beteckning)!.push(doc.dok_id)
  }

  // Fetch more pages if needed
  for (let page = 2; page <= firstPage.totalPages; page++) {
    await new Promise((r) => setTimeout(r, 300))
    const pageData = await fetchPage(page)
    for (const doc of pageData.documents) {
      allDocs.push({
        beteckning: doc.beteckning,
        dok_id: doc.dok_id,
        title: doc.titel?.replace(/\n/g, ' ').substring(0, 50),
      })

      if (!byBeteckning.has(doc.beteckning)) {
        byBeteckning.set(doc.beteckning, [])
      }
      byBeteckning.get(doc.beteckning)!.push(doc.dok_id)
    }
  }

  console.log(`\nFetched ${allDocs.length} documents`)
  console.log(`Unique beteckning: ${byBeteckning.size}`)

  // Find duplicates
  console.log('\nBeteckning with multiple dok_ids:')
  for (const [beteckning, dokIds] of byBeteckning) {
    if (dokIds.length > 1) {
      console.log(`  ${beteckning}: ${dokIds.join(', ')}`)
    }
  }

  // Sort and show all
  const sortedBeteckning = Array.from(byBeteckning.keys()).sort()
  console.log(`\nAll unique beteckning from 1994 (${sortedBeteckning.length}):`)

  // Check specifically for 1994:1000
  console.log('\nLooking for 1994:1000...')
  const found = allDocs.find((d) => d.beteckning === '1994:1000')
  if (found) {
    console.log(`  FOUND: ${found.dok_id} - ${found.title}`)
  } else {
    console.log('  NOT FOUND in fetched results!')
  }

  // Write full list
  fs.writeFileSync(
    'data/sfs-comparison/debug-1994-full.txt',
    allDocs.map((d) => `${d.beteckning}\t${d.dok_id}\t${d.title}`).join('\n')
  )
  console.log('\nWritten: debug-1994-full.txt')
}

main().catch(console.error)
