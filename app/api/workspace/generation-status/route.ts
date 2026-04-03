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
        updated_at: true,
      },
    })

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    // Stale detection: if in_progress for over 6 minutes, auto-recover to failed
    // This handles Vercel function timeouts where the catch block never runs
    const STALE_THRESHOLD_MS = 6 * 60 * 1000
    if (
      workspace.law_list_generation_status === 'in_progress' &&
      workspace.updated_at.getTime() < Date.now() - STALE_THRESHOLD_MS
    ) {
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
