/**
 * Check gap between DB and API for all years
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
    ORDER BY year DESC
  `

  const dbByYear = new Map<string, number>()
  for (const row of dbYears) {
    dbByYear.set(row.year, Number(row.count))
  }

  console.log('Year | DB | API | Gap')
  console.log('-----|-----|-----|-----')

  let totalGap = 0
  const yearsWithGaps: Array<{
    year: number
    gap: number
    db: number
    api: number
  }> = []

  // Check years from 2025 back to 1970
  for (let year = 2025; year >= 1970; year--) {
    const dbCount = dbByYear.get(String(year)) || 0
    const apiCount = await checkYearInApi(year)
    const gap = apiCount - dbCount

    if (gap !== 0 || apiCount > 0) {
      console.log(
        `${year} | ${dbCount} | ${apiCount} | ${gap > 0 ? '+' + gap : gap}`
      )
    }

    if (gap > 0) {
      totalGap += gap
      yearsWithGaps.push({ year, gap, db: dbCount, api: apiCount })
    }

    // Small delay to be nice to API
    await new Promise((r) => setTimeout(r, 100))
  }

  console.log('\n--- Summary ---')
  console.log(`Total gap: ${totalGap}`)
  console.log('\nYears with missing laws (sorted by gap):')
  yearsWithGaps
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 15)
    .forEach((y) => {
      console.log(
        `  ${y.year}: missing ${y.gap} laws (DB: ${y.db}, API: ${y.api})`
      )
    })

  await prisma.$disconnect()
}

main().catch(console.error)
