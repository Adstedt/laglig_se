/* eslint-disable no-console */
/**
 * Investigation: which SFS_LAW / AGENCY_REGULATION documents are missing
 * chunks and/or embeddings, and does it correlate with document size?
 *
 * Read-only. Usage: npx tsx scripts/investigate-missing-chunks.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { prisma } from '../lib/prisma'

const ALLOWED = ['SFS_LAW', 'AGENCY_REGULATION']

async function main() {
  // 1. Overall coverage among in-scope docs
  const inScope = await prisma.legalDocument.count({
    where: { content_type: { in: ALLOWED as any } },
  })

  // Docs with at least one chunk
  const docsWithChunks = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT cc.source_id) as count
    FROM content_chunks cc
    JOIN legal_documents ld ON ld.id = cc.source_id
    WHERE cc.source_type = 'LEGAL_DOCUMENT'
      AND ld.content_type IN ('SFS_LAW','AGENCY_REGULATION')
  `
  const withChunks = Number(docsWithChunks[0]?.count ?? 0)

  // Docs with at least one EMBEDDED chunk
  const docsWithEmb = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT cc.source_id) as count
    FROM content_chunks cc
    JOIN legal_documents ld ON ld.id = cc.source_id
    WHERE cc.source_type = 'LEGAL_DOCUMENT'
      AND ld.content_type IN ('SFS_LAW','AGENCY_REGULATION')
      AND cc.embedding IS NOT NULL
  `
  const withEmb = Number(docsWithEmb[0]?.count ?? 0)

  console.log(
    '=== In-scope document coverage (SFS_LAW + AGENCY_REGULATION) ==='
  )
  console.log(`Total in-scope docs:        ${inScope}`)
  console.log(
    `Docs with >=1 chunk:        ${withChunks} (${pct(withChunks, inScope)})`
  )
  console.log(`Docs missing chunks:        ${inScope - withChunks}`)
  console.log(
    `Docs with >=1 embedded chunk: ${withEmb} (${pct(withEmb, inScope)})`
  )
  console.log()

  // 2. Docs that HAVE content but are missing chunks, sorted by size
  const missingWithContent = await prisma.$queryRaw<
    Array<{
      document_number: string
      title: string
      content_type: string
      full_len: number
      md_len: number
      html_len: number
      has_json: boolean
    }>
  >`
    SELECT
      ld.document_number,
      ld.title,
      ld.content_type::text as content_type,
      COALESCE(LENGTH(ld.full_text), 0) as full_len,
      COALESCE(LENGTH(ld.markdown_content), 0) as md_len,
      COALESCE(LENGTH(ld.html_content), 0) as html_len,
      (ld.json_content IS NOT NULL) as has_json
    FROM legal_documents ld
    WHERE ld.content_type IN ('SFS_LAW','AGENCY_REGULATION')
      AND NOT EXISTS (
        SELECT 1 FROM content_chunks cc
        WHERE cc.source_type = 'LEGAL_DOCUMENT' AND cc.source_id = ld.id
      )
      AND (ld.markdown_content IS NOT NULL OR ld.html_content IS NOT NULL OR ld.json_content IS NOT NULL)
    ORDER BY GREATEST(COALESCE(LENGTH(ld.markdown_content),0), COALESCE(LENGTH(ld.html_content),0), COALESCE(LENGTH(ld.full_text),0)) DESC
  `

  console.log(
    `=== Docs WITH content but MISSING chunks: ${missingWithContent.length} ===`
  )
  console.log('(sorted by largest content; these should have been chunked)')
  for (const d of missingWithContent.slice(0, 40)) {
    console.log(
      `  ${d.document_number.padEnd(20)} md=${String(d.md_len).padStart(8)} html=${String(d.html_len).padStart(8)} full=${String(d.full_len).padStart(8)} json=${d.has_json ? 'Y' : 'n'}  ${d.title.slice(0, 50)}`
    )
  }
  console.log()

  // 3. Docs WITH chunks but chunks NOT embedded, sorted by size
  const chunkedNotEmbedded = await prisma.$queryRaw<
    Array<{
      document_number: string
      title: string
      chunk_count: bigint
      embedded_count: bigint
      md_len: number
    }>
  >`
    SELECT
      ld.document_number,
      ld.title,
      COUNT(cc.id) as chunk_count,
      COUNT(cc.embedding) as embedded_count,
      COALESCE(LENGTH(ld.markdown_content), 0) as md_len
    FROM legal_documents ld
    JOIN content_chunks cc ON cc.source_id = ld.id AND cc.source_type = 'LEGAL_DOCUMENT'
    WHERE ld.content_type IN ('SFS_LAW','AGENCY_REGULATION')
    GROUP BY ld.id, ld.document_number, ld.title, ld.markdown_content
    HAVING COUNT(cc.embedding) < COUNT(cc.id)
    ORDER BY (COUNT(cc.id) - COUNT(cc.embedding)) DESC
  `

  console.log(
    `=== Docs WITH chunks but some/all chunks UNEMBEDDED: ${chunkedNotEmbedded.length} ===`
  )
  for (const d of chunkedNotEmbedded.slice(0, 40)) {
    console.log(
      `  ${d.document_number.padEnd(20)} chunks=${String(Number(d.chunk_count)).padStart(5)} embedded=${String(Number(d.embedded_count)).padStart(5)} md=${String(d.md_len).padStart(8)}  ${d.title.slice(0, 45)}`
    )
  }
  console.log()

  // 4. Largest in-scope docs overall and their chunk status (size correlation)
  const largest = await prisma.$queryRaw<
    Array<{
      document_number: string
      title: string
      md_len: number
      chunk_count: bigint
      embedded_count: bigint
    }>
  >`
    SELECT
      ld.document_number,
      ld.title,
      COALESCE(LENGTH(ld.markdown_content), 0) as md_len,
      COUNT(cc.id) as chunk_count,
      COUNT(cc.embedding) as embedded_count
    FROM legal_documents ld
    LEFT JOIN content_chunks cc ON cc.source_id = ld.id AND cc.source_type = 'LEGAL_DOCUMENT'
    WHERE ld.content_type IN ('SFS_LAW','AGENCY_REGULATION')
      AND ld.markdown_content IS NOT NULL
    GROUP BY ld.id, ld.document_number, ld.title, ld.markdown_content
    ORDER BY LENGTH(ld.markdown_content) DESC
    LIMIT 30
  `

  console.log(
    `=== 30 largest in-scope docs (by markdown length) — chunk status ===`
  )
  for (const d of largest) {
    const flag =
      Number(d.chunk_count) === 0
        ? '  <-- NO CHUNKS'
        : Number(d.embedded_count) < Number(d.chunk_count)
          ? '  <-- UNEMBEDDED'
          : ''
    console.log(
      `  ${d.document_number.padEnd(20)} md=${String(d.md_len).padStart(9)} chunks=${String(Number(d.chunk_count)).padStart(5)} emb=${String(Number(d.embedded_count)).padStart(5)}${flag}  ${d.title.slice(0, 40)}`
    )
  }

  await prisma.$disconnect()
}

function pct(n: number, total: number): string {
  return total > 0 ? `${((n / total) * 100).toFixed(1)}%` : 'n/a'
}

main().catch((err) => {
  console.error('Fatal:', err)
  prisma.$disconnect()
  process.exit(1)
})
