import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const year = process.argv[2] || '2025'
  const limit = parseInt(process.argv[3] || '5', 10)

  const docs = await prisma.amendmentDocument.findMany({
    where: { sfs_number: { startsWith: `${year}:` } },
    include: { section_changes: true },
    orderBy: { sfs_number: 'asc' },
    take: limit,
  })

  console.log(`\nAmendment Documents for ${year} (showing ${docs.length}):\n`)

  docs.forEach((doc) => {
    console.log('='.repeat(60))
    console.log('SFS:', doc.sfs_number)
    console.log(
      'Title:',
      doc.title?.substring(0, 70) +
        (doc.title && doc.title.length > 70 ? '...' : '')
    )
    console.log('Base Law:', doc.base_law_sfs, '-', doc.base_law_name)
    console.log(
      'Effective:',
      doc.effective_date?.toISOString().split('T')[0] || 'N/A'
    )
    console.log(
      'Status:',
      doc.parse_status,
      '- Confidence:',
      doc.confidence?.toFixed(2) || 'N/A'
    )
    console.log('Section Changes:', doc.section_changes.length)
    doc.section_changes.forEach((sc) => {
      const loc = sc.chapter
        ? `${sc.chapter} kap. ${sc.section} §`
        : `${sc.section} §`
      console.log(
        `  - ${loc} (${sc.change_type}) ${sc.description?.substring(0, 40) || ''}`
      )
    })
    console.log()
  })

  // Stats
  const totalDocs = await prisma.amendmentDocument.count({
    where: { sfs_number: { startsWith: `${year}:` } },
  })
  const totalChanges = await prisma.sectionChange.count()
  const byStatus = await prisma.amendmentDocument.groupBy({
    by: ['parse_status'],
    _count: true,
    where: { sfs_number: { startsWith: `${year}:` } },
  })

  console.log('='.repeat(60))
  console.log('STATS')
  console.log('='.repeat(60))
  console.log(`Total amendment docs (${year}): ${totalDocs}`)
  console.log(`Total section changes: ${totalChanges}`)
  console.log('By status:')
  byStatus.forEach((s) => console.log(`  - ${s.parse_status}: ${s._count}`))

  await prisma.$disconnect()
}

main().catch(console.error)
