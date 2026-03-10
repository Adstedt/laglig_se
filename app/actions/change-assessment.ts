'use server'

/**
 * Story 14.10, Task 3: Change Assessment Server Actions
 * CRUD operations for ChangeAssessment records with workspace scoping.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import type {
  AssessmentStatus,
  ImpactLevel,
  ComplianceStatus,
} from '@prisma/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

export interface CreateOrUpdateAssessmentInput {
  changeEventId: string
  lawListItemId: string
  status: AssessmentStatus
  impactLevel: ImpactLevel
  aiAnalysis?: string | undefined
  aiRecommendations?: string[] | undefined
  userNotes?: string | undefined
  /** If provided and different from current, logs a ComplianceStatusLog */
  newComplianceStatus?: ComplianceStatus | undefined
}

export interface AssessmentData {
  id: string
  changeEventId: string
  lawListItemId: string
  status: AssessmentStatus
  impactLevel: ImpactLevel
  aiAnalysis: string | null
  aiRecommendations: unknown
  userNotes: string | null
  assessedBy: string
  assessedAt: Date
}

// ---------------------------------------------------------------------------
// createOrUpdateAssessment
// ---------------------------------------------------------------------------

export async function createOrUpdateAssessment(
  input: CreateOrUpdateAssessmentInput
): Promise<ActionResult<AssessmentData>> {
  try {
    return await withWorkspace(async (ctx) => {
      const now = new Date()

      // Upsert the assessment
      const assessment = await prisma.changeAssessment.upsert({
        where: {
          change_event_id_law_list_item_id: {
            change_event_id: input.changeEventId,
            law_list_item_id: input.lawListItemId,
          },
        },
        create: {
          change_event_id: input.changeEventId,
          law_list_item_id: input.lawListItemId,
          workspace_id: ctx.workspaceId,
          status: input.status,
          impact_level: input.impactLevel,
          ai_analysis: input.aiAnalysis ?? null,
          ai_recommendations: input.aiRecommendations ?? Prisma.JsonNull,
          user_notes: input.userNotes ?? null,
          assessed_by: ctx.userId,
          assessed_at: now,
        },
        update: {
          status: input.status,
          impact_level: input.impactLevel,
          ai_analysis: input.aiAnalysis ?? null,
          ai_recommendations: input.aiRecommendations ?? Prisma.JsonNull,
          user_notes: input.userNotes ?? null,
          assessed_by: ctx.userId,
          assessed_at: now,
        },
      })

      // Update LawListItem acknowledgement
      await prisma.lawListItem.update({
        where: { id: input.lawListItemId },
        data: {
          last_change_acknowledged_at: now,
          last_change_acknowledged_by: ctx.userId,
        },
      })

      // Log compliance status change if applicable
      if (input.newComplianceStatus) {
        const item = await prisma.lawListItem.findUnique({
          where: { id: input.lawListItemId },
          select: { compliance_status: true },
        })
        if (item && item.compliance_status !== input.newComplianceStatus) {
          await prisma.complianceStatusLog.create({
            data: {
              law_list_item_id: input.lawListItemId,
              previous_status: item.compliance_status,
              new_status: input.newComplianceStatus,
              changed_by: ctx.userId,
              reason: `Bedömning av ändring ${input.changeEventId}`,
              change_assessment_id: assessment.id,
            },
          })
          await prisma.lawListItem.update({
            where: { id: input.lawListItemId },
            data: { compliance_status: input.newComplianceStatus },
          })
        }
      }

      return {
        success: true,
        data: {
          id: assessment.id,
          changeEventId: assessment.change_event_id,
          lawListItemId: assessment.law_list_item_id,
          status: assessment.status,
          impactLevel: assessment.impact_level,
          aiAnalysis: assessment.ai_analysis,
          aiRecommendations: assessment.ai_recommendations,
          userNotes: assessment.user_notes,
          assessedBy: assessment.assessed_by,
          assessedAt: assessment.assessed_at,
        },
      }
    }, 'changes:acknowledge')
  } catch (error) {
    console.error('Error creating/updating assessment:', error)
    return { success: false, error: 'Kunde inte spara bedömningen' }
  }
}

// ---------------------------------------------------------------------------
// getAssessment
// ---------------------------------------------------------------------------

export async function getAssessment(
  changeEventId: string,
  lawListItemId: string
): Promise<ActionResult<AssessmentData | null>> {
  try {
    return await withWorkspace(async () => {
      const assessment = await prisma.changeAssessment.findUnique({
        where: {
          change_event_id_law_list_item_id: {
            change_event_id: changeEventId,
            law_list_item_id: lawListItemId,
          },
        },
      })

      if (!assessment) {
        return { success: true, data: null }
      }

      return {
        success: true,
        data: {
          id: assessment.id,
          changeEventId: assessment.change_event_id,
          lawListItemId: assessment.law_list_item_id,
          status: assessment.status,
          impactLevel: assessment.impact_level,
          aiAnalysis: assessment.ai_analysis,
          aiRecommendations: assessment.ai_recommendations,
          userNotes: assessment.user_notes,
          assessedBy: assessment.assessed_by,
          assessedAt: assessment.assessed_at,
        },
      }
    }, 'read')
  } catch (error) {
    console.error('Error fetching assessment:', error)
    return { success: false, error: 'Kunde inte hämta bedömningen' }
  }
}

// ---------------------------------------------------------------------------
// getAssessmentStatusByChangeEventIds
// ---------------------------------------------------------------------------

/**
 * Batch query: get assessment statuses for a list of change event IDs.
 * Used by the Changes tab to replace hardcoded "Ny" badges.
 */
export async function getAssessmentStatusByChangeEventIds(
  changeEventIds: string[]
): Promise<ActionResult<Record<string, AssessmentStatus>>> {
  try {
    return await withWorkspace(async () => {
      if (changeEventIds.length === 0) {
        return { success: true, data: {} }
      }

      const assessments = await prisma.changeAssessment.findMany({
        where: { change_event_id: { in: changeEventIds } },
        select: { change_event_id: true, status: true },
      })

      const statusMap: Record<string, AssessmentStatus> = {}
      for (const a of assessments) {
        statusMap[a.change_event_id] = a.status
      }

      return { success: true, data: statusMap }
    }, 'read')
  } catch (error) {
    console.error('Error fetching assessment statuses:', error)
    return { success: false, error: 'Kunde inte hämta bedömningsstatusar' }
  }
}
