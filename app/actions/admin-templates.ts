'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getAdminSession } from '@/lib/admin/auth'
import { canTransitionTo } from '@/lib/admin/template-workflow'
import { prisma } from '@/lib/prisma'

// ============================================================================
// Schemas
// ============================================================================

const syncSummariesSchema = z.object({
  documentId: z.string().uuid(),
  sourceTemplateId: z.string().uuid(),
  targetTemplateIds: z.array(z.string().uuid()).min(1),
})

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Namn krävs').max(200),
  slug: z.string().min(1, 'Slug krävs').max(200),
  domain: z.string().min(1, 'Domän krävs').max(100),
  description: z.string().max(5000).optional(),
  target_audience: z.string().max(2000).optional(),
})

const updateTemplateSchema = z.object({
  name: z.string().min(1, 'Namn krävs').max(200),
  slug: z.string().min(1, 'Slug krävs').max(200),
  domain: z.string().min(1, 'Domän krävs').max(100),
  description: z.string().max(5000).optional(),
  target_audience: z.string().max(2000).optional(),
  primary_regulatory_bodies: z.array(z.string()).optional(),
})

const updateItemContentSchema = z.object({
  compliance_summary: z.string().max(10000).optional(),
  expert_commentary: z.string().max(20000).optional(),
})

const createSectionSchema = z.object({
  name: z.string().min(1, 'Namn krävs').max(200),
  section_number: z.string().min(1, 'Sektionsnummer krävs').max(50),
  description: z.string().max(2000).optional(),
})

const updateSectionSchema = z.object({
  name: z.string().min(1, 'Namn krävs').max(200).optional(),
  description: z.string().max(2000).optional(),
})

// ============================================================================
// Create Template
// ============================================================================

export async function createTemplate(
  data: z.infer<typeof createTemplateSchema>
): Promise<{ success: boolean; error?: string; templateId?: string }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const adminUser = await prisma.user.findFirst({
      where: { email: session.email },
      select: { id: true },
    })
    if (!adminUser)
      return { success: false, error: 'Admin-användare hittades inte' }

    const parsed = createTemplateSchema.safeParse(data)
    if (!parsed.success) return { success: false, error: 'Ogiltig indata' }

    const existingSlug = await prisma.lawListTemplate.findUnique({
      where: { slug: parsed.data.slug },
      select: { id: true },
    })
    if (existingSlug)
      return { success: false, error: 'En mall med denna slug finns redan' }

    const template = await prisma.lawListTemplate.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        domain: parsed.data.domain,
        description: parsed.data.description ?? null,
        target_audience: parsed.data.target_audience ?? null,
        status: 'DRAFT',
        version: 1,
        document_count: 0,
        section_count: 0,
        primary_regulatory_bodies: [],
        created_by: adminUser.id,
      },
    })

    revalidatePath('/admin/templates')

    return { success: true, templateId: template.id }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Update Template
// ============================================================================

