/**
 * Dev-only: reset the Nordvik test workspace's law list so a fresh generation
 * run starts clean (the generator APPENDS to the default list, so re-running
 * without this stacks new items on top of the old ones).
 *
 * Empties items + groups of the default list and resets the generation status
 * flags so the dashboard shows the "generate" prompt again.
 *
 *   npx tsx scripts/reset-school-law-list.ts
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })

import { prisma } from '@/lib/prisma'

const SLUG = 'nordvik-utbildning-skoltest'

async function main() {
  const ws = await prisma.workspace.findUnique({
    where: { slug: SLUG },
    select: { id: true, name: true },
  })
  if (!ws) throw new Error(`Workspace not found for slug "${SLUG}"`)

  const lists = await prisma.lawList.findMany({
    where: { workspace_id: ws.id },
    select: {
      id: true,
      is_default: true,
      _count: { select: { items: true, groups: true } },
    },
  })
  const listIds = lists.map((l) => l.id)

  console.log(`Workspace: ${ws.name} (${ws.id})`)
  console.log(
    `Lists: ${lists.length}`,
    lists.map(
      (l) =>
        `${l.id}${l.is_default ? '*' : ''} items=${l._count.items} groups=${l._count.groups}`
    )
  )

  const delItems = await prisma.lawListItem.deleteMany({
    where: { law_list_id: { in: listIds } },
  })
  const delGroups = await prisma.lawListGroup.deleteMany({
    where: { law_list_id: { in: listIds } },
  })

  // Re-arm the first-run onboarding modal. getOnboardingState() opens it only
  // when ALL THREE guards hold (lib/onboarding/get-onboarding-state.ts):
  //   1. law_list_generation_status === null
  //   2. first_run_dismissed_at === null   (modal never dismissed)
  //   3. created_at within the last 24h    (fresh-window guard)
  // Bumping created_at is safe on this test seed workspace and is the only way
  // to satisfy guard #3 without a code change.
  await prisma.workspace.update({
    where: { id: ws.id },
    data: {
      law_list_generation_status: null,
      law_list_generation_error: null,
      law_list_generation_started_at: null,
      law_list_generation_progress: [],
      first_run_dismissed_at: null,
      tutorial_fab_dismissed_at: null,
      first_run_tabs_viewed: [],
      created_at: new Date(),
    },
  })

  console.log(`Deleted ${delItems.count} items, ${delGroups.count} groups.`)
  console.log(
    'Reset: status=null, first_run_dismissed_at=null, created_at=now → first-run modal re-armed.'
  )
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
