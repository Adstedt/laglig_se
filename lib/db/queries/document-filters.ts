/**
 * Story 12.1: Reusable Prisma where clause helpers for document filtering.
 *
 * Stub documents (AGENCY_REGULATION with null full_text) are excluded from
 * public-facing views but remain visible in admin backoffice.
 */

import type { Prisma } from '@prisma/client'

/**
 * Prisma where clause that excludes stub documents from results.
 * A stub is defined as content_type = AGENCY_REGULATION AND full_text IS NULL.
 *
 * Usage:
 *   const docs = await prisma.legalDocument.findMany({
 *     where: { ...otherFilters, ...excludeStubDocuments },
 *   })
 */
export const excludeStubDocuments: Prisma.LegalDocumentWhereInput = {
  NOT: {
    AND: [{ content_type: 'AGENCY_REGULATION' }, { full_text: null }],
  },
}

/**
 * SQL WHERE clause fragment for raw queries that excludes stub documents.
 * Use in raw SQL queries where Prisma where clauses can't be used.
 */
export const EXCLUDE_STUBS_SQL = `(ld.content_type != 'AGENCY_REGULATION' OR ld.full_text IS NOT NULL)`
