/**
 * Validate parsed LawSection data quality
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function validate() {
  console.log('=== LawSection Validation ===\n')

  // Count total sections created
  const totalSections = await prisma.lawSection.count()
  console.log('Total sections in DB:', totalSections)

  // Count by chapter presence
  const withChapter = await prisma.lawSection.count({
    where: { chapter: { not: null } },
  })
  const withoutChapter = await prisma.lawSection.count({
    where: { chapter: null },
  })
  console.log('With chapters:', withChapter)
  console.log('Without chapters:', withoutChapter)

  // Count unique laws processed
  const uniqueLaws = await prisma.lawSection.findMany({
    select: { legal_document_id: true },
    distinct: ['legal_document_id'],
  })
  console.log('Unique laws with sections:', uniqueLaws.length)

  // Sample a few sections with chapters
  console.log('\n=== Sample Sections WITH Chapters ===')
  const samplesWithChapter = await prisma.lawSection.findMany({
    where: { chapter: { not: null } },
    take: 3,
    include: {
      legal_document: { select: { document_number: true, title: true } },
    },
  })
  for (const s of samplesWithChapter) {
    console.log(
      `\n[${s.legal_document.document_number}] ${s.chapter} kap. ${s.section} §`
    )
    console.log('Title:', s.legal_document.title?.substring(0, 60))
    console.log('Heading:', s.heading || '(none)')
    console.log(
      'Text preview:',
      s.text_content.substring(0, 150).replace(/\n/g, ' ')
    )
    console.log('HTML length:', s.html_content.length)
  }

  // Sample sections WITHOUT chapters
  console.log('\n=== Sample Sections WITHOUT Chapters ===')
  const samplesNoChapter = await prisma.lawSection.findMany({
    where: { chapter: null },
    take: 3,
    include: {
      legal_document: { select: { document_number: true, title: true } },
    },
  })
  for (const s of samplesNoChapter) {
    console.log(`\n[${s.legal_document.document_number}] ${s.section} §`)
    console.log('Title:', s.legal_document.title?.substring(0, 60))
    console.log('Heading:', s.heading || '(none)')
    console.log(
      'Text preview:',
      s.text_content.substring(0, 150).replace(/\n/g, ' ')
    )
    console.log('HTML length:', s.html_content.length)
  }

  // Check for potential issues
  console.log('\n=== Data Quality Checks ===')
  const emptyText = await prisma.lawSection.count({
    where: { text_content: '' },
  })
  const emptyHtml = await prisma.lawSection.count({
    where: { html_content: '' },
  })
  console.log('Empty text_content:', emptyText)
  console.log('Empty html_content:', emptyHtml)

  // Very short sections (might indicate parsing issues)
  const veryShortSections = await prisma.lawSection.findMany({
    where: {},
    orderBy: { text_content: 'asc' },
    take: 5,
    select: {
      chapter: true,
      section: true,
      text_content: true,
      legal_document: { select: { document_number: true } },
    },
  })
  console.log('\nShortest sections:')
  for (const s of veryShortSections) {
    const ref = s.chapter
      ? `${s.chapter} kap. ${s.section} §`
      : `${s.section} §`
    console.log(
      `  [${s.legal_document.document_number}] ${ref}: "${s.text_content.substring(0, 50)}" (${s.text_content.length} chars)`
    )
  }

  // Section number distribution
  const sectionCounts = await prisma.$queryRaw<
    Array<{ section: string; cnt: bigint }>
  >`
    SELECT section, COUNT(*) as cnt
    FROM law_sections
    GROUP BY section
    ORDER BY cnt DESC
    LIMIT 10
  `
  console.log('\nMost common section numbers:')
  for (const row of sectionCounts) {
    console.log(`  ${row.section} §: ${row.cnt} occurrences`)
  }

  // Avg sections per law
  const avgSections = totalSections / uniqueLaws.length
  console.log(`\nAverage sections per law: ${avgSections.toFixed(1)}`)

  await prisma.$disconnect()
}

validate().catch(console.error)
