import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

async function main() {
  const { prisma } = await import('../lib/prisma')
  const ce = await prisma.changeEvent.findFirst({
    where: { amendment_sfs: 'SFS 2026:214' },
    select: { diff_summary: true },
  })

  if (!ce?.diff_summary) {
    console.log('No diff found')
    return
  }

  const lines = ce.diff_summary.split('\n')
  console.log(`Total lines: ${lines.length}`)

  // Print lines 220 onwards
  console.log('\n=== Lines 210+ (end of diff) ===')
  lines.slice(210).forEach((line, i) => {
    console.log(`${210 + i}: ${line}`)
  })

  // Count @@ sections
  const sections = lines.filter((l) => l.startsWith('@@'))
  console.log(`\n=== Number of diff hunks: ${sections.length} ===`)
  sections.forEach((s, i) => console.log(`Hunk ${i + 1}: ${s}`))

  // Check for 8 kap. 7 in ANY form
  console.log('\n=== Any line containing "8 kap" ===')
  lines.forEach((line, i) => {
    if (
      line.includes('8 kap.') &&
      !line.includes('8 kap. 4 §') &&
      !line.includes('8 kap. 9 §') &&
      !line.includes('8 kap. 1 §') &&
      !line.includes('8 kap. 11 §')
    ) {
      console.log(`Line ${i}: ${line}`)
    }
  })
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
