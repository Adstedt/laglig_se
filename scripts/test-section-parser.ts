/**
 * Test the section parser against real law HTML
 */
import { PrismaClient } from '@prisma/client'
import {
  parseLawSections,
  formatSectionRef,
} from '../lib/legal-document/section-parser'

const prisma = new PrismaClient()

async function main() {
  // Test with Arbetsmiljölagen (has chapters)
  console.log('=== Testing with Arbetsmiljölagen (SFS 1977:1160) ===\n')

  const aml = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1977:1160' },
    select: { html_content: true, title: true },
  })

  if (aml?.html_content) {
    const result = parseLawSections(aml.html_content)

    console.log(`Title: ${aml.title}`)
    console.log(`Has chapters: ${result.hasChapters}`)
    console.log(`Total sections: ${result.totalSections}`)
    console.log(
      `Errors: ${result.errors.length > 0 ? result.errors.join(', ') : 'None'}`
    )

    console.log('\nFirst 10 sections:')
    for (const section of result.sections.slice(0, 10)) {
      const ref = formatSectionRef(section.chapter, section.section)
      const textPreview = section.textContent
        .substring(0, 80)
        .replace(/\n/g, ' ')
      console.log(`  ${ref}: ${textPreview}...`)
      if (section.heading) {
        console.log(`    Heading: ${section.heading}`)
      }
    }

    console.log('\nSample full section (1 kap. 1 §):')
    const sample = result.sections.find(
      (s) => s.chapter === '1' && s.section === '1'
    )
    if (sample) {
      console.log('HTML length:', sample.htmlContent.length)
      console.log('Text content:', sample.textContent.substring(0, 500))
    }
  }

  // Test with a law without chapters (simpler structure)
  console.log('\n\n=== Testing with Brottsskadeförordning (SFS 2014:327) ===\n')

  const simple = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2014:327' },
    select: { html_content: true, title: true },
  })

  if (simple?.html_content) {
    const result = parseLawSections(simple.html_content)

    console.log(`Title: ${simple.title}`)
    console.log(`Has chapters: ${result.hasChapters}`)
    console.log(`Total sections: ${result.totalSections}`)
    console.log(
      `Errors: ${result.errors.length > 0 ? result.errors.join(', ') : 'None'}`
    )

    console.log('\nAll sections:')
    for (const section of result.sections) {
      const ref = formatSectionRef(section.chapter, section.section)
      const textPreview = section.textContent
        .substring(0, 80)
        .replace(/\n/g, ' ')
      console.log(`  ${ref}: ${textPreview}...`)
    }
  }

  // Count laws with and without HTML content
  const lawCounts = await prisma.legalDocument.groupBy({
    by: ['content_type'],
    where: { content_type: 'SFS_LAW' },
    _count: true,
  })

  const withHtml = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW', html_content: { not: null } },
  })

  const withoutHtml = await prisma.legalDocument.count({
    where: {
      content_type: 'SFS_LAW',
      OR: [{ html_content: null }, { html_content: '' }],
    },
  })

  console.log('\n\n=== Database Statistics ===')
  console.log(`Total SFS_LAW documents: ${lawCounts[0]?._count || 0}`)
  console.log(`With HTML content: ${withHtml}`)
  console.log(`Without HTML content: ${withoutHtml}`)

  await prisma.$disconnect()
}

main()
