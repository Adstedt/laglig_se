/**
 * CrossReference population from linkification results
 *
 * Upserts detected references into the CrossReference table,
 * with context snippets and deduplication.
 */

import { prisma } from '@/lib/prisma'
import type { LinkedReference } from './linkify-html'

/**
 * Extract a context snippet (~100 chars) surrounding a reference in the source text.
 */
function extractContext(fullText: string, ref: LinkedReference): string {
  const { start, end } = ref.reference
  const snippetPadding = 40
  const contextStart = Math.max(0, start - snippetPadding)
  const contextEnd = Math.min(fullText.length, end + snippetPadding)

  let snippet = fullText.slice(contextStart, contextEnd).trim()

  if (contextStart > 0) snippet = '...' + snippet
  if (contextEnd < fullText.length) snippet = snippet + '...'

  return snippet
}

/**
 * Save linked references as CrossReference records.
 *
 * Handles deduplication: if a (source, target) pair already exists,
 * the context is updated rather than creating a duplicate.
 *
 * @param sourceDocumentId - The ID of the document containing the references
 * @param linkedReferences - References that were successfully linked
 * @param plainText - Plain text of the source document (for context extraction)
 * @returns Number of cross-references upserted
 */
export async function saveCrossReferences(
  sourceDocumentId: string,
  linkedReferences: LinkedReference[],
  plainText: string
): Promise<number> {
  if (linkedReferences.length === 0) return 0

  // Deduplicate: keep only unique (source, target) pairs (first occurrence wins for context)
  const seen = new Set<string>()
  const uniqueRefs: Array<{
    targetDocumentId: string
    context: string
  }> = []

  for (const ref of linkedReferences) {
    const key = ref.targetDocumentId
    if (seen.has(key)) continue
    seen.add(key)

    uniqueRefs.push({
      targetDocumentId: ref.targetDocumentId,
      context: extractContext(plainText, ref),
    })
  }

  // Delete existing REFERENCES cross-references for this source document,
  // then insert fresh ones. This is simpler and more robust than individual upserts
  // since CrossReference doesn't have a unique constraint on (source, target).
  await prisma.$transaction([
    prisma.crossReference.deleteMany({
      where: {
        source_document_id: sourceDocumentId,
        reference_type: 'REFERENCES',
      },
    }),
    prisma.crossReference.createMany({
      data: uniqueRefs.map((ref) => ({
        source_document_id: sourceDocumentId,
        target_document_id: ref.targetDocumentId,
        reference_type: 'REFERENCES' as const,
        context: ref.context,
      })),
    }),
  ])

  return uniqueRefs.length
}
