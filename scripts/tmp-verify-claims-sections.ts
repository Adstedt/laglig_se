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

  // Search for 11 kap references
  const lines = ce.diff_summary.split('\n')
  console.log('=== Lines mentioning "11 kap" ===')
  lines.forEach((line, i) => {
    if (line.includes('11 kap')) {
      console.log(`Line ${i}: ${line}`)
    }
  })

  console.log('\n=== Lines mentioning "8 kap. 7" ===')
  lines.forEach((line, i) => {
    if (line.includes('8 kap. 7')) {
      console.log(`Line ${i}: ${line}`)
    }
  })

  console.log('\n=== Lines mentioning "samverkan" ===')
  lines.forEach((line, i) => {
    if (
      line.toLowerCase().includes('samverkan') &&
      (line.startsWith('+') || line.startsWith('-'))
    ) {
      console.log(`Line ${i}: ${line}`)
    }
  })

  console.log('\n=== Last 30 lines of diff ===')
  console.log(lines.slice(-30).join('\n'))

  console.log('\n=== All chapter headers ===')
  lines.forEach((line, i) => {
    if (
      line.match(/^\+?\d+ kap\./) ||
      line.match(/^[-+]?\s*\d+ kap\./) ||
      line.includes(' kap. ')
    ) {
      if (
        line.includes('kap.') &&
        (line.includes('Samverkan') ||
          line.includes('Organisation') ||
          line.includes('planering'))
      ) {
        console.log(`Line ${i}: ${line}`)
      }
    }
  })
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
