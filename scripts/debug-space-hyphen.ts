import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Check 3 kap 6 § for SFS 2008:934
  const section = await prisma.sectionChange.findFirst({
    where: {
      amendment: { sfs_number: 'SFS 2008:934' },
      chapter: '3',
      section: '6',
    },
    select: { new_text: true },
  })

  console.log('=== SFS 2008:934 - 3 kap. 6 § ===')

  if (section?.new_text) {
    // Find 'arbets-' pattern
    const patterns = ['arbets-', 'projekte-', 'anlägg-']

    for (const p of patterns) {
      const idx = section.new_text.indexOf(p)
      if (idx >= 0) {
        const context = section.new_text.substring(idx, idx + 25)
        console.log(`\nPattern "${p}":`)
        console.log('Context:', JSON.stringify(context))
        console.log('Char codes:')
        for (let i = 0; i < Math.min(context.length, 20); i++) {
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

    // Count different hyphen patterns
    const hyphenNewline = (
      section.new_text.match(/[a-zåäö]+-\n[a-zåäö]/gi) || []
    ).length
    const hyphenSpace = (section.new_text.match(/[a-zåäö]+- [a-zåäö]/gi) || [])
      .length
    const hyphenDirect = (section.new_text.match(/[a-zåäö]+-[a-zåäö]/gi) || [])
      .length

    console.log('\n=== Pattern counts ===')
    console.log('hyphen+newline:', hyphenNewline)
    console.log('hyphen+space:', hyphenSpace)
    console.log('hyphen+letter (direct):', hyphenDirect)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
