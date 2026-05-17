/**
 * GET /api/workspace/generation-status
 * Story 16.4, Task 6.1 (AC: 21)
 *
 * Returns law list generation status for polling.
 *
 * DELETE /api/workspace/generation-status
 * Clears the generation status so the completed/failed banner doesn't reappear.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth/session'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { prisma } from '@/lib/prisma'

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

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        law_list_generation_status: true,
        law_list_generation_error: true,
        law_list_generation_progress: true,
        law_list_generation_started_at: true,
        updated_at: true,
      },
    })

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    // Stale detection: if in_progress for over 6 minutes, treat as failed.
    // Handles Vercel function timeouts where the catch block never runs.
    const STALE_THRESHOLD_MS = 6 * 60 * 1000
    const isStaleInProgress =
      workspace.law_list_generation_status === 'in_progress' &&
      workspace.updated_at.getTime() < Date.now() - STALE_THRESHOLD_MS
    const looksFailed =
      workspace.law_list_generation_status === 'failed' || isStaleInProgress

    if (looksFailed) {
      // Auto-recovery: the generation may have succeeded before the function
      // timed out, just without updating the status field. If a default law
      // list with items already exists, silently clear the status so no banner
      // is shown.
      const existingList = await prisma.lawList.findFirst({
        where: { workspace_id: workspaceId, is_default: true },
        select: { _count: { select: { items: true } } },
      })

      if (existingList && existingList._count.items > 0) {
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            law_list_generation_status: null,
            law_list_generation_error: null,
          },
        })
        return NextResponse.json({
          status: null,
          progress: null,
          error: null,
        })
      }

      // Genuine failure — persist it if we detected staleness here.
      if (isStaleInProgress) {
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            law_list_generation_status: 'failed',
            law_list_generation_error:
              'Genereringen tog för lång tid. Försök igen eller skapa listan manuellt.',
          },
        })
        return NextResponse.json({
          status: 'failed',
          progress: workspace.law_list_generation_progress ?? null,
          error:
            'Genereringen tog för lång tid. Försök igen eller skapa listan manuellt.',
        })
      }
    }

    // Get item count and groups if completed
    let itemCount: number | undefined
    let groups: Array<{ name: string; count: number }> | undefined
    if (workspace.law_list_generation_status === 'completed') {
      const list = await prisma.lawList.findFirst({
        where: { workspace_id: workspaceId, is_default: true },
        select: {
          _count: { select: { items: true } },
          groups: {
            select: { name: true, _count: { select: { items: true } } },
            orderBy: { position: 'asc' },
          },
        },
      })
      itemCount = list?._count.items
      groups = list?.groups.map((g) => ({
        name: g.name,
        count: g._count.items,
      }))
    }

    return NextResponse.json({
      status: workspace.law_list_generation_status ?? 'pending',
      progress: workspace.law_list_generation_progress ?? null,
      itemCount,
      groups,
      error: workspace.law_list_generation_error ?? null,
      // Story 25.3 polish: ISO string for client-side asymptotic % computation
      // in <ProgressStrip>. Null when generation hasn't started yet.
      startedAt:
        workspace.law_list_generation_started_at?.toISOString() ?? null,
    })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ctx = await getWorkspaceContext()

    await prisma.workspace.update({
      where: { id: ctx.workspaceId },
      data: { law_list_generation_status: null },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
