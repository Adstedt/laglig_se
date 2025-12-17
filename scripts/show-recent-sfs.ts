/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function main() {
  const docs = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_LAW', document_number: { startsWith: 'SFS ' } },
    select: { document_number: true, created_at: true },
    orderBy: { created_at: 'desc' },
    take: 300,
  })

  console.log('Last 300 SFS_LAW by created_at (when added to our DB):\n')

  let page = 1
  for (let i = 0; i < docs.length; i++) {
    if (i % 100 === 0) {
      console.log(
        `--- Page ${page} (${i + 1}-${Math.min(i + 100, docs.length)}) ---`
      )
      page++
    }
    const d = docs[i]
    const created = d.created_at?.toISOString().split('T')[0] || 'unknown'
    console.log(`${d.document_number.padEnd(20)} (added: ${created})`)
  }

  await prisma.$disconnect()
}

main()
