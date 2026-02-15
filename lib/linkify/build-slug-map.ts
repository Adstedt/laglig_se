/**
 * Build an in-memory lookup map from document_number → slug/type/title
 *
 * Used during linkification to resolve detected references to actual
 * document URLs. Batch-fetched in a single query to avoid N+1.
 */

import { prisma } from '@/lib/prisma'

export interface SlugMapEntry {
  slug: string
  contentType: string
  title: string
  id: string
}

export type SlugMap = Map<string, SlugMapEntry>

/**
 * Fetch all documents from the database and build a Map keyed by document_number.
 *
 * Only fetches the four columns needed for linkification (plus id for CrossReference).
 * Safe to cache and reuse across documents during bulk processing.
 */
export async function buildSlugMap(): Promise<SlugMap> {
  const documents = await prisma.legalDocument.findMany({
    select: {
      id: true,
      document_number: true,
      slug: true,
      content_type: true,
      title: true,
    },
  })

  const map: SlugMap = new Map()

  for (const doc of documents) {
    map.set(doc.document_number, {
      slug: doc.slug,
      contentType: doc.content_type,
      title: doc.title,
      id: doc.id,
    })
  }

  return map
}
