'use server'

/**
 * Story 24.5: admin-only LegalDocument lookup for the catalog-request
 * fulfilment modal. Returns the minimal shape needed to render visual
 * confirmation ("AFS 2024:1 — Föreskrifter om...") in the UI before the
 * admin commits the fulfilment.
 *
 * Workspace-agnostic — admin sees all documents.
 */

import { getAdminSession } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

export async function lookupLegalDocument(rawId: string): Promise<
  ActionResult<{
    id: string
    title: string
    document_number: string
    content_type: string
  }>
> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Ej autentiserad' }

  const id = rawId.trim()
  if (id.length === 0) {
    return { success: false, error: 'Ange ett dokument-id' }
  }

  try {
    const doc = await prisma.legalDocument.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        document_number: true,
        content_type: true,
      },
    })
    if (!doc) {
      return { success: false, error: 'Inget dokument med det id:t hittades' }
    }
    return {
      success: true,
      data: {
        id: doc.id,
        title: doc.title,
        document_number: doc.document_number,
        content_type: doc.content_type,
      },
    }
  } catch (err) {
    console.error('lookupLegalDocument error:', err)
    return { success: false, error: 'Kunde inte slå upp dokumentet' }
  }
}
