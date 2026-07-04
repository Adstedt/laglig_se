/* eslint-disable no-console */
/**
 * Story 7.7 (AC 6): scoped retrieval-layer grounding eval for kollektivavtal.
 * Modeled on scripts/benchmark-retrieval.ts. Requires a live DB
 * (DATABASE_URL) + embedding/rerank keys via .env.local — NOT part of the
 * unit suite.
 *
 * Asserts, against `retrieveContext` (the real production pipeline):
 *   (a) CA retrieval is workspace-correct AND agreement-correct under bias
 *       (`sourceId` hard filter → only the assigned agreement's chunks);
 *   (b) a cross-workspace probe returns ZERO foreign CA chunks — including
 *       when probing WITH the target workspace's agreement id (a foreign/
 *       hallucinated id must filter to zero, never leak);
 *   (c) legal-corpus retrieval still returns the expected instruments across
 *       three legal areas (uppsägningstid/LAS, semester/Semesterlagen,
 *       arbetstid/ATL) — the CA tool addition must not degrade legal search.
 *
 * Usage:
 *   npx tsx scripts/eval-ca-grounding.ts
 *   npx tsx scripts/eval-ca-grounding.ts --workspace <id> [--agreement <id>] [--foreign-workspace <id>] [--top 8]
 *
 * Without flags the script auto-discovers: the first workspace that has
 * COLLECTIVE_AGREEMENT chunks (target), that workspace's first agreement
 * with chunks (bias target), and any OTHER workspace (foreign probe; falls
 * back to a random UUID when the DB has only one workspace).
 *
 * Exit code 0 = all assertions passed; 1 = at least one FAIL.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { retrieveContext } from '../lib/agent/retrieval'

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  return idx >= 0 ? process.argv[idx + 1] : undefined
}

const TOP_K = parseInt(argValue('--top') ?? '8', 10)

// ── The epic's reference queries ─────────────────────────────────────────────
const CA_QUERY = 'Vilken uppsägningstid gäller enligt kollektivavtalet?'
const LEGAL_QUERIES: Array<{
  query: string
  expectDocNumber: RegExp
  area: string
}> = [
  {
    query:
      'Vilken uppsägningstid gäller vid uppsägning från arbetsgivarens sida?',
    expectDocNumber: /1982:80/, // LAS
    area: 'uppsägningstid (LAS)',
  },
  {
    query: 'Hur många semesterdagar har en anställd rätt till per år?',
    expectDocNumber: /1977:480/, // Semesterlagen
    area: 'semester (Semesterlagen)',
  },
  {
    query: 'Hur mycket övertid får en anställd arbeta per kalenderår?',
    expectDocNumber: /1982:673/, // Arbetstidslagen
    area: 'arbetstid (ATL)',
  },
]

let failures = 0

function assert(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  PASS  ${label}`)
  } else {
    failures++
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

async function main(): Promise<void> {
  console.log('=== Story 7.7 — CA grounding eval (retrieval layer) ===\n')

  // ── Discover targets ───────────────────────────────────────────────────────
  let workspaceId = argValue('--workspace')
  if (!workspaceId) {
    const row = await prisma.$queryRaw<Array<{ workspace_id: string }>>`
      SELECT DISTINCT workspace_id FROM content_chunks
      WHERE source_type = 'COLLECTIVE_AGREEMENT' AND workspace_id IS NOT NULL
      LIMIT 1
    `
    workspaceId = row[0]?.workspace_id
  }
  if (!workspaceId) {
    console.error(
      'No workspace with COLLECTIVE_AGREEMENT chunks found. Upload + ingest an agreement first (Story 7.5), or pass --workspace <id>.'
    )
    process.exit(1)
  }

  const agreements = await prisma.collectiveAgreement.findMany({
    where: { workspace_id: workspaceId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  const agreementIds = new Set(agreements.map((a) => a.id))

  let biasAgreementId = argValue('--agreement')
  if (!biasAgreementId) {
    const withChunks = await prisma.$queryRaw<Array<{ source_id: string }>>`
      SELECT DISTINCT source_id FROM content_chunks
      WHERE source_type = 'COLLECTIVE_AGREEMENT' AND workspace_id = ${workspaceId}
      LIMIT 1
    `
    biasAgreementId = withChunks[0]?.source_id
  }

  let foreignWorkspaceId = argValue('--foreign-workspace')
  if (!foreignWorkspaceId) {
    const other = await prisma.workspace.findFirst({
      where: { id: { not: workspaceId } },
      select: { id: true },
    })
    // A random UUID is a valid probe too: retrieval must return zero CA rows
    // for a workspace that owns none.
    foreignWorkspaceId = other?.id ?? randomUUID()
  }

  console.log(`Target workspace:  ${workspaceId}`)
  console.log(
    `Agreements:        ${agreements.length} (${agreements.map((a) => a.name).join(', ') || 'n/a'})`
  )
  console.log(`Bias agreement:    ${biasAgreementId ?? 'n/a'}`)
  console.log(`Foreign workspace: ${foreignWorkspaceId}\n`)

  // ── (a) CA retrieval: workspace-correct ────────────────────────────────────
  console.log(`(a) CA retrieval — "${CA_QUERY}"`)
  const caAll = await retrieveContext(CA_QUERY, workspaceId, {
    sourceTypes: ['COLLECTIVE_AGREEMENT'],
    topK: TOP_K,
  })
  assert('returns at least one CA chunk (unbiased)', caAll.results.length > 0)
  assert(
    'every result is a COLLECTIVE_AGREEMENT chunk',
    caAll.results.every((r) => r.sourceType === 'COLLECTIVE_AGREEMENT'),
    caAll.results.map((r) => r.sourceType).join(',')
  )
  assert(
    "every result belongs to the target workspace's agreements",
    caAll.results.every((r) => agreementIds.has(r.sourceId)),
    `foreign source_ids: ${caAll.results
      .filter((r) => !agreementIds.has(r.sourceId))
      .map((r) => r.sourceId)
      .join(',')}`
  )

  // ── (a) agreement-correct under bias ───────────────────────────────────────
  if (biasAgreementId) {
    const caBiased = await retrieveContext(CA_QUERY, workspaceId, {
      sourceTypes: ['COLLECTIVE_AGREEMENT'],
      sourceId: biasAgreementId,
      topK: TOP_K,
    })
    assert('biased retrieval returns chunks', caBiased.results.length > 0)
    assert(
      'biased retrieval returns ONLY the assigned agreement',
      caBiased.results.every((r) => r.sourceId === biasAgreementId),
      caBiased.results.map((r) => r.sourceId).join(',')
    )
  } else {
    console.log('  SKIP  bias assertions — no agreement with chunks found')
  }

  // ── (b) cross-workspace leakage probe ──────────────────────────────────────
  console.log('\n(b) Cross-workspace leakage probe')
  const foreignPlain = await retrieveContext(CA_QUERY, foreignWorkspaceId, {
    sourceTypes: ['COLLECTIVE_AGREEMENT'],
    topK: TOP_K,
  })
  assert(
    "foreign workspace sees ZERO of the target's CA chunks",
    foreignPlain.results.every((r) => !agreementIds.has(r.sourceId)),
    `leaked: ${foreignPlain.results
      .filter((r) => agreementIds.has(r.sourceId))
      .map((r) => r.id)
      .join(',')}`
  )
  if (biasAgreementId) {
    // The hostile case: a foreign workspace probing WITH the target's
    // agreement id (crafted/hallucinated id). Must filter to zero.
    const foreignBiased = await retrieveContext(CA_QUERY, foreignWorkspaceId, {
      sourceTypes: ['COLLECTIVE_AGREEMENT'],
      sourceId: biasAgreementId,
      topK: TOP_K,
    })
    assert(
      "foreign workspace + target's agreementId → ZERO chunks",
      foreignBiased.results.length === 0,
      `got ${foreignBiased.results.length}`
    )
  }

  // ── (c) legal corpus still healthy across ≥2 areas ─────────────────────────
  console.log('\n(c) Legal-corpus reference queries')
  for (const lq of LEGAL_QUERIES) {
    const res = await retrieveContext(lq.query, workspaceId, { topK: TOP_K })
    const docNumbers = res.results
      .map((r) => r.documentNumber ?? '')
      .filter(Boolean)
    assert(
      `${lq.area}: expected instrument in top ${TOP_K}`,
      docNumbers.some((d) => lq.expectDocNumber.test(d)),
      `got: ${[...new Set(docNumbers)].join(' | ') || '(none)'}`
    )
  }

  console.log(
    `\n${failures === 0 ? 'ALL ASSERTIONS PASSED' : `${failures} ASSERTION(S) FAILED`}`
  )
  await prisma.$disconnect()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  prisma.$disconnect()
  process.exit(1)
})
