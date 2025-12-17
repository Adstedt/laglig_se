/* eslint-disable no-console */
/**
 * Fetch ALL SFS numbers from Riksdagen API - BY YEAR
 *
 * The API has a 10,000 result limit. We bypass this by fetching year by year.
 */

import * as fs from 'fs'
import * as path from 'path'

const CONFIG = {
  PAGE_SIZE: 500,
  DELAY_MS: 250,
  OUTPUT_DIR: 'data/sfs-comparison',
  START_YEAR: 1700, // Very old laws
  END_YEAR: 2025,
}

interface RiksdagenDocument {
  dok_id: string
  beteckning: string
  titel: string
  datum: string
  systemdatum: string
}

async function fetchYearPage(
  year: number,
  page: number
): Promise<{
  documents: RiksdagenDocument[]
  totalCount: number
  totalPages: number
}> {
  const url = new URL('https://data.riksdagen.se/dokumentlista/')
  url.searchParams.set('doktyp', 'sfs')
  url.searchParams.set('utformat', 'json')
  url.searchParams.set('sz', CONFIG.PAGE_SIZE.toString())
  url.searchParams.set('p', page.toString())
  url.searchParams.set('rm', year.toString()) // Filter by year

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
  const documents: RiksdagenDocument[] = data.dokumentlista.dokument || []

  return { documents, totalCount, totalPages }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  console.log('Fetching ALL SFS from Riksdagen API (by year)...')
  console.log('')

  const outputDir = path.join(process.cwd(), CONFIG.OUTPUT_DIR)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const allDocuments: {
    sfs: string
    title: string
    date: string
    dok_id: string
    year: number
  }[] = []
  const allSfsNumbers = new Set<string>()
  const yearStats: { year: number; count: number }[] = []

  // Fetch year by year
  for (let year = CONFIG.START_YEAR; year <= CONFIG.END_YEAR; year++) {
    await sleep(CONFIG.DELAY_MS)

    try {
      const firstPage = await fetchYearPage(year, 1)

      if (firstPage.totalCount === 0) {
        continue // Skip years with no laws
      }

      // Process first page
      for (const doc of firstPage.documents) {
        if (!allSfsNumbers.has(doc.beteckning)) {
          allSfsNumbers.add(doc.beteckning)
          allDocuments.push({
            sfs: doc.beteckning,
            title: doc.titel,
            date: doc.datum,
            dok_id: doc.dok_id,
            year,
          })
        }
      }

      // Fetch remaining pages for this year
      for (let page = 2; page <= firstPage.totalPages; page++) {
        await sleep(CONFIG.DELAY_MS)
        const pageData = await fetchYearPage(year, page)

        for (const doc of pageData.documents) {
          if (!allSfsNumbers.has(doc.beteckning)) {
            allSfsNumbers.add(doc.beteckning)
            allDocuments.push({
              sfs: doc.beteckning,
              title: doc.titel,
              date: doc.datum,
              dok_id: doc.dok_id,
              year,
            })
          }
        }
      }

      yearStats.push({ year, count: firstPage.totalCount })
      console.log(
        `${year}: ${firstPage.totalCount} documents (running total: ${allSfsNumbers.size})`
      )
    } catch (error) {
      console.error(
        `Error for year ${year}:`,
        error instanceof Error ? error.message : error
      )
    }
  }

  console.log('')
  console.log(`Total unique SFS numbers: ${allSfsNumbers.size}`)
  console.log('')

  // Sort by SFS number
  allDocuments.sort((a, b) => a.sfs.localeCompare(b.sfs))

  // Write full list with details
  const fullListPath = path.join(outputDir, 'api-sfs-full-list.txt')
  const fullListContent = allDocuments
    .map((d) => `${d.sfs}\t${d.date}\t${d.dok_id}\t${d.title}`)
    .join('\n')
  fs.writeFileSync(
    fullListPath,
    `# All SFS from Riksdagen API (fetched by year)\n# Format: SFS\\tDATE\\tDOK_ID\\tTITLE\n# Total: ${allDocuments.length}\n# Fetched: ${new Date().toISOString()}\n#\n${fullListContent}\n`
  )
  console.log(`Written: api-sfs-full-list.txt`)

  // Write just SFS numbers
  const sfsOnlyPath = path.join(outputDir, 'api-sfs-list.txt')
  const sortedSfs = Array.from(allSfsNumbers).sort()
  fs.writeFileSync(sfsOnlyPath, sortedSfs.join('\n') + '\n')
  console.log(`Written: api-sfs-list.txt (${sortedSfs.length} entries)`)

  // Write year stats
  const yearStatsPath = path.join(outputDir, 'api-year-stats.json')
  fs.writeFileSync(
    yearStatsPath,
    JSON.stringify(
      {
        years: yearStats,
        totalDocuments: allDocuments.length,
        uniqueSfsNumbers: allSfsNumbers.size,
        fetchedAt: new Date().toISOString(),
      },
      null,
      2
    ) + '\n'
  )
  console.log(`Written: api-year-stats.json`)

  console.log('')
  console.log('Done!')
}

main().catch(console.error)
