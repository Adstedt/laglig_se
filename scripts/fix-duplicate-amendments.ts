/**
 * Fix duplicate SFS_AMENDMENT LegalDocuments
 *
 * Bug: createLegalDocumentFromAmendment prepended "SFS " to sfs_number
 * that already had the prefix, creating "SFS SFS YYYY:NNN" duplicates
 * alongside the original "SFS YYYY:NNN" records.
 *
 * Uses raw SQL for efficiency (3 queries instead of 18,000+).
 *
 * Usage:
 *   pnpm tsx scripts/fix-duplicate-amendments.ts --dry-run
 *   pnpm tsx scripts/fix-duplicate-amendments.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  console.log(
    `\n=== Fix Duplicate Amendments ${dryRun ? '(DRY RUN)' : ''} ===\n`
  )

  // Count duplicates
  const dupeCount = await prisma.legalDocument.count({
    where: {
      content_type: 'SFS_AMENDMENT',
      document_number: { startsWith: 'SFS SFS' },
    },
  })
  console.log(`"SFS SFS" duplicate records: ${dupeCount}`)

  if (dupeCount === 0) {
    console.log('Nothing to fix.')
    return
  }

  if (dryRun) {
    // Check how many have a matching original
    const [matchCount] = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM "legal_documents" dup
      JOIN "legal_documents" orig
        ON orig.document_number = REPLACE(dup.document_number, 'SFS SFS ', 'SFS ')
        AND orig.content_type = 'SFS_AMENDMENT'
      WHERE dup.content_type = 'SFS_AMENDMENT'
        AND dup.document_number LIKE 'SFS SFS %'
    `
    const orphanCount = dupeCount - Number(matchCount.count)

    console.log(`  With matching "SFS" original: ${matchCount.count}`)
    console.log(`  Without match (will rename): ${orphanCount}`)
    console.log(`\nDry run complete. Run without --dry-run to apply.\n`)
    return
  }

  // Step 1: Copy content from "SFS SFS X" → "SFS X" where both exist
  const merged = await prisma.$executeRaw`
    UPDATE "legal_documents" orig
    SET
      html_content = dup.html_content,
      markdown_content = COALESCE(dup.markdown_content, orig.markdown_content),
      json_content = COALESCE(dup.json_content, orig.json_content),
      full_text = COALESCE(dup.full_text, orig.full_text),
      updated_at = NOW()
    FROM "legal_documents" dup
    WHERE dup.content_type = 'SFS_AMENDMENT'
      AND dup.document_number LIKE 'SFS SFS %'
      AND orig.document_number = REPLACE(dup.document_number, 'SFS SFS ', 'SFS ')
      AND orig.content_type = 'SFS_AMENDMENT'
  `
  console.log(`Step 1: Merged content into ${merged} original records`)

  // Step 2: Delete duplicates that had a matching original
  const deleted = await prisma.$executeRaw`
    DELETE FROM "legal_documents" dup
    USING "legal_documents" orig
    WHERE dup.content_type = 'SFS_AMENDMENT'
      AND dup.document_number LIKE 'SFS SFS %'
      AND orig.document_number = REPLACE(dup.document_number, 'SFS SFS ', 'SFS ')
      AND orig.content_type = 'SFS_AMENDMENT'
  `
  console.log(`Step 2: Deleted ${deleted} duplicate records`)

  // Step 3: Rename remaining "SFS SFS" records where no conflict exists
  const renamed = await prisma.$executeRaw`
    UPDATE "legal_documents" d
    SET
      document_number = REPLACE(d.document_number, 'SFS SFS ', 'SFS '),
      updated_at = NOW()
    WHERE d.content_type = 'SFS_AMENDMENT'
      AND d.document_number LIKE 'SFS SFS %'
      AND NOT EXISTS (
        SELECT 1 FROM "legal_documents" e
        WHERE e.document_number = REPLACE(d.document_number, 'SFS SFS ', 'SFS ')
      )
  `
  console.log(`Step 3: Renamed ${renamed} orphan records`)

  // Step 4: Delete any remaining "SFS SFS" that conflict with existing base laws
  const conflictDeleted = await prisma.$executeRaw`
    DELETE FROM "legal_documents" d
    USING "legal_documents" e
    WHERE d.content_type = 'SFS_AMENDMENT'
      AND d.document_number LIKE 'SFS SFS %'
      AND e.document_number = REPLACE(d.document_number, 'SFS SFS ', 'SFS ')
  `
  console.log(
    `Step 4: Deleted ${conflictDeleted} conflicting duplicates (base law already exists)`
  )

  // Verify
  const remaining = await prisma.legalDocument.count({
    where: {
      content_type: 'SFS_AMENDMENT',
      document_number: { startsWith: 'SFS SFS' },
    },
  })
  const totalAfter = await prisma.legalDocument.count({
    where: { content_type: 'SFS_AMENDMENT' },
  })

  console.log(`\n=== Result ===`)
  console.log(`  Remaining "SFS SFS" records: ${remaining}`)
  console.log(`  Total SFS_AMENDMENT records: ${totalAfter}`)
  console.log(`\nDone.\n`)
}
main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
