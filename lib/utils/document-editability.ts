import { WorkspaceDocumentStatus } from '@prisma/client'

/**
 * Returns true if the document can be edited in the given status.
 * Only DRAFT and IN_REVIEW documents are editable.
 */
export function isDocumentEditable(
  status: WorkspaceDocumentStatus | string
): boolean {
  return (
    status === WorkspaceDocumentStatus.DRAFT ||
    status === WorkspaceDocumentStatus.IN_REVIEW
  )
}
