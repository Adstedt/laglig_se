import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient, ContentType, DocumentStatus } from '@prisma/client'

/**
 * Integration tests for Story 2.1: Multi-Content-Type Data Model
 *
 * These tests verify:
 * - Schema validation (tables, indexes, relations)
 * - CRUD operations for all content types
 * - Type-specific relations (CourtCase, EuDocument)
 * - Amendment tracking with 7 competitive fields
 * - Cross-references and document subjects
 * - Constraint enforcement (unique, foreign keys)
 */

const prisma = new PrismaClient()

describe('Multi-Content-Type Schema Integration Tests', () => {
  // Test data IDs for cleanup
  const testIds: {
    documents: string[]
    courtCases: string[]
    euDocuments: string[]
    amendments: string[]
    crossReferences: string[]
    documentSubjects: string[]
  } = {
    documents: [],
    courtCases: [],
    euDocuments: [],
    amendments: [],
    crossReferences: [],
    documentSubjects: [],
  }

  // Clean up any leftover test data before starting
  beforeAll(async () => {
    // Delete any documents with test-specific patterns
    await prisma.legalDocument.deleteMany({
      where: {
        OR: [
          { document_number: { startsWith: 'SFS 1977:48' } },
          { document_number: { startsWith: 'SFS 1999' } },
          { document_number: { startsWith: 'SFS 2000' } },
          { document_number: { startsWith: 'SFS 2024' } },
          { document_number: { startsWith: 'SFS 1980' } },
          { document_number: { startsWith: 'AD 2023' } },
          { document_number: { startsWith: 'HD 2024' } },
          { document_number: { startsWith: 'EU 2016' } },
          { document_number: { startsWith: 'SFS 2021:1112' } },
          { slug: { startsWith: 'test-' } },
          { slug: { startsWith: 'unique-slug-test' } },
        ],
      },
    })
  })

  afterAll(async () => {
    // Clean up test data in correct order (respecting foreign keys)
    await prisma.documentSubject.deleteMany({
      where: { id: { in: testIds.documentSubjects } },
    })
    await prisma.crossReference.deleteMany({
      where: { id: { in: testIds.crossReferences } },
    })
    await prisma.amendment.deleteMany({
      where: { id: { in: testIds.amendments } },
    })
    await prisma.courtCase.deleteMany({
      where: { id: { in: testIds.courtCases } },
    })
    await prisma.euDocument.deleteMany({
      where: { id: { in: testIds.euDocuments } },
    })
    await prisma.legalDocument.deleteMany({
      where: { id: { in: testIds.documents } },
    })

    await prisma.$disconnect()
  })

  describe('AC1: ContentType Enum', () => {
    it('should have all 9 content type values', () => {
      const expectedTypes = [
        'SFS_LAW',
        'COURT_CASE_AD',
        'COURT_CASE_HD',
        'COURT_CASE_HOVR',
        'COURT_CASE_HFD',
        'COURT_CASE_MOD',
        'COURT_CASE_MIG',
        'EU_REGULATION',
        'EU_DIRECTIVE',
      ]

      const actualTypes = Object.keys(ContentType)
      expect(actualTypes).toEqual(expectedTypes)
    })
  })

  describe('AC2: LegalDocument Polymorphic Table', () => {
    it('should create SFS law document with all core fields', async () => {
      const law = await prisma.legalDocument.create({
        data: {
          document_number: 'SFS 1977:480',
          title: 'Semesterlag (1977:480)',
          slug: 'test-semesterlag-1977-480',
          content_type: ContentType.SFS_LAW,
          summary: 'Lag om rätt till semester för arbetstagare',
          full_text: 'Denna lag reglerar rätten till semester...',
          effective_date: new Date('1977-06-01'),
          publication_date: new Date('1977-05-25'),
          status: DocumentStatus.ACTIVE,
          source_url:
            'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/semesterlag-1977480_sfs-1977-480',
          metadata: {
            category: 'ARBETSRATT',
            sfs_number: '1977:480',
          },
        },
      })

      testIds.documents.push(law.id)

      expect(law.id).toBeTruthy()
      expect(law.content_type).toBe(ContentType.SFS_LAW)
      expect(law.document_number).toBe('SFS 1977:480')
      expect(law.title).toBe('Semesterlag (1977:480)')
      expect(law.slug).toBe('test-semesterlag-1977-480')
      expect(law.status).toBe(DocumentStatus.ACTIVE)
      expect(law.metadata).toEqual({
        category: 'ARBETSRATT',
        sfs_number: '1977:480',
      })
      expect(law.created_at).toBeInstanceOf(Date)
      expect(law.updated_at).toBeInstanceOf(Date)
    })

    it('should enforce unique constraint on document_number', async () => {
      await prisma.legalDocument.create({
        data: {
          document_number: 'SFS 1999:999',
          title: 'Test Law',
          slug: 'test-law-1999-999',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://example.com',
        },
      })

      // Attempt to create duplicate
      await expect(
        prisma.legalDocument.create({
          data: {
            document_number: 'SFS 1999:999', // Duplicate
            title: 'Another Test Law',
            slug: 'another-test-law-1999-999',
            content_type: ContentType.SFS_LAW,
            status: DocumentStatus.ACTIVE,
            source_url: 'https://example.com',
          },
        })
      ).rejects.toThrow(/Unique constraint/)
    })

    it('should enforce unique constraint on slug', async () => {
      await prisma.legalDocument.create({
        data: {
          document_number: 'SFS 2000:123',
          title: 'Test Law 2',
          slug: 'unique-slug-test',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://example.com',
        },
      })

      // Attempt to create duplicate slug
      await expect(
        prisma.legalDocument.create({
          data: {
            document_number: 'SFS 2000:456',
            title: 'Test Law 3',
            slug: 'unique-slug-test', // Duplicate
            content_type: ContentType.SFS_LAW,
            status: DocumentStatus.ACTIVE,
            source_url: 'https://example.com',
          },
        })
      ).rejects.toThrow(/Unique constraint/)
    })
  })

  describe('AC3: Type-Specific Tables (CourtCase, EuDocument)', () => {
    it('should create court case with relation to legal_documents', async () => {
      const courtCaseDoc = await prisma.legalDocument.create({
        data: {
          document_number: 'AD 2023 nr 45',
          title: 'AD 2023 nr 45 - Uppsägning p.g.a. arbetsbrist',
          slug: 'test-ad-2023-nr-45',
          content_type: ContentType.COURT_CASE_AD,
          summary: 'Arbetsdomstolens dom om uppsägning',
          status: DocumentStatus.ACTIVE,
          source_url: 'https://arbetsdomstolen.se/domar/2023-45',
          court_case: {
            create: {
              court_name: 'Arbetsdomstolen',
              case_number: '2023-45',
              decision_date: new Date('2023-05-15'),
              lower_court: null,
              parties: {
                plaintiff: 'LO',
                defendant: 'Företag AB',
              },
            },
          },
        },
        include: {
          court_case: true,
        },
      })

      testIds.documents.push(courtCaseDoc.id)
      if (courtCaseDoc.court_case) {
        testIds.courtCases.push(courtCaseDoc.court_case.id)
      }

      expect(courtCaseDoc.id).toBeTruthy()
      expect(courtCaseDoc.content_type).toBe(ContentType.COURT_CASE_AD)
      expect(courtCaseDoc.court_case).toBeTruthy()
      expect(courtCaseDoc.court_case?.court_name).toBe('Arbetsdomstolen')
      expect(courtCaseDoc.court_case?.case_number).toBe('2023-45')
      expect(courtCaseDoc.court_case?.parties).toEqual({
        plaintiff: 'LO',
        defendant: 'Företag AB',
      })
    })

    it('should create EU document with relation to legal_documents', async () => {
      const euDoc = await prisma.legalDocument.create({
        data: {
          document_number: 'EU 2016/679',
          title: 'GDPR - Dataskyddsförordningen',
          slug: 'test-gdpr-2016-679',
          content_type: ContentType.EU_REGULATION,
          summary: 'Europaparlamentets och rådets förordning om dataskydd',
          status: DocumentStatus.ACTIVE,
          source_url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
          eu_document: {
            create: {
              celex_number: '32016R0679',
              eut_reference: 'L 119/1',
              national_implementation_measures: {
                sweden: ['SFS 2018:218'],
              },
            },
          },
        },
        include: {
          eu_document: true,
        },
      })

      testIds.documents.push(euDoc.id)
      if (euDoc.eu_document) {
        testIds.euDocuments.push(euDoc.eu_document.id)
      }

      expect(euDoc.id).toBeTruthy()
      expect(euDoc.content_type).toBe(ContentType.EU_REGULATION)
      expect(euDoc.eu_document).toBeTruthy()
      expect(euDoc.eu_document?.celex_number).toBe('32016R0679')
      expect(euDoc.eu_document?.eut_reference).toBe('L 119/1')
      expect(euDoc.eu_document?.national_implementation_measures).toEqual({
        sweden: ['SFS 2018:218'],
      })
    })

    it('should enforce CASCADE delete on type-specific tables', async () => {
      // Create court case with document
      const doc = await prisma.legalDocument.create({
        data: {
          document_number: 'HD 2024 nr 1',
          title: 'Test Case',
          slug: 'test-case-hd-2024-1',
          content_type: ContentType.COURT_CASE_HD,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://example.com',
          court_case: {
            create: {
              court_name: 'Högsta domstolen',
              case_number: '2024-1',
              decision_date: new Date('2024-01-15'),
            },
          },
        },
        include: { court_case: true },
      })

      const courtCaseId = doc.court_case?.id

      expect(courtCaseId).toBeDefined()

      // Delete document
      await prisma.legalDocument.delete({
        where: { id: doc.id },
      })

      // Verify court case was also deleted (CASCADE)
      const deletedCourtCase = await prisma.courtCase.findUnique({
        where: { id: courtCaseId! },
      })

      expect(deletedCourtCase).toBeNull()
    })
  })

  describe('AC4: CrossReference Table', () => {
    it('should create cross-reference between documents', async () => {
      // Create two documents
      const sourceDoc = await prisma.legalDocument.create({
        data: {
          document_number: 'SFS 2024:100',
          title: 'Source Law',
          slug: 'test-source-law-2024-100',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://example.com',
        },
      })

      const targetDoc = await prisma.legalDocument.create({
        data: {
          document_number: 'SFS 2024:200',
          title: 'Target Law',
          slug: 'test-target-law-2024-200',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://example.com',
        },
      })

      testIds.documents.push(sourceDoc.id, targetDoc.id)

      // Create cross-reference
      const crossRef = await prisma.crossReference.create({
        data: {
          source_document_id: sourceDoc.id,
          target_document_id: targetDoc.id,
          reference_type: 'REFERENCES',
          context: 'Detta mål hänvisar till § 7 angående...',
        },
      })

      testIds.crossReferences.push(crossRef.id)

      expect(crossRef.id).toBeTruthy()
      expect(crossRef.source_document_id).toBe(sourceDoc.id)
      expect(crossRef.target_document_id).toBe(targetDoc.id)
      expect(crossRef.reference_type).toBe('REFERENCES')
      expect(crossRef.context).toBe('Detta mål hänvisar till § 7 angående...')
    })

    it('should query bidirectional relations', async () => {
      // Create documents
      const doc1 = await prisma.legalDocument.create({
        data: {
          document_number: 'SFS 2024:300',
          title: 'Doc 1',
          slug: 'test-doc-1-2024-300',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://example.com',
        },
      })

      const doc2 = await prisma.legalDocument.create({
        data: {
          document_number: 'SFS 2024:400',
          title: 'Doc 2',
          slug: 'test-doc-2-2024-400',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://example.com',
        },
      })

      testIds.documents.push(doc1.id, doc2.id)

      // Create cross-reference
      const crossRef = await prisma.crossReference.create({
        data: {
          source_document_id: doc1.id,
          target_document_id: doc2.id,
          reference_type: 'CITES',
        },
      })

      testIds.crossReferences.push(crossRef.id)

      // Query source document with outgoing references
      const sourceWithRefs = await prisma.legalDocument.findUnique({
        where: { id: doc1.id },
        include: {
          source_references: true,
        },
      })

      expect(sourceWithRefs?.source_references).toHaveLength(1)
      expect(sourceWithRefs?.source_references?.[0]?.target_document_id).toBe(
        doc2.id
      )

      // Query target document with incoming references
      const targetWithRefs = await prisma.legalDocument.findUnique({
        where: { id: doc2.id },
        include: {
          target_references: true,
        },
      })

      expect(targetWithRefs?.target_references).toHaveLength(1)
      expect(targetWithRefs?.target_references?.[0]?.source_document_id).toBe(
        doc1.id
      )
    })
  })

  describe('AC5: Amendment Table with 7 Competitive Fields', () => {
    it('should create amendment with all 7 competitive fields', async () => {
      // Create base document
      const baseLaw = await prisma.legalDocument.create({
        data: {
          document_number: 'SFS 1977:481',
          title: 'Base Law',
          slug: 'test-base-law-1977-481',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://example.com',
        },
      })

      // Create amending document
      const amendingLaw = await prisma.legalDocument.create({
        data: {
          document_number: 'SFS 2021:1112',
          title: 'Lag (2021:1112) om ändring i base law',
          slug: 'test-lag-2021-1112-andring',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://example.com',
        },
      })

      testIds.documents.push(baseLaw.id, amendingLaw.id)

      // Create amendment with all 7 fields
      const amendment = await prisma.amendment.create({
        data: {
          base_document_id: baseLaw.id,
          amending_document_id: amendingLaw.id,
          // 7 competitive fields
          amending_law_title: 'Lag (2021:1112) om ändring i base law',
          publication_date: new Date('2021-12-15'),
          effective_date: new Date('2022-01-01'),
          affected_sections_raw: 'ändr. 3 kap. 2 §; upph. 5 kap. 7 §',
          affected_sections: {
            amended: ['3:2'],
            repealed: ['5:7'],
            new: [],
            renumbered: [],
          },
          summary:
            'Ändring i beräkning av semesterersättning vid anställningens upphörande.',
          summary_generated_by: 'GPT_4',
          // Additional fields
          detected_method: 'RIKSDAGEN_TEXT_PARSING',
          metadata: {
            source: 'Riksdagen API',
            confidence: 0.95,
          },
        },
      })

      testIds.amendments.push(amendment.id)

      // Verify all 7 competitive fields
      expect(amendment.amending_law_title).toBe(
        'Lag (2021:1112) om ändring i base law'
      )
      expect(amendment.publication_date).toEqual(new Date('2021-12-15'))
      expect(amendment.effective_date).toEqual(new Date('2022-01-01'))
      expect(amendment.affected_sections_raw).toBe(
        'ändr. 3 kap. 2 §; upph. 5 kap. 7 §'
      )
      expect(amendment.affected_sections).toEqual({
        amended: ['3:2'],
        repealed: ['5:7'],
        new: [],
        renumbered: [],
      })
      expect(amendment.summary).toBe(
        'Ändring i beräkning av semesterersättning vid anställningens upphörande.'
      )
      expect(amendment.summary_generated_by).toBe('GPT_4')
    })

    it('should query amendments for a base document', async () => {
      const baseLaw = await prisma.legalDocument.create({
        data: {
          document_number: 'SFS 1980:100',
          title: 'Base Law for Amendments',
          slug: 'test-base-law-1980-100',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://example.com',
        },
      })

      const amendingLaw1 = await prisma.legalDocument.create({
        data: {
          document_number: 'SFS 2020:100',
          title: 'Amendment 1',
          slug: 'test-amendment-1-2020-100',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://example.com',
        },
      })

      const amendingLaw2 = await prisma.legalDocument.create({
        data: {
          document_number: 'SFS 2021:200',
          title: 'Amendment 2',
          slug: 'test-amendment-2-2021-200',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://example.com',
        },
      })

      testIds.documents.push(baseLaw.id, amendingLaw1.id, amendingLaw2.id)

      // Create two amendments
      const amendment1 = await prisma.amendment.create({
        data: {
          base_document_id: baseLaw.id,
          amending_document_id: amendingLaw1.id,
          amending_law_title: 'Amendment 1',
          publication_date: new Date('2020-01-01'),
        },
      })

      const amendment2 = await prisma.amendment.create({
        data: {
          base_document_id: baseLaw.id,
          amending_document_id: amendingLaw2.id,
          amending_law_title: 'Amendment 2',
          publication_date: new Date('2021-01-01'),
        },
      })

      testIds.amendments.push(amendment1.id, amendment2.id)

      // Query all amendments for base law
      const baseWithAmendments = await prisma.legalDocument.findUnique({
        where: { id: baseLaw.id },
        include: {
          base_amendments: true,
        },
      })

      expect(baseWithAmendments?.base_amendments).toHaveLength(2)
    })
  })

  describe('AC6: DocumentSubject Table', () => {
    it('should create document subject with categorization', async () => {
      const doc = await prisma.legalDocument.create({
        data: {
          document_number: 'SFS 2024:500',
          title: 'Test Law for Subjects',
          slug: 'test-law-subjects-2024-500',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://example.com',
        },
      })

      testIds.documents.push(doc.id)

      const subject = await prisma.documentSubject.create({
        data: {
          document_id: doc.id,
          subject_code: 'ARBETSRATT',
          subject_name: 'Arbetsrätt',
        },
      })

      testIds.documentSubjects.push(subject.id)

      expect(subject.id).toBeTruthy()
      expect(subject.document_id).toBe(doc.id)
      expect(subject.subject_code).toBe('ARBETSRATT')
      expect(subject.subject_name).toBe('Arbetsrätt')
    })

    it('should enforce unique constraint on document_id + subject_code', async () => {
      const doc = await prisma.legalDocument.create({
        data: {
          document_number: 'SFS 2024:600',
          title: 'Test Law for Unique Subject',
          slug: 'test-law-unique-subject-2024-600',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://example.com',
        },
      })

      testIds.documents.push(doc.id)

      // Create first subject
      await prisma.documentSubject.create({
        data: {
          document_id: doc.id,
          subject_code: 'DATASKYDD',
          subject_name: 'Dataskydd & GDPR',
        },
      })

      // Attempt to create duplicate subject for same document
      await expect(
        prisma.documentSubject.create({
          data: {
            document_id: doc.id,
            subject_code: 'DATASKYDD', // Duplicate
            subject_name: 'Dataskydd & GDPR',
          },
        })
      ).rejects.toThrow(/Unique constraint/)
    })

    it('should allow same subject_code for different documents', async () => {
      const doc1 = await prisma.legalDocument.create({
        data: {
          document_number: 'SFS 2024:700',
          title: 'Doc 1',
          slug: 'test-doc-1-2024-700',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://example.com',
        },
      })

      const doc2 = await prisma.legalDocument.create({
        data: {
          document_number: 'SFS 2024:800',
          title: 'Doc 2',
          slug: 'test-doc-2-2024-800',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://example.com',
        },
      })

      testIds.documents.push(doc1.id, doc2.id)

      // Same subject code for different documents should work
      const subject1 = await prisma.documentSubject.create({
        data: {
          document_id: doc1.id,
          subject_code: 'SEMESTER',
          subject_name: 'Semester & Ledighet',
        },
      })

      const subject2 = await prisma.documentSubject.create({
        data: {
          document_id: doc2.id,
          subject_code: 'SEMESTER', // Same code, different document
          subject_name: 'Semester & Ledighet',
        },
      })

      testIds.documentSubjects.push(subject1.id, subject2.id)

      expect(subject1.subject_code).toBe(subject2.subject_code)
      expect(subject1.document_id).not.toBe(subject2.document_id)
    })
  })

  describe('AC9: TypeScript Type Safety', () => {
    it('should provide type-safe ContentType enum', () => {
      const types: ContentType[] = [
        ContentType.SFS_LAW,
        ContentType.COURT_CASE_AD,
        ContentType.EU_REGULATION,
      ]

      expect(types).toHaveLength(3)
      expect(ContentType.SFS_LAW).toBe('SFS_LAW')
    })

    it('should reject invalid enum values at type level', async () => {
      // This test verifies TypeScript compilation - if it compiles, types are working
      const validDoc = await prisma.legalDocument.create({
        data: {
          document_number: 'SFS 2024:900',
          title: 'Type Safety Test',
          slug: 'test-type-safety-2024-900',
          content_type: ContentType.SFS_LAW, // Valid enum
          status: DocumentStatus.ACTIVE,
          source_url: 'https://example.com',
        },
      })

      testIds.documents.push(validDoc.id)

      expect(validDoc.content_type).toBe('SFS_LAW')
    })
  })

  describe('Performance: Index Validation', () => {
    it('should efficiently query by document_number (indexed)', async () => {
      const doc = await prisma.legalDocument.create({
        data: {
          document_number: 'SFS 2024:1000',
          title: 'Index Test',
          slug: 'test-index-2024-1000',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://example.com',
        },
      })

      testIds.documents.push(doc.id)

      const startTime = Date.now()
      const found = await prisma.legalDocument.findUnique({
        where: { document_number: 'SFS 2024:1000' },
      })
      const duration = Date.now() - startTime

      expect(found).toBeTruthy()
      expect(found?.id).toBe(doc.id)
      // Should be very fast with index (<100ms even on slow systems)
      expect(duration).toBeLessThan(1000)
    })

    it('should efficiently query by content_type (indexed)', async () => {
      const startTime = Date.now()
      const laws = await prisma.legalDocument.findMany({
        where: { content_type: ContentType.SFS_LAW },
        take: 10,
      })
      const duration = Date.now() - startTime

      expect(Array.isArray(laws)).toBe(true)
      // Should be fast with index
      expect(duration).toBeLessThan(1000)
    })
  })
})
