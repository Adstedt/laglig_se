/**
 * Final count check - include N-prefixed documents
 */

import { prisma } from '../lib/prisma'

async function main() {
  // Total SFS_LAW in DB
  const total = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW' },
  })

  // Standard format (SFS YYYY:NNN)
  const standard = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
    AND document_number ~ '^SFS [0-9]{4}:'
  `

  // N-prefixed (SFS NYYYY:NNN)
  const nPrefixed = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
    AND document_number ~ '^SFS N[0-9]{4}:'
  `

  // Other formats
  const other = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
    AND document_number !~ '^SFS N?[0-9]{4}:'
  `

  // Show some other format examples
  const otherExamples = await prisma.$queryRaw<
    Array<{ document_number: string }>
  >`
    SELECT document_number
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
    AND document_number !~ '^SFS N?[0-9]{4}:'
    LIMIT 10
  `

  console.log('='.repeat(50))
  console.log('DATABASE BREAKDOWN')
  console.log('='.repeat(50))
  console.log(`Total SFS_LAW:         ${total}`)
  console.log(`Standard (YYYY:NNN):   ${standard[0].count}`)
  console.log(`N-prefixed (NYYYY:NNN): ${nPrefixed[0].count}`)
  console.log(`Other formats:         ${other[0].count}`)

  if (Number(other[0].count) > 0) {
    console.log('\nOther format examples:')
    otherExamples.forEach((d) => console.log(`  ${d.document_number}`))
  }

  // API total
  const apiResponse = await fetch(
    'https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=1'
  )
  const apiData = await apiResponse.json()
  const apiTotal = parseInt(apiData.dokumentlista['@traffar'], 10)

  console.log('\n' + '='.repeat(50))
  console.log('COMPARISON WITH API')
  console.log('='.repeat(50))
  console.log(`API total:             ${apiTotal}`)
  console.log(`DB total:              ${total}`)
  console.log(`Difference:            ${total - apiTotal}`)
  console.log(
    `Coverage:              ${((total / apiTotal) * 100).toFixed(1)}%`
  )

  await prisma.$disconnect()
}

main().catch(console.error)
