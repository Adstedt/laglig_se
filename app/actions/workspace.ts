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
import { headers } from 'next/headers'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/auth/session'
import { setActiveWorkspace } from '@/lib/auth/workspace-context'
import {
  invalidateWorkspaceCache,
  invalidateUserCache,
} from '@/lib/cache/workspace-cache'
import { sendEmail } from '@/lib/email/email-service'
import { EnterpriseInquiryEmail } from '@/emails/enterprise-inquiry'
import { env } from '@/lib/env'
import { TRIAL_DURATION_DAYS } from '@/lib/billing/trial-config'

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

    // Read optional company fields (from onboarding wizard)
    const rawOrgNumber = formData.get('orgNumber') as string | null
    const streetAddress = formData.get('streetAddress') as string | null
    const postalCode = formData.get('postalCode') as string | null
    const city = formData.get('city') as string | null
    const sniCode = formData.get('sniCode') as string | null
    const legalForm = formData.get('legalForm') as string | null
    const rawEmployeeCount = formData.get('employeeCount') as string | null

    // Enrichment fields from BolagsAPI auto-fill
    const municipality = formData.get('municipality') as string | null
    const industryLabel = formData.get('industryLabel') as string | null
    const foundedYear = formData.get('foundedYear') as string | null
    const websiteUrl = formData.get('websiteUrl') as string | null
    const businessDescription = formData.get('businessDescription') as
      | string
      | null
    const taxStatus = formData.get('taxStatus') as string | null
    const foreignOwnedRaw = formData.get('foreignOwned') as string | null
    const parentCompanyName = formData.get('parentCompanyName') as string | null
    const parentCompanyOrgnr = formData.get('parentCompanyOrgnr') as
      | string
      | null
    const fiRegulatedRaw = formData.get('fiRegulated') as string | null
    const activeStatus = formData.get('activeStatus') as string | null
    const ongoingProcedures = formData.get('ongoingProcedures') as string | null
    const registeredDate = formData.get('registeredDate') as string | null
    const dataSource = formData.get('dataSource') as string | null
    const activityFlagsRaw = formData.get('activityFlags') as string | null
    const hasCollectiveAgreementRaw = formData.get('hasCollectiveAgreement') as
      | string
      | null
    // Story 5.12: tier picked during onboarding wizard.
    const rawPickedTier = formData.get('pickedTier') as string | null
    const PICKED_TIERS = ['SOLO', 'TEAM', 'ENTERPRISE'] as const
    type PickedTier = (typeof PICKED_TIERS)[number]
    let pickedTier: PickedTier
    if (
      rawPickedTier &&
      (PICKED_TIERS as readonly string[]).includes(rawPickedTier)
    ) {
      pickedTier = rawPickedTier as PickedTier
    } else {
      console.warn(
        '[createWorkspace] missing or invalid pickedTier — defaulting to SOLO'
      )
      pickedTier = 'SOLO'
    }
    // Enterprise picks: trial limits cap at Team to bound COGS during the
    // wait-for-sales window; enterprise_inquiry_at signals the lead.
    const trialPickedTier: 'SOLO' | 'TEAM' =
      pickedTier === 'ENTERPRISE' ? 'TEAM' : pickedTier
    const enterpriseInquiryAt = pickedTier === 'ENTERPRISE' ? new Date() : null

    // Server-side validation of optional company fields
    if (rawOrgNumber && !/^\d{6}-?\d{4}$/.test(rawOrgNumber)) {
      return {
        success: false,
        error: 'Ogiltigt organisationsnummer. Ange XXXXXX-XXXX',
      }
    }

    if (postalCode && !/^\d{3}\s?\d{2}$/.test(postalCode)) {
      return { success: false, error: 'Ogiltigt postnummer. Ange XXX XX' }
    }

    if (
      rawEmployeeCount &&
      rawEmployeeCount !== '' &&
      !/^\d+$/.test(rawEmployeeCount)
    ) {
      return {
        success: false,
        error: 'Antal anställda måste vara ett heltal',
      }
    }

    // Normalize org number to XXXXXX-XXXX format
    const orgNumber = rawOrgNumber
      ? rawOrgNumber.replace(/^(\d{6})(\d{4})$/, '$1-$2')
      : null

    const employeeCount =
      rawEmployeeCount && rawEmployeeCount !== ''
        ? parseInt(rawEmployeeCount, 10)
        : null

    // Build address string from parts
    const addressParts = [streetAddress, postalCode, city].filter(Boolean)
    const address = addressParts.length > 0 ? addressParts.join(', ') : null

    // Determine if company profile fields were provided
    const hasCompanyFields =
      orgNumber || sniCode || legalForm || employeeCount !== null || address

    // Story 5.13: trial duration sourced from single constant.
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS)

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
          // Story 25.0 (Epic 25): law_list_generation_status is intentionally
          // NOT set here — it lands NULL (the schema @default was dropped),
          // which is what getOnboardingState keys on to open the first-run
          // path-choice modal. The user picks a path there; generation only
          // fires if they choose "Generera laglista nu".
          // Story 5.12: trial limits cap at the picked tier (or Team for
          // Enterprise picks — see enterpriseInquiryAt below).
          trial_picked_tier: trialPickedTier,
          ...(enterpriseInquiryAt && {
            enterprise_inquiry_at: enterpriseInquiryAt,
          }),
          ...(orgNumber && { org_number: orgNumber }),
          ...(orgNumber && { company_legal_name: result.data.name }),
          ...(sniCode && { sni_code: sniCode }),
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

      // Create CompanyProfile if company-specific fields are provided
      if (hasCompanyFields) {
        const isAutoFilled = dataSource === 'bolagsapi'

        // Map legal_form to organization_type enum
        const orgTypeMap: Record<string, string> = {
          AB: 'AB',
          HB: 'HB',
          KB: 'OTHER',
          EF: 'ENSKILD_FIRMA',
          OVRIGT: 'OTHER',
        }

        // Parse JSON fields safely
        let parsedTaxStatus: object | null = null
        if (taxStatus) {
          try {
            parsedTaxStatus = JSON.parse(taxStatus)
          } catch {
            /* ignore */
          }
        }
        let parsedOngoingProcedures: object | null = null
        if (ongoingProcedures) {
          try {
            parsedOngoingProcedures = JSON.parse(ongoingProcedures)
          } catch {
            /* ignore */
          }
        }
        let parsedActivityFlags: object | null = null
        if (activityFlagsRaw) {
          try {
            parsedActivityFlags = JSON.parse(activityFlagsRaw)
          } catch {
            /* ignore */
          }
        }

        const parsedFoundedYear = foundedYear ? parseInt(foundedYear, 10) : null

        const profileData: Record<string, unknown> = {
          workspace_id: ws.id,
          company_name: result.data.name,
          data_source: isAutoFilled ? 'bolagsapi' : 'manual',
        }
        if (orgNumber) profileData.org_number = orgNumber
        if (sniCode) profileData.sni_code = sniCode
        if (legalForm) {
          profileData.legal_form = legalForm
          profileData.organization_type = orgTypeMap[legalForm] ?? 'OTHER'
        }
        if (employeeCount !== null) profileData.employee_count = employeeCount
        if (address) profileData.address = address
        if (municipality) profileData.municipality = municipality
        if (industryLabel) profileData.industry_label = industryLabel
        if (parsedFoundedYear && !isNaN(parsedFoundedYear))
          profileData.founded_year = parsedFoundedYear
        if (websiteUrl) profileData.website_url = websiteUrl
        if (businessDescription)
          profileData.business_description = businessDescription
        if (parsedTaxStatus) profileData.tax_status = parsedTaxStatus
        if (foreignOwnedRaw)
          profileData.foreign_owned = foreignOwnedRaw === 'true'
        if (parentCompanyName)
          profileData.parent_company_name = parentCompanyName
        if (parentCompanyOrgnr)
          profileData.parent_company_orgnr = parentCompanyOrgnr
        if (fiRegulatedRaw) profileData.fi_regulated = fiRegulatedRaw === 'true'
        if (activeStatus) profileData.active_status = activeStatus
        if (parsedOngoingProcedures)
          profileData.ongoing_procedures = parsedOngoingProcedures
        if (registeredDate)
          profileData.registered_date = new Date(registeredDate)
        if (isAutoFilled) profileData.last_enriched_at = new Date()
        if (parsedActivityFlags)
          profileData.activity_flags = parsedActivityFlags
        if (hasCollectiveAgreementRaw)
          profileData.has_collective_agreement =
            hasCollectiveAgreementRaw === 'true'

        await tx.companyProfile.create({ data: profileData as never })
      }

      return ws
    })

    // Set as active workspace
    await setActiveWorkspace(workspace.id)

    // Invalidate user cache to refresh workspace list
    await invalidateUserCache(user.id, ['context'])

    // Story 5.12: Enterprise-pick sales notification.
    // Fires AFTER the transaction commits — a failed email never rolls back
    // a successful workspace. Mirrors Story 14.27's [CHAT_USAGE_EVENT_WRITE_FAIL]
    // fail-safe pattern.
    if (enterpriseInquiryAt) {
      try {
        await sendEmail({
          to: env.SALES_NOTIFICATION_EMAIL,
          subject: `Ny Enterprise-intresseanmälan: ${result.data.name}`,
          react: EnterpriseInquiryEmail({
            workspaceName: result.data.name,
            ownerEmail: user.email,
            ...(orgNumber ? { orgNumber } : {}),
            ...(employeeCount !== null ? { employeeCount } : {}),
            ...(sniCode ? { sniCode } : {}),
            ...(industryLabel ? { industryLabel } : {}),
            ...(businessDescription ? { businessDescription } : {}),
            ...(municipality ? { municipality } : {}),
            ...(websiteUrl ? { websiteUrl } : {}),
          }),
          from: 'notifications',
        })
      } catch (err) {
        console.error('[ENTERPRISE_INQUIRY_EMAIL_FAIL]', err)
      }
    }

    // Story 25.0 (Epic 25): the law-list generation auto-fire that used to
    // live here has been removed. Generation is no longer triggered silently
    // on workspace creation — the first-run path-choice modal on /dashboard
    // now gates it, so the user intentionally picks Generera / Mall / Import /
    // Hoppa över. New workspaces land on /dashboard with
    // law_list_generation_status = null (the schema @default was dropped in
    // migration 20260514000000_add_first_run_modal_columns), which is what
    // getOnboardingState keys on to open the modal.

    revalidatePath('/')

    return { success: true, workspaceId: workspace.id }
  } catch (error) {
    // Handle unique constraint violation on org_number
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target as string[]
      if (target?.includes('org_number')) {
        return {
          success: false,
          error: 'Detta organisationsnummer är redan registrerat',
        }
      }
    }

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
      data,
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
      where: { email },
    })

    if (!user) {
      // Create invited user placeholder
      user = await prisma.user.create({
        data: {
          email,
          name: email.split('@')[0] || null,
        },
      })
    }

    // Add as member
    await prisma.workspaceMember.create({
      data: {
        workspace_id: workspaceId,
        user_id: user.id,
        role,
        joined_at: new Date(),
      },
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
        user_id: userId,
      },
    })

    if (!member) {
      return { success: false, error: 'Member not found' }
    }

    // Delete by id
    await prisma.workspaceMember.delete({
      where: {
        id: member.id,
      },
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
 * Story 16.4: Archive current default law list and re-trigger generation
 */
export async function regenerateLawList(): Promise<{
  success: boolean
  error?: string
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

    // Get active workspace from context
    const { getWorkspaceContext } = await import('@/lib/auth/workspace-context')
    const ctx = await getWorkspaceContext()
    const workspaceId = ctx.workspaceId

    // Archive current default list
    const currentDefault = await prisma.lawList.findFirst({
      where: { workspace_id: workspaceId, is_default: true },
    })

    if (currentDefault) {
      const now = new Date()
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      await prisma.lawList.update({
        where: { id: currentDefault.id },
        data: {
          name: `Er laglista (arkiverad ${dateStr})`,
          is_default: false,
        },
      })
    }

    // Reset status to pending
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        law_list_generation_status: 'pending',
        law_list_generation_error: null,
        law_list_generation_progress: Prisma.DbNull,
      },
    })

    // Trigger generation
    try {
      const headersList = await headers()
      const protocol = headersList.get('x-forwarded-proto') ?? 'http'
      const host = headersList.get('host') ?? 'localhost:3000'
      const cookie = headersList.get('cookie') ?? ''
      const baseUrl = `${protocol}://${host}`

      fetch(`${baseUrl}/api/workspace/generate-law-list`, {
        method: 'POST',
        headers: { cookie },
      }).catch(() => {})
    } catch {
      // Status remains 'pending' — dashboard retry will pick it up
    }

    revalidatePath('/laglistor')
    revalidatePath('/dashboard')

    return { success: true }
  } catch (error) {
    console.error('Error regenerating law list:', error)
    return { success: false, error: 'Något gick fel. Försök igen.' }
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
      where: { email: session.user.email },
    })

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspace_id: workspaceId,
        user_id: user.id,
      },
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
