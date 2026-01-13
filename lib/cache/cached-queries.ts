/**
 * Cached Document Queries (Story 2.19)
 *
 * Wraps document detail queries with Next.js data cache (unstable_cache)
 * for faster page loading. These queries power individual document pages
 * like /lagar/[id], /rattsfall/[court]/[id], and /eu/[type]/[id].
 *
 * Cache Strategy:
 * - All document queries: 1 hour TTL (content changes infrequently)
 * - Cache tags enable selective invalidation when sync jobs complete
 * - Tags: 'laws', 'court-cases', 'eu-legislation' for type-specific invalidation
 */

import { unstable_cache } from 'next/cache'
import { prisma, withRetry } from '@/lib/prisma'
import { ContentType } from '@prisma/client'
import { parseSfsFromSlug } from '@/lib/sfs/amendment-slug'
import { getCachedDocument } from '@/lib/services/document-cache'

/**
 * Get a cached law document by slug
 * Used by /lagar/[id]/page.tsx
 * 
 * UPDATED: Now uses centralized Redis cache for document content
 * This means when ANY user accesses a document ANYWHERE (modal, public, etc),
 * all subsequent accesses benefit from the same cache entry!
 */
export const getCachedLaw = unstable_cache(
  async (slug: string) => {
    // First get the document metadata and relations (lighter query)
    const doc = await withRetry(() =>
      prisma.legalDocument.findUnique({
        where: { slug, content_type: ContentType.SFS_LAW },
        select: {
          id: true, // Need ID to fetch from centralized cache
          title: true,
          document_number: true,
          slug: true,
          status: true,
          source_url: true,
          publication_date: true,
          effective_date: true,
          // Don't fetch HTML here - get from centralized cache
          subjects: {
            select: {
              subject_code: true,
              subject_name: true,
            },
          },
          base_amendments: {
            include: {
              amending_document: {
                select: {
                  slug: true,
                  document_number: true,
                  title: true,
                },
              },
            },
            orderBy: { effective_date: 'desc' },
          },
        },
      })
    )
    
    if (!doc) return null
    
    // Now get the HTML content from centralized Redis cache
    // This is shared across ALL users and ALL access patterns!
    const cachedDoc = await getCachedDocument(doc.id)
    console.log(`📚 Public page fetching document ${doc.document_number} - cache ${cachedDoc ? 'HIT' : 'MISS'}`)
    
    // Merge the cached content with the metadata
    return {
      ...doc,
      html_content: cachedDoc?.htmlContent || null,
      summary: cachedDoc?.summary || null,
      full_text: cachedDoc?.fullText || null,
      content_type: ContentType.SFS_LAW,
    }
  },
  ['law-by-slug'],
  {
    revalidate: 3600, // 1 hour TTL
    tags: ['laws', 'documents'],
  }
)

/**
 * Get a cached law document for metadata generation (lighter query)
 * Used by generateMetadata in /lagar/[id]/page.tsx
 */
export const getCachedLawMetadata = unstable_cache(
  async (slug: string) => {
    return withRetry(() =>
      prisma.legalDocument.findUnique({
        where: { slug, content_type: ContentType.SFS_LAW },
        select: {
          title: true,
          document_number: true,
          summary: true,
          full_text: true,
          slug: true,
        },
      })
    )
  },
  ['law-metadata'],
  {
    revalidate: 3600, // 1 hour TTL
    tags: ['laws', 'documents'],
  }
)

/**
 * Get a cached court case document by slug and court type
 * Used by /rattsfall/[court]/[id]/page.tsx
 *
 * Note: unstable_cache serializes to JSON, so Date objects become strings.
 * The consuming code should handle this - dates will be ISO strings.
 */
export const getCachedCourtCase = unstable_cache(
  async (slug: string, contentType: ContentType) => {
    const result = await withRetry(() =>
      prisma.legalDocument.findUnique({
        where: { slug, content_type: contentType },
        include: {
          court_case: true,
          source_references: {
            where: {
              target_document: {
                content_type: ContentType.SFS_LAW,
              },
            },
            include: {
              target_document: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  document_number: true,
                },
              },
            },
            take: 20,
          },
        },
      })
    )
    return result
  },
  ['court-case-by-slug'],
  {
    revalidate: 3600, // 1 hour TTL
    tags: ['court-cases', 'documents'],
  }
)

