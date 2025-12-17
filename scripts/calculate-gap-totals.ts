/**
 * Calculate total gap and projected totals after sync
 */

import { prisma } from '../lib/prisma'

async function checkYearInApi(year: number): Promise<number> {
  const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=1&rm=${year}`
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Laglig.se/1.0' },
    })
    const data = await response.json()
    return parseInt(data.dokumentlista['@traffar'], 10) || 0
  } catch {
    return -1
  }
}

async function main() {
  // Current DB total
  const dbTotal = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW' },
  })

  // API total
  const apiResponse = await fetch(
    'https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=1'
  )
  const apiData = await apiResponse.json()
  const apiTotal = parseInt(apiData.dokumentlista['@traffar'], 10)

  console.log('='.repeat(50))
  console.log('CURRENT STATE')
  console.log('='.repeat(50))
  console.log(`DB total:  ${dbTotal}`)
  console.log(`API total: ${apiTotal}`)
  console.log(`Gap:       ${apiTotal - dbTotal}`)
  console.log()

  // Years with gaps (from previous analysis)
  const yearsToCheck = [
    2025, 2024, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 1980, 1977, 1975,
  ]

  // Get DB counts by year
  const dbYears = await prisma.$queryRaw<
    Array<{ year: string; count: bigint }>
  >`
    SELECT
      SUBSTRING(document_number FROM 5 FOR 4) as year,
      COUNT(*) as count
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
    AND document_number ~ '^SFS [0-9]{4}:'
    GROUP BY SUBSTRING(document_number FROM 5 FOR 4)
  `
  const dbByYear = new Map<string, number>()
  for (const row of dbYears) {
    dbByYear.set(row.year, Number(row.count))
  }

  console.log('='.repeat(50))
  console.log('YEARS WITH GAPS')
  console.log('='.repeat(50))
  console.log('Year | DB | API | Missing')
  console.log('-----|-----|-----|--------')

  let totalMissing = 0
  const gaps: Array<{ year: number; missing: number }> = []

  for (const year of yearsToCheck) {
    const dbCount = dbByYear.get(String(year)) || 0
    const apiCount = await checkYearInApi(year)
    const missing = Math.max(0, apiCount - dbCount)

    if (missing > 0) {
      console.log(`${year} | ${dbCount} | ${apiCount} | ${missing}`)
      totalMissing += missing
      gaps.push({ year, missing })
    }

    await new Promise((r) => setTimeout(r, 100))
  }

  console.log('-----|-----|-----|--------')
  console.log(`TOTAL MISSING: ${totalMissing}`)
  console.log()

  console.log('='.repeat(50))
  console.log('PROJECTION AFTER SYNC')
  console.log('='.repeat(50))
  const projectedTotal = dbTotal + totalMissing
  console.log(`Current DB:      ${dbTotal}`)
  console.log(`Will add:        +${totalMissing}`)
  console.log(`Projected total: ${projectedTotal}`)
  console.log(`API total:       ${apiTotal}`)
  console.log(`Remaining gap:   ${apiTotal - projectedTotal}`)
  console.log()

  const coverageNow = ((dbTotal / apiTotal) * 100).toFixed(1)
  const coverageAfter = ((projectedTotal / apiTotal) * 100).toFixed(1)
  console.log(`Coverage now:    ${coverageNow}%`)
  console.log(`Coverage after:  ${coverageAfter}%`)

  await prisma.$disconnect()
}

main().catch(console.error)
