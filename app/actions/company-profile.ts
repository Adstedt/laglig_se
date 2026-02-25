'use server'

/**
 * Story 14.4: Company Profile Server Actions
 * Server actions for reading and updating the workspace company profile.
 */

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  getWorkspaceContext,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'
import { hasPermission } from '@/lib/auth/permissions'
import type {
  OrganizationType,
  EmployeeCountRange,
  ComplianceMaturity,
  WorkforceComposition,
  RevenueRange,
} from '@prisma/client'
import { calculateProfileCompleteness } from '@/lib/profile-completeness'

// ============================================================================
// Validation Schema
// ============================================================================

const updateCompanyProfileSchema = z.object({
  company_name: z.string().min(1).max(200).optional(),
  org_number: z.string().max(20).optional().nullable(),
  organization_type: z
    .enum([
      'AB',
      'HB',
      'KOMMUN',
      'REGION',
      'STATLIG_MYNDIGHET',
      'ENSKILD_FIRMA',
      'EKONOMISK_FORENING',
      'OTHER',
    ] as const satisfies readonly OrganizationType[])
    .optional()
    .nullable(),
  sni_code: z.string().max(20).optional().nullable(),
  industry_label: z.string().max(200).optional().nullable(),
  employee_count_range: z
    .enum([
      'RANGE_1_9',
      'RANGE_10_49',
      'RANGE_50_249',
      'RANGE_250_PLUS',
      'UNKNOWN',
    ] as const satisfies readonly EmployeeCountRange[])
    .optional()
    .nullable(),
  activity_flags: z
    .object({
      chemicals: z.boolean(),
      construction: z.boolean(),
      food: z.boolean(),
      personalData: z.boolean(),
      publicSector: z.boolean(),
      heavyMachinery: z.boolean(),
      minorEmployees: z.boolean(),
      internationalOperations: z.boolean(),
    })
    .optional()
    .nullable(),
  certifications: z.array(z.string().max(100)).max(20).optional(),
  compliance_maturity: z
    .enum([
      'BASIC',
      'DEVELOPING',
      'ESTABLISHED',
      'ADVANCED',
    ] as const satisfies readonly ComplianceMaturity[])
    .optional()
    .nullable(),
  has_compliance_officer: z.boolean().optional(),
  municipality: z.string().max(100).optional().nullable(),
  website_url: z
    .string()
    .url()
    .max(500)
    .or(z.literal(''))
    .optional()
    .nullable(),
  founded_year: z.number().int().min(1800).max(2100).optional().nullable(),
  has_collective_agreement: z.boolean().optional(),
  collective_agreement_name: z.string().max(200).optional().nullable(),
  workforce_composition: z
    .enum([
      'MOSTLY_WORKERS',
      'MOSTLY_SALARIED',
      'MIXED',
      'UNKNOWN',
    ] as const satisfies readonly WorkforceComposition[])
    .optional()
    .nullable(),
  revenue_range: z
    .enum([
      'UNDER_3M',
      'RANGE_3M_TO_40M',
      'RANGE_40M_TO_400M',
      'OVER_400M',
      'UNKNOWN',
    ] as const satisfies readonly RevenueRange[])
    .optional()
    .nullable(),
})

export type UpdateCompanyProfileInput = z.infer<
  typeof updateCompanyProfileSchema
>

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Get the company profile for the current workspace.
 * Creates one via upsert if it doesn't exist (lazy creation).
 * All workspace members can read the profile.
 */
export async function getCompanyProfile() {
  try {
    const context = await getWorkspaceContext()

    // Fetch workspace name for initial profile creation
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: context.workspaceId },
      select: { name: true },
    })

    const profile = await prisma.companyProfile.upsert({
      where: { workspace_id: context.workspaceId },
      create: {
        workspace_id: context.workspaceId,
        company_name: workspace.name,
      },
      update: {},
    })

    return profile
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      throw error
    }
    console.error('Error getting company profile:', error)
    throw new Error('Kunde inte hämta företagsprofil')
  }
}

/**
 * Update the company profile for the current workspace.
 * Only OWNER and ADMIN can update (workspace:settings permission).
 */
export async function updateCompanyProfile(
  data: UpdateCompanyProfileInput
): Promise<{
  success: boolean
  message?: string
  error?: string
  profile_completeness?: number
}> {
  try {
    const context = await getWorkspaceContext()

    // Check permission — only OWNER and ADMIN
    if (!hasPermission(context.role, 'workspace:settings')) {
      return { success: false, error: 'Åtkomst nekad' }
    }

    // Validate input
    const result = updateCompanyProfileSchema.safeParse(data)
    if (!result.success) {
      const firstIssue = result.error.issues[0]
      return {
        success: false,
        error: firstIssue?.message || 'Ogiltig indata',
      }
    }

    const validated = result.data

    // Build update data — only include fields that were explicitly provided
    const updateData: Record<string, unknown> = {}
    if (validated.company_name !== undefined)
      updateData.company_name = validated.company_name
    if (validated.org_number !== undefined)
      updateData.org_number = validated.org_number
    if (validated.organization_type !== undefined)
      updateData.organization_type = validated.organization_type
    if (validated.sni_code !== undefined)
      updateData.sni_code = validated.sni_code
    if (validated.industry_label !== undefined)
      updateData.industry_label = validated.industry_label
    if (validated.employee_count_range !== undefined)
      updateData.employee_count_range = validated.employee_count_range
    if (validated.activity_flags !== undefined)
      updateData.activity_flags = validated.activity_flags
    if (validated.certifications !== undefined)
      updateData.certifications = validated.certifications
    if (validated.compliance_maturity !== undefined)
      updateData.compliance_maturity = validated.compliance_maturity
    if (validated.has_compliance_officer !== undefined)
      updateData.has_compliance_officer = validated.has_compliance_officer
    if (validated.municipality !== undefined)
      updateData.municipality = validated.municipality
    if (validated.website_url !== undefined)
      updateData.website_url = validated.website_url || null
    if (validated.founded_year !== undefined)
      updateData.founded_year = validated.founded_year
    if (validated.has_collective_agreement !== undefined)
      updateData.has_collective_agreement = validated.has_collective_agreement
    if (validated.collective_agreement_name !== undefined)
      updateData.collective_agreement_name = validated.collective_agreement_name
    if (validated.workforce_composition !== undefined)
      updateData.workforce_composition = validated.workforce_composition
    if (validated.revenue_range !== undefined)
      updateData.revenue_range = validated.revenue_range

    // Update profile fields + completeness atomically
    const completeness = await prisma.$transaction(async (tx) => {
      const updatedProfile = await tx.companyProfile.update({
        where: { workspace_id: context.workspaceId },
        data: updateData,
      })

      const score = calculateProfileCompleteness(updatedProfile)
      if (score !== updatedProfile.profile_completeness) {
        await tx.companyProfile.update({
          where: { workspace_id: context.workspaceId },
          data: { profile_completeness: score },
        })
      }

      return score
    })

    revalidatePath('/settings')
    return {
      success: true,
      message: 'Företagsprofil uppdaterad',
      profile_completeness: completeness,
    }
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return { success: false, error: 'Åtkomst nekad' }
    }
    console.error('Error updating company profile:', error)
    return { success: false, error: 'Något gick fel' }
  }
}
