import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // First check a law WITH chapters
  const lawWithChapters = await prisma.legalDocument.findFirst({
    where: {
      document_number: { gte: 'SFS 2000:' },
      content_type: 'SFS_LAW',
      law_sections: { some: { chapter: { not: null } } },
    },
    include: {
      law_sections: {
        orderBy: [{ chapter: 'asc' }, { section: 'asc' }],
      },
    },
  })

  if (lawWithChapters) {
    console.log(
      '=== Law WITH Chapters:',
      lawWithChapters.document_number,
      '==='
    )
    console.log('Title:', lawWithChapters.title)
    console.log('Total sections:', lawWithChapters.law_sections.length)

    const chapters = [
      ...new Set(
        lawWithChapters.law_sections.map((s) => s.chapter).filter(Boolean)
      ),
    ]
    console.log('Chapters:', chapters.join(', '))

    console.log('\nSample sections by chapter:')
    for (const ch of chapters.slice(0, 3)) {
      const chSections = lawWithChapters.law_sections.filter(
        (s) => s.chapter === ch
      )
      console.log(`\n  Chapter ${ch} (${chSections.length} sections):`)
      for (const s of chSections.slice(0, 3)) {
        const preview = s.text_content.substring(0, 50).replace(/\n/g, ' ')
        console.log(`    ${s.section} §: ${preview}...`)
      }
    }
  } else {
    console.log('No 2000+ law with chapters found in test batch')
  }

  console.log('\n' + '='.repeat(60) + '\n')

  // Get a 2000+ law with sections (any structure)
  const lawWithSections = await prisma.legalDocument.findFirst({
    where: {
      document_number: { gte: 'SFS 2000:' },
      content_type: 'SFS_LAW',
      law_sections: { some: {} },
    },
    include: {
      law_sections: {
        orderBy: [{ chapter: 'asc' }, { section: 'asc' }],
      },
    },
  })

  if (!lawWithSections) {
    console.log('No 2000+ law found with sections')

    // Check what we do have
    const count2000 = await prisma.legalDocument.count({
      where: { document_number: { gte: 'SFS 2000:' }, content_type: 'SFS_LAW' },
    })
    console.log('Total 2000+ SFS_LAW docs:', count2000)

    const withSections = await prisma.lawSection.findMany({
      select: { legal_document: { select: { document_number: true } } },
      distinct: ['legal_document_id'],
      take: 10,
    })
    console.log(
      'Laws with sections:',
      withSections.map((s) => s.legal_document.document_number)
    )

    await prisma.$disconnect()
    return
  }

  console.log('=== Checking:', lawWithSections.document_number, '===')
  console.log('Title:', lawWithSections.title)
  console.log('Total sections:', lawWithSections.law_sections.length)

  // Show chapters
  const chapters = [
    ...new Set(
      lawWithSections.law_sections.map((s) => s.chapter).filter(Boolean)
    ),
  ]
  if (chapters.length > 0) {
    console.log('Chapters:', chapters.join(', '))
  } else {
    console.log('No chapters (flat structure)')
  }

  console.log('\nAll sections:')
  for (const s of lawWithSections.law_sections.slice(0, 25)) {
    const ref = s.chapter
      ? `${s.chapter} kap. ${s.section} §`
      : `${s.section} §`
    const preview = s.text_content.substring(0, 60).replace(/\n/g, ' ')
    console.log(`  ${ref}: ${preview}...`)
  }
  if (lawWithSections.law_sections.length > 25) {
    console.log(`  ... and ${lawWithSections.law_sections.length - 25} more`)
  }

  await prisma.$disconnect()
}

main()
