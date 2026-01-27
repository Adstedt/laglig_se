import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../../../lib/prisma'
import { ContentType, DocumentStatus } from '@prisma/client'

/**
 * Integration tests for Court Case ingestion from Domstolsverket PUH API
 *
 * Tests the data pipeline from Domstolsverket API → Database
 */

describe('Court Case Ingestion', () => {
  // Clean up test data before each test
  beforeEach(async () => {
    // Delete cross-references first due to FK constraints
    await prisma.crossReference.deleteMany({
      where: {
        source_document: {
          document_number: {
            startsWith: 'TEST-',
          },
        },
      },
    })
    await prisma.courtCase.deleteMany({
      where: {
        document: {
          document_number: {
            startsWith: 'TEST-',
          },
        },
      },
    })
    await prisma.legalDocument.deleteMany({
      where: {
        document_number: {
          startsWith: 'TEST-',
        },
      },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('Legal Document Creation for Court Cases', () => {
    it('should create court case with all required fields', async () => {
      const testCase = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-AD 2024 nr 10',
          title: 'Test arbetsdomstolens dom',
          slug: 'test-ad-2024-nr-10',
          content_type: ContentType.COURT_CASE_AD,
          full_text: 'Detta är ett testfall.\n\nDomslut: Käromålet ogillas.',
          html_content:
            '<p>Detta är ett testfall.</p><p>Domslut: Käromålet ogillas.</p>',
          publication_date: new Date('2024-01-15'),
          status: DocumentStatus.ACTIVE,
          source_url: 'https://rattspraxis.etjanst.domstol.se/test',
          metadata: {
            api_id: 'test-123',
            ecli: 'ECLI:SE:AD:2024:10',
            is_guiding: true,
            case_numbers: ['A 100/23'],
            keywords: ['uppsägning', 'arbetsbrist'],
            legal_areas: ['Arbetsrätt'],
          },
        },
      })

      expect(testCase.id).toBeDefined()
      expect(testCase.document_number).toBe('TEST-AD 2024 nr 10')
      expect(testCase.content_type).toBe('COURT_CASE_AD')
      expect(testCase.status).toBe('ACTIVE')
      expect(testCase.full_text).toContain('testfall')
      expect(testCase.html_content).toContain('<p>')
      expect(testCase.metadata).toMatchObject({
        ecli: 'ECLI:SE:AD:2024:10',
        is_guiding: true,
      })
    })

    it('should create HD (Högsta domstolen) case', async () => {
      const testCase = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-NJA 2024 s. 100',
          title: 'Test HD referat',
          slug: 'test-nja-2024-s-100',
          content_type: ContentType.COURT_CASE_HD,
          full_text: 'Högsta domstolens referat...',
          status: DocumentStatus.ACTIVE,
          source_url: 'https://rattspraxis.etjanst.domstol.se/test-hd',
          metadata: {
            api_id: 'test-hd-456',
          },
        },
      })

      expect(testCase.content_type).toBe('COURT_CASE_HD')
      expect(testCase.document_number).toContain('NJA')
    })

    it('should create HFD (Högsta förvaltningsdomstolen) case', async () => {
      const testCase = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-HFD 2024 ref. 15',
          title: 'Test HFD referat',
          slug: 'test-hfd-2024-ref-15',
          content_type: ContentType.COURT_CASE_HFD,
          full_text: 'Högsta förvaltningsdomstolens referat...',
          status: DocumentStatus.ACTIVE,
          source_url: 'https://rattspraxis.etjanst.domstol.se/test-hfd',
        },
      })

      expect(testCase.content_type).toBe('COURT_CASE_HFD')
    })

    it('should create HovR (Hovrätt) case', async () => {
      const testCase = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-RH 2024:50',
          title: 'Test Hovrättsdom',
          slug: 'test-rh-2024-50',
          content_type: ContentType.COURT_CASE_HOVR,
          full_text: 'Svea hovrätts dom...',
          status: DocumentStatus.ACTIVE,
          source_url: 'https://rattspraxis.etjanst.domstol.se/test-hovr',
          metadata: {
            court_code: 'HSV',
          },
        },
      })

      expect(testCase.content_type).toBe('COURT_CASE_HOVR')
    })

    it('should enforce unique document_number constraint', async () => {
      const testCase = {
        document_number: 'TEST-AD 2024 nr 99',
        title: 'Test Case',
        slug: 'test-case-2024-99',
        content_type: ContentType.COURT_CASE_AD,
        full_text: 'Test',
        status: DocumentStatus.ACTIVE,
        source_url: 'https://test.com',
      }

      // First insert should succeed
      await prisma.legalDocument.create({ data: testCase })

      // Second insert with same document_number should fail
      await expect(
        prisma.legalDocument.create({ data: testCase })
      ).rejects.toThrow()
    })
  })

  describe('Court Case Table Creation', () => {
    it('should create court_case record linked to legal_document', async () => {
      // Create legal document first
      const legalDoc = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-AD 2024 nr 20',
          title: 'Test Case with Details',
          slug: 'test-case-with-details',
          content_type: ContentType.COURT_CASE_AD,
          full_text: 'Test content',
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com',
        },
      })

      // Create court_case record
      const courtCase = await prisma.courtCase.create({
        data: {
          document_id: legalDoc.id,
          court_name: 'Arbetsdomstolen',
          case_number: 'A 100/23',
          decision_date: new Date('2024-01-15'),
        },
      })

      expect(courtCase.id).toBeDefined()
      expect(courtCase.court_name).toBe('Arbetsdomstolen')
      expect(courtCase.case_number).toBe('A 100/23')
      expect(courtCase.decision_date).toEqual(new Date('2024-01-15'))

      // Verify relation works
      const docWithCourtCase = await prisma.legalDocument.findUnique({
        where: { id: legalDoc.id },
        include: { court_case: true },
      })

      expect(docWithCourtCase?.court_case).toBeDefined()
      expect(docWithCourtCase?.court_case?.court_name).toBe('Arbetsdomstolen')
    })
  })

  describe('Cross-Reference Creation', () => {
    it('should create cross-reference from court case to SFS law', async () => {
      // Create court case document
      const courtCaseDoc = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-AD 2024 nr 30',
          title: 'Test Case with Law Reference',
          slug: 'test-case-law-ref',
          content_type: ContentType.COURT_CASE_AD,
          full_text: 'Enligt 6 § semesterlagen (1977:480) ska...',
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com',
        },
      })

      // Create SFS law document
      const sfsLaw = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-SFS 1977:480',
          title: 'Semesterlag (1977:480)',
          slug: 'test-semesterlag-1977-480',
          content_type: ContentType.SFS_LAW,
          full_text: 'Semesterlagen',
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com/sfs',
        },
      })

      // Create cross-reference
      const crossRef = await prisma.crossReference.create({
        data: {
          source_document_id: courtCaseDoc.id,
          target_document_id: sfsLaw.id,
          reference_type: 'CITES',
          context: '6 §',
        },
      })

      expect(crossRef.id).toBeDefined()
      expect(crossRef.reference_type).toBe('CITES')
      expect(crossRef.context).toBe('6 §')

      // Verify relation works both ways
      const caseWithRefs = await prisma.legalDocument.findUnique({
        where: { id: courtCaseDoc.id },
        include: {
          source_references: {
            include: { target_document: true },
          },
        },
      })

      expect(caseWithRefs?.source_references).toHaveLength(1)
      expect(
        caseWithRefs?.source_references[0]?.target_document.document_number
      ).toBe('TEST-SFS 1977:480')
    })

    it('should handle multiple law references from single court case', async () => {
      // Create court case document
      const courtCaseDoc = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-AD 2024 nr 40',
          title: 'Test Case with Multiple Refs',
          slug: 'test-case-multi-refs',
          content_type: ContentType.COURT_CASE_AD,
          full_text:
            'Enligt semesterlagen (1977:480) och arbetsmiljölagen (1977:1160)...',
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com',
        },
      })

      // Create two SFS law documents
      const law1 = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-SFS 1977:480',
          title: 'Semesterlag (1977:480)',
          slug: 'test-semesterlag',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com/1',
        },
      })

      const law2 = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-SFS 1977:1160',
          title: 'Arbetsmiljölag (1977:1160)',
          slug: 'test-arbetsmiljolag',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com/2',
        },
      })

      // Create cross-references
      await prisma.crossReference.createMany({
        data: [
          {
            source_document_id: courtCaseDoc.id,
            target_document_id: law1.id,
            reference_type: 'CITES',
          },
          {
            source_document_id: courtCaseDoc.id,
            target_document_id: law2.id,
            reference_type: 'CITES',
          },
        ],
      })

      // Verify count
      const refCount = await prisma.crossReference.count({
        where: { source_document_id: courtCaseDoc.id },
      })

      expect(refCount).toBe(2)
    })
  })

  describe('Database Queries', () => {
    it('should query court cases by content type', async () => {
      // Create test cases of different types
      await prisma.legalDocument.createMany({
        data: [
          {
            document_number: 'TEST-AD 2024 nr 50',
            title: 'AD Case 1',
            slug: 'test-ad-case-1',
            content_type: ContentType.COURT_CASE_AD,
            status: DocumentStatus.ACTIVE,
            source_url: 'https://test.com/1',
          },
          {
            document_number: 'TEST-AD 2024 nr 51',
            title: 'AD Case 2',
            slug: 'test-ad-case-2',
            content_type: ContentType.COURT_CASE_AD,
            status: DocumentStatus.ACTIVE,
            source_url: 'https://test.com/2',
          },
          {
            document_number: 'TEST-NJA 2024 s. 200',
            title: 'HD Case 1',
            slug: 'test-hd-case-1',
            content_type: ContentType.COURT_CASE_HD,
            status: DocumentStatus.ACTIVE,
            source_url: 'https://test.com/3',
          },
        ],
      })

      // Query only AD cases
      const adCases = await prisma.legalDocument.findMany({
        where: {
          content_type: ContentType.COURT_CASE_AD,
          document_number: { startsWith: 'TEST-' },
        },
      })

      expect(adCases).toHaveLength(2)
      expect(adCases.every((c) => c.content_type === 'COURT_CASE_AD')).toBe(
        true
      )
    })

    it('should query court cases with court_case relation', async () => {
      // Create legal document and court case
      const legalDoc = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-AD 2024 nr 60',
          title: 'Test Case for Query',
          slug: 'test-case-query',
          content_type: ContentType.COURT_CASE_AD,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com',
        },
      })

      await prisma.courtCase.create({
        data: {
          document_id: legalDoc.id,
          court_name: 'Arbetsdomstolen',
          case_number: 'A 200/23',
          decision_date: new Date('2024-03-15'),
        },
      })

      // Query with relation
      const result = await prisma.legalDocument.findUnique({
        where: { document_number: 'TEST-AD 2024 nr 60' },
        include: { court_case: true },
      })

      expect(result).toBeDefined()
      expect(result?.court_case?.court_name).toBe('Arbetsdomstolen')
      expect(result?.court_case?.decision_date).toEqual(new Date('2024-03-15'))
    })

    it('should query cross-references from court cases', async () => {
      // Create court case
      const courtCase = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-AD 2024 nr 70',
          title: 'Test Case for CrossRef Query',
          slug: 'test-crossref-query',
          content_type: ContentType.COURT_CASE_AD,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com',
        },
      })

      // Create target law
      const targetLaw = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-SFS 2020:123',
          title: 'Target Law',
          slug: 'test-target-law',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com/law',
        },
      })

      // Create cross-reference
      await prisma.crossReference.create({
        data: {
          source_document_id: courtCase.id,
          target_document_id: targetLaw.id,
          reference_type: 'CITES',
          context: '15 kap. 4 §',
        },
      })

      // Query cross-references from court cases to SFS laws
      const refs = await prisma.crossReference.findMany({
        where: {
          source_document: { content_type: ContentType.COURT_CASE_AD },
          target_document: { content_type: ContentType.SFS_LAW },
          source_document_id: courtCase.id,
        },
        include: {
          source_document: { select: { document_number: true } },
          target_document: { select: { document_number: true } },
        },
      })

      expect(refs).toHaveLength(1)
      expect(refs[0].source_document.document_number).toBe('TEST-AD 2024 nr 70')
      expect(refs[0].target_document.document_number).toBe('TEST-SFS 2020:123')
      expect(refs[0].context).toBe('15 kap. 4 §')
    })
  })

  describe('Duplicate Detection', () => {
    it('should detect existing court case before insert', async () => {
      const documentNumber = 'TEST-AD 2024 nr 80'

      // Create first case
      await prisma.legalDocument.create({
        data: {
          document_number: documentNumber,
          title: 'First Case',
          slug: 'first-case',
          content_type: ContentType.COURT_CASE_AD,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com',
        },
      })

      // Check for existing (simulating ingestion script logic)
      const existing = await prisma.legalDocument.findUnique({
        where: { document_number: documentNumber },
      })

      expect(existing).toBeDefined()
      expect(existing?.document_number).toBe(documentNumber)
    })

    it('should update existing case instead of creating duplicate', async () => {
      const documentNumber = 'TEST-AD 2024 nr 90'

      // Create initial case
      const initial = await prisma.legalDocument.create({
        data: {
          document_number: documentNumber,
          title: 'Initial Title',
          slug: 'initial-case',
          content_type: ContentType.COURT_CASE_AD,
          full_text: 'Initial content',
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com',
        },
      })

      // Simulate upsert logic from ingestion script
      const updated = await prisma.legalDocument.update({
        where: { document_number: documentNumber },
        data: {
          title: 'Updated Title',
          full_text: 'Updated content',
        },
      })

      expect(updated.id).toBe(initial.id) // Same record
      expect(updated.title).toBe('Updated Title')
      expect(updated.full_text).toBe('Updated content')

      // Verify only one record exists
      const count = await prisma.legalDocument.count({
        where: { document_number: documentNumber },
      })
      expect(count).toBe(1)
    })
  })

  describe('Content Verification', () => {
    it('should store both full_text and html_content', async () => {
      const htmlContent =
        '<div><h1>Dom</h1><p>Domslut: Överklagandet avslås.</p></div>'
      const plainText = 'Dom\n\nDomslut: Överklagandet avslås.'

      const courtCase = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-HD 2024 s. 100',
          title: 'Test HD Case',
          slug: 'test-hd-case-content',
          content_type: ContentType.COURT_CASE_HD,
          full_text: plainText,
          html_content: htmlContent,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com',
        },
      })

      expect(courtCase.full_text).toBe(plainText)
      expect(courtCase.html_content).toBe(htmlContent)
      expect(courtCase.full_text).not.toContain('<')
      expect(courtCase.html_content).toContain('<h1>')
    })

    it('should store metadata JSON correctly', async () => {
      const metadata = {
        api_id: 'abc-123',
        ecli: 'ECLI:SE:AD:2024:50',
        is_guiding: true,
        case_numbers: ['A 100/23', 'A 101/23'],
        keywords: ['avskedande', 'saklig grund'],
        legal_areas: ['Arbetsrätt', 'Processrätt'],
        ad_case_number: 'AD 2024 Dom nr 50',
        preparatory_works: ['prop. 2020/21:100'],
        sfs_refs: ['1977:480', '1982:673'],
      }

      const courtCase = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-AD 2024 nr 100',
          title: 'Test Metadata Storage',
          slug: 'test-metadata',
          content_type: ContentType.COURT_CASE_AD,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com',
          metadata: metadata,
        },
      })

      const retrieved = await prisma.legalDocument.findUnique({
        where: { id: courtCase.id },
      })

      expect(retrieved?.metadata).toMatchObject(metadata)
      expect(
        (retrieved?.metadata as Record<string, unknown>).case_numbers
      ).toEqual(['A 100/23', 'A 101/23'])
      expect(
        (retrieved?.metadata as Record<string, unknown>).keywords
      ).toContain('avskedande')
    })
  })
})
