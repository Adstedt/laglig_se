/**
 * Backfill script: Linkify existing LegalDocument html_content
 *
 * Processes all documents with html_content in batches, injecting
 * <a class="legal-ref"> links and populating CrossReference records.
 *
 * Safe to re-run (idempotent): strips existing legal-ref links before re-linkifying.
 *
 * Usage:
 *   npx tsx scripts/backfill-linkify.ts [--dry-run] [--limit N]
 *   npx tsx scripts/backfill-linkify.ts --doc "SFS 1982:673" --doc "AFS 2001:1"
 */

import { prisma } from '@/lib/prisma'
import { buildSlugMap, linkifyHtmlContent } from '@/lib/linkify'
import type { LinkedReference } from '@/lib/linkify/linkify-html'
import { htmlToPlainText } from '@/lib/transforms/html-to-markdown'

const BATCH_SIZE = 100
const WRITE_CONCURRENCY = 5 // parallel HTML updates (Prisma pool ≈ 10)

interface Stats {
  totalDocuments: number
  processed: number
  updated: number
  skipped: number
  totalLinksCreated: number
  totalCrossRefsUpserted: number
  errors: number
}

/** Parse --doc arguments (can appear multiple times) */
function parseDocArgs(args: string[]): string[] {
  const docs: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--doc' && args[i + 1]) {
      docs.push(args[i + 1]!)
      i++
    }
  }
  return docs
}

