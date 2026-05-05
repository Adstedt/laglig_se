/* eslint-disable no-console */
/**
 * Step H test setup: backdate Almåsa's period_started_at to 36 days ago
 * so the safety cron's "stale" filter (35-day threshold) catches it.
 * Logs original values for revert.
 */
import { prisma } from '../lib/prisma'

async function main() {
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
  })

  const thirtySixDaysAgo = new Date(Date.now() - 36 * 24 * 60 * 60 * 1000)

  await prisma.workspaceUsage.update({
    where: { workspace_id: ws.id },
    data: { period_started_at: thirtySixDaysAgo },
  })

  console.log(ws.name)
  console.log(
    `  period_started_at: ${before?.period_started_at.toISOString()} → ${thirtySixDaysAgo.toISOString()}`
  )
  console.log(
    `  tokens_used_this_period: ${before?.tokens_used_this_period.toString()} (unchanged for now)`
  )
  console.log(`\n→ Now run the safety cron. Counter should reset to 0.`)
  console.log(
    `\n  To revert period_started_at: pnpm tsx scripts/set-almasa-period.ts ${before?.period_started_at.toISOString()}`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
