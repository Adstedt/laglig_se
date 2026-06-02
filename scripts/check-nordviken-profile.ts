/* eslint-disable no-console */
/**
 * Read-only — prints the test workspace's identity fields (workspace row +
 * CompanyProfile). Used to diagnose workspace-rename drift: when
 * `workspace.name` and `CompanyProfile.company_name` disagree, the agent
 * generates content with the wrong company name (see
 * `fix-nordviken-identity.ts` for the one-shot data fix).
 *
 * Resolves the workspace via the test user's email (alexander+111 by default)
 * — identity-agnostic, so renames don't break this script.
 *
 * Usage:
 *   pnpm tsx scripts/check-nordviken-profile.ts                # default email
 *   pnpm tsx scripts/check-nordviken-profile.ts --email <e>
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
    select: {
      id: true,
      name: true,
      slug: true,
      org_number: true,
      company_legal_name: true,
      company_profile: true,
    },
  })
  if (!ws) {
    console.log('not found')
    return
  }

  console.log('=== Workspace row ===')
  console.log(
    JSON.stringify(
      {
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        org_number: ws.org_number,
        company_legal_name: ws.company_legal_name,
      },
      null,
      2
    )
  )
  console.log('\n=== CompanyProfile ===')
  if (!ws.company_profile) {
    console.log('(none)')
    return
  }
  console.log(JSON.stringify(ws.company_profile, null, 2))

  // Drift detector — flags the bug that motivated this script.
  if (ws.company_profile.company_name !== ws.name) {
    console.warn(
      `\n⚠ workspace.name="${ws.name}" ≠ CompanyProfile.company_name="${ws.company_profile.company_name}"\n` +
        `  The agent will generate drafts with the CompanyProfile name. Run\n` +
        `  scripts/fix-nordviken-identity.ts (or equivalent) to sync.`
    )
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
