/**
 * Dev helper (Story 19.7c smoke): surface an un-assessed change so the
 * change-assessment chat can be opened.
 *
 *   npx tsx scripts/surface-test-change.ts                      # diagnose (READ-ONLY)
 *   npx tsx scripts/surface-test-change.ts --ws nordvik         # diagnose one workspace
 *   npx tsx scripts/surface-test-change.ts --surface --ws nordvik  # reveal one (non-destructive)
 *   npx tsx scripts/surface-test-change.ts --surface --count 6 --ws nordvik  # reveal up to 6 distinct items
 *
 * A change shows on the dashboard as "unassessed" when it has NO ChangeAssessment
 * AND the law-list item's last_change_acknowledged_at is null/older than the
 * change (mirrors loadUnacknowledgedChanges in app/actions/change-events.ts).
 *
 * `--surface` picks an un-assessed change that's currently hidden only by the
 * acknowledgment timestamp and sets that item's last_change_acknowledged_at = NULL.
 * Reversible (re-acknowledge in the UI). It NEVER deletes a ChangeAssessment.
 * `--ws <substring>` scopes both the report and --surface to matching workspaces.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type Row = {
  workspace_name: string
  document_number: string
  change_type: string
  amendment_sfs: string | null
  detected_at: Date
  item_id: string
  has_assessment: boolean
  visible_now: boolean
}

async function main() {
  const surface = process.argv.includes('--surface')
  const wsIdx = process.argv.indexOf('--ws')
  const wsFilter =
    wsIdx >= 0 ? (process.argv[wsIdx + 1] ?? '').toLowerCase() : null
  const countIdx = process.argv.indexOf('--count')
  const count =
    countIdx >= 0
      ? Math.max(1, parseInt(process.argv[countIdx + 1] ?? '1', 10) || 1)
      : 1

  const all = await prisma.$queryRaw<Row[]>`
    SELECT
      ws.name                          AS workspace_name,
      ld.document_number,
      ce.change_type::text             AS change_type,
      ce.amendment_sfs,
      ce.detected_at,
      lli.id                           AS item_id,
      (ca.id IS NOT NULL)              AS has_assessment,
      (ca.id IS NULL AND (lli.last_change_acknowledged_at IS NULL
                          OR ce.detected_at > lli.last_change_acknowledged_at)) AS visible_now
    FROM change_events ce
    JOIN legal_documents ld   ON ld.id = ce.document_id
    JOIN law_list_items lli   ON lli.document_id = ce.document_id
    JOIN law_lists ll         ON ll.id = lli.law_list_id
    JOIN workspaces ws        ON ws.id = ll.workspace_id
    LEFT JOIN change_assessments ca
      ON ca.change_event_id = ce.id AND ca.law_list_item_id = lli.id
    WHERE NOT (ce.change_type = 'NEW_LAW' AND ce.amendment_sfs IS NULL)
    ORDER BY ws.name, ce.detected_at DESC
  `

  const rows = wsFilter
    ? all.filter((r) => r.workspace_name.toLowerCase().includes(wsFilter))
    : all

  if (rows.length === 0) {
    console.log(
      wsFilter
        ? `No change events on watched laws for workspaces matching "${wsFilter}".`
        : 'No change events on any watched law in any workspace. Ask Claude for a seeder.'
    )
    return
  }

  for (const r of rows) {
    const state = r.visible_now
      ? 'VISIBLE (unassessed)'
      : r.has_assessment
        ? 'assessed'
        : 'acknowledged — hidden by timestamp (surfaceable)'
    console.log(
      `[${r.workspace_name}] ${r.document_number} | ${r.change_type} ${r.amendment_sfs ?? ''} | ${state}`
    )
  }

  const visible = rows.filter((r) => r.visible_now)
  const surfaceable = rows.filter((r) => !r.has_assessment && !r.visible_now)
  const scope = wsFilter ? `matching "${wsFilter}"` : 'across all workspaces'

  if (!surface) {
    console.log(
      `\n${visible.length} already VISIBLE as unassessed; ${surfaceable.length} surfaceable (${scope}).`
    )
    if (visible.length > 0)
      console.log(
        `→ Open the "${visible[0]!.workspace_name}" dashboard and click the unassessed change.`
      )
    else if (surfaceable.length > 0)
      console.log('→ Re-run with --surface to reveal one.')
    else
      console.log(
        '→ Every change is already assessed. Ask Claude for a seeder or a (destructive) assessment-reset.'
      )
    return
  }

  // Pick up to `count` DISTINCT law-list items among the surfaceable changes.
  // Nulling an item's floor reveals every hidden change on that item, so distinct
  // items give the most variety to test against.
  const picks: Row[] = []
  const seenItems = new Set<string>()
  for (const r of surfaceable) {
    if (seenItems.has(r.item_id)) continue
    seenItems.add(r.item_id)
    picks.push(r)
    if (picks.length >= count) break
  }
  if (picks.length === 0) {
    console.log(
      '\nNo surfaceable (un-assessed) change found. Ask Claude for a seeder.'
    )
    return
  }
  for (const c of picks) {
    await prisma.$executeRaw`
      UPDATE law_list_items SET last_change_acknowledged_at = NULL WHERE id = ${c.item_id}
    `
    console.log(
      `✅ Surfaced ${c.document_number} (${c.change_type} ${c.amendment_sfs ?? ''}) in "${c.workspace_name}".`
    )
  }
  console.log(
    `\nSurfaced ${picks.length} item(s). Open that workspace → Laglistor → Ändringar; they now show as unassessed. (Reversible: acknowledge each again in the UI.)`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
