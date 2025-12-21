'use server'

/**
 * Story 5.9: Workspace Server Actions
 * Server actions for workspace creation and management.
 */

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/auth/session'
import { setActiveWorkspace } from '@/lib/auth/workspace-context'

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
