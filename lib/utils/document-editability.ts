import { WorkspaceDocumentStatus } from '@prisma/client'

/**
 * Returns true if the document can be edited in the given status.
 * Only DRAFT documents are editable — IN_REVIEW is frozen for review.
 */
export function isDocumentEditable(
  status: WorkspaceDocumentStatus | string
): boolean {
  return status === WorkspaceDocumentStatus.DRAFT
}
