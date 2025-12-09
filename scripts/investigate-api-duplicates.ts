/* eslint-disable no-console */
/**
 * Investigate API Duplicates
 *
 * Analyzes why the Riksdagen API reports 11,397 total SFS laws
 * but we only find 11,265 unique SFS numbers.
 */

async function investigate() {
  console.log('='.repeat(60))
  console.log('Investigating API Duplicates')
  console.log('='.repeat(60))
  console.log('')

  const allDocs: { dok_id: string; beteckning: string; titel: string }[] = []
  const seenSFS = new Map<string, { dok_id: string; beteckning: string; titel: string }[]>()

  // Fetch all pages (up to 100 pages * 100 per page = 10,000)
  // Then fetch ASC to get the rest
  console.log('Fetching all SFS from API (DESC order)...')

  for (let page = 1; page <= 100; page++) {
    const url = new URL('https://data.riksdagen.se/dokumentlista/')
    url.searchParams.set('doktyp', 'sfs')
    url.searchParams.set('utformat', 'json')
    url.searchParams.set('sz', '100')
    url.searchParams.set('p', page.toString())
    url.searchParams.set('sort', 'datum')
    url.searchParams.set('sortorder', 'desc')

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Laglig.se/1.0 (Legal research)',
        Accept: 'application/json',
      },
    })
    const data = await response.json()

    if (page === 1) {
      console.log('API total @traffar:', data.dokumentlista['@traffar'])
      console.log('')
    }

    const docs = data.dokumentlista.dokument || []
    if (docs.length === 0) break

    for (const doc of docs) {
      const sfsNumber = `SFS ${doc.beteckning}`
      allDocs.push({ dok_id: doc.dok_id, beteckning: doc.beteckning, titel: doc.titel })

      if (!seenSFS.has(sfsNumber)) {
        seenSFS.set(sfsNumber, [])
      }
      seenSFS.get(sfsNumber)!.push({ dok_id: doc.dok_id, beteckning: doc.beteckning, titel: doc.titel })
    }

    if (page % 10 === 0) {
      console.log(`  Fetched page ${page}... (${allDocs.length} docs, ${seenSFS.size} unique)`)
    }
  }

  console.log('')
  console.log('Fetching more SFS from API (ASC order for older laws)...')

  for (let page = 1; page <= 100; page++) {
    const url = new URL('https://data.riksdagen.se/dokumentlista/')
    url.searchParams.set('doktyp', 'sfs')
    url.searchParams.set('utformat', 'json')
    url.searchParams.set('sz', '100')
    url.searchParams.set('p', page.toString())
    url.searchParams.set('sort', 'datum')
    url.searchParams.set('sortorder', 'asc')

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Laglig.se/1.0 (Legal research)',
        Accept: 'application/json',
      },
    })
    const data = await response.json()
    const docs = data.dokumentlista.dokument || []
    if (docs.length === 0) break

    for (const doc of docs) {
      const sfsNumber = `SFS ${doc.beteckning}`
      allDocs.push({ dok_id: doc.dok_id, beteckning: doc.beteckning, titel: doc.titel })

      if (!seenSFS.has(sfsNumber)) {
        seenSFS.set(sfsNumber, [])
      }
      seenSFS.get(sfsNumber)!.push({ dok_id: doc.dok_id, beteckning: doc.beteckning, titel: doc.titel })
    }

    if (page % 10 === 0) {
      console.log(`  Fetched page ${page}... (${allDocs.length} docs, ${seenSFS.size} unique)`)
    }
  }

  // Find duplicates
  console.log('')
  console.log('='.repeat(60))
  console.log('ANALYSIS')
  console.log('='.repeat(60))
  console.log('')
  console.log('Total documents fetched:', allDocs.length)
  console.log('Unique SFS numbers:', seenSFS.size)
  console.log('')

  const duplicates = Array.from(seenSFS.entries())
    .filter(([_, docs]) => docs.length > 1)
    .sort((a, b) => b[1].length - a[1].length)

  console.log('SFS numbers with multiple entries:', duplicates.length)
  console.log('')

  if (duplicates.length > 0) {
    console.log('='.repeat(60))
    console.log('TOP 20 DUPLICATES')
    console.log('='.repeat(60))
    console.log('')

    for (const [sfsNumber, docs] of duplicates.slice(0, 20)) {
      console.log(`${sfsNumber} (${docs.length} entries):`)
      for (const doc of docs) {
        console.log(`  - dok_id: ${doc.dok_id}`)
        console.log(`    titel: ${doc.titel?.substring(0, 60)}...`)
      }
      console.log('')
    }
  }

  // Check for different dok_ids with same beteckning
  const sameBeteckningDifferentId = duplicates.filter(([_, docs]) => {
    const ids = new Set(docs.map(d => d.dok_id))
    return ids.size > 1
  })

  console.log('='.repeat(60))
  console.log('SAME SFS NUMBER, DIFFERENT DOK_ID')
  console.log('='.repeat(60))
  console.log('')
  console.log('Count:', sameBeteckningDifferentId.length)

  if (sameBeteckningDifferentId.length > 0) {
    console.log('')
    for (const [sfsNumber, docs] of sameBeteckningDifferentId.slice(0, 10)) {
      console.log(`${sfsNumber}:`)
      for (const doc of docs) {
        console.log(`  dok_id: ${doc.dok_id}, titel: ${doc.titel?.substring(0, 50)}`)
      }
      console.log('')
    }
  }
}

investigate().catch(console.error)
