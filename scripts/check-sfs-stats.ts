/**
 * Quick script to check SFS stats in DB vs API
 */

import { prisma } from '../lib/prisma'

async function main() {
  // Check API total
  const apiResponse = await fetch(
    'https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=1'
  )
  const apiData = await apiResponse.json()
  const apiTotal = parseInt(apiData.dokumentlista['@traffar'], 10)
  console.log('Total SFS laws in Riksdagen API:', apiTotal)

  // Check DB total
  const dbTotal = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW' },
  })
  console.log('Total SFS_LAW in DB:', dbTotal)
  console.log('Gap:', apiTotal - dbTotal)

  // Year distribution
  const years = await prisma.$queryRaw<Array<{ year: string; count: bigint }>>`
    SELECT
      SUBSTRING(document_number FROM 5 FOR 4) as year,
      COUNT(*) as count
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
    GROUP BY SUBSTRING(document_number FROM 5 FOR 4)
    ORDER BY year DESC
    LIMIT 40
  `
  console.log('\nDistribution by year (recent 40 years):')
  years.forEach((y) => console.log(`  ${y.year}: ${y.count}`))

  // Check specific years mentioned as problematic
  const problemYears = ['1999', '2000', '2024']
  console.log('\nProblem years detail:')
  for (const year of problemYears) {
    const count = await prisma.legalDocument.count({
      where: {
        content_type: 'SFS_LAW',
        document_number: { startsWith: `SFS ${year}:` },
      },
    })
    console.log(`  ${year}: ${count} laws in DB`)
  }

  await prisma.$disconnect()
}

main().catch(console.error)