/** Extract a context snippet (~100 chars) surrounding a reference in the source text. */
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

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]!, 10) : undefined
  const targetDocs = parseDocArgs(args)

  if (dryRun) console.log('[DRY RUN] No database writes will be made.\n')

  console.log('Building slug map...')
  const slugMap = await buildSlugMap()
  console.log(`Slug map: ${slugMap.size} documents indexed.\n`)

  // Build the where clause
  const where =
    targetDocs.length > 0
      ? { document_number: { in: targetDocs }, html_content: { not: null } }
      : { html_content: { not: null } as const }

  // Count total documents to process
  const totalCount = await prisma.legalDocument.count({ where })

  if (targetDocs.length > 0) {
    console.log(
      `Targeting ${targetDocs.length} document(s): ${targetDocs.join(', ')}`
    )
    console.log(`Found ${totalCount} matching document(s) with html_content.\n`)
  }

  const effectiveTotal = limit ? Math.min(limit, totalCount) : totalCount
  if (!targetDocs.length) {
    console.log(`Documents with html_content: ${totalCount}`)
    if (limit) console.log(`Processing limited to: ${limit}`)
    console.log(`Batch size: ${BATCH_SIZE}\n`)
  }

  const stats: Stats = {
    totalDocuments: effectiveTotal,
    processed: 0,
    updated: 0,
    skipped: 0,
    totalLinksCreated: 0,
    totalCrossRefsUpserted: 0,
    errors: 0,
  }

  const startTime = Date.now()
  let cursor: string | undefined

  while (stats.processed < effectiveTotal) {
    const remaining = effectiveTotal - stats.processed
    const take = Math.min(BATCH_SIZE, remaining)

    const batch = await prisma.legalDocument.findMany({
      where,
      select: {
        id: true,
        document_number: true,
        html_content: true,
        full_text: true,
        title: true,
      },
      orderBy: { id: 'asc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })

    if (batch.length === 0) break

    // ── Phase 1: CPU work — linkify all docs (synchronous, fast) ──
    const toWrite: Array<{
      id: string
      document_number: string
      linkifiedHtml: string
      linkedReferences: LinkedReference[]
      plainText: string
    }> = []

    for (const doc of batch) {
      stats.processed++
      try {
        const htmlContent = doc.html_content!
        const { html: linkifiedHtml, linkedReferences } = linkifyHtmlContent(
          htmlContent,
          slugMap,
          doc.document_number
        )

        if (linkedReferences.length === 0) {
          stats.skipped++
          if (targetDocs.length > 0) {
            console.log(`  ${doc.document_number}: no references found`)
          }
          continue
        }

        stats.totalLinksCreated += linkedReferences.length

        if (targetDocs.length > 0) {
          console.log(
            `  ${doc.document_number}: ${linkedReferences.length} links → ${[...new Set(linkedReferences.map((r) => r.reference.matchedText))].join(', ')}`
          )
        }

        if (dryRun) {
          stats.totalCrossRefsUpserted += new Set(
            linkedReferences.map((r) => r.targetDocumentId)
          ).size
          stats.updated++
          continue
        }

        toWrite.push({
          id: doc.id,
          document_number: doc.document_number!,
          linkifiedHtml,
          linkedReferences,
          plainText: doc.full_text ?? htmlToPlainText(htmlContent),
        })
      } catch (err) {
        stats.errors++
        console.error(
          `  ERROR processing ${doc.document_number} (${doc.id}):`,
          err instanceof Error ? err.message : err
        )
      }
    }

    if (toWrite.length > 0) {
      // ── Phase 2: Parallel HTML updates (WRITE_CONCURRENCY at a time) ──
      for (let i = 0; i < toWrite.length; i += WRITE_CONCURRENCY) {
        const chunk = toWrite.slice(i, i + WRITE_CONCURRENCY)
        await Promise.all(
          chunk.map((doc) =>
            prisma.legalDocument
              .update({
                where: { id: doc.id },
                data: { html_content: doc.linkifiedHtml },
              })
              .catch((err) => {
                stats.errors++
                console.error(
                  `  ERROR updating HTML ${doc.document_number}:`,
                  err instanceof Error ? err.message : err
                )
              })
          )
        )
      }

      // ── Phase 3: Batch cross-ref write — one transaction for entire batch ──
      // Collect all source IDs and all cross-ref rows
      const sourceIds = toWrite.map((d) => d.id)
      const allCrossRefRows: Array<{
        source_document_id: string
        target_document_id: string
        reference_type: 'REFERENCES'
        context: string
      }> = []

      for (const doc of toWrite) {
        const seen = new Set<string>()
        for (const ref of doc.linkedReferences) {
          if (seen.has(ref.targetDocumentId)) continue
          seen.add(ref.targetDocumentId)
          allCrossRefRows.push({
            source_document_id: doc.id,
            target_document_id: ref.targetDocumentId,
            reference_type: 'REFERENCES',
            context: extractContext(doc.plainText, ref),
          })
        }
      }

      try {
        await prisma.$transaction([
          prisma.crossReference.deleteMany({
            where: {
              source_document_id: { in: sourceIds },
              reference_type: 'REFERENCES',
            },
          }),
          prisma.crossReference.createMany({
            data: allCrossRefRows,
          }),
        ])
        stats.totalCrossRefsUpserted += allCrossRefRows.length
        stats.updated += toWrite.length
      } catch (err) {
        stats.errors += toWrite.length
        console.error(
          `  ERROR in batch cross-ref transaction:`,
          err instanceof Error ? err.message : err
        )
      }
    }

    cursor = batch[batch.length - 1]!.id

    // Progress log (skip per-batch logging for targeted runs)
    if (!targetDocs.length) {
      const elapsed = (Date.now() - startTime) / 1000
      const rate = stats.processed / elapsed
      const eta = (effectiveTotal - stats.processed) / rate
      console.log(
        `  [${stats.processed}/${effectiveTotal}] ` +
          `updated=${stats.updated} skipped=${stats.skipped} errors=${stats.errors} ` +
          `links=${stats.totalLinksCreated} crossRefs=${stats.totalCrossRefsUpserted} ` +
          `(${rate.toFixed(1)} docs/s, ETA: ${eta.toFixed(0)}s)`
      )
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('\n--- Backfill Complete ---')
  console.log(`  Total documents:      ${stats.totalDocuments}`)
  console.log(`  Processed:            ${stats.processed}`)
  console.log(`  Updated (with links): ${stats.updated}`)
  console.log(`  Skipped (no refs):    ${stats.skipped}`)
  console.log(`  Errors:               ${stats.errors}`)
  console.log(`  Links created:        ${stats.totalLinksCreated}`)
  console.log(`  Cross-refs upserted:  ${stats.totalCrossRefsUpserted}`)
  console.log(`  Time:                 ${totalTime}s`)
  if (dryRun)
    console.log('\n  [DRY RUN] No changes were written to the database.')

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
