/* eslint-disable no-console */
/**
 * Fetch ALL unique dok_ids from Riksdagen API - BY YEAR
 *
 * This ensures we get every single document regardless of duplicates
 */

import * as fs from 'fs'
import * as path from 'path'

const CONFIG = {
  PAGE_SIZE: 500,
  DELAY_MS: 250,
  OUTPUT_DIR: 'data/sfs-comparison',
  START_YEAR: 1700,
  END_YEAR: 2025,
}

interface RiksdagenDocument {
  dok_id: string
  beteckning: string
  titel: string
  datum: string
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
  url.searchParams.set('rm', year.toString())

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
  console.log('Fetching ALL dok_ids from Riksdagen API (by year)...')
  console.log('')

  const outputDir = path.join(process.cwd(), CONFIG.OUTPUT_DIR)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Track by dok_id (unique document identifier)
  const byDokId = new Map<
    string,
    { beteckning: string; title: string; date: string; year: number }
  >()
  // Track by beteckning (SFS number)
  const byBeteckning = new Map<
    string,
    { dok_id: string; title: string; date: string; year: number }[]
  >()

  let totalFetched = 0

  for (let year = CONFIG.START_YEAR; year <= CONFIG.END_YEAR; year++) {
    await sleep(CONFIG.DELAY_MS)

    try {
      const firstPage = await fetchYearPage(year, 1)

      if (firstPage.totalCount === 0) continue

      const processDoc = (doc: RiksdagenDocument) => {
        totalFetched++

        // Clean title (remove newlines)
        const cleanTitle = doc.titel
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

        // Track by dok_id
        if (!byDokId.has(doc.dok_id)) {
          byDokId.set(doc.dok_id, {
            beteckning: doc.beteckning,
            title: cleanTitle,
            date: doc.datum,
            year,
          })
        }

        // Track by beteckning
        if (!byBeteckning.has(doc.beteckning)) {
          byBeteckning.set(doc.beteckning, [])
        }
        const existing = byBeteckning.get(doc.beteckning)!
        if (!existing.find((e) => e.dok_id === doc.dok_id)) {
          existing.push({
            dok_id: doc.dok_id,
            title: cleanTitle,
            date: doc.datum,
            year,
          })
        }
      }

      // Process first page
      for (const doc of firstPage.documents) {
        processDoc(doc)
      }

      // Fetch remaining pages
      for (let page = 2; page <= firstPage.totalPages; page++) {
        await sleep(CONFIG.DELAY_MS)
        const pageData = await fetchYearPage(year, page)
        for (const doc of pageData.documents) {
          processDoc(doc)
        }
      }

      console.log(
        `${year}: ${firstPage.totalCount} docs (unique dok_ids: ${byDokId.size}, unique beteckning: ${byBeteckning.size})`
      )
    } catch (error) {
      console.error(
        `Error for year ${year}:`,
        error instanceof Error ? error.message : error
      )
    }
  }

  console.log('')
  console.log('='.repeat(60))
  console.log(`Total documents fetched: ${totalFetched}`)
  console.log(`Unique dok_ids: ${byDokId.size}`)
  console.log(`Unique beteckning (SFS numbers): ${byBeteckning.size}`)
  console.log('='.repeat(60))
  console.log('')

  // Find beteckning with multiple dok_ids (duplicates)
  const duplicates: {
    beteckning: string
    entries: { dok_id: string; title: string }[]
  }[] = []
  for (const [beteckning, entries] of byBeteckning) {
    if (entries.length > 1) {
      duplicates.push({
        beteckning,
        entries: entries.map((e) => ({ dok_id: e.dok_id, title: e.title })),
      })
    }
  }

  if (duplicates.length > 0) {
    console.log(`SFS numbers with multiple dok_ids: ${duplicates.length}`)
    console.log('First 10 examples:')
    for (const dup of duplicates.slice(0, 10)) {
      console.log(`  ${dup.beteckning}:`)
      for (const e of dup.entries) {
        console.log(`    - ${e.dok_id}: ${e.title.substring(0, 50)}...`)
      }
    }
    console.log('')
  }

  // Write clean API list
  const sfsNumbers = Array.from(byBeteckning.keys()).sort()
  fs.writeFileSync(
    path.join(outputDir, 'api-sfs-list.txt'),
    sfsNumbers.join('\n') + '\n'
  )
  console.log(
    `Written: api-sfs-list.txt (${sfsNumbers.length} unique SFS numbers)`
  )

  // Write full list with all details (clean format)
  const fullLines: string[] = []
  for (const [dok_id, info] of byDokId) {
    fullLines.push(`${info.beteckning}\t${info.date}\t${dok_id}\t${info.title}`)
  }
  fullLines.sort()
  fs.writeFileSync(
    path.join(outputDir, 'api-sfs-full-list.txt'),
    `# All SFS from Riksdagen API\n# Total dok_ids: ${byDokId.size}\n# Unique SFS: ${byBeteckning.size}\n# Fetched: ${new Date().toISOString()}\n# Format: SFS\\tDATE\\tDOK_ID\\tTITLE\n#\n${fullLines.join('\n')}\n`
  )
  console.log(`Written: api-sfs-full-list.txt`)

  // Write duplicates
  if (duplicates.length > 0) {
    const dupLines = duplicates
      .map(
        (d) =>
          `${d.beteckning}:\n${d.entries.map((e) => `  - ${e.dok_id}: ${e.title}`).join('\n')}`
      )
      .join('\n\n')
    fs.writeFileSync(
      path.join(outputDir, 'api-duplicates.txt'),
      `# SFS numbers that have multiple dok_ids in the API\n# Total: ${duplicates.length}\n#\n${dupLines}\n`
    )
    console.log(`Written: api-duplicates.txt (${duplicates.length} duplicates)`)
  }

  console.log('')
  console.log('Done!')
}

main().catch(console.error)
