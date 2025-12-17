/* eslint-disable no-console */
/**
 * Complete API SFS List Fetcher
 *
 * Fetches ALL SFS from Riksdagen API year by year with full verification
 */

import * as fs from 'fs'
import * as path from 'path'

const CONFIG = {
  PAGE_SIZE: 500,
  DELAY_MS: 300,
  OUTPUT_DIR: 'data/sfs-comparison',
  START_YEAR: 1600, // Kyrkolag is from 1686
  END_YEAR: 2025,
}

interface Doc {
  beteckning: string
  dok_id: string
  title: string
  date: string
}

async function fetchYearPage(
  year: number,
  page: number
): Promise<{ documents: unknown[]; totalCount: number; totalPages: number }> {
  const url = new URL('https://data.riksdagen.se/dokumentlista/')
  url.searchParams.set('doktyp', 'sfs')
  url.searchParams.set('utformat', 'json')
  url.searchParams.set('sz', CONFIG.PAGE_SIZE.toString())
  url.searchParams.set('p', page.toString())
  url.searchParams.set('rm', year.toString())
  // CRITICAL: sort=datum&sortorder=asc ensures all documents are returned
  // Without this, the API's default sort can skip documents in pagination
  url.searchParams.set('sort', 'datum')
  url.searchParams.set('sortorder', 'asc')

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
  return {
    documents: data.dokumentlista.dokument || [],
    totalCount: parseInt(data.dokumentlista['@traffar'], 10) || 0,
    totalPages: parseInt(data.dokumentlista['@sidor'], 10) || 1,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  console.log('='.repeat(60))
  console.log('Complete SFS API List Fetcher')
  console.log('='.repeat(60))
  console.log('')

  const outputDir = path.join(process.cwd(), CONFIG.OUTPUT_DIR)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const allDocs: Doc[] = []
  const byBeteckning = new Map<string, Doc>()
  const yearStats: {
    year: number
    apiCount: number
    fetched: number
    unique: number
  }[] = []

  let totalApiReported = 0
  let totalFetched = 0

  for (let year = CONFIG.START_YEAR; year <= CONFIG.END_YEAR; year++) {
    try {
      await sleep(CONFIG.DELAY_MS)
      const firstPage = await fetchYearPage(year, 1)

      if (firstPage.totalCount === 0) continue

      totalApiReported += firstPage.totalCount
      let yearFetched = 0
      const yearBeteckning = new Set<string>()

      const processDoc = (doc: {
        beteckning: string
        dok_id: string
        titel?: string
        datum: string
      }) => {
        yearFetched++
        totalFetched++

        const cleanTitle = (doc.titel || '')
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        const entry: Doc = {
          beteckning: doc.beteckning,
          dok_id: doc.dok_id,
          title: cleanTitle,
          date: doc.datum,
        }

        allDocs.push(entry)
        yearBeteckning.add(doc.beteckning)

        // Only keep first occurrence per beteckning
        if (!byBeteckning.has(doc.beteckning)) {
          byBeteckning.set(doc.beteckning, entry)
        }
      }

      // Process first page
      for (const doc of firstPage.documents) {
        processDoc(doc)
      }

      // Fetch remaining pages
      for (let page = 2; page <= firstPage.totalPages; page++) {
        await sleep(CONFIG.DELAY_MS)
        try {
          const pageData = await fetchYearPage(year, page)
          for (const doc of pageData.documents) {
            processDoc(doc)
          }
        } catch (error) {
          console.error(`  Error on page ${page} of ${year}, retrying...`)
          await sleep(1000)
          const pageData = await fetchYearPage(year, page)
          for (const doc of pageData.documents) {
            processDoc(doc)
          }
        }
      }

      yearStats.push({
        year,
        apiCount: firstPage.totalCount,
        fetched: yearFetched,
        unique: yearBeteckning.size,
      })

      // Verify we got everything
      if (yearFetched !== firstPage.totalCount) {
        console.log(
          `⚠️  ${year}: API=${firstPage.totalCount} but fetched=${yearFetched}`
        )
      } else {
        console.log(
          `${year}: ${firstPage.totalCount} docs, ${yearBeteckning.size} unique SFS`
        )
      }
    } catch (error) {
      console.error(
        `Error for year ${year}:`,
        error instanceof Error ? error.message : error
      )
    }
  }

  console.log('')
  console.log('='.repeat(60))
  console.log(`API reported total: ${totalApiReported}`)
  console.log(`Total fetched: ${totalFetched}`)
  console.log(`Unique SFS numbers: ${byBeteckning.size}`)
  console.log('='.repeat(60))

  // Write unique SFS list (sorted)
  const sortedSfs = Array.from(byBeteckning.keys()).sort()
  fs.writeFileSync(
    path.join(outputDir, 'api-sfs-list.txt'),
    sortedSfs.join('\n') + '\n'
  )
  console.log(`\nWritten: api-sfs-list.txt (${sortedSfs.length} entries)`)

  // Write full list with details
  const fullLines = sortedSfs.map((sfs) => {
    const doc = byBeteckning.get(sfs)!
    return `${sfs}\t${doc.date}\t${doc.dok_id}\t${doc.title}`
  })
  fs.writeFileSync(
    path.join(outputDir, 'api-sfs-full-list.txt'),
    `# Complete SFS list from Riksdagen API\n# Fetched: ${new Date().toISOString()}\n# API reported: ${totalApiReported}, Unique SFS: ${byBeteckning.size}\n# Format: SFS\\tDATE\\tDOK_ID\\tTITLE\n#\n${fullLines.join('\n')}\n`
  )
  console.log(`Written: api-sfs-full-list.txt`)

  // Write year stats
  fs.writeFileSync(
    path.join(outputDir, 'api-year-stats.json'),
    JSON.stringify(
      {
        totalApiReported,
        totalFetched,
        uniqueSfs: byBeteckning.size,
        years: yearStats,
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
