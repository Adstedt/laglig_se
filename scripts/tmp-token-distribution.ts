/**
 * Token distribution analysis across all test chunks.
 * Usage: npx tsx scripts/tmp-token-distribution.ts
 */

import { prisma } from '../lib/prisma'
import { chunkDocument, type ChunkInput } from '../lib/chunks'
import type { CanonicalDocumentJson } from '../lib/transforms/document-json-schema'

async function main() {
  // Grab a larger sample: 50 SFS_LAW + 50 AGENCY_REGULATION
  const docs = await prisma.legalDocument.findMany({
    where: {
      content_type: { in: ['SFS_LAW', 'AGENCY_REGULATION'] },
      json_content: { not: null as unknown as undefined },
    },
    select: {
      id: true,
      title: true,
      document_number: true,
      content_type: true,
      json_content: true,
      markdown_content: true,
      html_content: true,
    },
    take: 200,
    orderBy: { document_number: 'asc' },
  })

  console.log(`Loaded ${docs.length} documents\n`)

  const allTokens: number[] = []
  const byRole: Record<string, number[]> = {}
  const byTier: {
    paragraf: number[]
    nonParagraf: number[]
    markdown: number[]
  } = {
    paragraf: [],
    nonParagraf: [],
    markdown: [],
  }
  let oversizedTransitions = 0
  let duplicatePaths = 0
  let emptyDocs = 0

  for (const doc of docs) {
    const chunks = chunkDocument({
      documentId: doc.id,
      title: doc.title,
      documentNumber: doc.document_number,
      jsonContent: doc.json_content as CanonicalDocumentJson | null,
      markdownContent: doc.markdown_content,
      htmlContent: doc.html_content,
    })

    if (chunks.length === 0) {
      emptyDocs++
      continue
    }

    // Check for duplicate paths within same doc
    const paths = new Set<string>()
    for (const c of chunks) {
      if (paths.has(c.path)) duplicatePaths++
      paths.add(c.path)
    }

    for (const c of chunks) {
      allTokens.push(c.token_count)

      if (!byRole[c.content_role]) byRole[c.content_role] = []
      byRole[c.content_role]!.push(c.token_count)

      if (c.content_role === 'MARKDOWN_CHUNK') {
        byTier.markdown.push(c.token_count)
      } else if (c.path.startsWith('kap')) {
        byTier.paragraf.push(c.token_count)
      } else {
        byTier.nonParagraf.push(c.token_count)
        if (c.path === 'overgangsbest' && c.token_count > 1000) {
          oversizedTransitions++
          console.log(
            `  ⚠ Oversized transition: ${doc.document_number} — ${c.token_count} tokens`
          )
        }
      }
    }
  }

  // Sort for percentile calculations
  allTokens.sort((a, b) => a - b)

  const percentile = (arr: number[], p: number) => {
    const sorted = [...arr].sort((a, b) => a - b)
    const idx = Math.floor((sorted.length * p) / 100)
    return sorted[idx] ?? 0
  }

  const printStats = (label: string, tokens: number[]) => {
    if (tokens.length === 0) {
      console.log(`  ${label}: (no data)`)
      return
    }
    const sorted = [...tokens].sort((a, b) => a - b)
    console.log(`  ${label} (n=${tokens.length}):`)
    console.log(
      `    min=${sorted[0]}  p10=${percentile(tokens, 10)}  p25=${percentile(tokens, 25)}  median=${percentile(tokens, 50)}  p75=${percentile(tokens, 75)}  p90=${percentile(tokens, 90)}  p95=${percentile(tokens, 95)}  max=${sorted[sorted.length - 1]}`
    )
    console.log(
      `    avg=${Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length)}  total=${tokens.reduce((a, b) => a + b, 0)}`
    )
  }

  // Histogram buckets
  const buckets = [
    0,
    10,
    25,
    50,
    100,
    200,
    300,
    500,
    750,
    1000,
    2000,
    5000,
    Infinity,
  ]
  const histogram: Record<string, number> = {}
  for (let i = 0; i < buckets.length - 1; i++) {
    const lo = buckets[i]!
    const hi = buckets[i + 1]!
    const label = hi === Infinity ? `${lo}+` : `${lo}-${hi}`
    histogram[label] = allTokens.filter((t) => t >= lo && t < hi).length
  }

  console.log('\n═══ TOKEN DISTRIBUTION ═══\n')
  printStats('ALL CHUNKS', allTokens)
  console.log()

  console.log('By tier:')
  printStats('Paragraf (§)', byTier.paragraf)
  printStats('Non-§ (övergång/preamble/bilaga)', byTier.nonParagraf)
  printStats('Markdown fallback', byTier.markdown)
  console.log()

  console.log('By role:')
  for (const [role, tokens] of Object.entries(byRole)) {
    printStats(role, tokens)
  }
  console.log()

  console.log('Histogram (token buckets):')
  for (const [bucket, count] of Object.entries(histogram)) {
    const pct = ((count / allTokens.length) * 100).toFixed(1)
    const bar = '█'.repeat(Math.round((count / allTokens.length) * 100))
    console.log(
      `  ${bucket.padStart(10)}: ${String(count).padStart(6)} (${pct.padStart(5)}%) ${bar}`
    )
  }
  console.log()

  console.log('Issues:')
  console.log(`  Empty docs (0 chunks): ${emptyDocs}`)
  console.log(`  Duplicate paths (same doc): ${duplicatePaths}`)
  console.log(`  Oversized transitions (>1000 tok): ${oversizedTransitions}`)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
