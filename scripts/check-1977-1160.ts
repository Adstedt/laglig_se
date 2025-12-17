/**
 * Check hyphenation in 1977:1160 amendments
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Checking SFS 1977:1160...')

  // Count section changes
  const count = await prisma.sectionChange.count({
    where: { amendment: { base_law_sfs: 'SFS 1977:1160' } },
  })
  console.log('Total section changes:', count)

  // Get amendments
  const amendments = await prisma.amendmentDocument.findMany({
    where: { base_law_sfs: 'SFS 1977:1160' },
    select: {
      id: true,
      sfs_number: true,
      effective_date: true,
      full_text: true,
      _count: { select: { section_changes: true } },
    },
    orderBy: { effective_date: 'desc' },
    take: 10,
  })

  console.log('\nRecent amendments:')
  for (const a of amendments) {
    console.log(
      `  ${a.sfs_number} (${a.effective_date?.toISOString().split('T')[0]}) - ${a._count.section_changes} changes`
    )

    if (a.full_text) {
      // Check for hyphen+newline patterns
      const hyphenNewline = a.full_text.match(/[a-zåäö]+-\n[a-zåäö]+/gi) || []
      if (hyphenNewline.length > 0) {
        console.log(
          `    -> ${hyphenNewline.length} hyphen+newline patterns in full_text`
        )
        console.log(
          `       Examples: ${hyphenNewline
            .slice(0, 3)
            .map((m) => '"' + m.replace('\n', '↵') + '"')
            .join(', ')}`
        )
      }
    }
  }

  // Check section changes with new_text
  console.log('\n\nLooking for hyphenation issues in section texts...')

  const changes = await prisma.sectionChange.findMany({
    where: {
      amendment: { base_law_sfs: 'SFS 1977:1160' },
      new_text: { not: null },
    },
    select: {
      chapter: true,
      section: true,
      new_text: true,
      amendment: { select: { sfs_number: true } },
    },
    take: 50,
  })

  let issuesFound = 0
  for (const c of changes) {
    if (!c.new_text) continue

    // Look for hyphen followed by space and letter (indicates broken word displayed as "word- rest")
    const hyphenSpace = c.new_text.match(/[a-zåäö]- [a-zåäö]/gi) || []

    // Also check for hyphen directly followed by letter (no space/newline)
    const _hyphenDirect = c.new_text.match(/[a-zåäö]+-[a-zåäö]+/gi) || []

    if (hyphenSpace.length > 0) {
      console.log(
        `\n${c.amendment.sfs_number} - ${c.chapter} kap. ${c.section} §:`
      )
      console.log(
        `  Hyphen+space patterns: ${hyphenSpace.slice(0, 5).join(', ')}`
      )
      issuesFound++
    }
  }

  if (issuesFound === 0) {
    console.log('No "hyphen+space" patterns found in new_text')
    console.log('\nLet me check raw character patterns...')

    // Sample one change and show detailed character info
    const sample = changes[0]
    if (sample?.new_text) {
      console.log(
        `\nSample from ${sample.amendment.sfs_number} - ${sample.chapter} kap. ${sample.section} §`
      )

      // Find any hyphen
      const hyphenIdx = sample.new_text.indexOf('-')
      if (hyphenIdx >= 0) {
        const context = sample.new_text.substring(
          Math.max(0, hyphenIdx - 10),
          hyphenIdx + 15
        )
        console.log('Context around first hyphen:', JSON.stringify(context))
        console.log('Character codes:')
        for (let i = 0; i < context.length; i++) {
          const code = context.charCodeAt(i)
          const name =
            code === 10
              ? 'LF'
              : code === 13
                ? 'CR'
                : code === 32
                  ? 'SPC'
                  : context[i]
          console.log(`  [${i}] "${name}" = ${code}`)
        }
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
