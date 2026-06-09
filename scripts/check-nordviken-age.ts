/* eslint-disable no-console */
/**
 * Read-only — prints the test workspace's age in hours and whether it falls
 * inside the ≤24h "fresh" guard used by the first-run onboarding modal.
 *
 * Resolves the workspace via the test user's email (alexander+111 by default)
 * — identity-agnostic, so renames don't break this script.
 *
 * Usage:
 *   pnpm tsx scripts/check-nordviken-age.ts                # default email
 *   pnpm tsx scripts/check-nordviken-age.ts --email <e>
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
    select: { id: true, name: true, created_at: true },
  })
  if (!ws) {
    console.log('not found')
    return
  }
  const ageMs = Date.now() - ws.created_at.getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  console.log(
    JSON.stringify(
      {
        name: ws.name,
        id: ws.id,
        created_at: ws.created_at.toISOString(),
        age_hours: ageHours.toFixed(1),
        fresh_24h: ageHours <= 24,
      },
      null,
      2
    )
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
