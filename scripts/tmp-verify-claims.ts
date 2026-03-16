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

  // Extract only the + and - lines (actual changes)
  const lines = ce.diff_summary.split('\n')
  const changes = lines
    .filter((l) => l.startsWith('+') || l.startsWith('-') || l.startsWith('@@'))
    .filter((l) => !l.startsWith('---') && !l.startsWith('+++'))

  console.log('=== ACTUAL CHANGES IN DIFF ===')
  console.log(changes.join('\n'))
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
