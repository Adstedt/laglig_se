'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getAdminSession } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubscriptionTier, WorkspaceStatus } from '@prisma/client'

const updateTierSchema = z.object({
  workspaceId: z.string().uuid(),
  tier: z.nativeEnum(SubscriptionTier),
})

const updateStatusSchema = z.object({
  workspaceId: z.string().uuid(),
  status: z.nativeEnum(WorkspaceStatus),
})

export async function updateWorkspaceTier(
  workspaceId: string,
  tier: SubscriptionTier
): Promise<{ success: boolean; error?: string | undefined }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const adminUser = await prisma.user.findFirst({
      where: { email: session.email },
      select: { id: true },
    })
    if (!adminUser)
      return { success: false, error: 'Admin-användare hittades inte' }

    const parsed = updateTierSchema.safeParse({ workspaceId, tier })
    if (!parsed.success) return { success: false, error: 'Ogiltig indata' }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { subscription_tier: true },
    })
    if (!workspace) return { success: false, error: 'Arbetsytan hittades inte' }

    const oldTier = workspace.subscription_tier

    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { subscription_tier: tier },
      })

      await tx.activityLog.create({
        data: {
          workspace_id: workspaceId,
          user_id: adminUser.id,
          entity_type: 'ADMIN_ACTION',
          entity_id: workspaceId,
          action: 'CHANGE_TIER',
          old_value: JSON.parse(JSON.stringify({ tier: oldTier })),
          new_value: JSON.parse(JSON.stringify({ tier })),
        },
      })
    })

    revalidatePath(`/admin/workspaces/${workspaceId}`)
    revalidatePath('/admin/workspaces')

    return { success: true }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function updateWorkspaceStatus(
  workspaceId: string,
  status: WorkspaceStatus
): Promise<{ success: boolean; error?: string | undefined }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const adminUser = await prisma.user.findFirst({
      where: { email: session.email },
      select: { id: true },
    })
    if (!adminUser)
      return { success: false, error: 'Admin-användare hittades inte' }

    const parsed = updateStatusSchema.safeParse({ workspaceId, status })
    if (!parsed.success) return { success: false, error: 'Ogiltig indata' }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { status: true },
    })
    if (!workspace) return { success: false, error: 'Arbetsytan hittades inte' }

    if (workspace.status === status)
      return { success: false, error: 'Arbetsytan har redan denna status' }

    const oldStatus = workspace.status

    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          status,
          ...(status === 'PAUSED' ? { paused_at: new Date() } : {}),
          ...(status === 'DELETED' ? { deleted_at: new Date() } : {}),
          ...(status === 'ACTIVE' ? { paused_at: null, deleted_at: null } : {}),
        },
      })

      await tx.activityLog.create({
        data: {
          workspace_id: workspaceId,
          user_id: adminUser.id,
          entity_type: 'ADMIN_ACTION',
          entity_id: workspaceId,
          action: 'CHANGE_STATUS',
          old_value: JSON.parse(JSON.stringify({ status: oldStatus })),
          new_value: JSON.parse(JSON.stringify({ status })),
        },
      })
    })

    revalidatePath(`/admin/workspaces/${workspaceId}`)
    revalidatePath('/admin/workspaces')

    return { success: true }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}
