/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function main() {
  const result = await prisma.amendmentDocument.groupBy({
    by: ['parse_status'],
    _count: true,
  })
  console.log('AmendmentDocument by status:')
  for (const r of result) {
    console.log(`  ${r.parse_status}: ${r._count}`)
  }
  await prisma.$disconnect()
}

main()
