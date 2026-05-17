/* eslint-disable no-console */
/**
 * Read-only — prints the current onboarding + generation status for Almåsa.
 * Use to diagnose why the modal's ProgressStrip might be hidden.
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'

loadEnv({ path: resolve(process.cwd(), '.env.local') })

// eslint-disable-next-line import/first
import { prisma } from '../lib/prisma'

const DEFAULT_EMAIL = 'alexander.adstedt+111@kontorab.se'

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: DEFAULT_EMAIL },
    select: { workspace_members: { select: { workspace_id: true }, take: 1 } },
  })
  const workspaceId = user?.workspace_members[0]?.workspace_id
  if (!workspaceId) {
    console.error('No workspace found')
    process.exit(1)
  }

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      name: true,
      id: true,
      first_run_dismissed_at: true,
      first_run_tabs_viewed: true,
      law_list_generation_status: true,
      law_list_generation_error: true,
      law_list_generation_progress: true,
      updated_at: true,
    },
  })

  console.log(JSON.stringify(ws, null, 2))

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
