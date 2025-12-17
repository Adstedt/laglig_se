/**
 * Debug: Find where the hyphenated text in diffs is coming from
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(70))
  console.log('Checking sources of text for 7 kap. 6 § of SFS 1977:1160')
  console.log('='.repeat(70))

  // 1. Check base law section
  console.log('\n1. BASE LAW (LawSection table):')
  const baseSection = await prisma.lawSection.findFirst({
    where: {
      legal_document: { document_number: 'SFS 1977:1160' },
      chapter: '7',
      section: '6',
    },
    select: { text_content: true },
  })

  if (baseSection) {
    console.log('   Text length:', baseSection.text_content.length)
    console.log(
      '   First 200 chars:',
      JSON.stringify(baseSection.text_content.substring(0, 200))
    )

    // Check for patterns from screenshot
    const wordsToCheck = [
      'arbetsmiljöfrågor',
      'arbetsmiljö-',
      'verksamhet',
      'verk-',
      'arbetsstället',
      'arbets-',
    ]
    for (const word of wordsToCheck) {
      if (baseSection.text_content.includes(word)) {
        const idx = baseSection.text_content.indexOf(word)
        const context = baseSection.text_content.substring(
          Math.max(0, idx - 5),
          idx + word.length + 10
        )
        console.log(`   Contains "${word}": "${context}"`)
      }
    }
  } else {
    console.log('   NOT FOUND')
  }

  // 2. Check section changes for this section
  console.log('\n2. AMENDMENT CHANGES (SectionChange table):')
  const changes = await prisma.sectionChange.findMany({
    where: {
      amendment: { base_law_sfs: 'SFS 1977:1160' },
      chapter: '7',
      section: '6',
    },
    select: {
      new_text: true,
      change_type: true,
      amendment: { select: { sfs_number: true, effective_date: true } },
    },
    orderBy: { amendment: { effective_date: 'asc' } },
  })

  console.log(`   Found ${changes.length} changes to this section`)

  for (const c of changes) {
    console.log(
      `\n   ${c.amendment.sfs_number} (${c.amendment.effective_date?.toISOString().split('T')[0] || 'no date'}):`
    )
    console.log(`   Change type: ${c.change_type}`)

    if (c.new_text) {
      console.log(`   Text length: ${c.new_text.length}`)

      // Check for hyphenated patterns
      const wordsToCheck = [
        'arbetsmiljöfrågor',
        'arbetsmiljö-',
        'verk-',
        'arbets-',
      ]
      for (const word of wordsToCheck) {
        if (c.new_text.includes(word)) {
          const idx = c.new_text.indexOf(word)
          const context = c.new_text.substring(
            Math.max(0, idx - 5),
            idx + word.length + 15
          )
          console.log(`   Contains "${word}": "${context.replace(/\n/g, '↵')}"`)
        }
      }

      // Check for any hyphen patterns
      const hyphenPatterns = c.new_text.match(/[a-zåäö]+-\s?[a-zåäö]+/gi) || []
      if (hyphenPatterns.length > 0) {
        console.log(
          `   Hyphen patterns: ${hyphenPatterns.slice(0, 5).join(', ')}`
        )
      }
    } else {
      console.log('   (no new_text)')
    }
  }

  // 3. Also check the full amendment document text
  console.log('\n\n3. FULL AMENDMENT TEXT (AmendmentDocument.full_text):')
  const amendments = await prisma.amendmentDocument.findMany({
    where: {
      base_law_sfs: 'SFS 1977:1160',
      section_changes: { some: { chapter: '7', section: '6' } },
    },
    select: { sfs_number: true, full_text: true },
  })

  for (const a of amendments) {
    console.log(`\n   ${a.sfs_number}:`)
    if (a.full_text) {
      // Check for hyphen+newline
      const hyphenNewline = a.full_text.match(/[a-zåäö]+-\n[a-zåäö]+/gi) || []
      console.log(`   Hyphen+newline patterns: ${hyphenNewline.length}`)
      if (hyphenNewline.length > 0) {
        console.log(
          `   Examples: ${hyphenNewline
            .slice(0, 5)
            .map((m) => m.replace('\n', '↵'))
            .join(', ')}`
        )
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
