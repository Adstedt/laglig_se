/* eslint-disable no-console */
/**
 * Dev-only helper to PIN the Almåsa workspace in `law_list_generation_status =
 * 'in_progress'` with a hand-crafted progress payload, so the modal's
 * <ProgressStrip> renders indefinitely for visual inspection.
 *
 * Does NOT kick off a real LLM job. The /generation-status SWR poll will
 * read whatever the DB says and render the strip until status changes.
 *
 * Usage:
 *   pnpm tsx scripts/force-almasa-in-progress.ts                # default state
 *   pnpm tsx scripts/force-almasa-in-progress.ts --restore      # set status back to null
 *
 * Custom email:
 *   pnpm tsx scripts/force-almasa-in-progress.ts --email <e>
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'

loadEnv({ path: resolve(process.cwd(), '.env.local') })

// eslint-disable-next-line import/first
import { prisma } from '../lib/prisma'

const DEFAULT_EMAIL = 'alexander.adstedt+111@kontorab.se'

const FAKE_PROGRESS = [
  { label: 'Profil', status: 'done' },
  { label: 'Område-mapping', status: 'done' },
  { label: 'Matchar mot SFS-katalog', status: 'active' },
  { label: 'Kravpunkter', status: 'pending' },
  { label: 'Slutför', status: 'pending' },
]

async function main() {
  const args = process.argv.slice(2)
  const restore = args.includes('--restore')
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

  if (restore) {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        law_list_generation_status: null,
        law_list_generation_error: null,
        law_list_generation_progress: null,
        first_run_dismissed_at: null,
      },
    })
    console.log(`Restored: status=null on ${workspaceId}`)
  } else {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        law_list_generation_status: 'in_progress',
        law_list_generation_error: null,
        law_list_generation_progress: FAKE_PROGRESS,
        first_run_dismissed_at: null,
      },
    })
    console.log(`Pinned in_progress on ${workspaceId}.`)
    console.log('Active step: "Matchar mot SFS-katalog"')
    console.log('Steps: 5 total (2 done · 1 active · 2 pending)')
    console.log(
      `\nReload /dashboard, click Generera (it'll 409 immediately since\n` +
        `status=in_progress, and the path-choice-step's 409-as-success path\n` +
        `transitions to the tutorial step). Strip will render indefinitely.\n` +
        `Restore with: pnpm tsx scripts/force-almasa-in-progress.ts --restore`
    )
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
