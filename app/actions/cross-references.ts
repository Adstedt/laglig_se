'use server'

import { prisma } from '@/lib/prisma'
import { ContentType } from '@prisma/client'

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
