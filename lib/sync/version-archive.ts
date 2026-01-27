/**
 * Document Version Archiving
 *
 * Archives previous versions of legal documents before updating them.
 * This enables:
 * - Version history tracking
 * - Diff generation between versions
 * - Amendment history reconstruction
 *
 * Story 2.11 - Task 3: Implement Version Archiving
 */

import type { Prisma, DocumentVersion } from '@prisma/client'

// ============================================================================
// Types
// ============================================================================

export interface ArchiveVersionParams {
  documentId: string
  fullText: string
  htmlContent: string | null
  amendmentSfs: string | null // "SFS 2025:732"
  sourceSystemdatum: Date | null
  changedSections?: string[] // ["7 §", "12 §"]
}

// Transaction client type for Prisma interactive transactions
type TransactionClient = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

// ============================================================================
// Version Archiving
// ============================================================================

/**
 * Archive the current version of a document before updating it
 *
 * Creates a new DocumentVersion record with:
 * - Incremented version number
 * - Current full_text and html_content
 * - Amendment SFS that triggered the new version
 * - API systemdatum at capture time
 *
 * @param tx Prisma transaction client
 * @param params Archive parameters
 * @returns The created DocumentVersion record
 */
export async function archiveDocumentVersion(
  tx: TransactionClient,
  params: ArchiveVersionParams
): Promise<DocumentVersion> {
  const {
    documentId,
    fullText,
    htmlContent,
    amendmentSfs,
    sourceSystemdatum,
    changedSections,
  } = params

  // Get current highest version number
  const latestVersion = await tx.documentVersion.findFirst({
    where: { document_id: documentId },
    orderBy: { version_number: 'desc' },
    select: { version_number: true },
  })

  const newVersionNumber = (latestVersion?.version_number || 0) + 1

  // Create the archive version - build data object conditionally
  const createData: {
    document_id: string
    version_number: number
    full_text: string
    html_content: string | null
    amendment_sfs: string | null
    source_systemdatum: Date | null
    changed_sections?: string[]
  } = {
    document_id: documentId,
    version_number: newVersionNumber,
    full_text: fullText,
    html_content: htmlContent,
    amendment_sfs: amendmentSfs,
    source_systemdatum: sourceSystemdatum,
  }

  if (changedSections && changedSections.length > 0) {
    createData.changed_sections = changedSections
  }

  const archivedVersion = await tx.documentVersion.create({
    data: createData,
  })

  return archivedVersion
}

/**
 * Get version history for a document
 *
 * @param documentId The document UUID
 * @returns Array of versions ordered by version_number desc
 */
export async function getVersionHistory(
  tx: TransactionClient,
  documentId: string
): Promise<DocumentVersion[]> {
  return tx.documentVersion.findMany({
    where: { document_id: documentId },
    orderBy: { version_number: 'desc' },
  })
}

/**
 * Get a specific version of a document
 *
 * @param tx Prisma transaction client
 * @param documentId The document UUID
 * @param versionNumber The version number (1, 2, 3...)
 * @returns The version or null if not found
 */
export async function getVersion(
  tx: TransactionClient,
  documentId: string,
  versionNumber: number
): Promise<DocumentVersion | null> {
  return tx.documentVersion.findUnique({
    where: {
      document_id_version_number: {
        document_id: documentId,
        version_number: versionNumber,
      },
    },
  })
}

/**
 * Get the latest version of a document
 *
 * @param tx Prisma transaction client
 * @param documentId The document UUID
 * @returns The latest version or null if none exists
 */
export async function getLatestVersion(
  tx: TransactionClient,
  documentId: string
): Promise<DocumentVersion | null> {
  return tx.documentVersion.findFirst({
    where: { document_id: documentId },
    orderBy: { version_number: 'desc' },
  })
}

/**
 * Count versions for a document
 *
 * @param tx Prisma transaction client
 * @param documentId The document UUID
 * @returns Number of versions
 */
export async function countVersions(
  tx: TransactionClient,
  documentId: string
): Promise<number> {
  return tx.documentVersion.count({
    where: { document_id: documentId },
  })
}

/**
 * Create initial version record for a newly ingested document
 * Used during backfill to ensure all documents have at least version 1
 *
 * @param tx Prisma transaction client
 * @param params Initial version parameters
 * @returns The created DocumentVersion or null if version 1 already exists
 */
export async function createInitialVersion(
  tx: TransactionClient,
  params: {
    documentId: string
    fullText: string
    htmlContent: string | null
    amendmentSfs: string | null
    sourceSystemdatum: Date | null
  }
): Promise<DocumentVersion | null> {
  const { documentId, fullText, htmlContent, amendmentSfs, sourceSystemdatum } =
    params

  // Check if version 1 already exists
  const existing = await tx.documentVersion.findUnique({
    where: {
      document_id_version_number: {
        document_id: documentId,
        version_number: 1,
      },
    },
  })

  if (existing) {
    return null // Already has initial version
  }

  // Create version 1
  return tx.documentVersion.create({
    data: {
      document_id: documentId,
      version_number: 1,
      full_text: fullText,
      html_content: htmlContent,
      amendment_sfs: amendmentSfs,
      source_systemdatum: sourceSystemdatum,
    },
  })
}