/**
 * Get cached court case metadata for SEO
 * Used by generateMetadata in /rattsfall/[court]/[id]/page.tsx
 */
export const getCachedCourtCaseMetadata = unstable_cache(
  async (slug: string, contentType: ContentType) => {
    return withRetry(() =>
      prisma.legalDocument.findUnique({
        where: { slug, content_type: contentType },
        select: {
          title: true,
          document_number: true,
          summary: true,
          full_text: true,
          slug: true,
          court_case: {
            select: {
              court_name: true,
              case_number: true,
            },
          },
        },
      })
    )
  },
  ['court-case-metadata'],
  {
    revalidate: 3600, // 1 hour TTL
    tags: ['court-cases', 'documents'],
  }
)

/**
 * Get a cached EU legislation document by slug and type
 * Used by /eu/[type]/[id]/page.tsx
 */
export const getCachedEuLegislation = unstable_cache(
  async (slug: string, contentType: ContentType) => {
    return withRetry(() =>
      prisma.legalDocument.findUnique({
        where: { slug, content_type: contentType },
        include: {
          eu_document: true,
        },
      })
    )
  },
  ['eu-legislation-by-slug'],
  {
    revalidate: 3600, // 1 hour TTL
    tags: ['eu-legislation', 'documents'],
  }
)

/**
 * Get cached EU legislation metadata for SEO
 * Used by generateMetadata in /eu/[type]/[id]/page.tsx
 */
export const getCachedEuLegislationMetadata = unstable_cache(
  async (slug: string, contentType: ContentType) => {
    return withRetry(() =>
      prisma.legalDocument.findUnique({
        where: { slug, content_type: contentType },
        select: {
          title: true,
          document_number: true,
          summary: true,
          full_text: true,
          slug: true,
          eu_document: {
            select: {
              celex_number: true,
            },
          },
        },
      })
    )
  },
  ['eu-legislation-metadata'],
  {
    revalidate: 3600, // 1 hour TTL
    tags: ['eu-legislation', 'documents'],
  }
)

/**
 * Get cached list of top laws for static generation
 * Used by generateStaticParams in /lagar/[id]/page.tsx
 *
 * Note: Limit reduced from 500 to 50 to prevent connection pool exhaustion
 * during Vercel build. Non-pregenerated pages use ISR (dynamicParams=true).
 */
export const getTopLawsForStaticGeneration = unstable_cache(
  async (limit: number = 50) => {
    return withRetry(() =>
      prisma.legalDocument.findMany({
        where: { content_type: ContentType.SFS_LAW },
        orderBy: [
          // Sort by amendment_count (most amended = most important) would be ideal
          // but we don't have that field, so use effective_date as proxy
          { effective_date: 'desc' },
        ],
        take: limit,
        select: { slug: true },
      })
    )
  },
  ['top-laws-static'],
  {
    revalidate: 86400, // 24 hour TTL (doesn't change often)
    tags: ['laws', 'static-generation'],
  }
)

/**
 * Get cached list of top court cases for static generation
 * Used by generateStaticParams in /rattsfall/[court]/[id]/page.tsx
 */
export const getTopCourtCasesForStaticGeneration = unstable_cache(
  async (contentType: ContentType, limit: number = 50) => {
    return withRetry(() =>
      prisma.legalDocument.findMany({
        where: { content_type: contentType },
        orderBy: { publication_date: 'desc' },
        take: limit,
        select: { slug: true },
      })
    )
  },
  ['top-court-cases-static'],
  {
    revalidate: 86400, // 24 hour TTL
    tags: ['court-cases', 'static-generation'],
  }
)

/**
 * Get cached list of top court cases for all courts
 * Returns slugs with their court URL segment
 */
