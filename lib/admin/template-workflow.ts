import type { TemplateItemContentStatus, TemplateStatus } from '@prisma/client'

interface TransitionResult {
  allowed: boolean
  reason?: string
}

/**
 * Pure validation function for template status transitions.
 * Does NOT perform DB queries — receives data as arguments.
 */
export function canTransitionTo(
  currentStatus: TemplateStatus,
  newStatus: TemplateStatus,
  itemContentStatuses: TemplateItemContentStatus[]
): TransitionResult {
  // DRAFT → IN_REVIEW
  if (currentStatus === 'DRAFT' && newStatus === 'IN_REVIEW') {
    if (itemContentStatuses.length === 0) {
      return {
        allowed: false,
        reason: 'Mallen måste innehålla minst ett objekt',
      }
    }
    if (itemContentStatuses.some((s) => s === 'STUB')) {
      return {
        allowed: false,
        reason: 'Alla objekt måste ha minst AI-genererat innehåll',
      }
    }
    return { allowed: true }
  }

  // IN_REVIEW → PUBLISHED
  if (currentStatus === 'IN_REVIEW' && newStatus === 'PUBLISHED') {
    if (itemContentStatuses.length === 0) {
      return {
        allowed: false,
        reason: 'Mallen måste innehålla minst ett objekt',
      }
    }
    if (itemContentStatuses.some((s) => s === 'STUB')) {
      return {
        allowed: false,
        reason: 'Alla objekt måste ha minst AI-genererat innehåll',
      }
    }
    return { allowed: true }
  }

  // PUBLISHED → ARCHIVED
  if (currentStatus === 'PUBLISHED' && newStatus === 'ARCHIVED') {
    return { allowed: true }
  }

  // All other transitions: not allowed
  return { allowed: false, reason: 'Ogiltig statusövergång' }
}
