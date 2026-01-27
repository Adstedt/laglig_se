/* eslint-disable no-console */
/**
 * Check PDF attachments in ingested court cases
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Count cases with attachments
  const casesWithAttachments = await prisma.legalDocument.findMany({
    where: {
      content_type: {
        in: [
          'COURT_CASE_AD',
          'COURT_CASE_HFD',
          'COURT_CASE_HD',
          'COURT_CASE_HOVR',
        ],
      },
    },
    select: {
      document_number: true,
      metadata: true,
    },
  })

  let withPdf = 0
  let totalPdfs = 0
  const examples: { doc: string; files: string[] }[] = []

  for (const c of casesWithAttachments) {
    const meta = c.metadata as Record<string, unknown>
    const attachments = meta?.attachments as
      | Array<{ id: string; filename: string }>
      | undefined
    if (attachments && attachments.length > 0) {
      withPdf++
      totalPdfs += attachments.length
      if (examples.length < 5) {
        examples.push({
          doc: c.document_number,
          files: attachments.map((a) => a.filename),
        })
      }
    }
  }

  console.log('=== PDF Attachments in Court Cases ===\n')
  console.log(`Total cases: ${casesWithAttachments.length}`)
  console.log(`Cases with PDFs: ${withPdf}`)
  console.log(`Total PDF files: ${totalPdfs}`)
  console.log(
    `Percentage with PDFs: ${((withPdf / casesWithAttachments.length) * 100).toFixed(1)}%\n`
  )

  if (examples.length > 0) {
    console.log('Example cases with PDFs:')
    for (const ex of examples) {
      console.log(`  ${ex.doc}:`)
      for (const f of ex.files) {
        console.log(`    - ${f}`)
      }
    }
  }

  // Show raw metadata for one case with attachments
  console.log('\n=== Raw attachment structure (case with attachments) ===')

  // Find one that actually has attachments
  const allCases = await prisma.legalDocument.findMany({
    where: {
      content_type: {
        in: [
          'COURT_CASE_AD',
          'COURT_CASE_HFD',
          'COURT_CASE_HD',
          'COURT_CASE_HOVR',
        ],
      },
    },
    select: {
      document_number: true,
      metadata: true,
    },
  })

  for (const c of allCases) {
    const meta = c.metadata as Record<string, unknown>
    const attachments = meta?.attachments as unknown[] | undefined
    if (attachments && attachments.length > 0) {
      console.log('Document:', c.document_number)
      console.log('Attachments:', JSON.stringify(attachments, null, 2))
      break
    }
  }

  await prisma.$disconnect()
}
main()
