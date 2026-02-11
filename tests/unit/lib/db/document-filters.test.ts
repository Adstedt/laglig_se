/**
 * Story 12.1: Unit Tests for Document Stub Filter Helpers
 *
 * Tests the reusable Prisma where clause and SQL fragment used to
 * exclude stub documents (AGENCY_REGULATION with null full_text)
 * from public-facing queries.
 */

import { describe, it, expect } from 'vitest'
import {
  excludeStubDocuments,
  EXCLUDE_STUBS_SQL,
} from '@/lib/db/queries/document-filters'

describe('document-filters', () => {
  describe('excludeStubDocuments', () => {
    it('has a NOT clause', () => {
      expect(excludeStubDocuments).toHaveProperty('NOT')
    })

    it('targets AGENCY_REGULATION content type with null full_text', () => {
      const notClause = excludeStubDocuments.NOT
      expect(notClause).toBeDefined()

      // The NOT clause contains an AND with both conditions
      const andClause = (notClause as { AND: unknown[] }).AND
      expect(andClause).toHaveLength(2)
      expect(andClause[0]).toEqual({ content_type: 'AGENCY_REGULATION' })
      expect(andClause[1]).toEqual({ full_text: null })
    })

    it('is a valid Prisma where input shape', () => {
      // Should be spreadable into a where clause without errors
      const combined = { title: { contains: 'test' }, ...excludeStubDocuments }
      expect(combined).toHaveProperty('title')
      expect(combined).toHaveProperty('NOT')
    })
  })

  describe('EXCLUDE_STUBS_SQL', () => {
    it('produces a valid SQL WHERE fragment', () => {
      expect(EXCLUDE_STUBS_SQL).toContain('AGENCY_REGULATION')
      expect(EXCLUDE_STUBS_SQL).toContain('full_text IS NOT NULL')
    })

    it('uses OR logic to allow non-AGENCY_REGULATION or populated full_text', () => {
      // The SQL should allow:
      // - Any document that is NOT AGENCY_REGULATION, OR
      // - Any AGENCY_REGULATION that has full_text populated
      expect(EXCLUDE_STUBS_SQL).toContain("content_type != 'AGENCY_REGULATION'")
      expect(EXCLUDE_STUBS_SQL).toContain('OR')
      expect(EXCLUDE_STUBS_SQL).toContain('full_text IS NOT NULL')
    })

    it('references the ld table alias', () => {
      expect(EXCLUDE_STUBS_SQL).toContain('ld.content_type')
      expect(EXCLUDE_STUBS_SQL).toContain('ld.full_text')
    })
  })
})
