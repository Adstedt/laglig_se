/**
 * GET /api/workspace/law-list-preview
 *
 * Story 25.4 v0.6 (Epic 25, B.4 polish round):
 *
 * Returns a lightweight preview payload of the workspace's default LawList
 * for the <DoneGenerateStep> right-column preview. Mounted on the
 * post-generation done-state surface so the user sees the actual generated
 * list (toolbar counts + group breakdown + a few item rows from the first
 * group) before clicking "Visa min laglista".
 *
 * Composes existing query primitives — no new query module needed:
 *   1. prisma.lawList.findFirst (workspace's default list)
 *   2. getLawListWithGroups (groups + counts via 2-query pattern)
 *   3. prisma.lawListItem.findMany (first 3 items of the expanded group,
 *      joining LegalDocument for title)
 *
 * Race-condition handling: when `law_list_generation_status` flips to
 * 'completed' the LawList exists but items may still be mid-write
 * (`add_laws_to_list` batches). Response shape allows `expandedGroup: null`
 * + empty groups[] so the client can render a "Förbereder förhandsvisning…"
 * placeholder + SWR-retry until groups arrive.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth/session'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { prisma } from '@/lib/prisma'
import { getLawListWithGroups } from '@/lib/db/queries/optimized/law-list'

export interface LawListPreviewResponse {
  /** Default LawList id; null while the list hasn't been created yet. */
  listId: string | null
  /** Total item count across all groups; informs the toolbar "{N} regelverk" pill. */
  totalItems: number
  /** Groups ordered by position ASC (LLM's editorial order — matches /laglistor). */
  groups: Array<{
    id: string
    name: string
    itemCount: number
    position: number
  }>
  /**
   * First non-empty group (by position) with its first 3 items joined to
   * LegalDocument for the title. Null when no groups have items yet.
   */
  expandedGroup: {
    id: string
    items: Array<{
      id: string
      title: string
      businessContext: string | null
    }>
  } | null
}

export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let workspaceId: string
    try {
      const ctx = await getWorkspaceContext()
      workspaceId = ctx.workspaceId
    } catch {
      return NextResponse.json(
        { error: 'No active workspace' },
        { status: 400 }
      )
    }

    // 1. Default LawList for this workspace
    const list = await prisma.lawList.findFirst({
      where: { workspace_id: workspaceId, is_default: true },
      select: { id: true },
    })

    if (!list) {
      // No default list yet (pre-generation, or DB write-lag on first run).
      const payload: LawListPreviewResponse = {
        listId: null,
        totalItems: 0,
        groups: [],
        expandedGroup: null,
      }
      return NextResponse.json(payload)
    }

    // 2. Groups + counts (ordered by position ASC, two-query pattern)
    const listWithGroups = await getLawListWithGroups(list.id)
    if (!listWithGroups) {
      const payload: LawListPreviewResponse = {
        listId: list.id,
        totalItems: 0,
        groups: [],
        expandedGroup: null,
      }
      return NextResponse.json(payload)
    }

    const totalItems =
      listWithGroups.groups.reduce((sum, g) => sum + g.itemCount, 0) +
      listWithGroups.ungroupedCount

    // 3. Pick the first non-empty group by position to expand. Honors the
    //    LLM's editorial order (matches /laglistor's natural display order).
    const firstNonEmptyGroup = listWithGroups.groups.find(
      (g) => g.itemCount > 0
    )

    let expandedGroup: LawListPreviewResponse['expandedGroup'] = null
    if (firstNonEmptyGroup) {
      const items = await prisma.lawListItem.findMany({
        where: { group_id: firstNonEmptyGroup.id, law_list_id: list.id },
        select: {
          id: true,
          business_context: true,
          document: { select: { title: true } },
        },
        orderBy: { position: 'asc' },
        take: 3,
      })
      expandedGroup = {
        id: firstNonEmptyGroup.id,
        items: items.map((i) => ({
          id: i.id,
          title: i.document?.title ?? '',
          businessContext: i.business_context,
        })),
      }
    }

    const payload: LawListPreviewResponse = {
      listId: list.id,
      totalItems,
      groups: listWithGroups.groups.map((g) => ({
        id: g.id,
        name: g.name,
        itemCount: g.itemCount,
        position: g.position,
      })),
      expandedGroup,
    }
    return NextResponse.json(payload)
  } catch (err) {
    console.error('[GET /api/workspace/law-list-preview]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
