import { prisma } from '../lib/prisma'

async function main() {
  // Look at the SFS numbers immediately around the gap to understand
  // whether the missing numbers should plausibly exist.
  const docs = await prisma.legalDocument.findMany({
    where: { document_number: { startsWith: 'SFS 2026:' } },
    select: {
      document_number: true,
      content_type: true,
      title: true,
      effective_date: true,
      publication_date: true,
    },
    orderBy: { document_number: 'asc' },
  })

  const targets = new Set([405, 406, 407, 408, 409, 440, 441, 442, 443])
  const adjacent = docs
    .map((d) => ({
      num: parseInt(d.document_number.replace('SFS 2026:', '')),
      ...d,
    }))
    .filter((d) => targets.has(d.num))
    .sort((a, b) => a.num - b.num)

  console.log('Documents adjacent to the gap (410-439, 441, 442):\n')
  for (const d of adjacent) {
    console.log(
      `  ${d.document_number.padEnd(12)} | ${d.content_type.padEnd(15)} | eff ${d.effective_date?.toISOString().slice(0, 10) ?? '—'} | ${d.title.slice(0, 60)}`
    )
  }

  await prisma.$disconnect()
}

main().catch(console.error)
