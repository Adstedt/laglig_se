import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

async function main() {
  const { prisma } = await import('../lib/prisma')

  const events = await prisma.changeEvent.findMany({
    where: { change_type: 'AMENDMENT', diff_summary: { not: null } },
    orderBy: { detected_at: 'desc' },
    take: 20,
    select: {
      amendment_sfs: true,
      diff_summary: true,
      document: { select: { document_number: true } },
    },
  })

  console.log('Diff sizes for recent amendments:')
  for (const e of events) {
    const diffLen = e.diff_summary?.length ?? 0
    console.log(
      ' ',
      e.amendment_sfs,
      '→',
      e.document.document_number,
      '|',
      diffLen,
      'chars',
      '|',
      Math.round(diffLen / 4),
      'est. tokens'
    )
  }

  // Also check AmendmentDocument coverage
  const amendmentSfsList = events
    .map((e) => e.amendment_sfs)
    .filter(Boolean) as string[]
  const amdDocs = await prisma.amendmentDocument.findMany({
    where: { sfs_number: { in: amendmentSfsList } },
    select: { sfs_number: true },
  })
  console.log(
    '\nAmendmentDocument coverage:',
    amdDocs.length,
    '/',
    amendmentSfsList.length
  )
  if (amdDocs.length > 0) {
    for (const a of amdDocs) console.log('  Found:', a.sfs_number)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
