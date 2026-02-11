'use server'

/**
 * Story 12.10: Template Adoption Server Action
 * Adopts a published template into a workspace as a new law list.
 */

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  withWorkspace,
  requireWorkspaceAccess,
} from '@/lib/auth/workspace-context'
import { z } from 'zod'
import { getPublishedTemplateBySlugUncached } from '@/lib/db/queries/template-catalog'

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// Validation
// ============================================================================

const AdoptTemplateSchema = z.object({
  templateSlug: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  workspaceId: z.string().uuid().optional(),
})

// ============================================================================
// Helpers (imported from shared util)
// ============================================================================

import { generateUniqueName } from '@/lib/utils/generate-unique-name'

// ============================================================================
// Server Action
// ============================================================================

export async function adoptTemplate(
  input: unknown
): Promise<
  ActionResult<{ listId: string; listName: string; itemCount: number }>
> {
  try {
    const parsed = AdoptTemplateSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    // Workspace resolution: override or current
    const ctx = parsed.data.workspaceId
      ? await requireWorkspaceAccess(parsed.data.workspaceId)
      : await withWorkspace(async (c) => c, 'lists:create')

    // Fetch template with full sections and items
    const template = await getPublishedTemplateBySlugUncached(
      parsed.data.templateSlug
    )

    if (!template) {
      return { success: false, error: 'Mallen hittades inte' }
    }

    // Flatten all items across sections to check total count
    const totalItems = template.sections.reduce(
      (sum, section) => sum + section.items.length,
      0
    )

    if (totalItems === 0) {
      return {
        success: false,
        error: 'Mallen innehåller inga lagar att adoptera',
      }
    }

    // Check for duplicate list name in workspace
    const existingLists = await prisma.lawList.findMany({
      where: { workspace_id: ctx.workspaceId },
      select: { name: true },
    })
    const listName = generateUniqueName(
      parsed.data.name ?? template.name,
      existingLists.map((l) => l.name)
    )

    // Atomic transaction: create list + groups + items
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the LawList
      const lawList = await tx.lawList.create({
        data: {
          name: listName,
          description: parsed.data.description ?? null,
          is_default: parsed.data.isDefault ?? false,
          workspace_id: ctx.workspaceId,
          created_by: ctx.userId,
          metadata: {
            source_template_id: template.id,
            source_template_version: template.updated_at,
          },
        },
      })

      // 2. Create LawListGroup records from template sections
      const createdGroups = await Promise.all(
        template.sections.map((section) =>
          tx.lawListGroup.create({
            data: {
              law_list_id: lawList.id,
              name: section.name,
              position: section.position,
            },
          })
        )
      )

      // 3. Build section ID → group mapping
      const groupIdMap = new Map<string, string>()
      const groupNameMap = new Map<string, string>()
      template.sections.forEach((section, index) => {
        const group = createdGroups[index]
        if (group) {
          groupIdMap.set(section.id, group.id)
          groupNameMap.set(section.id, section.name)
        }
      })

      // 4. Bulk-create LawListItem records
      const itemData = template.sections.flatMap((section) =>
        section.items.map((item) => ({
          law_list_id: lawList.id,
          document_id: item.document.id,
          commentary: item.compliance_summary,
          ai_commentary: item.expert_commentary,
          category: groupNameMap.get(section.id) ?? null,
          group_id: groupIdMap.get(section.id) ?? null,
          position: item.position,
          source: 'TEMPLATE' as const,
          status: 'NOT_STARTED' as const,
          compliance_status: 'EJ_PABORJAD' as const,
          added_by: ctx.userId,
        }))
      )

      await tx.lawListItem.createMany({ data: itemData })

      return { listId: lawList.id, itemCount: itemData.length }
    })

    revalidatePath('/laglistor')

    return {
      success: true,
      data: {
        listId: result.listId,
        listName,
        itemCount: result.itemCount,
      },
    }
  } catch (error) {
    console.error('Error adopting template:', error)
    return { success: false, error: 'Kunde inte adoptera mall' }
  }
}
