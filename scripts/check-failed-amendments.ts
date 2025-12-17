/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function main() {
  const failed = await prisma.amendmentDocument.findMany({
    where: { parse_status: 'FAILED' },
    select: { sfs_number: true, title: true, parse_error: true },
    orderBy: { sfs_number: 'asc' },
  })

  console.log(`Total failed: ${failed.length}\n`)

  // Group by error type
  const byError = new Map<string, string[]>()
  for (const f of failed) {
    const errType = f.parse_error?.substring(0, 60) || 'no error'
    if (!byError.has(errType)) byError.set(errType, [])
    byError.get(errType)!.push(f.sfs_number)
  }

  console.log('Grouped by error type:\n')
  for (const [err, sfsList] of byError) {
    console.log(`${err}... (${sfsList.length} docs)`)
    console.log(`  Examples: ${sfsList.slice(0, 5).join(', ')}`)
    console.log('')
  }

  await prisma.$disconnect()
}

main()
