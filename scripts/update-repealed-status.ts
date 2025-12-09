/* eslint-disable no-console */
/**
 * Script: Update SFS laws with REPEALED status
 *
 * Identifies repealed laws by searching for the pattern
 * "har upphävts genom" in full_text and updates their status.
 *
 * Usage: pnpm tsx scripts/update-repealed-status.ts
 */

import { prisma } from '../lib/prisma'

async function updateRepealedStatus() {
  console.log('Updating status for repealed SFS laws...\n')

  // First, count how many will be affected
  const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint as count
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
    AND status = 'ACTIVE'
    AND full_text ILIKE '%har upphävts genom%'
  `
  const toUpdate = Number(countResult[0].count)
  console.log(`Found ${toUpdate} SFS laws with "har upphävts genom" pattern`)

  if (toUpdate === 0) {
    console.log('No documents to update.')
    return
  }

  // Update status to REPEALED
  const result = await prisma.$executeRaw`
    UPDATE legal_documents
    SET status = 'REPEALED', updated_at = NOW()
    WHERE content_type = 'SFS_LAW'
    AND status = 'ACTIVE'
    AND full_text ILIKE '%har upphävts genom%'
  `

  console.log(`\nUpdated ${result} documents to status REPEALED`)

  // Also check for "upphört att gälla" pattern (additional catches)
  const count2Result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint as count
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
    AND status = 'ACTIVE'
    AND full_text ILIKE '%upphört att gälla%'
  `
  const additionalCount = Number(count2Result[0].count)

  if (additionalCount > 0) {
    console.log(`\nFound ${additionalCount} additional with "upphört att gälla"`)

    const result2 = await prisma.$executeRaw`
      UPDATE legal_documents
      SET status = 'REPEALED', updated_at = NOW()
      WHERE content_type = 'SFS_LAW'
      AND status = 'ACTIVE'
      AND full_text ILIKE '%upphört att gälla%'
    `
    console.log(`Updated ${result2} additional documents`)
  }

  // Show final stats
  const stats = await prisma.legalDocument.groupBy({
    by: ['status'],
    _count: true
  })

  console.log('\n=== Final status distribution ===')
  stats.forEach(s => console.log(`${s.status}: ${s._count}`))
}

updateRepealedStatus()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
