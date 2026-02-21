import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getWorkspaceContext,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'

export async function PATCH() {
  try {
    const ctx = await getWorkspaceContext()

    const result = await prisma.notification.updateMany({
      where: {
        user_id: ctx.userId,
        workspace_id: ctx.workspaceId,
        read_at: null,
      },
      data: { read_at: new Date() },
    })

    return NextResponse.json({ success: true, updated: result.count })
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error marking all notifications as read:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