export async function updateTemplate(
  id: string,
  data: z.infer<typeof updateTemplateSchema>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const parsed = updateTemplateSchema.safeParse(data)
    if (!parsed.success) return { success: false, error: 'Ogiltig indata' }

    const template = await prisma.lawListTemplate.findUnique({
      where: { id },
      select: { id: true, slug: true },
    })
    if (!template) return { success: false, error: 'Mallen hittades inte' }

    if (parsed.data.slug !== template.slug) {
      const existingSlug = await prisma.lawListTemplate.findUnique({
        where: { slug: parsed.data.slug },
        select: { id: true },
      })
      if (existingSlug)
        return { success: false, error: 'En mall med denna slug finns redan' }
    }

    const updateData: {
      name: string
      slug: string
      domain: string
      description: string | null
      target_audience: string | null
      primary_regulatory_bodies?: string[]
    } = {
      name: parsed.data.name,
      slug: parsed.data.slug,
      domain: parsed.data.domain,
      description: parsed.data.description ?? null,
      target_audience: parsed.data.target_audience ?? null,
    }
    if (parsed.data.primary_regulatory_bodies) {
      updateData.primary_regulatory_bodies =
        parsed.data.primary_regulatory_bodies
    }

    await prisma.lawListTemplate.update({
      where: { id },
      data: updateData,
    })

    revalidatePath(`/admin/templates/${id}`)
    revalidatePath('/admin/templates')

    return { success: true }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Section CRUD
// ============================================================================

export async function createTemplateSection(
  templateId: string,
  data: z.infer<typeof createSectionSchema>
): Promise<{ success: boolean; error?: string; sectionId?: string }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const parsed = createSectionSchema.safeParse(data)
    if (!parsed.success) return { success: false, error: 'Ogiltig indata' }

    const template = await prisma.lawListTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, section_count: true },
    })
    if (!template) return { success: false, error: 'Mallen hittades inte' }

    const lastSection = await prisma.templateSection.findFirst({
      where: { template_id: templateId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    const nextPosition = (lastSection?.position ?? 0) + 1

    const section = await prisma.$transaction(async (tx) => {
      const created = await tx.templateSection.create({
        data: {
          template_id: templateId,
          name: parsed.data.name,
          section_number: parsed.data.section_number,
          description: parsed.data.description ?? null,
          position: nextPosition,
          item_count: 0,
        },
      })

      await tx.lawListTemplate.update({
        where: { id: templateId },
        data: { section_count: { increment: 1 } },
      })

      return created
    })

    revalidatePath(`/admin/templates/${templateId}`)

    return { success: true, sectionId: section.id }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function updateTemplateSection(
  id: string,
  data: z.infer<typeof updateSectionSchema>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const parsed = updateSectionSchema.safeParse(data)
    if (!parsed.success) return { success: false, error: 'Ogiltig indata' }

    const section = await prisma.templateSection.findUnique({
      where: { id },
      select: { id: true, template_id: true },
    })
    if (!section) return { success: false, error: 'Sektionen hittades inte' }

    await prisma.templateSection.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined
          ? { description: parsed.data.description }
          : {}),
      },
    })

    revalidatePath(`/admin/templates/${section.template_id}`)

    return { success: true }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function reorderTemplateSections(
  templateId: string,
  orderedIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const template = await prisma.lawListTemplate.findUnique({
      where: { id: templateId },
      select: { id: true },
    })
    if (!template) return { success: false, error: 'Mallen hittades inte' }

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.templateSection.update({
          where: { id },
          data: { position: index + 1 },
        })
      )
    )

    revalidatePath(`/admin/templates/${templateId}`)

    return { success: true }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function deleteTemplateSection(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const section = await prisma.templateSection.findUnique({
      where: { id },
      select: { id: true, template_id: true, item_count: true },
    })
    if (!section) return { success: false, error: 'Sektionen hittades inte' }

    if (section.item_count > 0)
      return {
        success: false,
        error: 'Sektionen innehåller dokument. Flytta dem först.',
      }

    await prisma.$transaction(async (tx) => {
      await tx.templateSection.delete({ where: { id } })
      await tx.lawListTemplate.update({
        where: { id: section.template_id },
        data: { section_count: { decrement: 1 } },
      })
    })

    revalidatePath(`/admin/templates/${section.template_id}`)

    return { success: true }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Move Item Between Sections
// ============================================================================

export async function moveTemplateItem(
  itemId: string,
  newSectionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const item = await prisma.templateItem.findUnique({
      where: { id: itemId },
      select: { id: true, section_id: true, template_id: true },
    })
    if (!item) return { success: false, error: 'Objektet hittades inte' }

    if (item.section_id === newSectionId)
      return { success: false, error: 'Objektet är redan i denna sektion' }

    const newSection = await prisma.templateSection.findUnique({
      where: { id: newSectionId },
      select: { id: true, template_id: true },
    })
    if (!newSection)
      return { success: false, error: 'Målsektionen hittades inte' }

    if (newSection.template_id !== item.template_id)
      return {
        success: false,
        error: 'Kan inte flytta objekt mellan olika mallar',
      }

    await prisma.$transaction(async (tx) => {
      await tx.templateItem.update({
        where: { id: itemId },
        data: { section_id: newSectionId },
      })
      await tx.templateSection.update({
        where: { id: item.section_id },
        data: { item_count: { decrement: 1 } },
      })
      await tx.templateSection.update({
        where: { id: newSectionId },
        data: { item_count: { increment: 1 } },
      })
    })

    revalidatePath(`/admin/templates/${item.template_id}`)

    return { success: true }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Update Template Item Content
// ============================================================================

export async function updateTemplateItemContent(
  itemId: string,
  data: { compliance_summary?: string; expert_commentary?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const parsed = updateItemContentSchema.safeParse(data)
    if (!parsed.success) return { success: false, error: 'Ogiltig indata' }

    const item = await prisma.templateItem.findUnique({
      where: { id: itemId },
      select: { id: true, template_id: true },
    })
    if (!item) return { success: false, error: 'Objektet hittades inte' }

    await prisma.templateItem.update({
      where: { id: itemId },
      data: {
        ...(parsed.data.compliance_summary !== undefined
          ? { compliance_summary: parsed.data.compliance_summary }
          : {}),
        ...(parsed.data.expert_commentary !== undefined
          ? { expert_commentary: parsed.data.expert_commentary }
          : {}),
      },
    })

    revalidatePath(`/admin/templates/${item.template_id}/items/${itemId}`)
    revalidatePath(`/admin/templates/${item.template_id}`)

    return { success: true }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Review Template Item
// ============================================================================

export async function reviewTemplateItem(
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const adminUser = await prisma.user.findFirst({
      where: { email: session.email },
      select: { id: true },
    })
    if (!adminUser)
      return { success: false, error: 'Admin-användare hittades inte' }

    const item = await prisma.templateItem.findUnique({
      where: { id: itemId },
      select: { id: true, template_id: true },
    })
    if (!item) return { success: false, error: 'Objektet hittades inte' }

    await prisma.templateItem.update({
      where: { id: itemId },
      data: {
        content_status: 'HUMAN_REVIEWED',
        reviewed_by: adminUser.id,
        reviewed_at: new Date(),
      },
    })

    revalidatePath(`/admin/templates/${item.template_id}/items/${itemId}`)
    revalidatePath(`/admin/templates/${item.template_id}`)

    return { success: true }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Approve Template Item
// ============================================================================

export async function approveTemplateItem(
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const item = await prisma.templateItem.findUnique({
      where: { id: itemId },
      select: { id: true, template_id: true },
    })
    if (!item) return { success: false, error: 'Objektet hittades inte' }

    await prisma.templateItem.update({
      where: { id: itemId },
      data: {
        content_status: 'APPROVED',
      },
    })

    revalidatePath(`/admin/templates/${item.template_id}/items/${itemId}`)
    revalidatePath(`/admin/templates/${item.template_id}`)

    return { success: true }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Bulk Review Template Items
// ============================================================================

export async function bulkReviewTemplateItems(
  templateId: string
): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const adminUser = await prisma.user.findFirst({
      where: { email: session.email },
      select: { id: true },
    })
    if (!adminUser)
      return { success: false, error: 'Admin-användare hittades inte' }

    const template = await prisma.lawListTemplate.findUnique({
      where: { id: templateId },
      select: { id: true },
    })
    if (!template) return { success: false, error: 'Mallen hittades inte' }

    const itemsToReview = await prisma.templateItem.findMany({
      where: { template_id: templateId, content_status: 'AI_GENERATED' },
      select: { id: true },
    })

    if (itemsToReview.length === 0) {
      return { success: true, updatedCount: 0 }
    }

    await prisma.$transaction(
      itemsToReview.map((item) =>
        prisma.templateItem.update({
          where: { id: item.id },
          data: {
            content_status: 'HUMAN_REVIEWED',
            reviewed_by: adminUser.id,
            reviewed_at: new Date(),
          },
        })
      )
    )

    revalidatePath(`/admin/templates/${templateId}`)

    return { success: true, updatedCount: itemsToReview.length }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Bulk Regenerate Template Items
// ============================================================================

export async function bulkRegenerateTemplateItems(
  templateId: string,
  itemIds: string[]
): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const template = await prisma.lawListTemplate.findUnique({
      where: { id: templateId },
      select: { id: true },
    })
    if (!template) return { success: false, error: 'Mallen hittades inte' }

    // Validate all items belong to this template
    const items = await prisma.templateItem.findMany({
      where: { id: { in: itemIds }, template_id: templateId },
      select: { id: true },
    })

    if (items.length !== itemIds.length) {
      return {
        success: false,
        error: 'Vissa objekt tillhör inte denna mall',
      }
    }

    await prisma.templateItem.updateMany({
      where: { id: { in: itemIds }, template_id: templateId },
      data: {
        content_status: 'STUB',
        compliance_summary: null,
        expert_commentary: null,
        generated_by: null,
        reviewed_by: null,
        reviewed_at: null,
      },
    })

    revalidatePath(`/admin/templates/${templateId}`)

    return { success: true, updatedCount: items.length }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Submit Template for Review (DRAFT → IN_REVIEW)
// ============================================================================

export async function submitForReview(
  templateId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const template = await prisma.lawListTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, status: true },
    })
    if (!template) return { success: false, error: 'Mallen hittades inte' }

    const itemStatuses = await prisma.templateItem.findMany({
      where: { template_id: templateId },
      select: { content_status: true },
    })

    const transition = canTransitionTo(
      template.status,
      'IN_REVIEW',
      itemStatuses.map((i) => i.content_status)
    )

    if (!transition.allowed) {
      return {
        success: false,
        error: transition.reason ?? 'Ogiltig statusövergång',
      }
    }

    await prisma.lawListTemplate.update({
      where: { id: templateId },
      data: { status: 'IN_REVIEW' },
    })

    revalidatePath(`/admin/templates/${templateId}`)
    revalidatePath('/admin/templates')

    return { success: true }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Publish Template (IN_REVIEW → PUBLISHED)
// ============================================================================

export async function publishTemplate(
  templateId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const template = await prisma.lawListTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, status: true, version: true },
    })
    if (!template) return { success: false, error: 'Mallen hittades inte' }

    const itemStatuses = await prisma.templateItem.findMany({
      where: { template_id: templateId },
      select: { content_status: true },
    })

    const transition = canTransitionTo(
      template.status,
      'PUBLISHED',
      itemStatuses.map((i) => i.content_status)
    )

    if (!transition.allowed) {
      return {
        success: false,
        error: transition.reason ?? 'Ogiltig statusövergång',
      }
    }

    await prisma.lawListTemplate.update({
      where: { id: templateId },
      data: {
        status: 'PUBLISHED',
        version: template.version + 1,
        published_at: new Date(),
      },
    })

    revalidatePath(`/admin/templates/${templateId}`)
    revalidatePath('/admin/templates')

    return { success: true }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Archive Template (PUBLISHED → ARCHIVED)
// ============================================================================

export async function archiveTemplate(
  templateId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const template = await prisma.lawListTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, status: true },
    })
    if (!template) return { success: false, error: 'Mallen hittades inte' }

    const transition = canTransitionTo(template.status, 'ARCHIVED', [])

    if (!transition.allowed) {
      return {
        success: false,
        error: transition.reason ?? 'Ogiltig statusövergång',
      }
    }

    await prisma.lawListTemplate.update({
      where: { id: templateId },
      data: { status: 'ARCHIVED' },
    })

    revalidatePath(`/admin/templates/${templateId}`)
    revalidatePath('/admin/templates')

    return { success: true }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Sync Template Summaries (Cross-List Overlap)
