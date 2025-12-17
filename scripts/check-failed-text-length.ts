/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function main() {
  const failed = await prisma.amendmentDocument.findMany({
    where: { parse_status: 'FAILED' },
    select: { sfs_number: true, title: true, full_text: true },
  })

  console.log('Failed amendments text lengths:\n')
  for (const f of failed) {
    const len = f.full_text?.length || 0
    console.log(`${f.sfs_number}: ${len.toLocaleString()} chars`)
    console.log(`  ${f.title?.substring(0, 70)}`)
  }

  await prisma.$disconnect()
}

main()
