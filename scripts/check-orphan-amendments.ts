/**
 * Check for orphan amendments (amendments referencing base laws not in LegalDocument)
 */

import { prisma } from '../lib/prisma'

async function main() {
  // Count total amendments
  const totalAmendments = await prisma.amendmentDocument.count()
  console.log(`Total amendment documents: ${totalAmendments}`)

  // Count linked amendments
  const linkedAmendments = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM amendment_documents ad
    INNER JOIN legal_documents ld ON ad.base_law_sfs = ld.document_number
    WHERE ld.content_type = 'SFS_LAW'
  `
  console.log(`Linked to base law: ${linkedAmendments[0].count}`)

  // Count orphans
  const orphanCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM amendment_documents ad
    LEFT JOIN legal_documents ld ON ad.base_law_sfs = ld.document_number
    WHERE ld.id IS NULL
  `
  console.log(`Orphan amendments: ${orphanCount[0].count}`)

  // Show some orphan base law references
  const orphanBaseLaws = await prisma.$queryRaw<
    Array<{ base_law_sfs: string; count: bigint }>
  >`
    SELECT ad.base_law_sfs, COUNT(*) as count
    FROM amendment_documents ad
    LEFT JOIN legal_documents ld ON ad.base_law_sfs = ld.document_number
    WHERE ld.id IS NULL
    GROUP BY ad.base_law_sfs
    ORDER BY count DESC
    LIMIT 20
  `
  console.log('\nTop orphan base law references:')
  for (const row of orphanBaseLaws) {
    console.log(`  ${row.base_law_sfs}: ${row.count} amendments`)
  }

  await prisma.$disconnect()
}

main().catch(console.error)
