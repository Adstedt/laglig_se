/* eslint-disable no-console */
/**
 * Bump the test workspace's `WorkspaceUsage.tokens_used_this_period` to a
 * target value (default 2,430,000 = 81% of Solo's 3M cap) so the next chat
 * turn triggers the soft-warn path. Logs the original value for revert.
 *
 * Resolves the workspace via the test user's email (alexander+111 by default)
 * — identity-agnostic, so renames don't break this script.
 *
 * Usage:
 *   pnpm tsx scripts/set-nordviken-counter.ts                 # bump to 2_430_000
 *   pnpm tsx scripts/set-nordviken-counter.ts <new_value>     # bump to <new_value>
 *   pnpm tsx scripts/set-nordviken-counter.ts --email <e> <v>
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })

// eslint-disable-next-line import/first
import { prisma } from '../lib/prisma'

const DEFAULT_EMAIL = 'alexander.adstedt+111@kontorab.se'

async function main() {
  const args = process.argv.slice(2)
  const emailIdx = args.indexOf('--email')
  const email =
    emailIdx !== -1 && args[emailIdx + 1] ? args[emailIdx + 1]! : DEFAULT_EMAIL
  const positional = args.filter(
    (a, i) => !a.startsWith('--') && args[i - 1] !== '--email'
  )
  const target = positional[0] ? Number(positional[0]) : 2_430_000

  const user = await prisma.user.findUnique({
    where: { email },
    select: { workspace_members: { select: { workspace_id: true }, take: 1 } },
  })
  const workspaceId = user?.workspace_members[0]?.workspace_id
  if (!workspaceId) {
    console.error(`No workspace for ${email}`)
    process.exit(1)
  }

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  })

  const before = await prisma.workspaceUsage.findUnique({
    where: { workspace_id: workspaceId },
    select: { tokens_used_this_period: true },
  })

  await prisma.workspaceUsage.update({
    where: { workspace_id: workspaceId },
    data: { tokens_used_this_period: BigInt(target) },
  })

  const beforeNum = before ? Number(before.tokens_used_this_period) : 0
  console.log(`${ws?.name} (${workspaceId})`)
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
    `\n  To revert: pnpm tsx scripts/set-nordviken-counter.ts ${beforeNum}`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
