/* eslint-disable no-console */
/**
 * Dev-only helper to test the dashboard "Laglistan kunde inte skapas
 * automatiskt" banner. The GET /api/workspace/generation-status endpoint now
 * silently auto-recovers the banner whenever a default law list with items
 * exists, so forcing a 'failed' status alone is not enough — we also have to
 * make sure no default law list with items is found by the recovery query.
 *
 * Usage:
 *   pnpm tsx scripts/toggle-failed-banner.ts                    # force banner
 *   pnpm tsx scripts/toggle-failed-banner.ts --restore          # revert
 *   pnpm tsx scripts/toggle-failed-banner.ts --email <e>        # custom email
 *
 * Defaults to alexander.adstedt+111@kontorab.se (the local test account).
 *
 * Marker for which law list was flipped is stashed in
 * workspace.law_list_generation_progress (Json field, not user-visible) under
 * { __forcedBannerListId: <id> }.
 */
import { prisma } from '../lib/prisma'

const DEFAULT_EMAIL = 'alexander.adstedt+111@kontorab.se'
const FAKE_ERROR =
  'Genereringen tog för lång tid. Försök igen eller skapa listan manuellt.'

async function main() {
  const args = process.argv.slice(2)
  const restore = args.includes('--restore')
  const emailIdx = args.indexOf('--email')
  const email =
    emailIdx !== -1 && args[emailIdx + 1] ? args[emailIdx + 1]! : DEFAULT_EMAIL

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

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      law_list_generation_status: true,
      law_list_generation_error: true,
      law_list_generation_progress: true,
    },
  })
  if (!workspace) {
    console.error(`No workspace ${workspaceId}`)
    process.exit(1)
  }

  console.log(`Workspace: ${workspace.name} (${workspace.id})`)
  console.log(`  status: ${workspace.law_list_generation_status ?? 'null'}`)
  console.log(`  error:  ${workspace.law_list_generation_error ?? 'null'}\n`)

  const progress = (workspace.law_list_generation_progress ?? {}) as Record<
    string,
    unknown
  >
  const stashedId =
    typeof progress.__forcedBannerListId === 'string'
      ? progress.__forcedBannerListId
      : null

  if (restore) {
    if (!stashedId) {
      console.log(
        'No forced-banner marker found. Clearing status defensively, no list to flip back.'
      )
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          law_list_generation_status: null,
          law_list_generation_error: null,
          law_list_generation_progress: null,
        },
      })
      await prisma.$disconnect()
      return
    }

    await prisma.$transaction([
      prisma.lawList.update({
        where: { id: stashedId },
        data: { is_default: true },
      }),
      prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          law_list_generation_status: null,
          law_list_generation_error: null,
          law_list_generation_progress: null,
        },
      }),
    ])

    console.log(`Restored: lawList ${stashedId} is_default=true, status=null`)
  } else {
    if (stashedId) {
      console.log(
        `Already in forced state (stashed list id: ${stashedId}). Run with --restore first if you want to re-force.`
      )
      await prisma.$disconnect()
      return
    }

    const defaultList = await prisma.lawList.findFirst({
      where: { workspace_id: workspaceId, is_default: true },
      select: { id: true, name: true, _count: { select: { items: true } } },
    })

    if (!defaultList) {
      console.log(
        'No default law list found — banner will render with just status=failed.'
      )
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          law_list_generation_status: 'failed',
          law_list_generation_error: FAKE_ERROR,
        },
      })
      await prisma.$disconnect()
      return
    }

    console.log(
      `Default list: ${defaultList.name} (${defaultList.id}, ${defaultList._count.items} items)`
    )

    await prisma.$transaction([
      prisma.lawList.update({
        where: { id: defaultList.id },
        data: { is_default: false },
      }),
      prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          law_list_generation_status: 'failed',
          law_list_generation_error: FAKE_ERROR,
          law_list_generation_progress: {
            __forcedBannerListId: defaultList.id,
          },
        },
      }),
    ])

    console.log(
      '\nForced banner state set. Reload the dashboard — banner should appear.'
    )
    console.log(
      `To restore: pnpm tsx scripts/toggle-failed-banner.ts${
        email !== DEFAULT_EMAIL ? ` --email ${email}` : ''
      } --restore`
    )
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
