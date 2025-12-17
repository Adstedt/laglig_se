/* eslint-disable no-console */
/**
 * Fetch ALL SFS documents and track duplicates properly
 *
 * This fetches all documents and keeps track of:
 * 1. All dok_ids (should match API total)
 * 2. All beteckning (SFS numbers) with their dok_ids
 * 3. Duplicates across years
 */

import * as fs from 'fs'
import * as path from 'path'

const CONFIG = {
  PAGE_SIZE: 500,
  DELAY_MS: 300,
  OUTPUT_DIR: 'data/sfs-comparison',
  START_YEAR: 1600,
  END_YEAR: 2025,
}

interface Doc {
  beteckning: string
  dok_id: string
  title: string
  date: string
  year: number
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
  console.log('Complete SFS API Fetcher with Full Duplicate Tracking')
  console.log('='.repeat(60))
  console.log('')

  const outputDir = path.join(process.cwd(), CONFIG.OUTPUT_DIR)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Track ALL documents by dok_id (unique)
  const allDokIds = new Map<string, Doc>()

  // Track all beteckning -> list of dok_ids
  const beteckningToDokIds = new Map<string, Doc[]>()

  let totalApiReported = 0

  for (let year = CONFIG.START_YEAR; year <= CONFIG.END_YEAR; year++) {
    try {
      await sleep(CONFIG.DELAY_MS)
      const firstPage = await fetchYearPage(year, 1)

      if (firstPage.totalCount === 0) continue

      totalApiReported += firstPage.totalCount

      const processDoc = (doc: {
        beteckning: string
        dok_id: string
        titel?: string
        datum: string
      }) => {
        const cleanTitle = (doc.titel || '')
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        const entry: Doc = {
          beteckning: doc.beteckning,
          dok_id: doc.dok_id,
          title: cleanTitle,
          date: doc.datum,
          year,
        }

        // Track by dok_id (should be unique)
        if (!allDokIds.has(doc.dok_id)) {
          allDokIds.set(doc.dok_id, entry)
        }

        // Track by beteckning
        if (!beteckningToDokIds.has(doc.beteckning)) {
          beteckningToDokIds.set(doc.beteckning, [])
        }
        // Only add if not already tracked for this dok_id
        const existing = beteckningToDokIds.get(doc.beteckning)!
        if (!existing.find((e) => e.dok_id === doc.dok_id)) {
          existing.push(entry)
        }
      }

      // Process all pages
      for (const doc of firstPage.documents) {
        processDoc(doc)
      }

      for (let page = 2; page <= firstPage.totalPages; page++) {
        await sleep(CONFIG.DELAY_MS)
        const pageData = await fetchYearPage(year, page)
        for (const doc of pageData.documents) {
          processDoc(doc)
        }
      }

      console.log(`${year}: ${firstPage.totalCount} docs`)
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
  console.log(`Unique dok_ids: ${allDokIds.size}`)
  console.log(`Unique beteckning (SFS): ${beteckningToDokIds.size}`)
  console.log('='.repeat(60))

  // Find all duplicates (beteckning with multiple dok_ids)
  const duplicates: { beteckning: string; docs: Doc[] }[] = []
  for (const [beteckning, docs] of beteckningToDokIds) {
    if (docs.length > 1) {
      duplicates.push({ beteckning, docs })
    }
  }

  console.log(`\nBeteckning with multiple dok_ids: ${duplicates.length}`)

  // Write duplicates file
  const dupeLines: string[] = []
  let totalDupeEntries = 0
  for (const dup of duplicates.sort((a, b) =>
    a.beteckning.localeCompare(b.beteckning)
  )) {
    totalDupeEntries += dup.docs.length - 1
    dupeLines.push(`${dup.beteckning} (${dup.docs.length} entries):`)
    for (const d of dup.docs) {
      dupeLines.push(
        `  ${d.dok_id} [${d.date}] year=${d.year}: ${d.title.substring(0, 60)}`
      )
    }
    dupeLines.push('')
  }

  fs.writeFileSync(
    path.join(outputDir, 'all-duplicates.txt'),
    `# All SFS numbers with multiple dok_ids\n# Total: ${duplicates.length} SFS numbers with ${totalDupeEntries} extra entries\n#\n${dupeLines.join('\n')}`
  )
  console.log(`Written: all-duplicates.txt`)

  // Write unique SFS list
  const sortedSfs = Array.from(beteckningToDokIds.keys()).sort()
  fs.writeFileSync(
    path.join(outputDir, 'api-sfs-list.txt'),
    sortedSfs.join('\n') + '\n'
  )
  console.log(`Written: api-sfs-list.txt (${sortedSfs.length} entries)`)

  // Write full list (one line per unique beteckning, using first dok_id found)
  const fullLines = sortedSfs.map((sfs) => {
    const docs = beteckningToDokIds.get(sfs)!
    const doc = docs[0]
    return `${sfs}\t${doc.date}\t${doc.dok_id}\t${doc.title}`
  })
  fs.writeFileSync(
    path.join(outputDir, 'api-sfs-full-list.txt'),
    `# Complete SFS list from Riksdagen API\n# Fetched: ${new Date().toISOString()}\n# API reported: ${totalApiReported}, Unique dok_ids: ${allDokIds.size}, Unique SFS: ${beteckningToDokIds.size}\n# Format: SFS\\tDATE\\tDOK_ID\\tTITLE\n#\n${fullLines.join('\n')}\n`
  )
  console.log(`Written: api-sfs-full-list.txt`)

  // Summary
  console.log('')
  console.log('='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  console.log(`API total documents: ${totalApiReported}`)
  console.log(`Unique dok_ids: ${allDokIds.size}`)
  console.log(`Unique beteckning (SFS): ${beteckningToDokIds.size}`)
  console.log(
    `Duplicates: ${duplicates.length} SFS with ${totalDupeEntries} extra entries`
  )
  console.log(
    `Verification: ${beteckningToDokIds.size} + ${totalDupeEntries} = ${beteckningToDokIds.size + totalDupeEntries}`
  )
  console.log('')
}

main().catch(console.error)
