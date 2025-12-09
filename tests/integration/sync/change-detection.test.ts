/**
 * Integration Tests for Change Detection & Version Archiving
 *
 * Tests the full flow of:
 * - Creating initial versions
 * - Detecting changes and archiving versions
 * - Creating change events
 * - Creating amendment records
 *
 * Story 2.11 - Task 13: Integration Tests
 *
 * NOTE: These tests require a test database connection.
 * They create and clean up test data during execution.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient, ContentType, ChangeType, DocumentStatus } from '@prisma/client'
import {
  archiveDocumentVersion,
  createInitialVersion,
  getVersionHistory,
  countVersions,
} from '@/lib/sync/version-archive'
import { detectChanges, createNewLawEvent, hasSubstantiveChanges } from '@/lib/sync/change-detection'
import { createAmendmentFromChange, extractAllAmendments, countAmendments } from '@/lib/sync/amendment-creator'

const prisma = new PrismaClient()

// Test document ID prefix for cleanup
const TEST_PREFIX = 'TEST_SYNC_2_11_'

describe('Integration: Change Detection & Version Archiving', () => {
  let _testDocumentId: string | null = null

  beforeAll(async () => {
    // Clean up any leftover test data
    await cleanupTestData()
  })

  afterAll(async () => {
    // Clean up test data after all tests
    await cleanupTestData()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up before each test for isolation
    await cleanupTestData()
    _testDocumentId = null
  })

  async function cleanupTestData() {
    // Delete test documents (cascade will handle related records)
    await prisma.legalDocument.deleteMany({
      where: {
        document_number: { startsWith: TEST_PREFIX },
      },
    })
  }

  async function createTestDocument(suffix: string = '001'): Promise<string> {
    const docNumber = `${TEST_PREFIX}${suffix}`

    const doc = await prisma.legalDocument.create({
      data: {
        document_number: docNumber,
        title: `Test Law ${suffix}`,
        slug: `test-law-${suffix}`,
        content_type: ContentType.SFS_LAW,
        full_text: `1 § Test section one. Lag (2020:100).

2 § Test section two. Lag (2020:100).`,
        html_content: null,
        publication_date: new Date('2020-01-01'),
        status: DocumentStatus.ACTIVE,
        source_url: `https://test.local/${docNumber}`,
        metadata: {
          systemdatum: '2020-01-01 00:00:00',
          test: true,
        },
      },
    })

    _testDocumentId = doc.id
    return doc.id
  }

  describe('Version Archiving', () => {
    it('should create initial version for new document', async () => {
      const docId = await createTestDocument('v001')

      await prisma.$transaction(async (tx) => {
        const version = await createInitialVersion(tx, {
          documentId: docId,
          fullText: 'Initial text content',
          htmlContent: null,
          amendmentSfs: null,
          sourceSystemdatum: null,
        })

        expect(version).not.toBeNull()
        expect(version?.version_number).toBe(1)
        expect(version?.document_id).toBe(docId)
      })

      // Verify version was created
      const versionCount = await countVersions(prisma, docId)
      expect(versionCount).toBe(1)
    })

    it('should not create duplicate initial versions', async () => {
      const docId = await createTestDocument('v002')

      // Create first initial version
      await prisma.$transaction(async (tx) => {
        await createInitialVersion(tx, {
          documentId: docId,
          fullText: 'Initial text',
          htmlContent: null,
          amendmentSfs: null,
          sourceSystemdatum: null,
        })
      })

      // Try to create another initial version
      await prisma.$transaction(async (tx) => {
        const duplicate = await createInitialVersion(tx, {
          documentId: docId,
          fullText: 'Should not be created',
          htmlContent: null,
          amendmentSfs: null,
          sourceSystemdatum: null,
        })

        // Should return null since version already exists
        expect(duplicate).toBeNull()
      })

      // Still only one version
      const versionCount = await countVersions(prisma, docId)
      expect(versionCount).toBe(1)
    })

    it('should archive new version with incremented number', async () => {
      const docId = await createTestDocument('v003')

      // Create initial version
      await prisma.$transaction(async (tx) => {
        await createInitialVersion(tx, {
          documentId: docId,
          fullText: 'Version 1 text',
          htmlContent: null,
          amendmentSfs: null,
          sourceSystemdatum: null,
        })
      })

      // Archive a new version
      await prisma.$transaction(async (tx) => {
        const version2 = await archiveDocumentVersion(tx, {
          documentId: docId,
          fullText: 'Version 2 text with changes',
          htmlContent: '<p>HTML content</p>',
          amendmentSfs: 'SFS 2025:100',
          sourceSystemdatum: new Date(),
        })

        expect(version2).not.toBeNull()
        expect(version2?.version_number).toBe(2)
        expect(version2?.amendment_sfs).toBe('SFS 2025:100')
      })

      // Verify both versions exist
      const versionCount = await countVersions(prisma, docId)
      expect(versionCount).toBe(2)
    })

    it('should retrieve version history in order', async () => {
      const docId = await createTestDocument('v004')

      // Create multiple versions
      await prisma.$transaction(async (tx) => {
        await createInitialVersion(tx, {
          documentId: docId,
          fullText: 'Version 1',
          htmlContent: null,
          amendmentSfs: null,
          sourceSystemdatum: null,
        })
      })

      await prisma.$transaction(async (tx) => {
        await archiveDocumentVersion(tx, {
          documentId: docId,
          fullText: 'Version 2',
          htmlContent: null,
          amendmentSfs: 'SFS 2021:100',
          sourceSystemdatum: new Date('2021-06-01'),
        })
      })

      await prisma.$transaction(async (tx) => {
        await archiveDocumentVersion(tx, {
          documentId: docId,
          fullText: 'Version 3',
          htmlContent: null,
          amendmentSfs: 'SFS 2022:200',
          sourceSystemdatum: new Date('2022-06-01'),
        })
      })

      // Get history
      const history = await getVersionHistory(prisma, docId)

      expect(history.length).toBe(3)
      // Should be in descending order (newest first)
      expect(history[0]?.version_number).toBe(3)
      expect(history[1]?.version_number).toBe(2)
      expect(history[2]?.version_number).toBe(1)
    })
  })

  describe('Change Detection', () => {
    it('should detect substantive changes in text', () => {
      const oldText = 'Section 1: Original text content.'
      const newText = 'Section 1: Modified text content with additions.'

      expect(hasSubstantiveChanges(oldText, newText)).toBe(true)
    })

    it('should ignore whitespace-only changes', () => {
      const oldText = 'Section 1: Text content.'
      const newText = 'Section 1:   Text   content.'

      expect(hasSubstantiveChanges(oldText, newText)).toBe(false)
    })

    it('should create change event for detected amendment', async () => {
      const docId = await createTestDocument('cd001')

      // Create initial version
      await prisma.$transaction(async (tx) => {
        await createInitialVersion(tx, {
          documentId: docId,
          fullText: 'Original text',
          htmlContent: null,
          amendmentSfs: null,
          sourceSystemdatum: null,
        })
      })

      // Detect changes
      await prisma.$transaction(async (tx) => {
        const changeEvent = await detectChanges(tx, {
          documentId: docId,
          contentType: ContentType.SFS_LAW,
          oldFullText: 'Original text',
          newFullText: 'Modified text with substantial changes',
          amendmentSfs: 'SFS 2025:100',
          previousVersionId: null,
          newVersionId: null,
        })

        expect(changeEvent).not.toBeNull()
        expect(changeEvent?.change_type).toBe(ChangeType.AMENDMENT)
        expect(changeEvent?.amendment_sfs).toBe('SFS 2025:100')
      })

      // Verify change event was created
      const events = await prisma.changeEvent.findMany({
        where: { document_id: docId },
      })
      expect(events.length).toBe(1)
    })

    it('should not create change event for no substantive changes', async () => {
      const docId = await createTestDocument('cd002')

      await prisma.$transaction(async (tx) => {
        const changeEvent = await detectChanges(tx, {
          documentId: docId,
          contentType: ContentType.SFS_LAW,
          oldFullText: 'Same text  content',
          newFullText: 'Same text content', // Only whitespace difference
          amendmentSfs: 'SFS 2025:100',
          previousVersionId: null,
          newVersionId: null,
        })

        expect(changeEvent).toBeNull()
      })
    })

    it('should create NEW_LAW event for new documents', async () => {
      const docId = await createTestDocument('cd003')

      await prisma.$transaction(async (tx) => {
        const event = await createNewLawEvent(tx, docId, ContentType.SFS_LAW)

        expect(event).not.toBeNull()
        expect(event.change_type).toBe(ChangeType.NEW_LAW)
        expect(event.document_id).toBe(docId)
      })
    })
  })

  describe('Amendment Creation', () => {
    it('should create amendment from detected change', async () => {
      const docId = await createTestDocument('am001')

      const fullText = `1 § First section with content. Lag (2020:100).

2 § Second section modified. Lag (2025:200).`

      await prisma.$transaction(async (tx) => {
        const amendment = await createAmendmentFromChange(tx, {
          baseDocumentId: docId,
          amendmentSfs: 'SFS 2025:200',
          fullText,
          detectedFromVersionId: undefined,
        })

        expect(amendment).not.toBeNull()
        expect(amendment?.amending_law_title).toContain('2025:200')
        expect(amendment?.base_document_id).toBe(docId)
      })
    })

    it('should not create duplicate amendments', async () => {
      const docId = await createTestDocument('am002')

      const fullText = `1 § Section. Lag (2020:100).`

      // Create first amendment
      await prisma.$transaction(async (tx) => {
        await createAmendmentFromChange(tx, {
          baseDocumentId: docId,
          amendmentSfs: 'SFS 2020:100',
          fullText,
        })
      })

      // Try to create duplicate
      await prisma.$transaction(async (tx) => {
        const duplicate = await createAmendmentFromChange(tx, {
          baseDocumentId: docId,
          amendmentSfs: 'SFS 2020:100',
          fullText,
        })

        expect(duplicate).toBeNull() // Should return null
      })

      // Only one amendment should exist
      const count = await countAmendments(prisma, docId)
      expect(count).toBe(1)
    })

    it('should extract all amendments from law text', async () => {
      const docId = await createTestDocument('am003')

      const fullText = `1 § First section. Lag (2019:50).

2 § Second section. Lag (2020:100).

3 § Third section. Lag (2021:200).

4 § Fourth section. Lag (2020:100).`

      await prisma.$transaction(async (tx) => {
        const amendments = await extractAllAmendments(tx, docId, fullText)

        // Should find 3 unique SFS numbers
        expect(amendments.length).toBeGreaterThanOrEqual(3)
      })

      // Verify amendments were created
      const count = await countAmendments(prisma, docId)
      expect(count).toBeGreaterThanOrEqual(3)
    })
  })
})
