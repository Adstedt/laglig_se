/* eslint-disable no-console */
/**
 * Dev-only helper to reset the first-run onboarding modal for the Almåsa
 * test workspace so the modal re-opens and the law-list generation flow
 * can be re-triggered.
 *
 * Clears:
 *   - workspace.first_run_dismissed_at        → null  (re-opens modal)
 *   - workspace.first_run_tabs_viewed         → []    (clears tutorial progress)
 *   - workspace.tutorial_fab_dismissed_at     → null  (re-shows future FAB)
 *   - workspace.law_list_generation_status    → null  (clears banner / unblocks Generera)
 *   - workspace.law_list_generation_error     → null
 *   - workspace.law_list_generation_progress  → null
 *   - OnboardingEvent rows for this workspace → deleted (fresh funnel data)
 *
 * Identifies workspace via the test user's email (same pattern as
 * scripts/toggle-failed-banner.ts).
 *
 * Usage:
 *   pnpm tsx scripts/reset-almasa-onboarding.ts                    # default email
 *   pnpm tsx scripts/reset-almasa-onboarding.ts --email <e>        # custom email
 *   pnpm tsx scripts/reset-almasa-onboarding.ts --keep-events      # keep telemetry rows
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'

// Load .env.local before importing prisma so DATABASE_URL is available.
loadEnv({ path: resolve(process.cwd(), '.env.local') })

// eslint-disable-next-line import/first
import { prisma } from '../lib/prisma'

const DEFAULT_EMAIL = 'alexander.adstedt+111@kontorab.se'

async function main() {
  const args = process.argv.slice(2)
  const emailIdx = args.indexOf('--email')
  const email =
    emailIdx !== -1 && args[emailIdx + 1] ? args[emailIdx + 1]! : DEFAULT_EMAIL
  const keepEvents = args.includes('--keep-events')

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      workspace_members: { select: { workspace_id: true }, take: 1 },
    },
  })
  if (!user) {
    console.error(`No user with email ${email}`)
    process.exit(1)
  }
  const workspaceId = user.workspace_members[0]?.workspace_id
  if (!workspaceId) {
    console.error(`User ${email} has no workspace membership`)
    process.exit(1)
  }

  const before = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      first_run_dismissed_at: true,
      first_run_tabs_viewed: true,
      tutorial_fab_dismissed_at: true,
      law_list_generation_status: true,
      law_list_generation_error: true,
    },
  })
  if (!before) {
    console.error(`No workspace ${workspaceId}`)
    process.exit(1)
  }

  console.log(`Workspace: ${before.name} (${before.id})`)
  console.log('Before reset:')
  console.log(
    `  first_run_dismissed_at:       ${before.first_run_dismissed_at ?? 'null'}`
  )
  console.log(
    `  first_run_tabs_viewed:        ${JSON.stringify(before.first_run_tabs_viewed)}`
  )
  console.log(
    `  tutorial_fab_dismissed_at:    ${before.tutorial_fab_dismissed_at ?? 'null'}`
  )
  console.log(
    `  law_list_generation_status:   ${before.law_list_generation_status ?? 'null'}`
  )
  console.log(
    `  law_list_generation_error:    ${before.law_list_generation_error ?? 'null'}\n`
  )

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      first_run_dismissed_at: null,
      first_run_tabs_viewed: [],
      tutorial_fab_dismissed_at: null,
      law_list_generation_status: null,
      law_list_generation_error: null,
      law_list_generation_progress: null,
      // Backdate created_at to "now" so the FRESH (≤24h) guard in
      // lib/onboarding/get-onboarding-state.ts passes. Without this, repeated
      // smoke tests over multiple days fail to re-open the first-run modal
      // even after clearing the dismissal flags. Dev-only helper — no
      // production impact.
      created_at: new Date(),
    },
  })

  let deletedEvents = 0
  if (!keepEvents) {
    const result = await prisma.onboardingEvent.deleteMany({
      where: { workspace_id: workspaceId },
    })
    deletedEvents = result.count
  }

  // Wipe the existing default LawList so re-running generation produces a
  // fresh list instead of appending. Without this, LLM variance across runs
  // (each run picks a slightly different set of laws) makes the count grow
  // every cycle (87 → 98 → 102). Cascade kills LawListItems via the schema's
  // onDelete: Cascade on LawListItem.law_list_id.
  const deletedLists = await prisma.lawList.deleteMany({
    where: { workspace_id: workspaceId, is_default: true },
  })

  console.log(`  Default LawList(s) wiped:     ${deletedLists.count}`)
  console.log('After reset:')
  console.log('  first_run_dismissed_at:       null')
  console.log('  first_run_tabs_viewed:        []')
  console.log('  tutorial_fab_dismissed_at:    null')
  console.log('  law_list_generation_status:   null')
  console.log('  law_list_generation_error:    null')
  console.log('  law_list_generation_progress: null')
  if (keepEvents) {
    console.log('  OnboardingEvent rows:         kept (--keep-events)\n')
  } else {
    console.log(`  OnboardingEvent rows:         ${deletedEvents} deleted\n`)
  }

  console.log('Reload /dashboard — the first-run modal should re-open.')

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
