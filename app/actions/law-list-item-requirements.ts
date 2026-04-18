'use server'

/**
 * Story 17.16: Kravpunkter — Structured Compliance Checklist
 * Server actions for LawListItemRequirement + RequirementEvidenceLink.
 * Follows the pattern in legal-document-modal.ts.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import { redis } from '@/lib/cache/redis'
import { logActivity } from '@/lib/services/activity-logger'

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

export interface RequirementEvidenceSummary {
  id: string
  linkedAt: Date
  file: {
    id: string
    filename: string
    mimeType: string | null
  } | null
  workspaceDocument: {
    id: string
    title: string
    documentType: string
    status: string
  } | null
}

export interface RequirementWithEvidence {
  id: string
  text: string
  comment: string | null
  isFulfilled: boolean
  bevisRequired: boolean
  position: number
  createdAt: Date
  updatedAt: Date
  createdBy: string
  evidence: RequirementEvidenceSummary[]
}

// ============================================================================
// Schemas
// ============================================================================

const CreateRequirementSchema = z.object({
  listItemId: z.string().uuid(),
  text: z.string().min(1, 'Text krävs').max(500, 'Max 500 tecken'),
})

const UpdateRequirementSchema = z
  .object({
    requirementId: z.string().uuid(),
    text: z.string().min(1).max(500).optional(),
    isFulfilled: z.boolean().optional(),
    bevisRequired: z.boolean().optional(),
    comment: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (data) =>
      data.text !== undefined ||
      data.isFulfilled !== undefined ||
      data.bevisRequired !== undefined ||
      data.comment !== undefined,
    { message: 'Minst ett fält måste uppdateras' }
  )

const ReorderRequirementsSchema = z.object({
  listItemId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).min(1),
})

// XOR: exactly one of fileId / workspaceDocumentId must be set.
const EvidenceInputSchema = z
  .object({
    requirementId: z.string().uuid(),
    fileId: z.string().uuid().optional(),
    workspaceDocumentId: z.string().uuid().optional(),
  })
  .refine(
    (data) => (data.fileId ? 1 : 0) + (data.workspaceDocumentId ? 1 : 0) === 1,
    {
      message: 'Exakt ett av fileId och workspaceDocumentId måste anges (XOR)',
    }
  )

// ============================================================================
// Cache helpers
// ============================================================================

async function invalidateCaches(listItemId: string): Promise<void> {
  try {
    await Promise.all([
      redis.del(`list-item-details:v3:${listItemId}`),
      redis.del(`list-item-requirements:${listItemId}`),
      redis.del(`linked-artifacts:${listItemId}`),
    ])
  } catch {
    // Cache invalidation is non-critical
  }
}

// Summarize text for activity log entries (truncate long content).
function truncate(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

// ============================================================================
// Workspace-isolation helper
// ============================================================================

/**
 * Resolve the workspace_id that a requirement belongs to by joining
 * LawListItemRequirement → LawListItem → LawList → workspace_id.
 */
async function getRequirementWorkspaceContext(requirementId: string): Promise<{
  workspaceId: string
  listItemId: string
} | null> {
  const req = await prisma.lawListItemRequirement.findUnique({
    where: { id: requirementId },
    select: {
      list_item_id: true,
      list_item: { select: { law_list: { select: { workspace_id: true } } } },
    },
  })
  if (!req) return null
  return {
    workspaceId: req.list_item.law_list.workspace_id,
    listItemId: req.list_item_id,
  }
}

// ============================================================================
// AC 13: createRequirement
// ============================================================================

export async function createRequirement(
  listItemId: string,
  text: string
): Promise<ActionResult<RequirementWithEvidence>> {
  const parsed = CreateRequirementSchema.safeParse({ listItemId, text })
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      // Workspace isolation: join through law_list.
      const item = await prisma.lawListItem.findFirst({
        where: { id: listItemId },
        include: { law_list: { select: { workspace_id: true } } },
      })
      if (!item || item.law_list.workspace_id !== ctx.workspaceId) {
        return { success: false, error: 'Laglistpost hittades inte' }
      }

      // Next position = (max existing position) + 1000.
      const last = await prisma.lawListItemRequirement.findFirst({
        where: { list_item_id: listItemId },
        orderBy: { position: 'desc' },
        select: { position: true },
      })
      const nextPosition = (last?.position ?? 0) + 1000

      const created = await prisma.lawListItemRequirement.create({
        data: {
          list_item_id: listItemId,
          text: parsed.data.text,
          position: nextPosition,
          created_by: ctx.userId,
        },
      })

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'requirement',
        created.id,
        'requirement_created',
        null,
        { text: truncate(parsed.data.text), list_item_id: listItemId }
      )

      await invalidateCaches(listItemId)
      revalidatePath('/laglistor')

      return {
        success: true,
        data: {
          id: created.id,
          text: created.text,
          comment: created.comment,
          isFulfilled: created.is_fulfilled,
          bevisRequired: created.bevis_required,
          position: created.position,
          createdAt: created.created_at,
          updatedAt: created.updated_at,
          createdBy: created.created_by,
          evidence: [],
        },
      }
    }, 'tasks:edit')
  } catch (error) {
    console.error('createRequirement error:', error)
    return { success: false, error: 'Kunde inte skapa kravpunkt' }
  }
}

