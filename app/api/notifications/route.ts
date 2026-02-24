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

    // Enrich change_event notifications with link_url
    const enriched = await Promise.all(
      notifications.map(async (n) => {
        let link_url: string | null = null

        if (n.entity_type === 'change_event' && n.entity_id) {
          const changeEvent = await prisma.changeEvent.findUnique({
            where: { id: n.entity_id },
            select: { document: { select: { slug: true } } },
          })
          if (changeEvent?.document?.slug) {
            link_url = `/dokument/${changeEvent.document.slug}`
          }
        }

        return { ...n, link_url }
      })
    )

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
