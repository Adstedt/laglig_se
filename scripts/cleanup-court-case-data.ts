/**
 * Story 2.31: One-time court case data cleanup script
 *
 * Removes all court case LegalDocument records and cascading child records.
 * Run with --execute to actually delete; default is dry-run mode.
 *
 * Usage:
 *   npx tsx scripts/cleanup-court-case-data.ts          # dry-run
 *   npx tsx scripts/cleanup-court-case-data.ts --execute # actual deletion
 */

import { PrismaClient, ContentType } from '@prisma/client'

const prisma = new PrismaClient()

const COURT_CASE_CONTENT_TYPES: ContentType[] = [
  ContentType.COURT_CASE_AD,
  ContentType.COURT_CASE_HD,
  ContentType.COURT_CASE_HOVR,
  ContentType.COURT_CASE_HFD,
  ContentType.COURT_CASE_MOD,
  ContentType.COURT_CASE_MIG,
]

async function main() {
  const isExecute = process.argv.includes('--execute')
  const mode = isExecute ? 'EXECUTE' : 'DRY-RUN'

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Court Case Data Cleanup — Mode: ${mode}`)
  console.log(`${'='.repeat(60)}\n`)

  // Step 1: Identify court case documents
  const courtCaseDocs = await prisma.legalDocument.findMany({
    where: { content_type: { in: COURT_CASE_CONTENT_TYPES } },
    select: { id: true, content_type: true },
  })

  const courtCaseIds = courtCaseDocs.map((d) => d.id)

  // Log per-type counts
  const typeCounts = COURT_CASE_CONTENT_TYPES.map((ct) => ({
    type: ct,
    count: courtCaseDocs.filter((d) => d.content_type === ct).length,
  }))

  console.log('Documents found per content type:')
  for (const { type, count } of typeCounts) {
    console.log(`  ${type}: ${count}`)
  }
  console.log(`  TOTAL: ${courtCaseIds.length}\n`)

  if (courtCaseIds.length === 0) {
    console.log('No court case documents found. Nothing to delete.')
    await prisma.$disconnect()
    return
  }

  // SAFETY CHECK: Verify all matched documents are court cases
  const nonCourtCaseCount = courtCaseDocs.filter(
    (d) => !COURT_CASE_CONTENT_TYPES.includes(d.content_type)
  ).length
  if (nonCourtCaseCount > 0) {
    console.error(
      `SAFETY CHECK FAILED: ${nonCourtCaseCount} non-court-case documents matched. Aborting.`
    )
    process.exit(1)
  }
  console.log(
    'SAFETY CHECK PASSED: All matched documents are COURT_CASE_* types.\n'
  )

  // Step 2: Count child records that need explicit deletion
  const contentChunkCount = await prisma.contentChunk.count({
    where: { source_type: 'LEGAL_DOCUMENT', source_id: { in: courtCaseIds } },
  })
  const lawListItemCount = await prisma.lawListItem.count({
    where: { document_id: { in: courtCaseIds } },
  })
  const templateItemCount = await prisma.templateItem.count({
    where: { document_id: { in: courtCaseIds } },
  })

  console.log('Child records requiring explicit deletion (no cascade):')
  console.log(`  ContentChunk:  ${contentChunkCount}`)
  console.log(`  LawListItem:   ${lawListItemCount}`)
  console.log(`  TemplateItem:  ${templateItemCount}`)
  console.log()

  if (!isExecute) {
    console.log(
      'DRY-RUN complete. Run with --execute to perform actual deletion.'
    )
    await prisma.$disconnect()
    return
  }

  // Step 3: Execute deletion in transaction
  console.log('Starting deletion transaction...\n')

  const result = await prisma.$transaction(
    async (tx) => {
      // 1. Delete ContentChunks (no FK cascade)
      const deletedChunks = await tx.contentChunk.deleteMany({
        where: {
          source_type: 'LEGAL_DOCUMENT',
          source_id: { in: courtCaseIds },
        },
      })
      console.log(`  [1/4] Deleted ${deletedChunks.count} ContentChunk records`)

      // 2. Delete LawListItems (onDelete: Restrict)
      const deletedListItems = await tx.lawListItem.deleteMany({
        where: { document_id: { in: courtCaseIds } },
      })
      console.log(
        `  [2/4] Deleted ${deletedListItems.count} LawListItem records`
      )

      // 3. Delete TemplateItems (onDelete: Restrict)
      const deletedTemplateItems = await tx.templateItem.deleteMany({
        where: { document_id: { in: courtCaseIds } },
      })
      console.log(
        `  [3/4] Deleted ${deletedTemplateItems.count} TemplateItem records`
      )

      // 4. Delete LegalDocuments (cascades: CourtCase, CrossReference, Amendment,
      //    DocumentSubject, DocumentVersion, ChangeEvent, LawSection, LegislativeRef, DocumentVisit)
      const deletedDocs = await tx.legalDocument.deleteMany({
        where: { content_type: { in: COURT_CASE_CONTENT_TYPES } },
      })
      console.log(
        `  [4/4] Deleted ${deletedDocs.count} LegalDocument records (+ cascaded children)`
      )

      return {
        chunks: deletedChunks.count,
        listItems: deletedListItems.count,
        templateItems: deletedTemplateItems.count,
        documents: deletedDocs.count,
      }
    },
    { timeout: 120000 } // 2 minute timeout for large deletions
  )

  console.log(`\nDeletion complete:`)
  console.log(`  ContentChunks:   ${result.chunks}`)
  console.log(`  LawListItems:    ${result.listItems}`)
  console.log(`  TemplateItems:   ${result.templateItems}`)
  console.log(`  LegalDocuments:  ${result.documents}`)

  // Step 4: Verify cleanup
  console.log('\nVerifying cleanup...')
  const remainingDocs = await prisma.legalDocument.count({
    where: { content_type: { in: COURT_CASE_CONTENT_TYPES } },
  })
  const remainingCourtCases = await prisma.courtCase.count()
  const orphanedChunks = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT count(*) FROM content_chunks
    WHERE source_type = 'LEGAL_DOCUMENT'
    AND source_id NOT IN (SELECT id FROM legal_documents)
  `

  console.log(`  Remaining COURT_CASE_* documents: ${remainingDocs}`)
  console.log(`  Remaining court_cases rows:       ${remainingCourtCases}`)
  console.log(`  Orphaned content_chunks:          ${orphanedChunks[0].count}`)

  if (
    remainingDocs === 0 &&
    remainingCourtCases === 0 &&
    orphanedChunks[0].count === 0n
  ) {
    console.log('\nCLEANUP VERIFIED: All court case data removed successfully.')
  } else {
    console.error(
      '\nWARNING: Some court case data may remain. Check counts above.'
    )
  }

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Script failed:', error)
  prisma.$disconnect()
  process.exit(1)
})