export const getAllTopCourtCasesForStaticGeneration = unstable_cache(
  async (limitPerCourt: number = 35) => {
    // Map of content type to URL segment
    const courtMap: Record<ContentType, string> = {
      COURT_CASE_HD: 'hd',
      COURT_CASE_HOVR: 'hovr',
      COURT_CASE_HFD: 'hfd',
      COURT_CASE_AD: 'ad',
      COURT_CASE_MOD: 'mod',
      COURT_CASE_MIG: 'mig',
      SFS_LAW: '', // Not a court
      SFS_AMENDMENT: '', // Not a court
      EU_REGULATION: '', // Not a court
      EU_DIRECTIVE: '', // Not a court
    }

    const courtTypes: ContentType[] = [
      'COURT_CASE_HD',
      'COURT_CASE_HOVR',
      'COURT_CASE_HFD',
      'COURT_CASE_AD',
      'COURT_CASE_MOD',
      'COURT_CASE_MIG',
    ]

    const allCases: { court: string; id: string }[] = []

    for (const courtType of courtTypes) {
      const cases = await withRetry(() =>
        prisma.legalDocument.findMany({
          where: { content_type: courtType },
          orderBy: { publication_date: 'desc' },
          take: limitPerCourt,
          select: { slug: true },
        })
      )

      const courtSlug = courtMap[courtType]
      if (courtSlug) {
        allCases.push(
          ...cases.map((c) => ({
            court: courtSlug,
            id: c.slug,
          }))
        )
      }
    }

    return allCases
  },
  ['all-top-court-cases-static'],
  {
    revalidate: 86400, // 24 hour TTL
    tags: ['court-cases', 'static-generation'],
  }
)

/**
 * Get a cached amendment document by slug (Story 2.29)
 * Used by /lagar/andringar/[id]/page.tsx
 *
 * Looks up both LegalDocument (for page display) and AmendmentDocument (for details)
 */
export const getCachedAmendment = unstable_cache(
  async (slug: string) => {
    // First get the LegalDocument
    const legalDoc = await withRetry(() =>
      prisma.legalDocument.findUnique({
        where: { slug, content_type: ContentType.SFS_AMENDMENT },
        include: {
          subjects: {
            select: {
              subject_code: true,
              subject_name: true,
            },
          },
        },
      })
    )

    if (!legalDoc) return null

    // Extract the SFS number to find the AmendmentDocument
    const sfsNumber = parseSfsFromSlug(slug)
    if (!sfsNumber) {
      return { ...legalDoc, amendmentDetails: null, baseLaw: null }
    }

    // Get detailed amendment info from AmendmentDocument
    const amendmentDoc = await withRetry(() =>
      prisma.amendmentDocument.findUnique({
        where: { sfs_number: sfsNumber },
        include: {
          section_changes: {
            orderBy: { sort_order: 'asc' },
          },
        },
      })
    )

    // Get base law info if available
    let baseLaw = null
    if (amendmentDoc?.base_law_sfs) {
      baseLaw = await withRetry(() =>
        prisma.legalDocument.findUnique({
          where: { document_number: `SFS ${amendmentDoc.base_law_sfs}` },
          select: {
            id: true,
            slug: true,
            title: true,
            document_number: true,
          },
        })
      )
    }

    return {
      ...legalDoc,
      amendmentDetails: amendmentDoc,
      baseLaw,
    }
  },
  ['amendment-by-slug'],
  {
    revalidate: 3600, // 1 hour TTL
    tags: ['amendments', 'laws', 'documents'],
  }
)

/**
 * Get cached amendment metadata for SEO (Story 2.29)
 * Used by generateMetadata in /lagar/andringar/[id]/page.tsx
 */
export const getCachedAmendmentMetadata = unstable_cache(
  async (slug: string) => {
    return withRetry(() =>
      prisma.legalDocument.findUnique({
        where: { slug, content_type: ContentType.SFS_AMENDMENT },
        select: {
          title: true,
          document_number: true,
          summary: true,
          full_text: true,
          slug: true,
          metadata: true,
        },
      })
    )
  },
  ['amendment-metadata'],
  {
    revalidate: 3600, // 1 hour TTL
    tags: ['amendments', 'laws', 'documents'],
  }
)
