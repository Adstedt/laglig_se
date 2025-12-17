/**
 * Check what years exist before 1970 and their gaps
 */

import { prisma } from '../lib/prisma'

async function getApiCountForYear(year: number): Promise<number> {
  const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=1&rm=${year}`
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Laglig.se/1.0' },
  })
  const data = await response.json()
  return parseInt(data.dokumentlista['@traffar'], 10) || 0
}

async function getDbCountForYear(year: number): Promise<number> {
  const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
    AND (
      document_number LIKE ${'SFS ' + year + ':%'}
      OR document_number LIKE ${'SFS N' + year + ':%'}
    )
  `
  return Number(result[0].count)
}

async function main() {
  console.log('Checking years before 1970...\n')
  console.log('Year | DB | API | Gap')
  console.log('-----|-----|-----|-----')

  let totalApiCount = 0
  let totalDbCount = 0
  const gaps: Array<{ year: number; db: number; api: number; gap: number }> = []

  // Check years from 1969 down to 1900
  for (let year = 1969; year >= 1900; year--) {
    const apiCount = await getApiCountForYear(year)

    if (apiCount === 0) continue // Skip years with no data

    const dbCount = await getDbCountForYear(year)
    const gap = apiCount - dbCount

    totalApiCount += apiCount
    totalDbCount += dbCount

    console.log(
      `${year} | ${dbCount} | ${apiCount} | ${gap > 0 ? '+' : ''}${gap}`
    )

    if (gap > 0) {
      gaps.push({ year, db: dbCount, api: apiCount, gap })
    }

    await new Promise((r) => setTimeout(r, 100))
  }

  console.log('\n' + '='.repeat(50))
  console.log(`Total pre-1970: DB=${totalDbCount}, API=${totalApiCount}`)
  console.log(`Gap: ${totalApiCount - totalDbCount}`)

  if (gaps.length > 0) {
    console.log('\nYears with positive gaps (missing from DB):')
    gaps.sort((a, b) => b.gap - a.gap)
    gaps.forEach((g) => console.log(`  ${g.year}: missing ${g.gap}`))
  }

  // Overall totals
  const totalDb = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW' },
  })
  const apiResponse = await fetch(
    'https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=1'
  )
  const apiData = await apiResponse.json()
  const totalApi = parseInt(apiData.dokumentlista['@traffar'], 10)

  console.log('\n' + '='.repeat(50))
  console.log('OVERALL:')
  console.log(`Total DB: ${totalDb}`)
  console.log(`Total API: ${totalApi}`)
  console.log(`Gap: ${totalApi - totalDb}`)

  await prisma.$disconnect()
}

main().catch(console.error)
