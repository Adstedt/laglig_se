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

  console.log('=== FULL DIFF ===')
  console.log(ce.diff_summary)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
