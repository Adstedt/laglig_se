/**
 * Thorough chunking test: 5 SFS laws + 5 Agency regulations.
 * Shows full chunk listing for manual inspection.
 *
 * Usage: npx tsx scripts/tmp-test-chunking.ts
 */

import { prisma } from '../lib/prisma'
import { chunkDocument, type ChunkInput } from '../lib/chunks'
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

function printFullChunkReport(
  label: string,
  doc: DocRow,
  chunks: ChunkInput[]
) {
  console.log('\n' + '═'.repeat(90))
  console.log(`  ${label}`)
  console.log(`  ${doc.document_number} — ${doc.title}`)
  console.log('═'.repeat(90))

  if (chunks.length === 0) {
    console.log('  ⚠ No chunks produced')
    console.log(`    json_content: ${doc.json_content ? 'present' : 'null'}`)
    console.log(
      `    markdown_content: ${doc.markdown_content ? `${doc.markdown_content.length} chars` : 'null'}`
    )
    console.log(
      `    html_content: ${doc.html_content ? `${doc.html_content.length} chars` : 'null'}`
    )
    return
  }

  // Summary stats
  const roles: Record<string, number> = {}
  for (const c of chunks) {
    roles[c.content_role] = (roles[c.content_role] ?? 0) + 1
  }
  const tokens = chunks.map((c) => c.token_count)
  const totalTokens = tokens.reduce((a, b) => a + b, 0)

  console.log(`  Chunks: ${chunks.length}   Total tokens: ${totalTokens}`)
  console.log(
    `  Token range: ${Math.min(...tokens)}–${Math.max(...tokens)}  avg: ${Math.round(totalTokens / tokens.length)}`
  )
  console.log(
    `  Roles: ${Object.entries(roles)
      .map(([r, n]) => `${r}(${n})`)
      .join(', ')}`
  )
  console.log('─'.repeat(90))

  // Full chunk listing
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]!
    const contentPreview =
      c.content.length > 200 ? c.content.slice(0, 200) + '…' : c.content
    const metaStr = c.metadata ? ` meta=${JSON.stringify(c.metadata)}` : ''

    console.log(
      `  [${String(i).padStart(3)}] ${c.path.padEnd(18)} ${c.content_role.padEnd(22)} ${String(c.token_count).padStart(5)} tok${metaStr}`
    )
    console.log(`        header: ${c.contextual_header}`)
    console.log(`        ${contentPreview.replace(/\n/g, '\\n')}`)
    console.log()
  }
}

async function main() {
  console.log(
    'Fetching 5 SFS laws + 5 Agency regulations for chunking inspection...\n'
  )

  const select = {
    id: true,
    title: true,
    document_number: true,
    content_type: true,
    json_content: true,
    markdown_content: true,
    html_content: true,
  } as const

  // ── SFS LAWS ──────────────────────────────────────────────────────────────
  // 1. Well-known chaptered law (Arbetsmiljölagen)
  const sfs1 = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1977:1160', content_type: 'SFS_LAW' },
    select,
  })

  // 2. Another chaptered law — Diskrimineringslagen (large, 7 chapters)
  const sfs2 = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2008:567', content_type: 'SFS_LAW' },
    select,
  })

  // 3. A small/simple law — pick something short
  const sfs3 = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2005:395', content_type: 'SFS_LAW' },
    select,
  })

  // 4. A law with divisions (avdelningar) — Socialförsäkringsbalken
  const sfs4 = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2010:110', content_type: 'SFS_LAW' },
    select,
  })

  // 5. A markdown-fallback law (json with 0 paragrafer but has markdown)
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
  // Find one that actually has 0 paragrafer in the JSON
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

  // ── AGENCY REGULATIONS ────────────────────────────────────────────────────
  // Pick 5 diverse agency docs (different agencies if possible)
  const agencyDocs = await prisma.$queryRaw<DocRow[]>`
    SELECT id, title, document_number, content_type::text, json_content, markdown_content, html_content
    FROM legal_documents
    WHERE content_type = 'AGENCY_REGULATION'
      AND json_content IS NOT NULL
    ORDER BY random()
    LIMIT 30
  `

  // Try to pick from different agency prefixes
  const seenPrefixes = new Set<string>()
  const agencies: DocRow[] = []
  for (const doc of agencyDocs) {
    const prefix = doc.document_number.split(' ')[0] ?? ''
    if (!seenPrefixes.has(prefix) && agencies.length < 5) {
      seenPrefixes.add(prefix)
      agencies.push(doc)
    }
  }
  // Fill remaining slots if we didn't get 5 distinct prefixes
  for (const doc of agencyDocs) {
    if (agencies.length >= 5) break
    if (!agencies.includes(doc)) agencies.push(doc)
  }

  // ── RUN CHUNKING ──────────────────────────────────────────────────────────
  const allTests: { label: string; doc: DocRow | null }[] = [
    {
      label: 'SFS LAW #1 — Chaptered (Arbetsmiljölagen)',
      doc: sfs1 as DocRow | null,
    },
    {
      label: 'SFS LAW #2 — Chaptered (Diskrimineringslagen)',
      doc: sfs2 as DocRow | null,
    },
    { label: 'SFS LAW #3 — Small law', doc: sfs3 as DocRow | null },
    {
      label: 'SFS LAW #4 — Divisions (Socialförsäkringsbalken)',
      doc: sfs4 as DocRow | null,
    },
    { label: 'SFS LAW #5 — Markdown fallback', doc: sfs5 },
    ...agencies.map((d, i) => ({
      label: `AGENCY #${i + 1} — ${d.document_number.split(' ')[0]}`,
      doc: d as DocRow | null,
    })),
  ]

  let grandTotalChunks = 0
  let grandTotalTokens = 0

  for (const { label, doc } of allTests) {
    if (!doc) {
      console.log('\n' + '═'.repeat(90))
      console.log(`  ${label}: NOT FOUND IN DB`)
      console.log('═'.repeat(90))
      continue
    }

    const chunks = chunkDocument({
      documentId: doc.id,
      title: doc.title,
      documentNumber: doc.document_number,
      jsonContent: doc.json_content as CanonicalDocumentJson | null,
      markdownContent: doc.markdown_content,
      htmlContent: doc.html_content,
    })

    printFullChunkReport(label, doc, chunks)
    grandTotalChunks += chunks.length
    grandTotalTokens += chunks.reduce((s, c) => s + c.token_count, 0)
  }

  console.log('\n' + '═'.repeat(90))
  console.log(
    `  GRAND TOTAL: ${grandTotalChunks} chunks, ${grandTotalTokens} tokens across ${allTests.filter((t) => t.doc).length} documents`
  )
  console.log('═'.repeat(90))

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
