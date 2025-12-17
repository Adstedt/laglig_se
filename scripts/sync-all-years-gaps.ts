/**
 * Systematic sync: Check every year and sync any gaps
 * Ensures 1:1 match with API on a per-year basis
 */

import { prisma } from '../lib/prisma'
import {
  fetchLawFullText,
  fetchLawHTML,
  generateSlug,
} from '../lib/external/riksdagen'
import { ContentType, DocumentStatus, ChangeType } from '@prisma/client'

const CONFIG = {
  START_YEAR: 1900,
  END_YEAR: 2025,
  DELAY_BETWEEN_REQUESTS: 200,
}

interface YearGap {
  year: number
  dbCount: number
  apiCount: number
  gap: number
}

async function getApiCountForYear(year: number): Promise<number> {
  const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=1&rm=${year}`
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Laglig.se/1.0' },
  })
  const data = await response.json()
  return parseInt(data.dokumentlista['@traffar'], 10) || 0
}

async function getDbCountForYear(year: number): Promise<number> {
  // Count both standard and N-prefixed for this year
  const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
    AND (
      document_number LIKE 'SFS ' || ${year.toString()} || ':%'
      OR document_number LIKE 'SFS N' || ${year.toString()} || ':%'
    )
  `
  return Number(result[0].count)
}

async function syncYear(
  year: number
): Promise<{ inserted: number; failed: number }> {
  const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=200&rm=${year}`
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Laglig.se/1.0' },
  })
  const data = await response.json()
  const docs = data.dokumentlista.dokument || []

  let inserted = 0
  let failed = 0

  for (const doc of docs) {
    const sfsNumber = `SFS ${doc.beteckning}`

    // Check if exists
    const existing = await prisma.legalDocument.findUnique({
      where: { document_number: sfsNumber },
      select: { id: true },
    })

    if (existing) continue

    // Fetch and insert
    try {
      await new Promise((r) => setTimeout(r, CONFIG.DELAY_BETWEEN_REQUESTS))

      const [htmlContent, fullText] = await Promise.all([
        fetchLawHTML(doc.dok_id),
        fetchLawFullText(doc.dok_id),
      ])

      if (!fullText && !htmlContent) {
        failed++
        continue
      }

      const slug = generateSlug(doc.titel, sfsNumber)

      await prisma.$transaction(async (tx) => {
        const newDoc = await tx.legalDocument.create({
          data: {
            document_number: sfsNumber,
            title: doc.titel,
            slug,
            content_type: ContentType.SFS_LAW,
            full_text: fullText,
            html_content: htmlContent,
            publication_date: doc.datum ? new Date(doc.datum) : null,
            status: DocumentStatus.ACTIVE,
            source_url: `https://data.riksdagen.se/dokument/${doc.dok_id}`,
            metadata: {
              dokId: doc.dok_id,
              source: 'data.riksdagen.se',
              systemdatum: doc.systemdatum,
              fetchedAt: new Date().toISOString(),
              method: 'sync-all-years-gaps',
            },
          },
        })

        await tx.documentVersion.create({
          data: {
            document_id: newDoc.id,
            version_number: 1,
            full_text: fullText || '',
            html_content: htmlContent,
            source_systemdatum: new Date(
              doc.systemdatum.replace(' ', 'T') + 'Z'
            ),
          },
        })

        await tx.changeEvent.create({
          data: {
            document_id: newDoc.id,
            content_type: ContentType.SFS_LAW,
            change_type: ChangeType.NEW_LAW,
          },
        })
      })

      inserted++
      console.log(`    Inserted: ${sfsNumber}`)
    } catch (error) {
      failed++
      console.error(
        `    Failed: ${sfsNumber} - ${error instanceof Error ? error.message : error}`
      )
    }
  }

  return { inserted, failed }
}

