/**
 * Live chunking test: clear all chunks, sync 10 specific docs, dump full output.
 * Usage: npx tsx scripts/tmp-clear-and-sync-chunks.ts
 */

import { prisma } from '../lib/prisma'
import { chunkDocument } from '../lib/chunks'
import { syncDocumentChunks } from '../lib/chunks/sync-document-chunks'
import type { CanonicalDocumentJson } from '../lib/transforms/document-json-schema'

interface DocRow {
  id: string
  title: string
  document_number: string
  content_type: string
  json_content: unknown
  markdown_content: string | null
  html_content: string | null
}

async function main() {
  // ── STEP 1: Clear all existing chunks ──────────────────────────────────
  const existingCount = await prisma.contentChunk.count()
  console.log(`\n═══ STEP 1: CLEAR DATABASE ═══`)
  console.log(`  Existing chunks: ${existingCount}`)
  if (existingCount > 0) {
    const deleted = await prisma.contentChunk.deleteMany({})
    console.log(`  Deleted: ${deleted.count}`)
  }
  const afterClear = await prisma.contentChunk.count()
  console.log(`  After clear: ${afterClear}`)

  // ── STEP 2: Select 10 diverse test documents ──────────────────────────
  console.log(`\n═══ STEP 2: SELECT TEST DOCUMENTS ═══`)

  const select = {
    id: true,
    title: true,
    document_number: true,
    content_type: true,
    json_content: true,
    markdown_content: true,
    html_content: true,
  } as const

  // SFS #1: Chaptered (Arbetsmiljölagen)
  const sfs1 = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1977:1160', content_type: 'SFS_LAW' },
    select,
  })

  // SFS #2: Chaptered (Diskrimineringslagen)
  const sfs2 = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2008:567', content_type: 'SFS_LAW' },
    select,
  })

  // SFS #3: Small/simple law
  const sfs3 = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2005:395', content_type: 'SFS_LAW' },
    select,
  })

  // SFS #4: Divisions (Socialförsäkringsbalken — big, many transitions)
  const sfs4 = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2010:110', content_type: 'SFS_LAW' },
    select,
  })

  // SFS #5: Markdown fallback (JSON with 0 paragrafer but has markdown)
  const sfs5rows = await prisma.$queryRaw<DocRow[]>`
    SELECT id, title, document_number, content_type::text, json_content, markdown_content, html_content
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
      AND json_content IS NOT NULL
      AND markdown_content IS NOT NULL
      AND length(markdown_content) > 500
    ORDER BY random()
    LIMIT 20
  `
  let sfs5: DocRow | null = null
  for (const row of sfs5rows) {
    const json = row.json_content as CanonicalDocumentJson | null
    if (!json) continue
    const chapters = json.chapters ?? []
    const totalParas = chapters.reduce(
      (sum, ch) => sum + (ch.paragrafer?.length ?? 0),
      0
    )
    if (totalParas === 0) {
      sfs5 = row
      break
    }
  }

  // 5 Agency regulations from different agencies
  const agencyDocs = await prisma.$queryRaw<DocRow[]>`
    SELECT id, title, document_number, content_type::text, json_content, markdown_content, html_content
    FROM legal_documents
    WHERE content_type = 'AGENCY_REGULATION'
      AND json_content IS NOT NULL
    ORDER BY random()
    LIMIT 30
  `
  const seenPrefixes = new Set<string>()
  const agencies: DocRow[] = []
  for (const doc of agencyDocs) {
    const prefix = doc.document_number.split(' ')[0] ?? ''
    if (!seenPrefixes.has(prefix) && agencies.length < 5) {
      seenPrefixes.add(prefix)
      agencies.push(doc)
    }
  }
  for (const doc of agencyDocs) {
    if (agencies.length >= 5) break
    if (!agencies.includes(doc)) agencies.push(doc)
  }

  const allDocs: { label: string; doc: DocRow | null }[] = [
    {
      label: 'SFS #1 — Chaptered (Arbetsmiljölagen)',
      doc: sfs1 as DocRow | null,
    },
    {
      label: 'SFS #2 — Chaptered (Diskrimineringslagen)',
      doc: sfs2 as DocRow | null,
    },
    { label: 'SFS #3 — Small law', doc: sfs3 as DocRow | null },
    {
      label: 'SFS #4 — Divisions (Socialförsäkringsbalken)',
      doc: sfs4 as DocRow | null,
    },
    { label: 'SFS #5 — Markdown fallback', doc: sfs5 },
    ...agencies.map((d, i) => ({
      label: `AGENCY #${i + 1} — ${d.document_number.split(' ')[0]}`,
      doc: d as DocRow | null,
    })),
  ]

  for (const { label, doc } of allDocs) {
    if (doc) {
      console.log(`  ✓ ${label}: ${doc.document_number} — ${doc.title}`)
    } else {
      console.log(`  ✗ ${label}: NOT FOUND`)
    }
  }

  // ── STEP 3: Sync each document (live DB write) ────────────────────────
  console.log(`\n═══ STEP 3: LIVE SYNC (write to DB) ═══`)

  let grandTotalChunks = 0
  let grandTotalTokens = 0
  const docResults: {
    label: string
    docNum: string
    chunks: number
    tokens: number
    roles: Record<string, number>
    paths: string[]
  }[] = []

  for (const { label, doc } of allDocs) {
    if (!doc) continue

    // Use syncDocumentChunks for the actual DB write
    const result = await syncDocumentChunks(doc.id)

    // Also get the in-memory chunks for detailed inspection
    const chunks = chunkDocument({
      documentId: doc.id,
      title: doc.title,
      documentNumber: doc.document_number,
      jsonContent: doc.json_content as CanonicalDocumentJson | null,
      markdownContent: doc.markdown_content,
      htmlContent: doc.html_content,
    })

    const roles: Record<string, number> = {}
    const tokens = chunks.map((c) => c.token_count)
    const totalTokens = tokens.reduce((a, b) => a + b, 0)
    for (const c of chunks) {
      roles[c.content_role] = (roles[c.content_role] ?? 0) + 1
    }

    grandTotalChunks += chunks.length
    grandTotalTokens += totalTokens

    docResults.push({
      label,
      docNum: doc.document_number,
      chunks: chunks.length,
      tokens: totalTokens,
      roles,
      paths: chunks.map((c) => c.path),
    })

    console.log(`\n${'─'.repeat(90)}`)
    console.log(`  ${label}`)
    console.log(`  ${doc.document_number} — ${doc.title}`)
    console.log(
      `  DB sync: created=${result.created}, deleted=${result.deleted}`
    )
    console.log(`  Chunks: ${chunks.length}   Total tokens: ${totalTokens}`)
    if (chunks.length > 0) {
      console.log(
        `  Token range: ${Math.min(...tokens)}–${Math.max(...tokens)}  avg: ${Math.round(totalTokens / tokens.length)}`
      )
      console.log(
        `  Roles: ${Object.entries(roles)
          .map(([r, n]) => `${r}(${n})`)
          .join(', ')}`
      )
    }
    console.log(`${'─'.repeat(90)}`)

    // Full chunk listing
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]!
      const contentPreview =
        c.content.length > 180 ? c.content.slice(0, 180) + '…' : c.content
      const metaStr = c.metadata ? ` meta=${JSON.stringify(c.metadata)}` : ''

      console.log(
        `  [${String(i).padStart(4)}] ${c.path.padEnd(22)} ${c.content_role.padEnd(24)} ${String(c.token_count).padStart(5)} tok${metaStr}`
      )
      console.log(`         header: ${c.contextual_header}`)
      console.log(`         ${contentPreview.replace(/\n/g, '\\n')}`)
      console.log()
    }
  }

  // ── STEP 4: Verify DB state ───────────────────────────────────────────
  console.log(`\n═══ STEP 4: VERIFY DB STATE ═══`)
  const finalCount = await prisma.contentChunk.count()
  console.log(`  Total chunks in DB: ${finalCount}`)
  console.log(`  Expected (from chunkDocument): ${grandTotalChunks}`)
  console.log(
    `  Match: ${finalCount === grandTotalChunks ? '✓ YES' : '✗ NO — mismatch!'}`
  )

  // Check for duplicates in DB
  const dupeCheck = await prisma.$queryRaw<
    { source_id: string; path: string; cnt: bigint }[]
  >`
    SELECT source_id, path, COUNT(*) as cnt
    FROM content_chunks
    GROUP BY source_id, path
    HAVING COUNT(*) > 1
  `
  console.log(`  Duplicate (source_id, path) in DB: ${dupeCheck.length}`)
  if (dupeCheck.length > 0) {
    for (const d of dupeCheck) {
      console.log(`    ⚠ ${d.source_id} / ${d.path} — ${d.cnt} occurrences`)
    }
  }

  // Token distribution of synced chunks
  const tokenStats = await prisma.$queryRaw<
    { min_tok: number; max_tok: number; avg_tok: number; total_tok: bigint }[]
  >`
    SELECT MIN(token_count) as min_tok, MAX(token_count) as max_tok,
           AVG(token_count)::int as avg_tok, SUM(token_count) as total_tok
    FROM content_chunks
  `
  if (tokenStats[0]) {
    const s = tokenStats[0]
    console.log(
      `  Token stats from DB: min=${s.min_tok}  max=${s.max_tok}  avg=${s.avg_tok}  total=${s.total_tok}`
    )
  }

  // Role distribution
  const roleDistrib = await prisma.$queryRaw<
    { content_role: string; cnt: bigint }[]
  >`
    SELECT content_role::text, COUNT(*) as cnt
    FROM content_chunks
    ORDER BY cnt DESC
  `
  console.log(`  Role distribution:`)
  for (const r of roleDistrib) {
    console.log(`    ${r.content_role}: ${r.cnt}`)
  }

  // ── STEP 5: Summary ───────────────────────────────────────────────────
  console.log(`\n═══ STEP 5: COMPREHENSIVE SUMMARY ═══`)
  console.log(`\n  Documents processed: ${docResults.length}`)
  console.log(`  Grand total chunks: ${grandTotalChunks}`)
  console.log(`  Grand total tokens: ${grandTotalTokens}`)
  console.log()

  // Per-doc summary table
  console.log(
    `  ${'Doc'.padEnd(50)} ${'Chunks'.padStart(7)} ${'Tokens'.padStart(8)} ${'Avg'.padStart(5)}  Roles`
  )
  console.log(`  ${'─'.repeat(100)}`)
  for (const d of docResults) {
    const avg = d.chunks > 0 ? Math.round(d.tokens / d.chunks) : 0
    const roleStr = Object.entries(d.roles)
      .map(([r, n]) => `${r}(${n})`)
      .join(' ')
    console.log(
      `  ${(d.docNum + ' ' + d.label).padEnd(50)} ${String(d.chunks).padStart(7)} ${String(d.tokens).padStart(8)} ${String(avg).padStart(5)}  ${roleStr}`
    )
  }

  // Issue detection
  console.log(`\n  Issues detected:`)
  let issues = 0
  for (const d of docResults) {
    // Check for duplicate paths within same doc
    const pathSet = new Set<string>()
    for (const p of d.paths) {
      if (pathSet.has(p)) {
        console.log(`    ⚠ Duplicate path in ${d.docNum}: ${p}`)
        issues++
      }
      pathSet.add(p)
    }
  }
  if (issues === 0) {
    console.log(`    ✓ No duplicate paths`)
  }
  console.log(
    `    DB duplicate check: ${dupeCheck.length === 0 ? '✓ None' : `⚠ ${dupeCheck.length} found`}`
  )
  console.log(
    `    DB count match: ${finalCount === grandTotalChunks ? '✓ Match' : `⚠ Mismatch (DB=${finalCount}, expected=${grandTotalChunks})`}`
  )

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
