import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getWorkspaceContext,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()

    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(Math.max(1, Number(limitParam)), 20) : 5

    const notifications = await prisma.notification.findMany({
      where: {
        user_id: ctx.userId,
        workspace_id: ctx.workspaceId,
        read_at: null,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        entity_type: true,
        entity_id: true,
        created_at: true,
      },
    })

    // Enrich notifications with link_url based on entity type
    const enriched = notifications.map((n) => {
      let link_url: string | null = null

      if (n.entity_type === 'change_event' && n.entity_id) {
        link_url = '/dashboard?view=amendments'
      } else if (n.entity_type === 'task' && n.entity_id) {
        link_url = `/tasks?task=${n.entity_id}`
      }

      return { ...n, link_url }
    })

    return NextResponse.json(enriched)
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