// ============================================================================

export async function syncTemplateSummaries(
  data: z.infer<typeof syncSummariesSchema>
): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
  try {
    const session = await getAdminSession()
    if (!session) return { success: false, error: 'Ej autentiserad' }

    const parsed = syncSummariesSchema.safeParse(data)
    if (!parsed.success) return { success: false, error: 'Ogiltig indata' }

    const { documentId, sourceTemplateId, targetTemplateIds } = parsed.data

    // Find source item
    const sourceItem = await prisma.templateItem.findFirst({
      where: { document_id: documentId, template_id: sourceTemplateId },
      select: {
        id: true,
        compliance_summary: true,
        expert_commentary: true,
        content_status: true,
      },
    })
    if (!sourceItem)
      return { success: false, error: 'Källobjektet hittades inte' }

    // Find target items
    const targetItems = await prisma.templateItem.findMany({
      where: {
        document_id: documentId,
        template_id: { in: targetTemplateIds },
      },
      select: { id: true, template_id: true },
    })

    if (targetItems.length !== targetTemplateIds.length) {
      return { success: false, error: 'Vissa målobjekt hittades inte' }
    }

    // Update all targets in a transaction
    await prisma.$transaction(
      targetItems.map((target) =>
        prisma.templateItem.update({
          where: { id: target.id },
          data: {
            compliance_summary: sourceItem.compliance_summary,
            expert_commentary: sourceItem.expert_commentary,
            content_status: sourceItem.content_status,
          },
        })
      )
    )

    revalidatePath('/admin/templates/overlap')
    for (const target of targetItems) {
      revalidatePath(`/admin/templates/${target.template_id}`)
    }

    return { success: true, updatedCount: targetItems.length }
  } catch {
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}
