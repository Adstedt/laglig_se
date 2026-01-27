/* eslint-disable no-console */
/**
 * Script: Fix REPEALED status - more precise pattern matching
 *
 * The previous pattern was too broad. We need to check for:
 * "Författningen har upphävts genom:" in the header section (first ~500 chars)
 * OR "Upphävd:" field in the header
 *
 * Usage: pnpm tsx scripts/fix-repealed-status.ts
 */

import { prisma } from '../lib/prisma'

async function fixRepealedStatus() {
  console.log('Fixing REPEALED status with more precise pattern...\n')

  // First, reset all SFS laws back to ACTIVE
  const resetCount = await prisma.$executeRaw`
    UPDATE legal_documents
    SET status = 'ACTIVE'
    WHERE content_type = 'SFS_LAW'
    AND status = 'REPEALED'
  `
  console.log(`Reset ${resetCount} documents back to ACTIVE`)

  // Now find truly repealed laws:
  // Pattern: "Upphävd:" appears in the header (first 600 chars) followed by a date
  // AND "Författningen har upphävts genom:" appears
  const trueRepealed = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint as count
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
    AND (
      -- Pattern 1: "Upphävd:" in header AND "Författningen har upphävts genom:"
      (
        LEFT(full_text, 600) ILIKE '%Upphävd:%'
        AND full_text ILIKE '%Författningen har upphävts genom:%'
      )
      OR
      -- Pattern 2: "Författningen har upphävts genom:" very early in document (header)
      LEFT(full_text, 800) ILIKE '%Författningen har upphävts genom:%'
    )
  `
  console.log(`\nFound ${trueRepealed[0].count} truly repealed laws`)

  // Update these to REPEALED
  const updateCount = await prisma.$executeRaw`
    UPDATE legal_documents
    SET status = 'REPEALED', updated_at = NOW()
    WHERE content_type = 'SFS_LAW'
    AND (
      (
        LEFT(full_text, 600) ILIKE '%Upphävd:%'
        AND full_text ILIKE '%Författningen har upphävts genom:%'
      )
      OR
      LEFT(full_text, 800) ILIKE '%Författningen har upphävts genom:%'
    )
  `
  console.log(`Updated ${updateCount} documents to REPEALED`)

  // Verify LAS is now ACTIVE
  const las = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1982:80' },
    select: { title: true, status: true },
  })
  console.log(`\nVerification - LAS (SFS 1982:80): ${las?.status}`)

  // Show final stats
  const stats = await prisma.legalDocument.groupBy({
    by: ['status'],
    _count: true,
  })

  console.log('\n=== Final status distribution ===')
  stats.forEach((s) => console.log(`${s.status}: ${s._count}`))
}

fixRepealedStatus()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
