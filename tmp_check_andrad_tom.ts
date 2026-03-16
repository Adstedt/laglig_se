import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  // Check a few SFS_LAW docs for "ändrad" metadata
  const laws = await p.legalDocument.findMany({
    where: {
      content_type: 'SFS_LAW',
      document_number: {
        in: [
          'SFS 1977:1160', // Arbetsmiljölagen
          'SFS 2010:900', // Plan- och bygglagen
          'SFS 1999:406', // the one amended by 1999:324
        ],
      },
    },
    select: {
      document_number: true,
      title: true,
      metadata: true,
      html_content: true,
      updated_at: true,
    },
  })

  for (const law of laws) {
    console.log(`\n=== ${law.document_number} ===`)
    console.log(`Title: ${law.title}`)
    console.log(`Updated: ${law.updated_at}`)
    console.log(`Metadata: ${JSON.stringify(law.metadata, null, 2)}`)

    // Check HTML for "ändrad" text
    const html = law.html_content ?? ''
    const andradMatch = html.match(/ändrad[^<]{0,100}/i)
    if (andradMatch) console.log(`HTML "ändrad" match: ${andradMatch[0]}`)

    const tomMatch = html.match(/t\.o\.m\.[^<]{0,50}/i)
    if (tomMatch) console.log(`HTML "t.o.m." match: ${tomMatch[0]}`)
  }

  // Also check: do recent 2026 amendments have corresponding law updates?
  console.log('\n\n=== Recent 2026 amendment → law update check ===')
  const amendments = await p.legalDocument.findMany({
    where: {
      content_type: 'SFS_AMENDMENT',
      document_number: { startsWith: 'SFS 2026:' },
    },
    select: { document_number: true, title: true, metadata: true },
    take: 5,
    orderBy: { document_number: 'desc' },
  })

  for (const a of amendments) {
    const meta = a.metadata as any
    console.log(`\n${a.document_number}: ${a.title}`)
    console.log(`  metadata: ${JSON.stringify(meta, null, 2)}`)
  }

  await p.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
