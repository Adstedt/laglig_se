/* eslint-disable no-console */
/**
 * Find Missing SFS Laws
 *
 * Compares what the Riksdagen API offers vs what we have in the database
 * to identify exactly which SFS numbers are missing.
 */

import { prisma } from '../lib/prisma'
import { fetchSFSLaws } from '../lib/external/riksdagen'

const CONFIG = {
  PAGE_SIZE: 100,
  API_MAX_PAGE: 100,
}

async function findMissingSFS() {
  console.log('='.repeat(80))
  console.log('Finding Missing SFS Laws')
  console.log('='.repeat(80))
  console.log('')

  // Step 1: Get all SFS numbers from the API
  console.log('Step 1: Fetching all SFS numbers from API...')
  const apiSfsNumbers = new Set<string>()

  // Fetch first page to get total count
  const firstPage = await fetchSFSLaws(CONFIG.PAGE_SIZE, 1, 'desc')
  const totalCount = firstPage.totalCount
  console.log(`API reports ${totalCount} total SFS laws`)

  // Add first page
  for (const law of firstPage.laws) {
    apiSfsNumbers.add(law.sfsNumber)
  }

  // Phase 1: DESC pages 2-100
  const descPages = Math.min(
    Math.ceil(totalCount / CONFIG.PAGE_SIZE),
    CONFIG.API_MAX_PAGE
  )
  console.log(`Fetching DESC pages 2-${descPages}...`)

  for (let page = 2; page <= descPages; page++) {
    if (page % 20 === 0) {
      console.log(`  Page ${page}/${descPages}...`)
    }
    const pageData = await fetchSFSLaws(CONFIG.PAGE_SIZE, page, 'desc')
    for (const law of pageData.laws) {
      apiSfsNumbers.add(law.sfsNumber)
    }
  }

  // Phase 2: ASC pages to cover the gap
  const lawsCoveredByDesc = descPages * CONFIG.PAGE_SIZE
  const remainingLaws = Math.max(0, totalCount - lawsCoveredByDesc)
  const ascPagesNeeded = Math.min(
    Math.ceil((remainingLaws + CONFIG.PAGE_SIZE) / CONFIG.PAGE_SIZE),
    CONFIG.API_MAX_PAGE
  )

  if (ascPagesNeeded > 0) {
    console.log(`Fetching ASC pages 1-${ascPagesNeeded}...`)
    for (let page = 1; page <= ascPagesNeeded; page++) {
      const pageData = await fetchSFSLaws(CONFIG.PAGE_SIZE, page, 'asc')
      for (const law of pageData.laws) {
        apiSfsNumbers.add(law.sfsNumber)
      }
    }
  }

  console.log(`\nAPI unique SFS numbers collected: ${apiSfsNumbers.size}`)

  // Step 2: Get all SFS numbers from database
  console.log('\nStep 2: Fetching all SFS numbers from database...')
  const dbDocuments = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_LAW' },
    select: { document_number: true },
  })

  const dbSfsNumbers = new Set(dbDocuments.map((d) => d.document_number))
  console.log(`Database SFS_LAW count: ${dbSfsNumbers.size}`)

  // Step 3: Find the differences
  console.log('\nStep 3: Comparing...')

  // Missing from DB (in API but not in DB)
  const missingFromDb: string[] = []
  for (const sfs of apiSfsNumbers) {
    if (!dbSfsNumbers.has(sfs)) {
      missingFromDb.push(sfs)
    }
  }

  // Extra in DB (in DB but not in API)
  const extraInDb: string[] = []
  for (const sfs of dbSfsNumbers) {
    if (!apiSfsNumbers.has(sfs)) {
      extraInDb.push(sfs)
    }
  }

  // Sort by year and number
  missingFromDb.sort((a, b) => {
    const aMatch = a.match(/SFS (\d{4}):(.+)/)
    const bMatch = b.match(/SFS (\d{4}):(.+)/)
    if (!aMatch || !bMatch) return a.localeCompare(b)
    const aYear = parseInt(aMatch[1])
    const bYear = parseInt(bMatch[1])
    if (aYear !== bYear) return aYear - bYear
    return aMatch[2].localeCompare(bMatch[2])
  })

  // Print results
  console.log('\n' + '='.repeat(80))
  console.log('RESULTS')
  console.log('='.repeat(80))
  console.log('')
  console.log(`API total: ${totalCount}`)
  console.log(`API unique SFS: ${apiSfsNumbers.size}`)
  console.log(`Database SFS_LAW: ${dbSfsNumbers.size}`)
  console.log(`Missing from DB: ${missingFromDb.length}`)
  console.log(`Extra in DB: ${extraInDb.length}`)
  console.log('')

  if (missingFromDb.length > 0) {
    console.log('='.repeat(80))
    console.log(`MISSING FROM DATABASE (${missingFromDb.length} laws):`)
    console.log('='.repeat(80))
    for (const sfs of missingFromDb) {
      console.log(sfs)
    }
  }

  if (extraInDb.length > 0) {
    console.log('')
    console.log('='.repeat(80))
    console.log(`EXTRA IN DATABASE (${extraInDb.length} laws):`)
    console.log('='.repeat(80))
    for (const sfs of extraInDb) {
      console.log(sfs)
    }
  }

  await prisma.$disconnect()
}

findMissingSFS().catch(console.error)