async function main() {
  console.log('='.repeat(60))
  console.log('SYSTEMATIC YEAR-BY-YEAR SYNC')
  console.log('='.repeat(60))
  console.log(`Checking years ${CONFIG.START_YEAR} to ${CONFIG.END_YEAR}`)
  console.log()

  // Phase 1: Identify all gaps
  console.log('Phase 1: Identifying gaps...\n')
  const gaps: YearGap[] = []
  let totalApiCount = 0
  let totalDbCount = 0

  for (let year = CONFIG.END_YEAR; year >= CONFIG.START_YEAR; year--) {
    const apiCount = await getApiCountForYear(year)
    const dbCount = await getDbCountForYear(year)
    const gap = apiCount - dbCount

    totalApiCount += apiCount
    totalDbCount += dbCount

    if (gap !== 0) {
      gaps.push({ year, dbCount, apiCount, gap })
      console.log(
        `  ${year}: DB=${dbCount}, API=${apiCount}, Gap=${gap > 0 ? '+' : ''}${gap}`
      )
    }

    await new Promise((r) => setTimeout(r, 50))
  }

  console.log('\n' + '-'.repeat(60))
  console.log(
    `Total: DB=${totalDbCount}, API=${totalApiCount}, Gap=${totalApiCount - totalDbCount}`
  )
  console.log('-'.repeat(60))

  // Phase 2: Sync years with positive gaps
  const yearsToSync = gaps
    .filter((g) => g.gap > 0)
    .sort((a, b) => b.gap - a.gap)

  if (yearsToSync.length === 0) {
    console.log('\nNo gaps to sync! Database matches API.')
  } else {
    console.log(`\nPhase 2: Syncing ${yearsToSync.length} years with gaps...\n`)

    let totalInserted = 0
    let totalFailed = 0

    for (const { year, gap } of yearsToSync) {
      console.log(`  Syncing ${year} (missing ~${gap})...`)
      const { inserted, failed } = await syncYear(year)
      totalInserted += inserted
      totalFailed += failed
      console.log(`    Done: ${inserted} inserted, ${failed} failed`)
    }

    console.log('\n' + '='.repeat(60))
    console.log('SYNC COMPLETE')
    console.log('='.repeat(60))
    console.log(`Total inserted: ${totalInserted}`)
    console.log(`Total failed: ${totalFailed}`)
  }

  // Phase 3: Final verification
  console.log('\nPhase 3: Final verification...\n')

  let finalApiTotal = 0
  let finalDbTotal = 0
  const remainingGaps: YearGap[] = []

  for (let year = CONFIG.END_YEAR; year >= CONFIG.START_YEAR; year--) {
    const apiCount = await getApiCountForYear(year)
    const dbCount = await getDbCountForYear(year)
    const gap = apiCount - dbCount

    finalApiTotal += apiCount
    finalDbTotal += dbCount

    if (gap !== 0) {
      remainingGaps.push({ year, dbCount, apiCount, gap })
    }

    await new Promise((r) => setTimeout(r, 50))
  }

  console.log('='.repeat(60))
  console.log('FINAL RESULTS')
  console.log('='.repeat(60))
  console.log(`API total (sum of years): ${finalApiTotal}`)
  console.log(`DB total (sum of years):  ${finalDbTotal}`)
  console.log(`Gap:                      ${finalApiTotal - finalDbTotal}`)
  console.log(
    `Coverage:                 ${((finalDbTotal / finalApiTotal) * 100).toFixed(2)}%`
  )

  if (remainingGaps.length > 0) {
    console.log('\nRemaining gaps:')
    remainingGaps.forEach((g) => {
      console.log(
        `  ${g.year}: DB=${g.dbCount}, API=${g.apiCount}, Gap=${g.gap > 0 ? '+' : ''}${g.gap}`
      )
    })
  } else {
    console.log('\n✓ Perfect 1:1 match achieved!')
  }

  await prisma.$disconnect()
}

main().catch(console.error)
