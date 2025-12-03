/* eslint-disable no-console */
/**
 * Analyze PDF distribution across court cases
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

interface Stats {
  total: number
  withPdf: number
}

async function main() {
  console.log('Fetching all court cases...')

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
      content_type: true,
      metadata: true,
      court_case: { select: { decision_date: true, court_name: true } },
    },
  })

  console.log(`Loaded ${allCases.length} cases\n`)

  // Analyze by court type
  const byCourtType: Record<string, Stats> = {}
  const byYear: Record<string, Stats> = {}

  for (const c of allCases) {
    const meta = c.metadata as Record<string, unknown> | null
    const attachments = meta?.attachments as unknown[] | undefined
    const hasPdf = attachments && attachments.length > 0
    const courtType = c.content_type
    const year = c.court_case?.decision_date?.getFullYear()?.toString() || 'unknown'

    // By court type
    if (!byCourtType[courtType]) byCourtType[courtType] = { total: 0, withPdf: 0 }
    byCourtType[courtType].total++
    if (hasPdf) byCourtType[courtType].withPdf++

    // By year for all
    if (!byYear[year]) byYear[year] = { total: 0, withPdf: 0 }
    byYear[year].total++
    if (hasPdf) byYear[year].withPdf++
  }

  console.log('=== PDF Distribution by Court Type ===')
  for (const [ct, data] of Object.entries(byCourtType)) {
    const pct = ((data.withPdf / data.total) * 100).toFixed(1)
    console.log(`${ct}: ${data.withPdf}/${data.total} (${pct}%)`)
  }

  console.log('')
  console.log('=== Cases by Year (with PDF counts) ===')
  const years = Object.keys(byYear).sort()
  for (const y of years) {
    const data = byYear[y]
    const pct = ((data.withPdf / data.total) * 100).toFixed(1)
    console.log(`${y}: ${data.withPdf}/${data.total} with PDF (${pct}%)`)
  }

  await prisma.$disconnect()
}
main()
