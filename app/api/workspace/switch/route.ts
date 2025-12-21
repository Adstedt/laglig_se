/**
 * API endpoint to switch the active workspace
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/auth/session'
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/auth/workspace-context'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { workspaceId } = await request.json()

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this workspace
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspace_id: workspaceId,
        user_id: user.id,
      },
      include: { workspace: true },
    })

    if (!member) {
      return NextResponse.json(
        { error: 'No access to this workspace' },
        { status: 403 }
      )
    }

    if (member.workspace.status === 'DELETED') {
      return NextResponse.json(
        { error: 'Workspace has been deleted' },
        { status: 410 }
      )
    }

    // Set the active workspace cookie
    const cookieStore = await cookies()
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })

    return NextResponse.json({
      success: true,
      workspace: {
        id: member.workspace.id,
        name: member.workspace.name,
        slug: member.workspace.slug,
      },
    })
  } catch (error) {
    console.error('Error switching workspace:', error)
    return NextResponse.json(
      { error: 'Failed to switch workspace' },
      { status: 500 }
    )
  }
}
