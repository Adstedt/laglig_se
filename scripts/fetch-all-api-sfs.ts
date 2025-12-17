/* eslint-disable no-console */
/**
 * Fetch ALL SFS numbers from Riksdagen API
 *
 * The API has 11,397 documents. We need to fetch them all properly.
 * Using page size 500 and fetching all pages.
 */

import * as fs from 'fs'
import * as path from 'path'

const CONFIG = {
  PAGE_SIZE: 500,
  DELAY_MS: 300,
  OUTPUT_DIR: 'data/sfs-comparison',
}

interface RiksdagenDocument {
  dok_id: string
  beteckning: string
  titel: string
  datum: string
  systemdatum: string
}

async function fetchPage(page: number): Promise<{
  documents: RiksdagenDocument[]
  totalCount: number
  totalPages: number
}> {
  const url = new URL('https://data.riksdagen.se/dokumentlista/')
  url.searchParams.set('doktyp', 'sfs')
  url.searchParams.set('utformat', 'json')
  url.searchParams.set('sz', CONFIG.PAGE_SIZE.toString())
  url.searchParams.set('p', page.toString())

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
  console.log('Fetching ALL SFS from Riksdagen API...')
  console.log('')

  const outputDir = path.join(process.cwd(), CONFIG.OUTPUT_DIR)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Get first page to see totals
  const firstPage = await fetchPage(1)
  const totalCount = firstPage.totalCount
  const totalPages = firstPage.totalPages

  console.log(`API reports: ${totalCount} total documents`)
  console.log(
    `API reports: ${totalPages} total pages (with page size ${CONFIG.PAGE_SIZE})`
  )
  console.log('')

  // Collect all documents
  const allDocuments: {
    sfs: string
    title: string
    date: string
    dok_id: string
  }[] = []
  const allSfsNumbers = new Set<string>()

  // Process first page
  for (const doc of firstPage.documents) {
    allSfsNumbers.add(doc.beteckning)
    allDocuments.push({
      sfs: doc.beteckning,
      title: doc.titel,
      date: doc.datum,
      dok_id: doc.dok_id,
    })
  }

  console.log(
    `Page 1/${totalPages}: ${firstPage.documents.length} docs (total unique: ${allSfsNumbers.size})`
  )

  // Fetch all remaining pages
  for (let page = 2; page <= totalPages; page++) {
    await sleep(CONFIG.DELAY_MS)

    try {
      const pageData = await fetchPage(page)

      for (const doc of pageData.documents) {
        if (!allSfsNumbers.has(doc.beteckning)) {
          allSfsNumbers.add(doc.beteckning)
          allDocuments.push({
            sfs: doc.beteckning,
            title: doc.titel,
            date: doc.datum,
            dok_id: doc.dok_id,
          })
        }
      }

      if (page % 5 === 0) {
        console.log(
          `Page ${page}/${totalPages}: ${pageData.documents.length} docs (total unique: ${allSfsNumbers.size})`
        )
      }
    } catch (error) {
      console.error(
        `Error on page ${page}:`,
        error instanceof Error ? error.message : error
      )
      // Retry once
      await sleep(1000)
      try {
        const pageData = await fetchPage(page)
        for (const doc of pageData.documents) {
          if (!allSfsNumbers.has(doc.beteckning)) {
            allSfsNumbers.add(doc.beteckning)
            allDocuments.push({
              sfs: doc.beteckning,
              title: doc.titel,
              date: doc.datum,
              dok_id: doc.dok_id,
            })
          }
        }
      } catch (retryError) {
        console.error(`Retry failed for page ${page}`)
      }
    }
  }

  console.log('')
  console.log(`Fetched ${allDocuments.length} total documents`)
  console.log(`Unique SFS numbers: ${allSfsNumbers.size}`)
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
    `# All SFS from Riksdagen API\n# Format: SFS\\tDATE\\tDOK_ID\\tTITLE\n# Total: ${allDocuments.length}\n# Fetched: ${new Date().toISOString()}\n#\n${fullListContent}\n`
  )
  console.log(`Written: api-sfs-full-list.txt`)

  // Write just SFS numbers
  const sfsOnlyPath = path.join(outputDir, 'api-sfs-list.txt')
  const sortedSfs = Array.from(allSfsNumbers).sort()
  fs.writeFileSync(sfsOnlyPath, sortedSfs.join('\n') + '\n')
  console.log(`Written: api-sfs-list.txt (${sortedSfs.length} entries)`)

  // Write summary
  const summaryPath = path.join(outputDir, 'api-fetch-summary.json')
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        apiReportedTotal: totalCount,
        apiReportedPages: totalPages,
        fetchedDocuments: allDocuments.length,
        uniqueSfsNumbers: allSfsNumbers.size,
        fetchedAt: new Date().toISOString(),
      },
      null,
      2
    ) + '\n'
  )
  console.log(`Written: api-fetch-summary.json`)

  console.log('')
  console.log('Done!')
}

main().catch(console.error)
