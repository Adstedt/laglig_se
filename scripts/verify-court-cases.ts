/* eslint-disable no-console */
/**
 * Verify Court Case Ingestion
 *
 * Quick script to verify court case data in database
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  Court Case Verification')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')

  // Count by content type
  const counts = await prisma.legalDocument.groupBy({
    by: ['content_type'],
    _count: { id: true },
    where: {
      content_type: {
        in: [
          'COURT_CASE_AD',
          'COURT_CASE_HFD',
          'COURT_CASE_HD',
          'COURT_CASE_HOVR',
          'COURT_CASE_MOD',
          'COURT_CASE_MIG',
        ],
      },
    },
  })

  console.log('Court cases by type:')
  let totalCases = 0
  for (const c of counts) {
    console.log(`  ${c.content_type}: ${c._count.id}`)
    totalCases += c._count.id
  }
  console.log(`  Total court cases: ${totalCases}`)
  console.log('')

  // Count court_cases records
  const courtCaseRecords = await prisma.courtCase.count()
  console.log(`court_cases table: ${courtCaseRecords} records`)

  // Count cross-references from court cases
  const crossRefCount = await prisma.crossReference.count({
    where: {
      source_document: {
        content_type: {
          in: [
            'COURT_CASE_AD',
            'COURT_CASE_HFD',
            'COURT_CASE_HD',
            'COURT_CASE_HOVR',
          ],
        },
      },
    },
  })
  console.log(`cross_references (from court cases): ${crossRefCount}`)
  console.log('')

  // Sample cases
  console.log('Sample court cases:')
  const samples = await prisma.legalDocument.findMany({
    where: {
      content_type: {
        in: ['COURT_CASE_AD', 'COURT_CASE_HD', 'COURT_CASE_HFD'],
      },
    },
    include: { court_case: true },
    take: 5,
    orderBy: { created_at: 'desc' },
  })

  for (const s of samples) {
    console.log(`  ${s.document_number}`)
    console.log(`    Title: ${s.title.substring(0, 50)}...`)
    console.log(`    Court: ${s.court_case?.court_name || 'N/A'}`)
    console.log(
      `    Content: ${s.full_text?.length || 0} chars text, ${s.html_content?.length || 0} chars HTML`
    )
    console.log('')
  }

  await prisma.$disconnect()
}

main().catch(console.error)
