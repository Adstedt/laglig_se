import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

async function main() {
  const { prisma } = await import('../lib/prisma')

  // Pick one of our test change events
  const testSfs = [
    'SFS 2026:214',
    'SFS 2026:208',
    'SFS 2026:213',
    'SFS 2026:216',
  ]

  for (const sfs of testSfs) {
    console.log('\n' + '='.repeat(60))
    console.log('Amendment:', sfs)

    // 1. Check ChangeEvent
    const ce = await prisma.changeEvent.findFirst({
      where: { amendment_sfs: sfs },
      include: {
        document: {
          select: { id: true, title: true, document_number: true },
        },
      },
    })
    if (!ce) {
      console.log('  No ChangeEvent found')
      continue
    }
    console.log('  ChangeEvent:', ce.id)
    console.log(
      '  Base law:',
      ce.document.title,
      '(' + ce.document.document_number + ')'
    )
    console.log('  Changed sections:', JSON.stringify(ce.changed_sections))
    console.log('  AI summary:', ce.ai_summary || '(none)')
    console.log('  Diff summary:', ce.diff_summary || '(none)')
    console.log('  Previous version ID:', ce.previous_version_id || '(none)')
    console.log('  New version ID:', ce.new_version_id || '(none)')

    // 2. Check if AmendmentDocument exists
    const amd = await prisma.amendmentDocument.findFirst({
      where: { amendment_sfs: sfs },
      select: {
        id: true,
        amendment_sfs: true,
        effective_date: true,
        full_text: true,
        markdown_content: true,
        html_content: true,
        json_content: true,
        status: true,
      },
    })
    if (amd) {
      console.log('  AmendmentDocument: YES')
      console.log('    Status:', amd.status)
      console.log('    Effective date:', amd.effective_date)
      console.log('    Full text:', (amd.full_text?.length ?? 0) + ' chars')
      console.log(
        '    Markdown:',
        (amd.markdown_content?.length ?? 0) + ' chars'
      )
      console.log('    HTML:', (amd.html_content?.length ?? 0) + ' chars')
      console.log('    JSON:', amd.json_content ? 'yes' : 'no')
    } else {
      console.log('  AmendmentDocument: NO — not ingested')
    }

    // 3. Check SectionChanges
    const sections = await prisma.sectionChange.findMany({
      where: { change_event_id: ce.id },
    })
    console.log('  SectionChanges:', sections.length)
    for (const s of sections.slice(0, 3)) {
      console.log('    -', s.section_id, ':', s.change_type)
      if (s.old_text)
        console.log('      Old:', s.old_text.substring(0, 100) + '...')
      if (s.new_text)
        console.log('      New:', s.new_text.substring(0, 100) + '...')
    }

    // 4. Check if the amendment SFS exists as a LegalDocument
    const legalDoc = await prisma.legalDocument.findFirst({
      where: { document_number: sfs },
      select: {
        id: true,
        title: true,
        status: true,
        full_text: true,
        markdown_content: true,
      },
    })
    if (legalDoc) {
      console.log('  LegalDocument (amendment):', legalDoc.title)
      console.log(
        '    Full text:',
        (legalDoc.full_text?.length ?? 0) + ' chars'
      )
      console.log(
        '    Markdown:',
        (legalDoc.markdown_content?.length ?? 0) + ' chars'
      )
    } else {
      console.log('  LegalDocument (amendment): NO — not in documents table')
    }
  }

  // 5. Overall stats on amendment pipeline
  const totalChanges = await prisma.changeEvent.count({
    where: { change_type: 'AMENDMENT' },
  })
  const withSummary = await prisma.changeEvent.count({
    where: { change_type: 'AMENDMENT', ai_summary: { not: null } },
  })
  const withSections = await prisma.sectionChange.count()
  const totalAmendments = await prisma.amendmentDocument.count()

  console.log('\n' + '='.repeat(60))
  console.log('PIPELINE STATS')
  console.log('  Total amendment ChangeEvents:', totalChanges)
  console.log('  With AI summary:', withSummary)
  console.log('  Total SectionChanges:', withSections)
  console.log('  Total AmendmentDocuments:', totalAmendments)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
