/**
 * Story 8.21: Cleanup duplicate ChangeEvent rows
 *
 * Identifies duplicate (document_id, amendment_sfs) groups and keeps
 * the richest row per group (longest diff_summary, then has previous_version_id,
 * then earliest detected_at). Reassigns any ChangeAssessments before deleting.
 *
 * SAFETY:
 * - Only touches rows where amendment_sfs IS NOT NULL
 * - Reassigns ChangeAssessment FKs before deleting (onDelete: Cascade protection)
 * - Idempotent — running twice produces no changes on the second run
 *
 * Usage: npx tsx scripts/cleanup-duplicate-change-events.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface DuplicateGroup {
  document_id: string
  amendment_sfs: string
  count: number
}

interface EventRow {
  id: string
  diff_len: number
  has_prev_version: boolean
  detected_at: Date
}

async function main() {
  console.log('[CLEANUP] Finding duplicate ChangeEvent groups...\n')

  // Step 1: Find all duplicate groups
  const dupeGroups: DuplicateGroup[] = await prisma.$queryRaw`
    SELECT
      ce.document_id,
      ce.amendment_sfs,
      COUNT(*)::int as count
    FROM change_events ce
    WHERE ce.amendment_sfs IS NOT NULL
    GROUP BY ce.document_id, ce.amendment_sfs
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `

  if (dupeGroups.length === 0) {
    console.log('[CLEANUP] No duplicate groups found. Nothing to do.')
    await prisma.$disconnect()
    return
  }

  console.log(`[CLEANUP] Found ${dupeGroups.length} duplicate groups\n`)

  let totalDeleted = 0
  let totalKept = 0
  let totalAssessmentsReassigned = 0

  for (const group of dupeGroups) {
    // Step 2: Get all rows in this group, ranked by richness
    const rows: EventRow[] = await prisma.$queryRaw`
      SELECT
        ce.id,
        COALESCE(LENGTH(ce.diff_summary), 0)::int as diff_len,
        (ce.previous_version_id IS NOT NULL) as has_prev_version,
        ce.detected_at
      FROM change_events ce
      WHERE ce.document_id = ${group.document_id}
        AND ce.amendment_sfs = ${group.amendment_sfs}
      ORDER BY
        COALESCE(LENGTH(ce.diff_summary), 0) DESC,
        (ce.previous_version_id IS NOT NULL) DESC,
        ce.detected_at ASC
    `

    const keepId = rows[0].id
    const deleteIds = rows.slice(1).map((r) => r.id)

    // Step 3: Reassign ChangeAssessments pointing to rows being deleted.
    // ChangeAssessment has @@unique([change_event_id, law_list_item_id]),
    // so if the kept row already has an assessment for the same law_list_item_id,
    // we delete the duplicate assessment instead of reassigning.
    if (deleteIds.length > 0) {
      // 3a: Delete assessments that would conflict (kept row already has one for same law_list_item_id)
      const conflictsDeleted: Array<{ count: number }> = await prisma.$queryRaw`
        WITH conflicts AS (
          DELETE FROM change_assessments ca_dup
          WHERE ca_dup.change_event_id = ANY(${deleteIds}::text[])
            AND ca_dup.law_list_item_id IN (
              SELECT ca_keep.law_list_item_id
              FROM change_assessments ca_keep
              WHERE ca_keep.change_event_id = ${keepId}
            )
          RETURNING ca_dup.id
        )
        SELECT COUNT(*)::int as count FROM conflicts
      `

      // 3b: Reassign remaining (non-conflicting) assessments to kept row
      const reassigned: Array<{ count: number }> = await prisma.$queryRaw`
        WITH reassigned AS (
          UPDATE change_assessments
          SET change_event_id = ${keepId}
          WHERE change_event_id = ANY(${deleteIds}::text[])
          RETURNING id
        )
        SELECT COUNT(*)::int as count FROM reassigned
      `

      const conflictCount = conflictsDeleted[0].count
      const reassignedCount = reassigned[0].count
      if (reassignedCount > 0 || conflictCount > 0) {
        console.log(
          `  ${group.amendment_sfs} → reassigned ${reassignedCount}, deleted ${conflictCount} conflicting assessment(s)`
        )
        totalAssessmentsReassigned += reassignedCount
      }

      // Step 4: Delete duplicate rows
      await prisma.$queryRaw`
        DELETE FROM change_events
        WHERE id = ANY(${deleteIds}::text[])
      `

      totalDeleted += deleteIds.length
      totalKept++
    }
  }

  // Step 5: Verify — re-run the duplicate query
  const remaining: Array<{ count: number }> = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count FROM (
      SELECT document_id, amendment_sfs
      FROM change_events
      WHERE amendment_sfs IS NOT NULL
      GROUP BY document_id, amendment_sfs
      HAVING COUNT(*) > 1
    ) dupes
  `

  const remainingCount = remaining[0].count

  console.log('\n[CLEANUP] Summary:')
  console.log(`  Groups found:            ${dupeGroups.length}`)
  console.log(`  Rows kept:               ${totalKept}`)
  console.log(`  Rows deleted:            ${totalDeleted}`)
  console.log(`  Assessments reassigned:  ${totalAssessmentsReassigned}`)
  console.log(`  Remaining duplicates:    ${remainingCount}`)

  if (remainingCount > 0) {
    console.error('\n[CLEANUP] ERROR: Duplicates still exist after cleanup!')
    process.exit(1)
  } else {
    console.log('\n[CLEANUP] Success — 0 duplicate groups remain.')
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('[CLEANUP] Fatal error:', e)
  process.exit(1)
})
