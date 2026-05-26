'use server'

/**
 * Story 8.1: Change Event Server Actions
 * Queries for unacknowledged ChangeEvents scoped to workspace law lists
 */

import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import { passthroughRedirect } from '@/lib/auth/passthrough-redirect'
import { derivePriority, priorityWeight } from '@/lib/changes/change-utils'
import type { ContentType, ChangeType } from '@prisma/client'
import type { UnacknowledgedChange } from '@/lib/changes/change-utils'

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Get all unacknowledged ChangeEvents for the current workspace's law lists.
 *
 * Query path: ChangeEvent → LegalDocument → LawListItem → LawList → Workspace
 * Filter: detected_at > last_change_acknowledged_at OR last_change_acknowledged_at IS NULL
 */
export async function getUnacknowledgedChanges(): Promise<
  ActionResult<UnacknowledgedChange[]>
> {
  try {
    // Story 19.3 (SF-A): delegate to the workspaceId-parameterized core so the
    // same query backs both this session-derived action AND the agent
    // `list_unassessed_changes` tool (which passes its closure workspaceId — no
    // session/cookies() dependency inside the streaming tool loop).
    return await withWorkspace(
      (ctx) => loadUnacknowledgedChanges(ctx.workspaceId),
      'read'
    )
  } catch (error) {
    passthroughRedirect(error)
    console.error('Error fetching unacknowledged changes:', error)
    return { success: false, error: 'Kunde inte hämta ändringar' }
  }
}

/**
 * Story 19.3 (SF-A): workspaceId-parameterized core of the unacknowledged-change
 * query. Both the session-derived `getUnacknowledgedChanges` (above) and the
 * agent `list_unassessed_changes` tool delegate here. One row per
 * (ChangeEvent × LawList) — each is an independent unit of work for the
 * assessment flow, with full list-specific context (unchanged semantics).
 */
export async function loadUnacknowledgedChanges(
  workspaceId: string
): Promise<ActionResult<UnacknowledgedChange[]>> {
  try {
    const changes = await prisma.$queryRaw<
      Array<{
        id: string
        document_id: string
        title: string
        document_number: string
        content_type: ContentType
        change_type: ChangeType
        amendment_sfs: string | null
        ai_summary: string | null
        detected_at: Date
        effective_date: Date | null
        list_id: string
        list_name: string
        law_list_item_id: string
      }>
    >`
      SELECT
        ce.id,
        ce.document_id,
        ld.title,
        ld.document_number,
        ld.content_type,
        ce.change_type,
        ce.amendment_sfs,
        ce.ai_summary,
        ce.detected_at,
        ad.effective_date,
        ll.id as list_id,
        ll.name as list_name,
        lli.id as law_list_item_id
      FROM change_events ce
      JOIN legal_documents ld ON ld.id = ce.document_id
      JOIN law_list_items lli ON lli.document_id = ce.document_id
      JOIN law_lists ll ON ll.id = lli.law_list_id
      LEFT JOIN amendment_documents ad ON ad.sfs_number = ce.amendment_sfs
      LEFT JOIN change_assessments ca
        ON ca.change_event_id = ce.id
        AND ca.law_list_item_id = lli.id
      WHERE ll.workspace_id = ${workspaceId}
        AND ca.id IS NULL
        AND (
          lli.last_change_acknowledged_at IS NULL
          OR ce.detected_at > lli.last_change_acknowledged_at
        )
        AND NOT (ce.change_type = 'NEW_LAW' AND ce.amendment_sfs IS NULL)
    `

    // Derive priority and sort
    const result: UnacknowledgedChange[] = changes.map((ce) => ({
      id: ce.id,
      documentId: ce.document_id,
      documentTitle: ce.title,
      documentNumber: ce.document_number,
      contentType: ce.content_type,
      changeType: ce.change_type,
      amendmentSfs: ce.amendment_sfs,
      aiSummary: ce.ai_summary,
      detectedAt: ce.detected_at,
      effectiveDate: ce.effective_date ?? null,
      priority: derivePriority(ce.change_type),
      listId: ce.list_id,
      listName: ce.list_name,
      lawListItemId: ce.law_list_item_id,
    }))

    // Sort: priority desc, then detected_at desc
    result.sort((a, b) => {
      const pDiff = priorityWeight(b.priority) - priorityWeight(a.priority)
      if (pDiff !== 0) return pDiff
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    })

    return { success: true, data: result }
  } catch (error) {
    passthroughRedirect(error)
    console.error('Error fetching unacknowledged changes:', error)
    return { success: false, error: 'Kunde inte hämta ändringar' }
  }
}

/**
 * Get count of unacknowledged ChangeEvents for the workspace (for tab badge).
 *
 * Uses COUNT(*) intentionally (not COUNT(DISTINCT ce.id)) because the data model
 * is one row per (ChangeEvent × LawList). Same law in 2 lists = 2 work items.
 * This matches the Changes tab display where each row is an independent unit
 * of work for the assessment flow (Story 8.3).
 */
