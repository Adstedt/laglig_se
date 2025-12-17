/**
 * Compare raw PDF text vs LLM-parsed section text
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const amendment = await prisma.amendmentDocument.findUnique({
    where: { sfs_number: 'SFS 2002:585' },
    include: { section_changes: true },
  })

  if (!amendment?.full_text) {
    console.log('No amendment found')
    return
  }

  console.log('='.repeat(70))
  console.log('RAW PDF TEXT (full_text field):')
  console.log('='.repeat(70))

  // Check for hyphen+newline in raw PDF
  const pdfHyphenNewline =
    amendment.full_text.match(/[a-zåäö]-\n[a-zåäö]/gi) || []
  console.log(`\nHyphen+newline patterns: ${pdfHyphenNewline.length}`)

  if (pdfHyphenNewline.length > 0) {
    console.log('\nExamples from PDF:')
    for (const m of pdfHyphenNewline.slice(0, 10)) {
      const idx = amendment.full_text.indexOf(m)
      const before = amendment.full_text.substring(Math.max(0, idx - 15), idx)
      const after = amendment.full_text.substring(idx, idx + 20)
      console.log(
        `  "...${before}[${m.replace('\n', '↵')}]${after.substring(m.length)}..."`
      )
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('LLM-PARSED SECTION TEXT (new_text field):')
  console.log('='.repeat(70))

  for (const change of amendment.section_changes) {
    if (!change.new_text) continue

    const sectionHyphen = change.new_text.match(/[a-zåäö]-[a-zåäö]/gi) || []
    const sectionHyphenNewline =
      change.new_text.match(/[a-zåäö]-\n[a-zåäö]/gi) || []

    console.log(`\n${change.chapter} kap. ${change.section} §:`)
    console.log(`  Hyphen patterns (mid-line): ${sectionHyphen.length}`)
    console.log(`  Hyphen+newline patterns: ${sectionHyphenNewline.length}`)

    if (sectionHyphen.length > 0) {
      console.log('  Examples:')
      for (const m of sectionHyphen.slice(0, 5)) {
        console.log(`    "${m}"`)
      }
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('CONCLUSION')
  console.log('='.repeat(70))
  console.log(`
The raw PDF has hyphen+newline patterns where words were split.
The LLM during parsing kept the hyphen but removed the newline,
turning "änd-\\nleda" into "änd-leda".

This means:
- In PDF: "änd-" at end of line, "leda" at start of next line
- After LLM parse: "änd-leda" (hyphen kept, newline removed)
- The hyphen is NOW mid-line but was originally a line-break artifact
`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