// ============================================================================
// AC 14: updateRequirement
// ============================================================================

export async function updateRequirement(
  requirementId: string,
  updates: {
    text?: string
    isFulfilled?: boolean
    bevisRequired?: boolean
    comment?: string | null
  }
): Promise<ActionResult> {
  const parsed = UpdateRequirementSchema.safeParse({
    requirementId,
    text: updates.text,
    isFulfilled: updates.isFulfilled,
    bevisRequired: updates.bevisRequired,
    comment: updates.comment,
  })
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      const scope = await getRequirementWorkspaceContext(requirementId)
      if (!scope || scope.workspaceId !== ctx.workspaceId) {
        return { success: false, error: 'Kravpunkt hittades inte' }
      }

      const existing = await prisma.lawListItemRequirement.findUnique({
        where: { id: requirementId },
        select: {
          text: true,
          is_fulfilled: true,
          bevis_required: true,
          comment: true,
        },
      })
      if (!existing) {
        return { success: false, error: 'Kravpunkt hittades inte' }
      }

      const nextData: {
        text?: string
        is_fulfilled?: boolean
        bevis_required?: boolean
        comment?: string | null
      } = {}
      if (parsed.data.text !== undefined) nextData.text = parsed.data.text
      if (parsed.data.isFulfilled !== undefined)
        nextData.is_fulfilled = parsed.data.isFulfilled
      if (parsed.data.bevisRequired !== undefined)
        nextData.bevis_required = parsed.data.bevisRequired
      if (parsed.data.comment !== undefined)
        nextData.comment = parsed.data.comment

      await prisma.lawListItemRequirement.update({
        where: { id: requirementId },
        data: nextData,
      })

      // Pick a descriptive action string so the activity feed can render nice labels.
      const action =
        parsed.data.bevisRequired !== undefined &&
        parsed.data.bevisRequired !== existing.bevis_required
          ? parsed.data.bevisRequired
            ? 'requirement_marked_bevis_required'
            : 'requirement_marked_bevis_optional'
          : parsed.data.isFulfilled !== undefined
            ? parsed.data.isFulfilled
              ? 'requirement_marked_fulfilled'
              : 'requirement_marked_unfulfilled'
            : parsed.data.comment !== undefined &&
                parsed.data.comment !== existing.comment
              ? 'requirement_comment_updated'
              : 'requirement_text_updated'

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'requirement',
        requirementId,
        action,
        {
          text: truncate(existing.text),
          is_fulfilled: existing.is_fulfilled,
          bevis_required: existing.bevis_required,
          comment: existing.comment ? truncate(existing.comment) : null,
        },
        {
          text: truncate(parsed.data.text ?? existing.text),
          is_fulfilled: parsed.data.isFulfilled ?? existing.is_fulfilled,
          bevis_required: parsed.data.bevisRequired ?? existing.bevis_required,
          comment: (() => {
            const next =
              parsed.data.comment !== undefined
                ? parsed.data.comment
                : existing.comment
            return next ? truncate(next) : null
          })(),
        }
      )

      await invalidateCaches(scope.listItemId)
      revalidatePath('/laglistor')
      return { success: true }
    }, 'tasks:edit')
  } catch (error) {
    console.error('updateRequirement error:', error)
    return { success: false, error: 'Kunde inte uppdatera kravpunkt' }
  }
}

// ============================================================================
// AC 15: deleteRequirement
// ============================================================================

