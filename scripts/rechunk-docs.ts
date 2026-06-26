/* eslint-disable no-console */
/**
 * Re-chunk + re-embed existing LegalDocuments (no re-ingest / no Claude PDF
 * call). Used after the Story 9.7 chunker coverage-fix to recover docs whose
 * bodies weren't embedded.
 *
 * Usage:
 *   pnpm tsx scripts/rechunk-docs.ts --docs "SKOLFS 2023:184,SKOLFS 2011:144"
 *   pnpm tsx scripts/rechunk-docs.ts --low-coverage [--limit N] [--apply]
 *     (selects docs whose chunked tokens cover <60% of full_text; --apply re-syncs)
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })
/* eslint-disable import/first */
import { prisma } from '../lib/prisma'
import { syncDocumentChunks } from '../lib/chunks/sync-document-chunks'
import { estimateTokenCount } from '../lib/chunks/token-count'
/* eslint-enable import/first */

async function coverage(id: string, fullText: string | null): Promise<number> {
  const docTokens = fullText ? estimateTokenCount(fullText) : 0
  if (!docTokens) return 1
  const rows = await prisma.$queryRaw<{ s: bigint }[]>`
    SELECT coalesce(sum(token_count),0)::bigint s FROM content_chunks WHERE source_id = ${id}`
  return Number(rows[0]!.s) / docTokens
}

async function main() {
  const args = process.argv.slice(2)
  const docsIdx = args.indexOf('--docs')
  const lowCoverage = args.includes('--low-coverage')
  const apply = args.includes('--apply')
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx !== -1 ? Number(args[limitIdx + 1]) : Infinity

  let targets: {
    id: string
    document_number: string
    full_text: string | null
  }[] = []

  if (docsIdx !== -1 && args[docsIdx + 1]) {
    const nums = args[docsIdx + 1]!.split(',').map((s) => s.trim())
    targets = await prisma.legalDocument.findMany({
      where: { document_number: { in: nums } },
      select: { id: true, document_number: true, full_text: true },
    })
  } else if (lowCoverage) {
    // Fast aggregate selection: long docs whose chunk tokens cover <60% of body
    // (token estimate ≈ chars/4). One query — no 12k-row full_text scan.
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT ld.id
      FROM legal_documents ld
      JOIN LATERAL (
        SELECT coalesce(sum(cc.token_count),0) chunk_tokens
        FROM content_chunks cc WHERE cc.source_id = ld.id
      ) t ON true
      WHERE ld.content_type IN ('AGENCY_REGULATION','SFS_LAW')
        AND ld.html_content IS NOT NULL
        AND length(ld.full_text) > 1600
        AND t.chunk_tokens < 0.6 * (length(ld.full_text)/4.0)
      ORDER BY ld.document_number`
    const ids = (Number.isFinite(limit) ? rows.slice(0, limit) : rows).map(
      (r) => r.id
    )
    targets = await prisma.legalDocument.findMany({
      where: { id: { in: ids } },
      select: { id: true, document_number: true, full_text: true },
    })
    console.log(`Low-coverage docs found: ${targets.length}`)
  } else {
    console.error('Pass --docs "A,B" or --low-coverage')
    process.exit(1)
  }

  for (const d of targets) {
    const before = await coverage(d.id, d.full_text)
    if (!apply && lowCoverage) {
      console.log(
        `  [scan] ${d.document_number}: coverage ${(before * 100).toFixed(0)}%`
      )
      continue
    }
    const r = await syncDocumentChunks(d.id)
    const after = await coverage(d.id, d.full_text)
    console.log(
      `  ${d.document_number}: ${r.chunksCreated} chunks | coverage ${(before * 100).toFixed(0)}% → ${(after * 100).toFixed(0)}%`
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
