/**
 * Story 14.10, Task 7: Effective date utilities
 * Resolves and formats effective dates for change events.
 */

import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EffectiveDateBadge {
  text: string
  variant: 'amber' | 'red' | 'green' | 'gray'
}

interface ChangeEventLike {
  amendment_sfs: string | null
  document_id: string
}

// ---------------------------------------------------------------------------
// getEffectiveDateBadge
// ---------------------------------------------------------------------------

/**
 * Returns a Swedish-language badge label and color variant for a given effective date.
 */
export function getEffectiveDateBadge(date: Date | null): EffectiveDateBadge {
  if (!date) {
    return { text: 'Ikraftträdandedatum okänt', variant: 'gray' }
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffMs = target.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays > 0) {
    return { text: `Träder i kraft om ${diffDays} dagar`, variant: 'amber' }
  }
  if (diffDays === 0) {
    return { text: 'Träder i kraft idag', variant: 'red' }
  }
  // Past
  return { text: 'Trädde i kraft', variant: 'green' }
}

// ---------------------------------------------------------------------------
// resolveEffectiveDate
// ---------------------------------------------------------------------------

/**
 * Resolves effective date from chain:
 * ChangeEvent.amendment_sfs → AmendmentDocument.effective_date →
 * LegalDocument.effective_date → null
 */
export async function resolveEffectiveDate(
  changeEvent: ChangeEventLike
): Promise<Date | null> {
  // Try AmendmentDocument first (via amendment_sfs)
  if (changeEvent.amendment_sfs) {
    // Extract SFS number from "SFS YYYY:NNN" format
    const sfsMatch = changeEvent.amendment_sfs.match(/^SFS\s+(.+)$/)
    const sfsNumber = sfsMatch?.[1] ?? changeEvent.amendment_sfs

    if (sfsNumber) {
      const amendment = await prisma.amendmentDocument.findFirst({
        where: { sfs_number: sfsNumber },
        select: { effective_date: true },
      })
      if (amendment?.effective_date) {
        return amendment.effective_date
      }
    }
  }

  // Fallback to LegalDocument.effective_date
  const doc = await prisma.legalDocument.findUnique({
    where: { id: changeEvent.document_id },
    select: { effective_date: true },
  })
  if (doc?.effective_date) {
    return doc.effective_date
  }

  return null
}
