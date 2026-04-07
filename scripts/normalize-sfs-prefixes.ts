/**
 * SFS Prefix Normalization Script
 *
 * Normalizes all SFS number fields to use the "SFS YYYY:X" format (WITH prefix).
 * Removes duplicate amendment_documents created by the format mismatch.
 *
 * Run with: npx tsx scripts/normalize-sfs-prefixes.ts
 * Dry run:  npx tsx scripts/normalize-sfs-prefixes.ts --dry-run
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`SFS Prefix Normalization${DRY_RUN ? ' (DRY RUN)' : ''}`)
  console.log(`${'='.repeat(60)}\n`)

  // ──────────────────────────────────────────────────────────────────
  // Step 1: Delete duplicate no-prefix amendment_documents
  // ──────────────────────────────────────────────────────────────────
  console.log('## Step 1: Delete duplicate no-prefix amendment_documents')

  const allAmendments = await prisma.amendmentDocument.findMany({
    where: { sfs_number: { not: { startsWith: 'SFS ' } } },
    select: { id: true, sfs_number: true, parse_status: true },
  })

  console.log(`  Found ${allAmendments.length} records without "SFS " prefix`)

  let deletedCount = 0
  let keptForPrefixing = 0

  for (const record of allAmendments) {
    const prefixedVersion = `SFS ${record.sfs_number}`
    const existsWithPrefix = await prisma.amendmentDocument.findUnique({
      where: { sfs_number: prefixedVersion },
      select: { id: true },
    })

    if (existsWithPrefix) {
      // Duplicate — delete the no-prefix version (prefixed one is authoritative)
      if (!DRY_RUN) {
        // section_changes cascade-delete automatically
        await prisma.amendmentDocument.delete({ where: { id: record.id } })
      }
      deletedCount++
      if (deletedCount <= 5) {
        console.log(
          `  Deleted duplicate: ${record.sfs_number} (${record.parse_status})`
        )
      }
    } else {
      keptForPrefixing++
    }
  }

  console.log(`  Deleted: ${deletedCount} duplicates`)
  console.log(`  Kept for prefixing: ${keptForPrefixing}`)

  // ──────────────────────────────────────────────────────────────────
  // Step 2: Prefix remaining bare sfs_number records
  // ──────────────────────────────────────────────────────────────────
  console.log('\n## Step 2: Prefix remaining bare sfs_number records')

  if (!DRY_RUN) {
    const result = await prisma.$executeRaw`
      UPDATE amendment_documents
      SET sfs_number = 'SFS ' || sfs_number
      WHERE sfs_number NOT LIKE 'SFS %'
    `
    console.log(`  Updated: ${result} records`)
  } else {
    const remaining = await prisma.amendmentDocument.count({
      where: { sfs_number: { not: { startsWith: 'SFS ' } } },
    })
    console.log(`  Would update: ${remaining} records`)
  }

  // ──────────────────────────────────────────────────────────────────
  // Step 3: Prefix bare base_law_sfs records
  // ──────────────────────────────────────────────────────────────────
  console.log('\n## Step 3: Prefix bare base_law_sfs records')

  if (!DRY_RUN) {
    const result = await prisma.$executeRaw`
      UPDATE amendment_documents
      SET base_law_sfs = 'SFS ' || base_law_sfs
      WHERE base_law_sfs NOT LIKE 'SFS %'
        AND base_law_sfs != 'unknown'
    `
    console.log(`  Updated: ${result} records`)
  } else {
    const count = await prisma.amendmentDocument.count({
      where: {
        base_law_sfs: { not: { startsWith: 'SFS ' } },
        NOT: { base_law_sfs: 'unknown' },
      },
    })
    console.log(`  Would update: ${count} records`)
  }

  // ──────────────────────────────────────────────────────────────────
  // Step 4: Prefix bare document_versions.amendment_sfs records
  // ──────────────────────────────────────────────────────────────────
  console.log('\n## Step 4: Prefix bare document_versions.amendment_sfs')

  if (!DRY_RUN) {
    const result = await prisma.$executeRaw`
      UPDATE document_versions
      SET amendment_sfs = 'SFS ' || amendment_sfs
      WHERE amendment_sfs IS NOT NULL
        AND amendment_sfs NOT LIKE 'SFS %'
    `
    console.log(`  Updated: ${result} records`)
  } else {
    const count = await prisma.documentVersion.count({
      where: {
        amendment_sfs: { not: null },
        NOT: { amendment_sfs: { startsWith: 'SFS ' } },
      },
    })
    console.log(`  Would update: ${count} records`)
  }

  // ──────────────────────────────────────────────────────────────────
  // Verification
  // ──────────────────────────────────────────────────────────────────
  if (!DRY_RUN) {
    console.log('\n## Verification')

    const bareSfsNumber = await prisma.amendmentDocument.count({
      where: { sfs_number: { not: { startsWith: 'SFS ' } } },
    })
    console.log(
      `  Bare sfs_number remaining: ${bareSfsNumber}${bareSfsNumber === 0 ? ' ✓' : ' ✗ UNEXPECTED'}`
    )

    const bareBaseLaw = await prisma.amendmentDocument.count({
      where: {
        base_law_sfs: { not: { startsWith: 'SFS ' } },
        NOT: { base_law_sfs: 'unknown' },
      },
    })
    console.log(
      `  Bare base_law_sfs remaining: ${bareBaseLaw}${bareBaseLaw === 0 ? ' ✓' : ' ✗ UNEXPECTED'}`
    )

    const bareVersions = await prisma.documentVersion.count({
      where: {
        amendment_sfs: { not: null },
        NOT: { amendment_sfs: { startsWith: 'SFS ' } },
      },
    })
    console.log(
      `  Bare document_versions.amendment_sfs remaining: ${bareVersions}${bareVersions === 0 ? ' ✓' : ' ✗ UNEXPECTED'}`
    )

    // Check for duplicates
    const dupes = await prisma.$queryRawUnsafe<
      { sfs_number: string; cnt: bigint }[]
    >(`
      SELECT sfs_number, COUNT(*) as cnt
      FROM amendment_documents
      GROUP BY sfs_number
      HAVING COUNT(*) > 1
    `)
    console.log(
      `  Duplicate sfs_numbers: ${dupes.length}${dupes.length === 0 ? ' ✓' : ' ✗ UNEXPECTED'}`
    )
    if (dupes.length > 0) {
      for (const d of dupes.slice(0, 5)) {
        console.log(`    ${d.sfs_number}: ${d.cnt}`)
      }
    }

    const totalAmendments = await prisma.amendmentDocument.count()
    console.log(`  Total amendment_documents: ${totalAmendments}`)
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(
    DRY_RUN
      ? 'Dry run complete. Run without --dry-run to apply.'
      : 'Normalization complete.'
  )
  console.log(`${'='.repeat(60)}\n`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('Script failed:', e)
  await prisma.$disconnect()
  process.exit(1)
})
