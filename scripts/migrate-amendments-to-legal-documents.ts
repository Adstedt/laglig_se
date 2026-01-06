/**
 * Migration Script: AmendmentDocument → LegalDocument
 *
 * Story 2.29: Amendment Document Pages
 *
 * Creates LegalDocument entries from existing AmendmentDocument records
 * so amendments can have their own browsable, searchable pages.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-amendments-to-legal-documents.ts
 *   pnpm tsx scripts/migrate-amendments-to-legal-documents.ts --dry-run
 *   pnpm tsx scripts/migrate-amendments-to-legal-documents.ts --limit=10
 *   pnpm tsx scripts/migrate-amendments-to-legal-documents.ts --dry-run --limit=10
 *   pnpm tsx scripts/migrate-amendments-to-legal-documents.ts --base-law=1977:1160
 */

import { PrismaClient, ParseStatus } from '@prisma/client'
import {
  generateAmendmentSlug,
  generateAmendmentTitle,
} from '../lib/sfs/amendment-slug'

const prisma = new PrismaClient()

interface MigrationStats {
  processed: number
  created: number
  updated: number
  skipped: number
  errors: number
}

async function migrateAmendmentsToLegalDocuments(
  dryRun = false,
  limit?: number,
  baseLawFilter?: string
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  }

  const limitStr = limit ? ` (limit: ${limit})` : ''
  const filterStr = baseLawFilter ? ` (base-law: ${baseLawFilter})` : ''
  console.log(
    `\n🔄 Starting amendment migration${dryRun ? ' (DRY RUN)' : ''}${limitStr}${filterStr}...\n`
  )

  // Get ALL existing document numbers to avoid unique constraint conflicts
  // (some amendments may share SFS numbers with base laws)
  console.log('📊 Fetching existing LegalDocument records...')
  const existingDocs = await prisma.legalDocument.findMany({
    select: { document_number: true },
  })
  const existingDocNumbers = new Set(existingDocs.map(d => d.document_number))
  console.log(`   Found ${existingDocNumbers.size} existing records to skip\n`)

  // Build where clause
  const whereClause: { parse_status: ParseStatus; base_law_sfs?: { contains: string } } = {
    parse_status: ParseStatus.COMPLETED,
  }
  if (baseLawFilter) {
    whereClause.base_law_sfs = { contains: baseLawFilter }
  }

  // Fetch completed amendments (with optional limit and filter)
  const allAmendments = await prisma.amendmentDocument.findMany({
    where: whereClause,
    orderBy: {
      effective_date: 'desc',
    },
  })

  // Filter to only amendments that don't exist yet
  const amendments = allAmendments.filter(a => {
    const sfsNum = a.sfs_number.replace(/^SFS\s*/i, '')
    const documentNumber = `SFS ${sfsNum}`
    return !existingDocNumbers.has(documentNumber)
  })

  // Apply limit after filtering
  const limitedAmendments = limit ? amendments.slice(0, limit) : amendments

  console.log(`📋 Found ${allAmendments.length} total amendments, ${limitedAmendments.length} need migration\n`)

  for (const amendment of limitedAmendments) {
    stats.processed++

    try {
      // Generate document number in standard format
      // Handle case where sfs_number might already have "SFS " prefix
      const sfsNum = amendment.sfs_number.replace(/^SFS\s*/i, '')
      const documentNumber = `SFS ${sfsNum}`

      // Generate title if not present
      const title =
        amendment.title ??
        generateAmendmentTitle(
          amendment.sfs_number,
          amendment.base_law_sfs,
          amendment.base_law_name
        )

      // Generate slug
      const slug = generateAmendmentSlug(
        amendment.sfs_number,
        title,
        amendment.base_law_name
      )

      // Find base law document for linking
      const baseLawSfs = amendment.base_law_sfs.replace(/^SFS\s*/i, '')
      const baseLawDocNumber = `SFS ${baseLawSfs}`
      const baseLaw = await prisma.legalDocument.findUnique({
        where: { document_number: baseLawDocNumber },
        select: { id: true, slug: true },
      })

      // Build metadata object
      const metadata = {
        amendment_document_id: amendment.id,
        base_law_sfs: amendment.base_law_sfs,
        base_law_slug: baseLaw?.slug ?? null,
        base_law_name: amendment.base_law_name,
        storage_path: amendment.storage_path,
        has_markdown: Boolean(amendment.markdown_content),
        confidence: amendment.confidence,
      }

      const data = {
        content_type: 'SFS_AMENDMENT' as const,
        document_number: documentNumber,
        title,
        slug,
        full_text: amendment.full_text ?? amendment.markdown_content ?? null,
        html_content: null, // Amendments don't have HTML content
        effective_date: amendment.effective_date,
        publication_date: amendment.publication_date,
        status: 'ACTIVE' as const,
        source_url:
          amendment.original_url ??
          `https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/_sfs-${amendment.sfs_number.replace(':', '-')}/`,
        metadata,
      }

      if (dryRun) {
        console.log(`  ✨ Would CREATE: ${documentNumber} → /${slug}`)
        stats.created++
        continue
      }

      // Create the LegalDocument
      await prisma.legalDocument.create({ data })
      console.log(`  ✨ Created: ${documentNumber} → /${slug}`)
      stats.created++
    } catch (error) {
      // Handle unique constraint errors silently (record already exists)
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        stats.skipped++
        continue
      }
      stats.errors++
      console.error(
        `  ❌ Error processing ${amendment.sfs_number}:`,
        error instanceof Error ? error.message : error
      )
    }
  }

  return stats
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  // Parse --limit=N argument
  const limitArg = args.find(arg => arg.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined

  // Parse --base-law=XXXX:XXXX argument
  const baseLawArg = args.find(arg => arg.startsWith('--base-law='))
  const baseLawFilter = baseLawArg ? baseLawArg.split('=')[1] : undefined

  try {
    const stats = await migrateAmendmentsToLegalDocuments(dryRun, limit, baseLawFilter)

    console.log('\n' + '='.repeat(50))
    console.log('📊 Migration Summary:')
    console.log('='.repeat(50))
    console.log(`  Processed: ${stats.processed}`)
    console.log(`  Created:   ${stats.created}`)
    console.log(`  Updated:   ${stats.updated}`)
    console.log(`  Skipped:   ${stats.skipped}`)
    console.log(`  Errors:    ${stats.errors}`)
    console.log('='.repeat(50))

    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN. No changes were made.')
      console.log('   Run without --dry-run to apply changes.\n')
    } else {
      console.log('\n✅ Migration complete!\n')
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
