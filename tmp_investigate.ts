import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const noHtml = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_AMENDMENT', html_content: null },
    select: {
      document_number: true,
      full_text: true,
      markdown_content: true,
      source_url: true,
      metadata: true,
      created_at: true,
    },
  })

  console.log('=== 5,862 LegalDocuments without html_content ===')
  console.log('Total:', noHtml.length)

  const withFullText = noHtml.filter(
    (d) => d.full_text && d.full_text.length > 0
  )
  const withMarkdown = noHtml.filter(
    (d) => d.markdown_content && d.markdown_content.length > 0
  )
  console.log('With full_text:', withFullText.length)
  console.log('With markdown_content:', withMarkdown.length)
  console.log(
    'Completely empty (no text at all):',
    noHtml.filter((d) => !d.full_text && !d.markdown_content).length
  )

  const sfsNumbers = noHtml.map((d) => d.document_number.replace('SFS ', ''))

  const matchingAmendments = await prisma.amendmentDocument.findMany({
    where: {
      OR: [
        { sfs_number: { in: sfsNumbers } },
        { sfs_number: { in: sfsNumbers.map((s) => 'SFS ' + s) } },
      ],
    },
    select: {
      sfs_number: true,
      parse_status: true,
      storage_path: true,
      full_text: true,
      markdown_content: true,
    },
  })

  console.log('')
  console.log('=== Matching AmendmentDocuments ===')
  console.log('Found:', matchingAmendments.length, 'out of', sfsNumbers.length)

  const byStatus = {}
  for (const a of matchingAmendments) {
    byStatus[a.parse_status] = (byStatus[a.parse_status] || 0) + 1
  }
  console.log('By parse_status:', byStatus)

  const withPdf = matchingAmendments.filter(
    (a) => a.storage_path && a.storage_path.length > 0
  )
  console.log('With storage_path (PDF available):', withPdf.length)

  const amendWithText = matchingAmendments.filter(
    (a) => a.full_text && a.full_text.length > 0
  )
  const amendWithMarkdown = matchingAmendments.filter(
    (a) => a.markdown_content && a.markdown_content.length > 0
  )
  console.log('With full_text:', amendWithText.length)
  console.log('With markdown_content:', amendWithMarkdown.length)

  const matchedSet = new Set(
    matchingAmendments.map((a) => a.sfs_number.replace(/^SFS /, ''))
  )
  const orphanLegalDocs = sfsNumbers.filter((s) => !matchedSet.has(s))
  console.log('')
  console.log('=== Orphan LegalDocuments (no AmendmentDocument) ===')
  console.log('Count:', orphanLegalDocs.length)

  const yearDist = {}
  for (const s of orphanLegalDocs) {
    const year = s.split(':')[0]
    yearDist[year] = (yearDist[year] || 0) + 1
  }
  const sorted = Object.entries(yearDist).sort((a, b) => b[1] - a[1])
  console.log('Year distribution (top 15):', sorted.slice(0, 15))
  console.log('Sample orphan SFS numbers:', orphanLegalDocs.slice(0, 10))

  const allYearDist = {}
  for (const s of sfsNumbers) {
    const year = s.split(':')[0]
    allYearDist[year] = (allYearDist[year] || 0) + 1
  }
  const allSorted = Object.entries(allYearDist).sort((a, b) => b[1] - a[1])
  console.log('')
  console.log('=== Year distribution of all 5862 ===')
  console.log('Top 20:', allSorted.slice(0, 20))

  const sampleMeta = noHtml.slice(0, 5).map((d) => ({
    doc: d.document_number,
    hasText: !!(d.full_text && d.full_text.length > 0),
    textLen: d.full_text?.length || 0,
    meta: d.metadata,
    created: d.created_at,
  }))
  console.log('')
  console.log('=== Sample metadata ===')
  for (const s of sampleMeta) {
    console.log(JSON.stringify(s))
  }

  await prisma.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
