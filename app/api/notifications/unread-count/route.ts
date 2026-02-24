import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getWorkspaceContext,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'

export async function GET() {
  try {
    const ctx = await getWorkspaceContext()

    const count = await prisma.notification.count({
      where: {
        user_id: ctx.userId,
        workspace_id: ctx.workspaceId,
        read_at: null,
      },
    })

    return NextResponse.json({ count })
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching unread count:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