export async function deleteRequirement(
  requirementId: string
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(requirementId).success) {
    return { success: false, error: 'Ogiltigt ID' }
  }

  try {
    return await withWorkspace(async (ctx) => {
      const scope = await getRequirementWorkspaceContext(requirementId)
      if (!scope || scope.workspaceId !== ctx.workspaceId) {
        return { success: false, error: 'Kravpunkt hittades inte' }
      }

      const existing = await prisma.lawListItemRequirement.findUnique({
        where: { id: requirementId },
        select: { text: true },
      })

      // Cascade handles evidence links via Prisma schema onDelete.
      await prisma.lawListItemRequirement.delete({
        where: { id: requirementId },
      })

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'requirement',
        requirementId,
        'requirement_deleted',
        { text: existing ? truncate(existing.text) : null },
        null
      )

      await invalidateCaches(scope.listItemId)
      revalidatePath('/laglistor')
      return { success: true }
    }, 'tasks:edit')
  } catch (error) {
    console.error('deleteRequirement error:', error)
    return { success: false, error: 'Kunde inte ta bort kravpunkt' }
  }
}

// ============================================================================
// AC 16: reorderRequirements
// ============================================================================

export async function reorderRequirements(
  listItemId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  const parsed = ReorderRequirementsSchema.safeParse({ listItemId, orderedIds })
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      // Workspace isolation via the list item.
      const item = await prisma.lawListItem.findFirst({
        where: { id: listItemId },
        include: { law_list: { select: { workspace_id: true } } },
      })
      if (!item || item.law_list.workspace_id !== ctx.workspaceId) {
        return { success: false, error: 'Laglistpost hittades inte' }
      }

      // Sanity check: all ids belong to this list item.
      const count = await prisma.lawListItemRequirement.count({
        where: {
          id: { in: parsed.data.orderedIds },
          list_item_id: listItemId,
        },
      })
      if (count !== parsed.data.orderedIds.length) {
        return {
          success: false,
          error: 'Okänd kravpunkt i ordningen',
        }
      }

      // Evenly spaced Float positions: 1000, 2000, 3000... No unique constraint,
      // so inserts later can pick midpoints without a swap dance.
      await prisma.$transaction(
        parsed.data.orderedIds.map((id, index) =>
          prisma.lawListItemRequirement.update({
            where: { id },
            data: { position: (index + 1) * 1000 },
          })
        )
      )

      await invalidateCaches(listItemId)
      return { success: true }
    }, 'tasks:edit')
  } catch (error) {
    console.error('reorderRequirements error:', error)
    return { success: false, error: 'Kunde inte uppdatera ordning' }
  }
}

// ============================================================================
// AC 19: getRequirementsForListItem
// ============================================================================

export async function getRequirementsForListItem(
  listItemId: string
): Promise<ActionResult<RequirementWithEvidence[]>> {
  if (!z.string().uuid().safeParse(listItemId).success) {
    return { success: false, error: 'Ogiltigt ID' }
  }

  try {
    return await withWorkspace(async (ctx) => {
      const item = await prisma.lawListItem.findFirst({
        where: { id: listItemId },
        include: { law_list: { select: { workspace_id: true } } },
      })
      if (!item || item.law_list.workspace_id !== ctx.workspaceId) {
        return { success: false, error: 'Laglistpost hittades inte' }
      }

      const rows = await prisma.lawListItemRequirement.findMany({
        where: { list_item_id: listItemId },
        orderBy: { position: 'asc' },
        include: {
          evidence_links: {
            orderBy: { linked_at: 'asc' },
            include: {
              file: {
                select: { id: true, filename: true, mime_type: true },
              },
              workspace_document: {
                select: {
                  id: true,
                  title: true,
                  document_type: true,
                  status: true,
                },
              },
            },
          },
        },
      })

      const data: RequirementWithEvidence[] = rows.map((r) => ({
        id: r.id,
        text: r.text,
        comment: r.comment,
        isFulfilled: r.is_fulfilled,
        bevisRequired: r.bevis_required,
        position: r.position,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        createdBy: r.created_by,
        evidence: r.evidence_links.map((link) => ({
          id: link.id,
          linkedAt: link.linked_at,
          file: link.file
            ? {
                id: link.file.id,
                filename: link.file.filename,
                mimeType: link.file.mime_type,
              }
            : null,
          workspaceDocument: link.workspace_document
            ? {
                id: link.workspace_document.id,
                title: link.workspace_document.title,
                documentType: link.workspace_document.document_type,
                status: link.workspace_document.status,
              }
            : null,
        })),
      }))

      return { success: true, data }
    }, 'read')
  } catch (error) {
    console.error('getRequirementsForListItem error:', error)
    return { success: false, error: 'Kunde inte hämta kravpunkter' }
  }
}

