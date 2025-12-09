'use server'

import { prisma } from '@/lib/prisma'
import { ContentType } from '@prisma/client'

export interface CitingCourtCase {
  id: string
  title: string
  slug: string
  contentType: ContentType
  caseNumber: string | null
  decisionDate: Date | null
  context: string | null
  courtName: string | null
}

// Court case content types for filtering
const COURT_CASE_TYPES = [
  ContentType.COURT_CASE_AD,
  ContentType.COURT_CASE_HD,
  ContentType.COURT_CASE_HFD,
  ContentType.COURT_CASE_HOVR,
  ContentType.COURT_CASE_MOD,
  ContentType.COURT_CASE_MIG,
] as const

export async function getCourtCasesCitingLaw(
  lawId: string,
  limit: number = 10
): Promise<{ cases: CitingCourtCase[]; totalCount: number }> {
  // Get court cases that cite this law (this law is the TARGET)
  // NOTE: Prisma doesn't support orderBy on deeply nested relations.
  // We fetch and sort in memory, or use raw query for large datasets.
  const [refs, countResult] = await Promise.all([
    prisma.crossReference.findMany({
      where: {
        target_document_id: lawId,
        reference_type: 'CITES',
        source_document: {
          content_type: { in: [...COURT_CASE_TYPES] },
        },
      },
      include: {
        source_document: {
          select: {
            id: true,
            title: true,
            slug: true,
            content_type: true,
            publication_date: true,
            court_case: {
              select: {
                case_number: true,
                decision_date: true,
                court_name: true,
              },
            },
          },
        },
      },
    }),
    prisma.crossReference.count({
      where: {
        target_document_id: lawId,
        reference_type: 'CITES',
        source_document: {
          content_type: { in: [...COURT_CASE_TYPES] },
        },
      },
    }),
  ])

  // Sort by decision_date DESC in memory (Prisma limitation for nested relation ordering)
  const sortedRefs = refs.sort((a, b) => {
    const dateA = a.source_document.court_case?.decision_date?.getTime() ?? 0
    const dateB = b.source_document.court_case?.decision_date?.getTime() ?? 0
    return dateB - dateA // DESC
  })

  // Apply limit after sorting
  const limitedRefs = sortedRefs.slice(0, limit)

  return {
    cases: limitedRefs.map((ref) => ({
      id: ref.source_document.id,
      title: ref.source_document.title,
      slug: ref.source_document.slug,
      contentType: ref.source_document.content_type,
      caseNumber: ref.source_document.court_case?.case_number ?? null,
      decisionDate: ref.source_document.court_case?.decision_date ?? null,
      context: ref.context,
      courtName: ref.source_document.court_case?.court_name ?? null,
    })),
    totalCount: countResult,
  }
}

export interface ImplementedDirective {
  id: string
  title: string
  slug: string
  celexNumber: string | null
  context: string | null
}

export async function getImplementedEuDirectives(
  lawId: string
): Promise<ImplementedDirective[]> {
  const refs = await prisma.crossReference.findMany({
    where: {
      source_document_id: lawId,
      reference_type: 'IMPLEMENTS',
      target_document: {
        content_type: {
          in: [ContentType.EU_DIRECTIVE, ContentType.EU_REGULATION],
        },
      },
    },
    include: {
      target_document: {
        select: {
          id: true,
          title: true,
          slug: true,
          eu_document: {
            select: {
              celex_number: true,
            },
          },
        },
      },
    },
  })

  return refs.map((ref) => ({
    id: ref.target_document.id,
    title: ref.target_document.title,
    slug: ref.target_document.slug,
    celexNumber: ref.target_document.eu_document?.celex_number ?? null,
    context: ref.context,
  }))
}

export async function lookupLawBySfsNumber(
  sfsNumber: string
): Promise<{ slug: string; title: string } | null> {
  // SFS numbers can be in various formats: "2018:218", "SFS 2018:218", etc.
  const normalized = sfsNumber.replace(/^SFS\s*/i, '').trim()

  const law = await prisma.legalDocument.findFirst({
    where: {
      content_type: ContentType.SFS_LAW,
      OR: [
        { document_number: `SFS ${normalized}` },
        { document_number: normalized },
        { document_number: { contains: normalized } },
      ],
    },
    select: {
      slug: true,
      title: true,
    },
  })

  return law
}