export async function getUnacknowledgedChangeCount(): Promise<
  ActionResult<number>
> {
  try {
    return await withWorkspace(async (ctx) => {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM change_events ce
        JOIN law_list_items lli ON lli.document_id = ce.document_id
        JOIN law_lists ll ON ll.id = lli.law_list_id
        LEFT JOIN change_assessments ca
          ON ca.change_event_id = ce.id
          AND ca.law_list_item_id = lli.id
        WHERE ll.workspace_id = ${ctx.workspaceId}
          AND ca.id IS NULL
          AND (
            lli.last_change_acknowledged_at IS NULL
            OR ce.detected_at > lli.last_change_acknowledged_at
          )
          AND NOT (ce.change_type = 'NEW_LAW' AND ce.amendment_sfs IS NULL)
      `

      return { success: true, data: Number(result[0]?.count ?? 0) }
    }, 'read')
  } catch (error) {
    passthroughRedirect(error)
    console.error('Error fetching unacknowledged change count:', error)
    return { success: false, error: 'Kunde inte hämta antal ändringar' }
  }
}

/**
 * Get a single unacknowledged ChangeEvent by ID, scoped to the current workspace.
 * Used for deep-linking from email notifications into the Hem assessment flow.
 */
export async function getUnacknowledgedChangeById(
  changeEventId: string
): Promise<ActionResult<UnacknowledgedChange | null>> {
  try {
    return await withWorkspace(async (ctx) => {
      const changes = await prisma.$queryRaw<
        Array<{
          id: string
          document_id: string
          title: string
          document_number: string
          content_type: ContentType
          change_type: ChangeType
          amendment_sfs: string | null
          ai_summary: string | null
          detected_at: Date
          effective_date: Date | null
          list_id: string
          list_name: string
          law_list_item_id: string
        }>
      >`
        SELECT
          ce.id,
          ce.document_id,
          ld.title,
          ld.document_number,
          ld.content_type,
          ce.change_type,
          ce.amendment_sfs,
          ce.ai_summary,
          ce.detected_at,
          ad.effective_date,
          ll.id as list_id,
          ll.name as list_name,
          lli.id as law_list_item_id
        FROM change_events ce
        JOIN legal_documents ld ON ld.id = ce.document_id
        JOIN law_list_items lli ON lli.document_id = ce.document_id
        JOIN law_lists ll ON ll.id = lli.law_list_id
        LEFT JOIN amendment_documents ad ON ad.sfs_number = ce.amendment_sfs
        WHERE ce.id = ${changeEventId}
          AND ll.workspace_id = ${ctx.workspaceId}
        LIMIT 1
      `

      if (changes.length === 0) {
        return { success: true, data: null }
      }

      const ce = changes[0]!
      const result: UnacknowledgedChange = {
        id: ce.id,
        documentId: ce.document_id,
        documentTitle: ce.title,
        documentNumber: ce.document_number,
        contentType: ce.content_type,
        changeType: ce.change_type,
        amendmentSfs: ce.amendment_sfs,
        aiSummary: ce.ai_summary,
        detectedAt: ce.detected_at,
        effectiveDate: ce.effective_date ?? null,
        priority: derivePriority(ce.change_type),
        listId: ce.list_id,
        listName: ce.list_name,
        lawListItemId: ce.law_list_item_id,
      }

      return { success: true, data: result }
    }, 'read')
  } catch (error) {
    console.error('Error fetching change event by ID:', error)
    return { success: false, error: 'Kunde inte hämta ändringen' }
  }
}

/**
 * Get unacknowledged ChangeEvent counts per document_id (for law list item indicators).
 * Returns a map of document_id → count.
 */
export async function getUnacknowledgedChangeCountByDocument(): Promise<
  ActionResult<Record<string, number>>
> {
  try {
    return await withWorkspace(async (ctx) => {
      const results = await prisma.$queryRaw<
        Array<{ document_id: string; count: bigint }>
      >`
        SELECT ce.document_id, COUNT(DISTINCT ce.id) as count
        FROM change_events ce
        JOIN law_list_items lli ON lli.document_id = ce.document_id
        JOIN law_lists ll ON ll.id = lli.law_list_id
        LEFT JOIN change_assessments ca
          ON ca.change_event_id = ce.id
          AND ca.law_list_item_id = lli.id
        WHERE ll.workspace_id = ${ctx.workspaceId}
          AND ca.id IS NULL
          AND (
            lli.last_change_acknowledged_at IS NULL
            OR ce.detected_at > lli.last_change_acknowledged_at
          )
          AND NOT (ce.change_type = 'NEW_LAW' AND ce.amendment_sfs IS NULL)
        GROUP BY ce.document_id
      `

      const countMap: Record<string, number> = {}
      for (const row of results) {
        countMap[row.document_id] = Number(row.count)
      }

      return { success: true, data: countMap }
    }, 'read')
  } catch (error) {
    console.error('Error fetching change counts by document:', error)
    return { success: false, error: 'Kunde inte hämta ändringsantal' }
  }
}