// ============================================================================
// AC 17: linkEvidenceToRequirement
// ============================================================================

export async function linkEvidenceToRequirement(
  requirementId: string,
  evidence: { fileId?: string; workspaceDocumentId?: string }
): Promise<ActionResult<{ id: string }>> {
  const parsed = EvidenceInputSchema.safeParse({
    requirementId,
    fileId: evidence.fileId,
    workspaceDocumentId: evidence.workspaceDocumentId,
  })
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      const scope = await getRequirementWorkspaceContext(requirementId)
      if (!scope || scope.workspaceId !== ctx.workspaceId) {
        return { success: false, error: 'Kravpunkt hittades inte' }
      }

      // Verify the evidence target also belongs to this workspace.
      if (parsed.data.fileId) {
        const file = await prisma.workspaceFile.findFirst({
          where: { id: parsed.data.fileId, workspace_id: ctx.workspaceId },
          select: { id: true, filename: true },
        })
        if (!file) {
          return { success: false, error: 'Fil hittades inte i arbetsytan' }
        }
      } else if (parsed.data.workspaceDocumentId) {
        const doc = await prisma.workspaceDocument.findFirst({
          where: {
            id: parsed.data.workspaceDocumentId,
            workspace_id: ctx.workspaceId,
          },
          select: { id: true, title: true },
        })
        if (!doc) {
          return {
            success: false,
            error: 'Dokument hittades inte i arbetsytan',
          }
        }
      }

      // Unique constraint prevents duplicates — turn the Prisma error into
      // a user-friendly message.
      try {
        const link = await prisma.requirementEvidenceLink.create({
          data: {
            requirement_id: requirementId,
            file_id: parsed.data.fileId ?? null,
            workspace_document_id: parsed.data.workspaceDocumentId ?? null,
            linked_by: ctx.userId,
          },
        })

        await logActivity(
          ctx.workspaceId,
          ctx.userId,
          'requirement',
          requirementId,
          'requirement_evidence_linked',
          null,
          {
            file_id: parsed.data.fileId ?? null,
            workspace_document_id: parsed.data.workspaceDocumentId ?? null,
          }
        )

        await invalidateCaches(scope.listItemId)
        return { success: true, data: { id: link.id } }
      } catch (err: unknown) {
        // Prisma error P2002 = unique constraint violation (already linked).
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === 'P2002'
        ) {
          return { success: false, error: 'Beviset är redan länkat' }
        }
        throw err
      }
    }, 'tasks:edit')
  } catch (error) {
    console.error('linkEvidenceToRequirement error:', error)
    return { success: false, error: 'Kunde inte länka bevis' }
  }
}

// ============================================================================
// AC 18: unlinkEvidenceFromRequirement
// ============================================================================

export async function unlinkEvidenceFromRequirement(
  requirementId: string,
  evidence: { fileId?: string; workspaceDocumentId?: string }
): Promise<ActionResult> {
  const parsed = EvidenceInputSchema.safeParse({
    requirementId,
    fileId: evidence.fileId,
    workspaceDocumentId: evidence.workspaceDocumentId,
  })
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      const scope = await getRequirementWorkspaceContext(requirementId)
      if (!scope || scope.workspaceId !== ctx.workspaceId) {
        return { success: false, error: 'Kravpunkt hittades inte' }
      }

      const existing = await prisma.requirementEvidenceLink.findFirst({
        where: {
          requirement_id: requirementId,
          file_id: parsed.data.fileId ?? null,
          workspace_document_id: parsed.data.workspaceDocumentId ?? null,
        },
        select: { id: true },
      })

      if (!existing) {
        return { success: false, error: 'Länken hittades inte' }
      }

      await prisma.requirementEvidenceLink.delete({
        where: { id: existing.id },
      })

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'requirement',
        requirementId,
        'requirement_evidence_unlinked',
        {
          file_id: parsed.data.fileId ?? null,
          workspace_document_id: parsed.data.workspaceDocumentId ?? null,
        },
        null
      )

      await invalidateCaches(scope.listItemId)
      return { success: true }
    }, 'tasks:edit')
  } catch (error) {
    console.error('unlinkEvidenceFromRequirement error:', error)
    return { success: false, error: 'Kunde inte ta bort länken' }
  }
}
