/* eslint-disable no-console */
/**
 * SURGICAL clean-slate wipe for the the test workspace. Deletes only
 * law-list-coupled data and onboarding telemetry, in a single transaction.
 *
 * Preserved (NOT touched):
 *   - workspace row + workspace_members (your access stays)
 *   - company_profiles (LLM generation input)
 *   - workspace_usage, notification_preferences (user prefs / billing)
 *   - activity_logs, chat_messages, chat_usage_events, notifications
 *   - workspace_documents, workspace_files, workspace_invitations
 *
 * Deleted:
 *   - law_lists  (+ cascades to law_list_items, law_list_groups)
 *   - law_list_imports
 *   - tasks (+ task_columns)
 *   - change_assessments
 *   - compliance_audit_cycles
 *   - onboarding_events
 *
 * Also resets workspace onboarding columns (first_run_dismissed_at,
 * law_list_generation_status etc.) so the first-run modal re-opens.
 *
 * Usage:
 *   pnpm tsx scripts/wipe-nordviken-surgical.ts            # dry-run (prints what WOULD delete)
 *   pnpm tsx scripts/wipe-nordviken-surgical.ts --confirm  # actually run
 *   pnpm tsx scripts/wipe-nordviken-surgical.ts --confirm --email <e>
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })

// eslint-disable-next-line import/first
import { prisma } from '../lib/prisma'

const DEFAULT_EMAIL = 'alexander.adstedt+111@kontorab.se'

async function countAll(workspaceId: string) {
  const [
    lawLists,
    lawListItems,
    lawListGroups,
    lawListImports,
    tasks,
    taskColumns,
    changeAssessments,
    complianceAuditCycles,
    onboardingEvents,
  ] = await Promise.all([
    prisma.lawList.count({ where: { workspace_id: workspaceId } }),
    prisma.lawListItem.count({
      where: { law_list: { workspace_id: workspaceId } },
    }),
    prisma.lawListGroup.count({
      where: { law_list: { workspace_id: workspaceId } },
    }),
    prisma.lawListImport.count({ where: { workspace_id: workspaceId } }),
    prisma.task.count({ where: { workspace_id: workspaceId } }),
    prisma.taskColumn.count({ where: { workspace_id: workspaceId } }),
    prisma.changeAssessment.count({ where: { workspace_id: workspaceId } }),
    prisma.complianceAuditCycle.count({ where: { workspace_id: workspaceId } }),
    prisma.onboardingEvent.count({ where: { workspace_id: workspaceId } }),
  ])
  return {
    lawLists,
    lawListItems,
    lawListGroups,
    lawListImports,
    tasks,
    taskColumns,
    changeAssessments,
    complianceAuditCycles,
    onboardingEvents,
  }
}

function printCounts(label: string, c: Record<string, number>) {
  console.log(`\n${label}:`)
  for (const [k, v] of Object.entries(c)) {
    console.log(`  ${k.padEnd(24)} ${v}`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const confirm = args.includes('--confirm')
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
    select: { name: true, id: true },
  })
  console.log(`Target: ${ws?.name} (${ws?.id})`)

  const before = await countAll(workspaceId)
  printCounts('BEFORE', before)
  const total = Object.values(before).reduce((s, n) => s + n, 0)
  console.log(`\n  Total rows to delete: ${total}`)

  if (!confirm) {
    console.log('\nDRY RUN — pass --confirm to actually delete.')
    await prisma.$disconnect()
    return
  }

  console.log('\nRunning surgical wipe in transaction...')
  await prisma.$transaction(
    async (tx) => {
      // Delete children before parents to avoid FK constraint violations
      // even if cascades aren't set on every edge of the schema.

      // 1. Compliance audit cycles (may reference law list items)
      await tx.complianceAuditCycle.deleteMany({
        where: { workspace_id: workspaceId },
      })

      // 2. Change assessments (reference law list items)
      await tx.changeAssessment.deleteMany({
        where: { workspace_id: workspaceId },
      })

      // 3. Tasks (may reference law list items)
      await tx.task.deleteMany({ where: { workspace_id: workspaceId } })
      await tx.taskColumn.deleteMany({ where: { workspace_id: workspaceId } })

      // 4. Law list imports
      await tx.lawListImport.deleteMany({
        where: { workspace_id: workspaceId },
      })

      // 5. Law list items + groups (children of law_lists) — explicit delete
      //    so we don't rely on schema cascade rules being set everywhere.
      await tx.lawListItem.deleteMany({
        where: { law_list: { workspace_id: workspaceId } },
      })
      await tx.lawListGroup.deleteMany({
        where: { law_list: { workspace_id: workspaceId } },
      })

      // 6. Law lists themselves
      await tx.lawList.deleteMany({ where: { workspace_id: workspaceId } })

      // 7. Onboarding events (B.2 telemetry slate clean)
      await tx.onboardingEvent.deleteMany({
        where: { workspace_id: workspaceId },
      })

      // 8. Reset workspace columns so the first-run modal re-opens cleanly
      await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          first_run_dismissed_at: null,
          first_run_tabs_viewed: [],
          tutorial_fab_dismissed_at: null,
          law_list_generation_status: null,
          law_list_generation_error: null,
          law_list_generation_progress: null,
        },
      })
    },
    { timeout: 30_000 }
  )

  const after = await countAll(workspaceId)
  printCounts('AFTER', after)

  const remaining = Object.values(after).reduce((s, n) => s + n, 0)
  if (remaining === 0) {
    console.log(
      '\n✓ Clean slate. Reload /dashboard — modal will re-open at path-choice.'
    )
  } else {
    console.log(`\n⚠ ${remaining} rows remain — investigate.`)
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
