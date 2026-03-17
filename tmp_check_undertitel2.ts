import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  // Check what the "empty" latestAmendment values actually are
  const samples = await p.legalDocument.findMany({
    where: {
      content_type: 'SFS_LAW',
      document_number: {
        in: ['SFS 2000:654', 'SFS 1980:872', 'SFS 2024:1274'],
      },
    },
    select: { document_number: true, metadata: true },
  })

  console.log('=== "Empty" latestAmendment values ===')
  for (const s of samples) {
    const meta = s.metadata as any
    console.log(
      `${s.document_number}: latestAmendment = ${JSON.stringify(meta?.latestAmendment)} (type: ${typeof meta?.latestAmendment})`
    )
  }

  // Reverse lookup: given a base law, find its amendments
  console.log(
    '\n=== Reverse lookup: Amendments for Arbetsmiljölagen (SFS 1977:1160) ==='
  )
  const amendments = await p.legalDocument.findMany({
    where: {
      content_type: 'SFS_AMENDMENT',
      metadata: { path: ['base_law_sfs'], equals: 'SFS 1977:1160' },
    },
    select: { document_number: true, title: true, markdown_content: true },
    orderBy: { document_number: 'desc' },
    take: 5,
  })
  console.log(`Found ${amendments.length} amendments (showing latest 5):`)
  for (const a of amendments) {
    console.log(
      `  ${a.document_number}: ${a.title} — markdown: ${a.markdown_content?.length ?? 0} chars`
    )
  }

  // Count total amendments for a few popular laws
  console.log('\n=== Amendment counts for major laws ===')
  for (const sfs of [
    'SFS 1977:1160',
    'SFS 2010:900',
    'SFS 1962:700',
    'SFS 2017:900',
  ]) {
    const count = await p.legalDocument.count({
      where: {
        content_type: 'SFS_AMENDMENT',
        metadata: { path: ['base_law_sfs'], equals: sfs },
      },
    })
    console.log(`  ${sfs}: ${count} amendments`)
  }

  await p.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
