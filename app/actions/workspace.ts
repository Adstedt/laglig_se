'use server'

/**
 * Story 5.9: Workspace Server Actions
 * Server actions for workspace creation and management.
 * 
 * Story P.2: Enhanced with cache invalidation
 * @see docs/stories/P.2.systematic-caching.story.md
 */

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/auth/session'
import { setActiveWorkspace } from '@/lib/auth/workspace-context'
import { 
  invalidateWorkspaceCache, 
  invalidateUserCache 
} from '@/lib/cache/workspace-cache'

// ============================================================================
// Validation Schemas
// ============================================================================

const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Arbetsplatsnamn krävs').max(100, 'Max 100 tecken'),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a URL-safe slug from a workspace name
 */
function generateSlug(name: string): string {
  const baseSlug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50) // Limit base slug length

  // Add random suffix for uniqueness
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  return `${baseSlug}-${randomSuffix}`
}

// ============================================================================
// Server Actions
// ============================================================================

export async function createWorkspace(formData: FormData): Promise<{
  success: boolean
  error?: string
  workspaceId?: string
}> {
  try {
    const session = await getServerSession()

    if (!session?.user?.email) {
      return { success: false, error: 'Du måste vara inloggad' }
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return { success: false, error: 'Användare hittades inte' }
    }

    // Validate input
    const name = formData.get('name')
    const result = createWorkspaceSchema.safeParse({ name })

    if (!result.success) {
      const firstIssue = result.error.issues[0]
      return {
        success: false,
        error: firstIssue?.message || 'Ogiltigt arbetsplatsnamn',
      }
    }

    // Generate unique slug
    const slug = generateSlug(result.data.name)

    // Calculate trial end date (14 days from now)
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)

    // Create workspace and add owner in transaction
    const workspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name: result.data.name,
          slug,
          owner_id: user.id,
          subscription_tier: 'TRIAL',
          trial_ends_at: trialEndsAt,
          status: 'ACTIVE',
        },
      })

      await tx.workspaceMember.create({
        data: {
          workspace_id: ws.id,
          user_id: user.id,
          role: 'OWNER',
          joined_at: new Date(),
        },
      })

      return ws
    })

    // Set as active workspace
    await setActiveWorkspace(workspace.id)
    
    // Invalidate user cache to refresh workspace list
    await invalidateUserCache(user.id, ['context'])
    
    revalidatePath('/')

    return { success: true, workspaceId: workspace.id }
  } catch (error) {
    console.error('Error creating workspace:', error)
    return { success: false, error: 'Något gick fel. Försök igen.' }
  }
}

/**
 * Create workspace and redirect to dashboard
 * Used by the create workspace form
 */
export async function createWorkspaceAndRedirect(
  formData: FormData
): Promise<void> {
  const result = await createWorkspace(formData)

  if (result.success) {
    redirect('/dashboard')
  }

  // If failed, the form will display the error
  // This shouldn't happen in normal flow since we return before redirect
}

/**
 * Update workspace settings with cache invalidation
 * Story P.2: Added cache invalidation
 */
export async function updateWorkspaceSettings(
  workspaceId: string,
  data: {
    name?: string
    company_org_number?: string
    company_logo?: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' }
    }

    // Update workspace
    await prisma.workspace.update({
      where: { id: workspaceId },
      data
    })

    // Invalidate workspace cache
    await invalidateWorkspaceCache(workspaceId, ['context', 'settings'])
    
    revalidatePath('/settings/workspace')
    
    return { success: true }
  } catch (error) {
    console.error('Error updating workspace:', error)
    return { success: false, error: 'Failed to update workspace' }
  }
}

/**
 * Add member to workspace with cache invalidation
 * Story P.2: Added cache invalidation
 */
export async function addWorkspaceMember(
  workspaceId: string,
  email: string,
  role: 'OWNER' | 'ADMIN' | 'HR_MANAGER' | 'MEMBER' | 'AUDITOR'
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' }
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      // Create invited user placeholder
      user = await prisma.user.create({
        data: {
          email,
          name: email.split('@')[0] || null,
        }
      })
    }

    // Add as member
    await prisma.workspaceMember.create({
      data: {
        workspace_id: workspaceId,
        user_id: user.id,
        role,
        joined_at: new Date()
      }
    })

    // Invalidate workspace members cache
    await invalidateWorkspaceCache(workspaceId, ['members'])
    
    revalidatePath('/settings/workspace')
    
    return { success: true }
  } catch (error) {
    console.error('Error adding member:', error)
    return { success: false, error: 'Failed to add member' }
  }
}

/**
 * Remove member from workspace with cache invalidation
 * Story P.2: Added cache invalidation
 */
export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' }
    }

    // Find the member first
    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspace_id: workspaceId,
        user_id: userId
      }
    })

    if (!member) {
      return { success: false, error: 'Member not found' }
    }

    // Delete by id
    await prisma.workspaceMember.delete({
      where: {
        id: member.id
      }
    })

    // Invalidate both workspace and user cache
    await invalidateWorkspaceCache(workspaceId, ['members'])
    await invalidateUserCache(userId, ['context'])
    
    revalidatePath('/settings/workspace')
    
    return { success: true }
  } catch (error) {
    console.error('Error removing member:', error)
    return { success: false, error: 'Failed to remove member' }
  }
}

/**
 * Switch active workspace with cache warming
 * Story P.2: Added cache warming for new workspace
 */
export async function switchWorkspace(
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' }
    }

    // Verify user has access to this workspace
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    
    if (!user) {
      return { success: false, error: 'User not found' }
    }

    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspace_id: workspaceId,
        user_id: user.id
      }
    })

    if (!member) {
      return { success: false, error: 'No access to this workspace' }
    }

    // Set as active workspace
    await setActiveWorkspace(workspaceId)
    
    // Invalidate old workspace context
    await invalidateUserCache(user.id, ['context'])
    
    revalidatePath('/')
    
    return { success: true }
  } catch (error) {
    console.error('Error switching workspace:', error)
    return { success: false, error: 'Failed to switch workspace' }
  }
}
