#!/usr/bin/env tsx
/**
 * Clear SFS Laws from Database
 *
 * Removes all SFS laws and their associated amendments to prepare for re-ingestion.
 */

import { prisma } from '../lib/prisma'

async function clearSFSLaws() {
  console.log('='.repeat(80))
  console.log('Clear SFS Laws - Starting')
  console.log('='.repeat(80))
  console.log('')

  // Count existing records
  const lawCount = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW' },
  })

  const amendmentCount = await prisma.amendment.count()

  console.log(`📊 Existing SFS laws: ${lawCount}`)
  console.log(`📊 Existing amendments: ${amendmentCount}`)
  console.log('')

  if (lawCount === 0) {
    console.log('✅ No SFS laws to clear.')
    await prisma.$disconnect()
    return
  }

  console.log('🗑️  Deleting all amendments...')
  const deletedAmendments = await prisma.amendment.deleteMany()
  console.log(`✅ Deleted ${deletedAmendments.count} amendments`)

  console.log('🗑️  Deleting all SFS laws...')
  const deletedLaws = await prisma.legalDocument.deleteMany({
    where: { content_type: 'SFS_LAW' },
  })
  console.log(`✅ Deleted ${deletedLaws.count} SFS laws`)

  console.log('')
  console.log('='.repeat(80))
  console.log('✅ CLEAR COMPLETE')
  console.log('='.repeat(80))
  console.log('')
  console.log('Ready to re-run ingestion with:')
  console.log('  pnpm tsx scripts/ingest-sfs-laws.ts')
  console.log('')

  await prisma.$disconnect()
}

clearSFSLaws().catch(console.error)
