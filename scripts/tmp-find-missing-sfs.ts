/**
 * Compare Riksdag API vs our DB by year to find the gap.
 * Then drill into specific gap years to find missing doc numbers.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function getApiCountForYear(year: string): Promise<number> {
  const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=1&rm=${year}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Laglig.se/1.0' },
  })
  if (!res.ok) return -1
  const data = await res.json()
  return parseInt(data.dokumentlista?.['@traffar'] || '0', 10)
}

async function getApiDocsForYear(year: string): Promise<string[]> {
  const docs: string[] = []
  let page = 1
  while (true) {
    const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=200&p=${page}&rm=${year}`
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Laglig.se/1.0' },
    })
    if (!res.ok) break
    const data = await res.json()
    const results = data.dokumentlista?.dokument || []
    if (results.length === 0) break
    for (const d of results) {
      docs.push(`SFS ${d.beteckning}`)
    }
    const totalPages = parseInt(data.dokumentlista?.['@sidor'] || '1', 10)
    if (page >= totalPages) break
    page++
    await sleep(250)
  }
  return docs
}

async function main() {
  // Get DB counts by year
  const dbCounts = await prisma.$queryRaw<any[]>`
    SELECT
      CASE
        WHEN document_number ~ '^SFS [A-Z]?(\d{4})'
        THEN substring(document_number from '(\d{4})')
        ELSE 'unknown'
      END as year,
      COUNT(*) as count
    FROM legal_documents
    WHERE content_type IN ('SFS_LAW', 'SFS_AMENDMENT')
    GROUP BY 1
    ORDER BY 1 DESC
  `

  const dbByYear = new Map<string, number>()
  for (const row of dbCounts) {
    dbByYear.set(row.year, Number(row.count))
  }

  // Check API counts for recent years + sample old years
  const years = []
  for (let y = 2026; y >= 2015; y--) years.push(String(y))
  // Add some older years to spot-check
  for (const y of [
    '2010',
    '2005',
    '2000',
    '1995',
    '1990',
    '1980',
    '1970',
    '1960',
  ])
    years.push(y)

  console.log('Year     API      DB       Gap')
  console.log('-'.repeat(45))

  const gapYears: string[] = []

  for (const year of years) {
    await sleep(300)
    const apiCount = await getApiCountForYear(year)
    const dbCount = dbByYear.get(year) || 0
    const gap = apiCount - dbCount
    const marker = gap > 0 ? ' <<<' : ''
    console.log(
      `${year}     ${String(apiCount).padStart(5)}    ${String(dbCount).padStart(5)}    ${String(gap).padStart(5)}${marker}`
    )
    if (gap > 5) gapYears.push(year)
  }

  // Drill into gap years to find specific missing docs
  if (gapYears.length > 0) {
    console.log(`\n${'='.repeat(50)}`)
    console.log(`Drilling into gap years: ${gapYears.join(', ')}`)
    console.log('='.repeat(50))

    for (const year of gapYears.slice(0, 3)) {
      console.log(`\n--- ${year} ---`)
      const apiDocs = await getApiDocsForYear(year)

      const dbDocs = await prisma.legalDocument.findMany({
        where: {
          document_number: { startsWith: `SFS ${year}` },
          content_type: { in: ['SFS_LAW', 'SFS_AMENDMENT'] },
        },
        select: { document_number: true, content_type: true },
      })
      // Also check N-prefix
      const dbDocsN = await prisma.legalDocument.findMany({
        where: {
          document_number: { startsWith: `SFS N${year}` },
          content_type: { in: ['SFS_LAW', 'SFS_AMENDMENT'] },
        },
        select: { document_number: true, content_type: true },
      })

      const dbSet = new Set(
        [...dbDocs, ...dbDocsN].map((d) => d.document_number)
      )
      const missing = apiDocs.filter((d) => !dbSet.has(d))

      console.log(
        `API: ${apiDocs.length} | DB: ${dbSet.size} | Missing: ${missing.length}`
      )
      for (const m of missing.slice(0, 15)) {
        console.log(`  ${m}`)
      }
      if (missing.length > 15) console.log(`  ... +${missing.length - 15} more`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
