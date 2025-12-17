/**
 * Investigate what the orphan amendments actually are
 */

import { prisma } from '../lib/prisma'

async function main() {
  // Get details of non-unknown orphans
  const orphans = await prisma.$queryRaw<
    Array<{
      sfs_number: string
      base_law_sfs: string
      title: string | null
      base_law_name: string | null
    }>
  >`
    SELECT ad.sfs_number, ad.base_law_sfs, ad.title, ad.base_law_name
    FROM amendment_documents ad
    LEFT JOIN legal_documents ld ON ad.base_law_sfs = ld.document_number
    WHERE ld.id IS NULL
    AND ad.base_law_sfs != 'SFS unknown'
    ORDER BY ad.base_law_sfs
  `

  console.log('Non-unknown orphan amendments:\n')
  for (const row of orphans) {
    console.log(`Amendment: ${row.sfs_number}`)
    console.log(`  References base law: ${row.base_law_sfs}`)
    console.log(`  Title: ${row.title || '(none)'}`)
    console.log(`  Base law name from LLM: ${row.base_law_name || '(none)'}`)
    console.log()
  }

  // Check what the "unknown" ones are
  console.log('\n---\nSample "SFS unknown" amendments:\n')
  const unknowns = await prisma.amendmentDocument.findMany({
    where: { base_law_sfs: 'SFS unknown' },
    select: { sfs_number: true, title: true },
    take: 10,
  })

  for (const row of unknowns) {
    console.log(`${row.sfs_number}: ${row.title || '(no title)'}`)
  }

  await prisma.$disconnect()
}

main().catch(console.error)
