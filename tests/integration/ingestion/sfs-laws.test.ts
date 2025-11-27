import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../../../lib/prisma'
import { ContentType, DocumentStatus } from '@prisma/client'
import { generateSlug } from '../../../lib/external/riksdagen'

/**
 * Integration tests for SFS law ingestion
 *
 * Tests the data pipeline from Riksdagen API → Database
 */

describe('SFS Law Ingestion', () => {
  // Clean up test data before each test
  beforeEach(async () => {
    await prisma.amendment.deleteMany({
      where: {
        base_document: {
          document_number: {
            startsWith: 'TEST-SFS',
          },
        },
      },
    })
    await prisma.legalDocument.deleteMany({
      where: {
        document_number: {
          startsWith: 'TEST-SFS',
        },
      },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('Legal Document Creation', () => {
    it('should create SFS law with all required fields', async () => {
      const testLaw = {
        document_number: 'TEST-SFS 1977:480',
        title: 'Test Semesterlag (1977:480)',
        slug: generateSlug('Test Semesterlag (1977:480)', 'TEST-SFS 1977:480'),
        content_type: ContentType.SFS_LAW,
        full_text: 'Detta är en testlag.\n\n1 § Detta är första paragrafen.',
        publication_date: new Date('1977-06-01'),
        status: DocumentStatus.ACTIVE,
        source_url: 'https://data.riksdagen.se/dokument/test-1977-480',
        metadata: {
          ministry: 'Arbetsmarknadsdepartementet',
          lawType: 'sfst',
        },
      }

      const created = await prisma.legalDocument.create({
        data: testLaw,
      })

      expect(created.id).toBeDefined()
      expect(created.document_number).toBe('TEST-SFS 1977:480')
      expect(created.content_type).toBe('SFS_LAW')
      expect(created.status).toBe('ACTIVE')
      expect(created.full_text).toContain('testlag')
      expect(created.metadata).toMatchObject({
        ministry: 'Arbetsmarknadsdepartementet',
      })
    })

    it('should enforce unique document_number constraint', async () => {
      const testLaw = {
        document_number: 'TEST-SFS 1982:673',
        title: 'Test Law',
        slug: 'test-law-1982-673',
        content_type: ContentType.SFS_LAW,
        full_text: 'Test',
        status: DocumentStatus.ACTIVE,
        source_url: 'https://test.com',
      }

      // First insert should succeed
      await prisma.legalDocument.create({ data: testLaw })

      // Second insert with same document_number should fail
      await expect(
        prisma.legalDocument.create({ data: testLaw })
      ).rejects.toThrow()
    })

    it('should generate unique slug from title and SFS number', () => {
      const slug = generateSlug('Arbetsmiljölagen', '1977:1160')

      expect(slug).toBe('arbetsmiljolagen-1977-1160')
      expect(slug).not.toContain('ö') // Swedish chars normalized
      expect(slug).toMatch(/^[a-z0-9-]+$/) // Only lowercase, numbers, hyphens
    })
  })

  describe('Amendment Extraction', () => {
    it('should extract "Lag (YYYY:NNNN)" pattern from text', () => {
      const sampleText = `
        3 § Detta är en paragraf. Lag (2021:1112).

        4 § En annan paragraf. Lag (2022:456).

        31 § Har upphävts genom lag (2021:1112).
      `

      const amendmentPattern = /Lag \((\d{4}):(\d+)\)\.?/gi
      const matches = [...sampleText.matchAll(amendmentPattern)]

      expect(matches.length).toBeGreaterThan(0)

      // Should find unique amendment references
      const uniqueRefs = new Set(matches.map((m) => `${m[1]}:${m[2]}`))
      expect(uniqueRefs.has('2021:1112')).toBe(true)
      expect(uniqueRefs.has('2022:456')).toBe(true)
    })

    it('should create amendment record with all required fields', async () => {
      // Create base law
      const baseLaw = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-SFS 1980:100',
          title: 'Test Base Law for Amendments',
          slug: 'test-base-law-amendments-1980-100',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com',
        },
      })

      // Create amending law
      const amendingLaw = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-SFS 2021:999',
          title: 'Test Amending Law',
          slug: 'test-amending-law-2021-999',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com',
          publication_date: new Date('2021-12-15'),
        },
      })

      // Create amendment record
      const amendment = await prisma.amendment.create({
        data: {
          base_document_id: baseLaw.id,
          amending_document_id: amendingLaw.id,
          amending_law_title: amendingLaw.title,
          publication_date: amendingLaw.publication_date!,
          effective_date: new Date('2022-01-01'),
          affected_sections_raw: 'ändr. 6 kap. 17 §; upph. 8 kap. 4 §',
          affected_sections: {
            amended: ['6:17'],
            repealed: ['8:4'],
            new: [],
            renumbered: [],
          },
          summary: null, // Not yet generated
          summary_generated_by: null,
          detected_method: 'RIKSDAGEN_TEXT_PARSING',
        },
      })

      expect(amendment.id).toBeDefined()
      expect(amendment.amending_law_title).toContain('Test Amending Law')
      expect(amendment.publication_date).toEqual(new Date('2021-12-15'))
      expect(amendment.effective_date).toEqual(new Date('2022-01-01'))
      expect(amendment.affected_sections).toMatchObject({
        amended: ['6:17'],
        repealed: ['8:4'],
      })
      expect(amendment.detected_method).toBe('RIKSDAGEN_TEXT_PARSING')
    })

    it('should prevent duplicate amendment records', async () => {
      // Create base and amending laws
      const baseLaw = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-SFS 1977:480',
          title: 'Test Law',
          slug: 'test-law-1977-480',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com',
        },
      })

      const amendingLaw = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-SFS 2021:1112',
          title: 'Test Amending Law',
          slug: 'test-amending-law-2021-1112',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com',
          publication_date: new Date('2021-12-15'),
        },
      })

      // Create first amendment
      await prisma.amendment.create({
        data: {
          base_document_id: baseLaw.id,
          amending_document_id: amendingLaw.id,
          amending_law_title: 'Test',
          publication_date: new Date(),
          detected_method: 'RIKSDAGEN_TEXT_PARSING',
        },
      })

      // Check for existing amendment
      const existing = await prisma.amendment.findFirst({
        where: {
          base_document_id: baseLaw.id,
          amending_document_id: amendingLaw.id,
        },
      })

      expect(existing).toBeDefined()

      // Duplicate detection logic should skip creating second amendment
      if (existing) {
        // Skip creation (simulating ingestion script logic)
        const count = await prisma.amendment.count({
          where: {
            base_document_id: baseLaw.id,
            amending_document_id: amendingLaw.id,
          },
        })

        expect(count).toBe(1)
      }
    })
  })

  describe('Database Queries', () => {
    it('should query SFS laws by content type', async () => {
      // Create test laws
      await prisma.legalDocument.createMany({
        data: [
          {
            document_number: 'TEST-SFS 1977:480',
            title: 'Test Law 1',
            slug: 'test-law-1',
            content_type: ContentType.SFS_LAW,
            status: DocumentStatus.ACTIVE,
            source_url: 'https://test.com/1',
          },
          {
            document_number: 'TEST-SFS 1982:673',
            title: 'Test Law 2',
            slug: 'test-law-2',
            content_type: ContentType.SFS_LAW,
            status: DocumentStatus.ACTIVE,
            source_url: 'https://test.com/2',
          },
        ],
      })

      const sfsLaws = await prisma.legalDocument.findMany({
        where: {
          content_type: ContentType.SFS_LAW,
          document_number: {
            startsWith: 'TEST-SFS',
          },
        },
      })

      expect(sfsLaws).toHaveLength(2)
      expect(sfsLaws.every((law) => law.content_type === 'SFS_LAW')).toBe(true)
    })

    it('should query amendments with relations', async () => {
      // Create base law
      const baseLaw = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-SFS 1977:480',
          title: 'Test Base Law',
          slug: 'test-base-law',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com',
        },
      })

      // Create amending law
      const amendingLaw = await prisma.legalDocument.create({
        data: {
          document_number: 'TEST-SFS 2021:1112',
          title: 'Test Amending Law',
          slug: 'test-amending-law',
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.ACTIVE,
          source_url: 'https://test.com',
          publication_date: new Date('2021-12-15'),
        },
      })

      // Create amendment
      await prisma.amendment.create({
        data: {
          base_document_id: baseLaw.id,
          amending_document_id: amendingLaw.id,
          amending_law_title: 'Test',
          publication_date: new Date(),
          detected_method: 'RIKSDAGEN_TEXT_PARSING',
        },
      })

      // Query with relations
      const lawWithAmendments = await prisma.legalDocument.findUnique({
        where: { id: baseLaw.id },
        include: {
          base_amendments: {
            include: {
              amending_document: true,
            },
          },
        },
      })

      expect(lawWithAmendments).toBeDefined()
      expect(lawWithAmendments?.base_amendments).toHaveLength(1)
      expect(
        lawWithAmendments?.base_amendments[0]?.amending_document.title
      ).toBe('Test Amending Law')
    })
  })

  describe('Duplicate Detection', () => {
    it('should detect existing law before insert', async () => {
      const documentNumber = 'TEST-SFS 1977:480'

      // Create first law
      await prisma.legalDocument.create({
        data: {
          document_number: documentNumber,
          title: 'Test Law',
          slug: 'test-law',
          content_type: ContentType.SFS_LAW,
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

      // Ingestion script should skip if existing
      if (existing) {
        // Skip creation
        const count = await prisma.legalDocument.count({
          where: { document_number: documentNumber },
        })

        expect(count).toBe(1) // Only one record
      }
    })
  })
})
