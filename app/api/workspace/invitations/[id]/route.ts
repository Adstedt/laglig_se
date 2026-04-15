/**
 * Story 5.3: Revoke a pending workspace invitation.
 * Permission: members:invite.
 */

import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { requirePermission } from '@/lib/api/require-permission'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission('members:invite')
  if (denied) return denied

  const { id } = await params
  const context = await getWorkspaceContext()

  const result = await prisma.workspaceInvitation.updateMany({
    where: {
      id,
      workspace_id: context.workspaceId,
      status: 'PENDING',
    },
    data: { status: 'REVOKED' },
  })

  if (result.count === 0) {
    return NextResponse.json(
      { error: 'Inbjudan hittades inte eller är inte väntande' },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true })
}
