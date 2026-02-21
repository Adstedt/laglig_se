import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getWorkspaceContext,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getWorkspaceContext()
    const { id } = await params

    // Verify notification belongs to this user
    const notification = await prisma.notification.findFirst({
      where: {
        id,
        user_id: ctx.userId,
        workspace_id: ctx.workspaceId,
      },
    })

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      )
    }

    await prisma.notification.update({
      where: { id },
      data: { read_at: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error marking notification as read:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
