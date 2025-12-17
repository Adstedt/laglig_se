/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function main() {
  const sfsNumber = process.argv[2] || 'SFS 2025:1445'

  // Check AmendmentDocument (parsed PDFs from svenskforfattningssamling.se)
  const amendment = await prisma.amendmentDocument.findUnique({
    where: { sfs_number: sfsNumber },
    include: {
      section_changes: {
        orderBy: { sort_order: 'asc' },
      },
    },
  })

  console.log(`\n${sfsNumber} in AmendmentDocument:`)
  if (amendment) {
    console.log('  Title:', amendment.title)
    console.log(
      '  Base law:',
      amendment.base_law_sfs,
      '-',
      amendment.base_law_name
    )
    console.log('  Effective date:', amendment.effective_date)
    console.log('  Parse status:', amendment.parse_status)
    console.log('  Created:', amendment.created_at)
    console.log('\n  Section changes:', amendment.section_changes.length)
    amendment.section_changes.forEach((s) => {
      const ch = s.chapter ? `${s.chapter} kap. ` : ''
      console.log(`    - ${ch}${s.section} § (${s.change_type})`)
    })

    // Show amendment PDF content preview
    console.log('\n  Amendment PDF content (preview):')
    console.log('  ' + '-'.repeat(50))
    const preview = amendment.full_text
      ?.substring(0, 1500)
      .replace(/\n/g, '\n  ')
    console.log('  ' + preview)
    console.log('  ' + '-'.repeat(50))
  } else {
    console.log(
      '  NOT FOUND - PDF not yet ingested from svenskforfattningssamling.se'
    )
  }

  // Also check if base law exists in legalDocument
  if (amendment?.base_law_sfs) {
    const baseLaw = await prisma.legalDocument.findUnique({
      where: { document_number: amendment.base_law_sfs },
      select: { id: true, document_number: true, title: true, metadata: true },
    })
    console.log('\n  Base law in legalDocument:', baseLaw ? 'YES' : 'NO')
    if (baseLaw) {
      const meta = baseLaw.metadata as { latestAmendment?: string } | null
      console.log('    Latest amendment:', meta?.latestAmendment)

      // Check versions for diff capability
      const versions = await prisma.documentVersion.findMany({
        where: { document_id: baseLaw.id },
        orderBy: { version_number: 'asc' },
        select: {
          version_number: true,
          amendment_sfs: true,
          created_at: true,
          full_text: true,
        },
      })

      console.log('\n  Document versions:', versions.length)
      for (const v of versions) {
        const date = v.created_at.toISOString().split('T')[0]
        console.log(
          `    v${v.version_number}: ${v.amendment_sfs || 'initial'} (${date}) - ${v.full_text?.length || 0} chars`
        )
      }

      // Show diff potential
      if (versions.length >= 2) {
        const oldV = versions[versions.length - 2]
        const newV = versions[versions.length - 1]
        console.log('\n  DIFF AVAILABLE:')
        console.log(
          `    Old: v${oldV.version_number} (${oldV.full_text?.length} chars)`
        )
        console.log(
          `    New: v${newV.version_number} (${newV.full_text?.length} chars)`
        )

        // Simple diff: find lines that changed
        const oldLines = oldV.full_text?.split('\n') || []
        const newLines = newV.full_text?.split('\n') || []
        const addedLines = newLines.filter((l) => !oldLines.includes(l)).length
        const removedLines = oldLines.filter(
          (l) => !newLines.includes(l)
        ).length
        console.log(`    Changes: +${addedLines} lines, -${removedLines} lines`)
      }
    }
  }

  await prisma.$disconnect()
}

main()
