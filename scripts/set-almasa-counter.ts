/* eslint-disable no-console */
/**
 * Step E test setup: bump Almåsa's tokens_used_this_period to 81% of Solo's
 * 3M cap (2,430,000) so the next chat turn triggers the soft-warn path.
 *
 * Logs the original value so we can revert with confidence.
 *
 * Usage:
 *   pnpm tsx scripts/set-almasa-counter.ts                # bump to 2_430_000
 *   pnpm tsx scripts/set-almasa-counter.ts <new_value>    # bump to <new_value>
 */
import { prisma } from '../lib/prisma'

async function main() {
  const arg = process.argv[2]
  const target = arg ? Number(arg) : 2_430_000

  const ws = await prisma.workspace.findFirst({
    where: { name: { contains: 'almåsa', mode: 'insensitive' } },
    select: { id: true, name: true },
  })
  if (!ws) {
    console.error('Almåsa workspace not found')
    process.exit(1)
  }

  const before = await prisma.workspaceUsage.findUnique({
    where: { workspace_id: ws.id },
    select: { tokens_used_this_period: true },
  })

  await prisma.workspaceUsage.update({
    where: { workspace_id: ws.id },
    data: { tokens_used_this_period: BigInt(target) },
  })

  const beforeNum = before ? Number(before.tokens_used_this_period) : 0
  console.log(`${ws.name}`)
  console.log(`  before: ${beforeNum.toLocaleString('en-US')}`)
  console.log(`  after:  ${target.toLocaleString('en-US')}`)
  const cap = 3_000_000
  console.log(`  → ${((target / cap) * 100).toFixed(1)}% of Solo's 3M cap`)
  if (target >= cap * 0.8 && target < cap * 2) {
    console.log(`  → SOFT-WARN territory (≥80% of included quota)`)
  } else if (target >= cap * 2) {
    console.log(`  → HARD-CAP territory (≥2× included quota)`)
  }
  console.log(
    `\n  To revert: pnpm tsx scripts/set-almasa-counter.ts ${beforeNum}`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
