'use server'

/**
 * Story 5.7: Workspace Settings Server Actions
 * Server actions for updating workspace settings.
 */

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  getWorkspaceContext,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'
import { hasPermission } from '@/lib/auth/permissions'

// ============================================================================
// Validation Schemas
// ============================================================================

const updateWorkspaceNameSchema = z.object({
  name: z.string().min(1, 'Arbetsplatsnamn krävs').max(100, 'Max 100 tecken'),
})

// ============================================================================
// Server Actions
// ============================================================================

export async function updateWorkspaceName(
  name: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const context = await getWorkspaceContext()

    // Check permission
    if (!hasPermission(context.role, 'workspace:settings')) {
      return { success: false, error: 'Åtkomst nekad' }
    }

    // Validate input
    const result = updateWorkspaceNameSchema.safeParse({ name })
    if (!result.success) {
      const firstIssue = result.error.issues[0]
      return { success: false, error: firstIssue?.message || 'Ogiltigt namn' }
    }

    // Update workspace
    await prisma.workspace.update({
      where: { id: context.workspaceId },
      data: { name: result.data.name },
    })

    revalidatePath('/settings')
    return { success: true, message: 'Inställningar sparade' }
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return { success: false, error: 'Åtkomst nekad' }
    }
    console.error('Error updating workspace name:', error)
    return { success: false, error: 'Något gick fel' }
  }
}

export async function uploadWorkspaceLogo(
  formData: FormData
): Promise<{
  success: boolean
  message?: string
  error?: string
  logoUrl?: string
}> {
  try {
    const context = await getWorkspaceContext()

    // Check permission
    if (!hasPermission(context.role, 'workspace:settings')) {
      return { success: false, error: 'Åtkomst nekad' }
    }

    const file = formData.get('logo') as File | null
    if (!file) {
      return { success: false, error: 'Ingen fil vald' }
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: 'Endast PNG och JPG är tillåtna' }
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSize) {
      return { success: false, error: 'Filen får max vara 2MB' }
    }

    // For now, we'll store the logo URL as a placeholder
    // Full Supabase Storage integration will be added when the storage bucket is set up
    // TODO: Implement actual Supabase Storage upload when bucket is configured

    // Simulate successful upload with a placeholder
    const logoUrl = `/api/workspace/${context.workspaceId}/logo`

    await prisma.workspace.update({
      where: { id: context.workspaceId },
      data: { company_logo: logoUrl },
    })

    revalidatePath('/settings')
    return {
      success: true,
      message: 'Logotyp sparad',
      logoUrl,
    }
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return { success: false, error: 'Åtkomst nekad' }
    }
    console.error('Error uploading workspace logo:', error)
    return { success: false, error: 'Något gick fel vid uppladdning' }
  }
}

export async function changeMemberRole(
  memberId: string,
  newRole: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const context = await getWorkspaceContext()

    // Check permission
    if (!hasPermission(context.role, 'members:change_role')) {
      return { success: false, error: 'Åtkomst nekad' }
    }

    // Validate role
    const validRoles = ['ADMIN', 'HR_MANAGER', 'MEMBER', 'AUDITOR']
    if (!validRoles.includes(newRole)) {
      return { success: false, error: 'Ogiltig roll' }
    }

    // Find the member
    const member = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspace_id: context.workspaceId },
    })

    if (!member) {
      return { success: false, error: 'Medlem hittades inte' }
    }

    // Prevent changing owner role
    if (member.role === 'OWNER') {
      return { success: false, error: 'Kan inte ändra ägarens roll' }
    }

    // Update member role
    await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: newRole as 'ADMIN' | 'HR_MANAGER' | 'MEMBER' | 'AUDITOR' },
    })

    revalidatePath('/settings')
    return { success: true, message: 'Roll uppdaterad' }
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return { success: false, error: 'Åtkomst nekad' }
    }
    console.error('Error changing member role:', error)
    return { success: false, error: 'Något gick fel' }
  }
}

export async function removeMember(
  memberId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const context = await getWorkspaceContext()

    // Check permission
    if (!hasPermission(context.role, 'members:remove')) {
      return { success: false, error: 'Åtkomst nekad' }
    }

    // Find the member
    const member = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspace_id: context.workspaceId },
    })

    if (!member) {
      return { success: false, error: 'Medlem hittades inte' }
    }

    // Prevent removing owner
    if (member.role === 'OWNER') {
      return { success: false, error: 'Kan inte ta bort ägaren' }
    }

    // Prevent removing yourself
    if (member.user_id === context.userId) {
      return { success: false, error: 'Du kan inte ta bort dig själv' }
    }

    // Remove member
    await prisma.workspaceMember.delete({
      where: { id: memberId },
    })

    revalidatePath('/settings')
    return { success: true, message: 'Medlem borttagen' }
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return { success: false, error: 'Åtkomst nekad' }
    }
    console.error('Error removing member:', error)
    return { success: false, error: 'Något gick fel' }
  }
}
