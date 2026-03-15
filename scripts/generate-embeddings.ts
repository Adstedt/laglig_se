/* eslint-disable no-console */
/**
 * Batch embedding generation pipeline
 * Story 14.3, Task 4 (AC: 9-13)
 *
 * Two phases:
 * 1. Context prefix generation (Claude Haiku) — one call per document
 * 2. Embedding generation (OpenAI text-embedding-3-small) — batches of 100
 *
 * Supports both sequential mode (one API call at a time) and batch mode
 * (Anthropic Batch API with 50% cost savings).
 *
 * Usage:
 *   npx tsx scripts/generate-embeddings.ts                       # full sequential run
 *   npx tsx scripts/generate-embeddings.ts --estimate            # cost estimate only
 *   npx tsx scripts/generate-embeddings.ts --limit 100           # first 100 docs
 *   npx tsx scripts/generate-embeddings.ts --resume              # resume from cursor
 *   npx tsx scripts/generate-embeddings.ts --skip-context        # skip LLM, embed only
 *   npx tsx scripts/generate-embeddings.ts --source-type SFS_LAW # filter by type
 *   npx tsx scripts/generate-embeddings.ts --batch-submit        # submit batches to Anthropic Batch API
 *   npx tsx scripts/generate-embeddings.ts --batch-status        # check status of submitted batches
 *   npx tsx scripts/generate-embeddings.ts --batch-collect       # download results, write prefixes to DB
 *   npx tsx scripts/generate-embeddings.ts --batch-full          # submit + poll + collect in one run
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import Anthropic from '@anthropic-ai/sdk'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import {
  generateContextPrefixes,
  buildBatchPrefixRequests,
  parsePrefixResponse,
  HAIKU_MODEL,
  type ChunkForContext,
  type BatchPrefixRequest,
} from '../lib/chunks/generate-context-prefixes'
import {
  generateEmbeddingsBatch,
  vectorToString,
  type EmbeddingInput,
} from '../lib/chunks/embed-chunks'
import { estimateTokenCount } from '../lib/chunks/token-count'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// Configuration
// ============================================================================

const PROGRESS_FILE = path.join(
  __dirname,
  '..',
  'data',
  'embedding-progress.json'
)
const BATCH_PROGRESS_FILE = path.join(
  __dirname,
  '..',
  'data',
  'batch-progress.json'
)
const EMBEDDING_BATCH_SIZE = 100
const EMBEDDING_DELAY_MS = 200 // delay between OpenAI batches
const CONTEXT_DELAY_MS = 500 // delay between Haiku calls
const MAX_CONSECUTIVE_FAILURES = 5
const BATCH_CHUNK_SIZE = 500 // docs per Anthropic batch
const BATCH_POLL_INTERVAL_MS = 30_000 // 30s between polls
const HAIKU_MAX_TOKENS = 8192

// Cost rates (standard)
const HAIKU_INPUT_COST_PER_M = 0.8 // $/1M input tokens
const HAIKU_OUTPUT_COST_PER_M = 4.0 // $/1M output tokens
const EMBEDDING_COST_PER_M = 0.02 // $/1M tokens

// Batch API pricing (50% of standard)
const _HAIKU_BATCH_INPUT_COST_PER_M = 0.4
const _HAIKU_BATCH_OUTPUT_COST_PER_M = 2.0

// ============================================================================
// Types
// ============================================================================

interface Progress {
  phase: 'context' | 'embedding' | 'complete'
  lastProcessedDocId: string | null
  lastProcessedChunkId: string | null
  totalDocsProcessed: number
  totalChunksEmbedded: number
  totalCost: number
  lastRunAt: string
}

interface BatchEntry {
  batchId: string
  docIds: string[]
  status: 'submitted' | 'in_progress' | 'ended' | 'collected'
  docCount: number
  requestCount: number
}

interface BatchProgress {
  batches: BatchEntry[]
  totalDocsSubmitted: number
  totalRequestsSubmitted: number
  totalPrefixesWritten: number
  submittedAt: string
  sourceType: string | null
  /** Maps customId → { docId, chunkPaths } for split doc result mapping */
  requestMap: Record<string, { docId: string; chunkPaths: string[] }>
}

interface CliArgs {
  estimate: boolean
  limit: number | null
  resume: boolean
  skipContext: boolean
  sourceType: string | null
  batchSubmit: boolean
  batchStatus: boolean
  batchCollect: boolean
  batchFull: boolean
}

// ============================================================================
// Progress tracking
// ============================================================================

function loadProgress(): Progress | null {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
    }
  } catch {
    // ignore
  }
  return null
}

function saveProgress(progress: Progress): void {
  const dir = path.dirname(PROGRESS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

// ============================================================================
// CLI argument parsing
// ============================================================================

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const result: CliArgs = {
    estimate: false,
    limit: null,
    resume: false,
    skipContext: false,
    sourceType: null,
    batchSubmit: false,
    batchStatus: false,
    batchCollect: false,
    batchFull: false,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--estimate':
        result.estimate = true
        break
      case '--limit':
        result.limit = parseInt(args[++i] ?? '0', 10)
        break
      case '--resume':
        result.resume = true
        break
      case '--skip-context':
        result.skipContext = true
        break
      case '--source-type':
        result.sourceType = args[++i] ?? null
        break
      case '--batch-submit':
        result.batchSubmit = true
        break
      case '--batch-status':
        result.batchStatus = true
        break
      case '--batch-collect':
        result.batchCollect = true
        break
      case '--batch-full':
        result.batchFull = true
        break
    }
  }

  return result
}

// ============================================================================
// Cost estimation
// ============================================================================

async function runEstimate(sourceTypeFilter: string | null): Promise<void> {
  console.log('Calculating cost estimate...\n')

  const sourceFilter = sourceTypeFilter
    ? Prisma.sql`AND ld.content_type = ${sourceTypeFilter}`
    : Prisma.sql``

  // Count documents with chunks but no context_prefix
  const docsNeedingContext = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT cc.source_id) as count
    FROM content_chunks cc
    JOIN legal_documents ld ON cc.source_id = ld.id
    WHERE cc.context_prefix IS NULL
    ${sourceFilter}
  `
  const docCount = Number(docsNeedingContext[0]?.count ?? 0)

  // Total markdown tokens across those documents
  const markdownStats = await prisma.$queryRaw<
    Array<{ total_chars: bigint; avg_chars: string }>
  >`
    SELECT
      COALESCE(SUM(LENGTH(ld.markdown_content)), 0) as total_chars,
      COALESCE(AVG(LENGTH(ld.markdown_content)), 0) as avg_chars
    FROM legal_documents ld
    WHERE ld.id IN (
      SELECT DISTINCT cc.source_id FROM content_chunks cc WHERE cc.context_prefix IS NULL
    )
    ${sourceFilter}
  `
  const totalMarkdownChars = Number(markdownStats[0]?.total_chars ?? 0)
  const totalMarkdownTokens = totalMarkdownChars / 4

  // Count chunks needing embedding
  const chunksNeedingEmbed = await prisma.$queryRaw<
    Array<{ count: bigint; total_tokens: bigint }>
  >`
    SELECT COUNT(*) as count, COALESCE(SUM(cc.token_count), 0) as total_tokens
    FROM content_chunks cc
    JOIN legal_documents ld ON cc.source_id = ld.id
    WHERE cc.embedding IS NULL
    ${sourceFilter}
  `
  const chunkCount = Number(chunksNeedingEmbed[0]?.count ?? 0)
  const totalChunkTokens = Number(chunksNeedingEmbed[0]?.total_tokens ?? 0)

  // Estimate costs
  // Haiku: input = markdown, output ≈ 50 chunks × 75 tokens per doc
  const avgChunksPerDoc = chunkCount / Math.max(docCount, 1)
  const haikuOutputTokens = docCount * avgChunksPerDoc * 75
  const haikuInputCost =
    (totalMarkdownTokens / 1_000_000) * HAIKU_INPUT_COST_PER_M
  const haikuOutputCost =
    (haikuOutputTokens / 1_000_000) * HAIKU_OUTPUT_COST_PER_M
  const haikuTotalCost = haikuInputCost + haikuOutputCost

  // Embedding: token_count + ~100 tokens overhead (header + prefix)
  const embeddingTokens = totalChunkTokens + chunkCount * 100
  const embeddingCost = (embeddingTokens / 1_000_000) * EMBEDDING_COST_PER_M

  console.log('=== Context Prefix Generation (Claude Haiku) ===')
  console.log(`  Documents needing context: ${docCount.toLocaleString()}`)
  console.log(
    `  Total markdown tokens: ${Math.round(totalMarkdownTokens).toLocaleString()}`
  )
  console.log(
    `  Estimated output tokens: ${Math.round(haikuOutputTokens).toLocaleString()}`
  )
  console.log(`  Estimated cost: $${haikuTotalCost.toFixed(2)}`)
  console.log(
    `  Estimated time: ${formatDuration(docCount * (CONTEXT_DELAY_MS + 500))}`
  )
  console.log()
  console.log('=== Embedding Generation (OpenAI) ===')
  console.log(`  Chunks needing embedding: ${chunkCount.toLocaleString()}`)
  console.log(`  Total tokens (content): ${totalChunkTokens.toLocaleString()}`)
  console.log(
    `  Total tokens (with overhead): ${embeddingTokens.toLocaleString()}`
  )
  console.log(`  Estimated cost: $${embeddingCost.toFixed(2)}`)
  console.log(
    `  Estimated time: ${formatDuration((chunkCount / EMBEDDING_BATCH_SIZE) * EMBEDDING_DELAY_MS)}`
  )
  console.log()
  console.log(`=== Total ===`)
  console.log(
    `  Combined cost: $${(haikuTotalCost + embeddingCost).toFixed(2)}`
  )
}

// ============================================================================
// Phase 1: Context prefix generation
// ============================================================================

async function runContextGeneration(
  args: CliArgs,
  progress: Progress
): Promise<void> {
  const startTime = Date.now()

  // Build query conditions
  const conditions: string[] = ['cc.context_prefix IS NULL']
  if (args.sourceType) {
    conditions.push(`ld.content_type = '${args.sourceType}'`)
  }
  if (progress.lastProcessedDocId) {
    conditions.push(`ld.id > '${progress.lastProcessedDocId}'`)
  }

  const whereClause = conditions.join(' AND ')
  const limitClause = args.limit ? `LIMIT ${args.limit}` : ''

  // Get documents that need context prefixes
  const docs = await prisma.$queryRaw<
    Array<{
      id: string
      title: string
      document_number: string
      markdown_content: string | null
    }>
  >(Prisma.sql`
    SELECT DISTINCT ld.id, ld.title, ld.document_number, ld.markdown_content
    FROM legal_documents ld
    JOIN content_chunks cc ON cc.source_id = ld.id
    WHERE ${Prisma.raw(whereClause)}
    ORDER BY ld.id ASC
    ${Prisma.raw(limitClause)}
  `)

  const totalDocs = docs.length
  console.log(`[Context] ${totalDocs} documents need context prefixes`)

  let consecutiveFailures = 0

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]!

    if (!doc.markdown_content) {
      console.warn(
        `[Context] Skipping ${doc.document_number} — no markdown_content`
      )
      continue
    }

    // Load chunks for this document
    const chunks = await prisma.contentChunk.findMany({
      where: {
        source_id: doc.id,
        context_prefix: null,
      },
      select: { id: true, path: true, content: true },
      orderBy: { id: 'asc' },
    })

    if (chunks.length === 0) continue

    const chunkInputs: ChunkForContext[] = chunks.map((c) => ({
      path: c.path,
      content: c.content,
    }))

    try {
      const prefixes = await generateContextPrefixes(
        {
          markdown: doc.markdown_content,
          title: doc.title,
          documentNumber: doc.document_number,
        },
        chunkInputs
      )

      // Write prefixes to DB
      let updated = 0
      for (const chunk of chunks) {
        const prefix = prefixes.get(chunk.path)
        if (prefix) {
          await prisma.contentChunk.update({
            where: { id: chunk.id },
            data: { context_prefix: prefix },
          })
          updated++
        }
      }

      consecutiveFailures = 0
      progress.totalDocsProcessed++
      progress.lastProcessedDocId = doc.id
      progress.lastRunAt = new Date().toISOString()

      // Estimate cost: input tokens + output tokens
      const inputTokens = estimateTokenCount(doc.markdown_content)
      const outputTokens = updated * 75
      progress.totalCost +=
        (inputTokens / 1_000_000) * HAIKU_INPUT_COST_PER_M +
        (outputTokens / 1_000_000) * HAIKU_OUTPUT_COST_PER_M

      if ((i + 1) % 10 === 0 || i === docs.length - 1) {
        const elapsed = formatDuration(Date.now() - startTime)
        const pct = (((i + 1) / totalDocs) * 100).toFixed(1)
        console.log(
          `[Context] ${i + 1}/${totalDocs} docs (${pct}%) | ` +
            `${updated}/${chunks.length} chunks prefixed | ` +
            `Cost: $${progress.totalCost.toFixed(2)} | Elapsed: ${elapsed}`
        )
        saveProgress(progress)
      }

      // Rate limiting delay
      await sleep(CONTEXT_DELAY_MS)
    } catch (err) {
      consecutiveFailures++
      const msg = err instanceof Error ? err.message : String(err)
      console.error(
        `[Context] FAILED ${doc.document_number} (${doc.id}): ${msg}`
      )

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(
          `[Context] ${MAX_CONSECUTIVE_FAILURES} consecutive failures — aborting. Use --resume to continue.`
        )
        saveProgress(progress)
        process.exit(1)
      }
    }
  }

  console.log(
    `[Context] Phase complete. ${progress.totalDocsProcessed} docs processed.`
  )
  progress.phase = 'embedding'
  saveProgress(progress)
}

// ============================================================================
// Phase 2: Embedding generation
// ============================================================================

async function runEmbeddingGeneration(
  args: CliArgs,
  progress: Progress
): Promise<void> {
  const startTime = Date.now()

  // When --limit is set, scope to only docs that have context_prefix written
  // (i.e. the ones we just processed) to avoid scanning all 580K chunks
  const limitFilter = args.limit
    ? Prisma.sql`AND cc.context_prefix IS NOT NULL`
    : Prisma.sql``

  const sourceFilter = args.sourceType
    ? Prisma.sql`AND ld.content_type = ${args.sourceType}`
    : Prisma.sql``

  const cursorFilter = progress.lastProcessedChunkId
    ? Prisma.sql`AND cc.id > ${progress.lastProcessedChunkId}`
    : Prisma.sql``

  // Count total chunks needing embedding
  const totalResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM content_chunks cc
    JOIN legal_documents ld ON cc.source_id = ld.id
    WHERE cc.embedding IS NULL
    ${limitFilter}
    ${sourceFilter}
    ${cursorFilter}
  `
  const totalChunks = Number(totalResult[0]?.count ?? 0)
  console.log(`[Embed] ${totalChunks.toLocaleString()} chunks need embedding`)

  let processed = progress.totalChunksEmbedded
  let consecutiveFailures = 0
  let lastChunkId = progress.lastProcessedChunkId

  while (true) {
    // Fetch next batch
    const cursorCondition = lastChunkId
      ? Prisma.sql`AND cc.id > ${lastChunkId}`
      : Prisma.sql``

    const batch = await prisma.$queryRaw<
      Array<{
        id: string
        content: string
        context_prefix: string | null
        contextual_header: string
        token_count: number
      }>
    >`
      SELECT cc.id, cc.content, cc.context_prefix, cc.contextual_header, cc.token_count
      FROM content_chunks cc
      JOIN legal_documents ld ON cc.source_id = ld.id
      WHERE cc.embedding IS NULL
      ${limitFilter}
      ${sourceFilter}
      ${cursorCondition}
      ORDER BY cc.id ASC
      LIMIT ${EMBEDDING_BATCH_SIZE}
    `

    if (batch.length === 0) break

    const embeddingInputs: EmbeddingInput[] = batch.map((chunk) => ({
      text: chunk.content,
      contextPrefix: chunk.context_prefix ?? '',
      contextualHeader: chunk.contextual_header,
    }))

    try {
      const result = await generateEmbeddingsBatch(embeddingInputs)

      // Bulk-write embeddings via single raw SQL UPDATE (100 rows per query)
      const values = batch
        .map((chunk, j) => {
          const safeId = chunk.id.replace(/'/g, "''")
          return `('${safeId}', '${vectorToString(result.embeddings[j]!)}'::vector)`
        })
        .join(',\n')

      await prisma.$executeRawUnsafe(`
        UPDATE content_chunks cc
        SET embedding = v.emb, updated_at = NOW()
        FROM (VALUES ${values}) AS v(id, emb)
        WHERE cc.id = v.id
      `)

      consecutiveFailures = 0
      processed += batch.length
      lastChunkId = batch[batch.length - 1]!.id

      // Estimate embedding cost
      const batchTokens = batch.reduce((sum, c) => sum + c.token_count + 100, 0)
      progress.totalCost += (batchTokens / 1_000_000) * EMBEDDING_COST_PER_M
      progress.totalChunksEmbedded = processed
      progress.lastProcessedChunkId = lastChunkId
      progress.lastRunAt = new Date().toISOString()

      const elapsed = formatDuration(Date.now() - startTime)
      const pct =
        totalChunks > 0 ? ((processed / totalChunks) * 100).toFixed(1) : '?'
      console.log(
        `[Embed] ${processed.toLocaleString()}/${totalChunks.toLocaleString()} (${pct}%) | ` +
          `Cost: $${progress.totalCost.toFixed(2)} | Elapsed: ${elapsed}`
      )
      saveProgress(progress)

      // Rate limiting delay
      await sleep(EMBEDDING_DELAY_MS)
    } catch (err) {
      consecutiveFailures++
      const msg = err instanceof Error ? err.message : String(err)
      console.error(
        `[Embed] FAILED batch at chunk ${lastChunkId ?? 'start'}: ${msg}`
      )

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(
          `[Embed] ${MAX_CONSECUTIVE_FAILURES} consecutive failures — aborting. Use --resume to continue.`
        )
        saveProgress(progress)
        process.exit(1)
      }

      // Skip this batch on failure — advance cursor past the problematic chunk
      if (batch.length > 0) {
        lastChunkId = batch[batch.length - 1]!.id
      }
    }
  }

  console.log(
    `[Embed] Phase complete. ${processed.toLocaleString()} chunks embedded.`
  )
  progress.phase = 'complete'
  saveProgress(progress)
}

// ============================================================================
// Batch API: Progress file helpers
// ============================================================================

function loadBatchProgress(): BatchProgress | null {
  try {
    if (fs.existsSync(BATCH_PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(BATCH_PROGRESS_FILE, 'utf-8'))
    }
  } catch {
    // ignore
  }
  return null
}

function saveBatchProgress(progress: BatchProgress): void {
  const dir = path.dirname(BATCH_PROGRESS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(BATCH_PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

// ============================================================================
// Batch API: Submit
// ============================================================================

async function runBatchSubmit(args: CliArgs): Promise<BatchProgress> {
  console.log('\n=== Batch Submit: Context Prefix Generation ===\n')

  // Step 1: Get doc IDs that need prefixes (lightweight query — no large columns)
  console.log('[Batch] Finding documents that need context prefixes...')
  await prisma.$executeRawUnsafe('SET statement_timeout = 600000') // 10 min

  const sourceFilter = args.sourceType
    ? `AND ld.content_type = '${args.sourceType}'`
    : ''
  const limitClause = args.limit ? `LIMIT ${args.limit}` : ''

  const docIdRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT DISTINCT cc.source_id as id
    FROM content_chunks cc
    JOIN legal_documents ld ON cc.source_id = ld.id
    WHERE cc.context_prefix IS NULL
    ${Prisma.raw(sourceFilter)}
    ORDER BY cc.source_id ASC
    ${Prisma.raw(limitClause)}
  `)

  console.log(`[Batch] ${docIdRows.length} documents need context prefixes`)

  if (docIdRows.length === 0) {
    return {
      batches: [],
      totalDocsSubmitted: 0,
      totalRequestsSubmitted: 0,
      totalPrefixesWritten: 0,
      submittedAt: new Date().toISOString(),
      sourceType: args.sourceType,
      requestMap: {},
    }
  }

  // Step 2: Bulk fetch docs + chunks in pages of 500
  const allDocIds = docIdRows.map((r) => r.id)
  const allRequests: Array<{
    request: BatchPrefixRequest
    docId: string
  }> = []
  let skipped = 0
  const DOC_PAGE_SIZE = 500

  for (let page = 0; page < allDocIds.length; page += DOC_PAGE_SIZE) {
    const pageIds = allDocIds.slice(page, page + DOC_PAGE_SIZE)

    // Fetch chunks first (lighter), then docs (heavy markdown)
    const chunks = await prisma.contentChunk.findMany({
      where: { source_id: { in: pageIds }, context_prefix: null },
      select: { source_id: true, path: true, content: true },
      orderBy: { id: 'asc' },
    })
    const docs = await prisma.legalDocument.findMany({
      where: { id: { in: pageIds } },
      select: {
        id: true,
        title: true,
        document_number: true,
        markdown_content: true,
      },
    })

    // Group chunks by source_id
    const chunksByDoc = new Map<
      string,
      Array<{ path: string; content: string }>
    >()
    for (const c of chunks) {
      const group = chunksByDoc.get(c.source_id) ?? []
      group.push({ path: c.path, content: c.content })
      chunksByDoc.set(c.source_id, group)
    }

    for (const doc of docs) {
      if (!doc.markdown_content) {
        skipped++
        continue
      }

      const docChunks = chunksByDoc.get(doc.id)
      if (!docChunks || docChunks.length === 0) continue

      const requests = buildBatchPrefixRequests(
        doc.id,
        {
          markdown: doc.markdown_content,
          title: doc.title,
          documentNumber: doc.document_number,
        },
        docChunks
      )

      for (const req of requests) {
        allRequests.push({ request: req, docId: doc.id })
      }
    }

    console.log(
      `[Batch] Building requests: ${Math.min(page + DOC_PAGE_SIZE, allDocIds.length)}/${allDocIds.length} docs (${allRequests.length} requests so far)`
    )
  }

  if (skipped > 0) {
    console.log(`[Batch] Skipped ${skipped} docs with no markdown_content`)
  }

  console.log(
    `[Batch] Built ${allRequests.length} API requests for ${allDocIds.length - skipped} documents`
  )

  if (allRequests.length === 0) {
    console.log('[Batch] Nothing to submit.')
    return {
      batches: [],
      totalDocsSubmitted: 0,
      totalRequestsSubmitted: 0,
      totalPrefixesWritten: 0,
      submittedAt: new Date().toISOString(),
      sourceType: args.sourceType,
      requestMap: {},
    }
  }

  // Build request map for result collection
  const requestMap: Record<string, { docId: string; chunkPaths: string[] }> = {}
  for (const { request, docId } of allRequests) {
    requestMap[request.customId] = {
      docId,
      chunkPaths: request.chunkPaths,
    }
  }

  // Submit in chunks of BATCH_CHUNK_SIZE
  const anthropic = new Anthropic()
  const batchEntries: BatchEntry[] = []
  const docIdSet = new Set<string>()

  for (let i = 0; i < allRequests.length; i += BATCH_CHUNK_SIZE) {
    const chunk = allRequests.slice(i, i + BATCH_CHUNK_SIZE)
    const batchDocIds = [...new Set(chunk.map((r) => r.docId))]
    batchDocIds.forEach((id) => docIdSet.add(id))

    const batchRequests = chunk.map((r) => ({
      custom_id: r.request.customId,
      params: {
        model: HAIKU_MODEL,
        max_tokens: HAIKU_MAX_TOKENS,
        messages: [{ role: 'user' as const, content: r.request.prompt }],
      },
    }))

    console.log(
      `[Batch] Submitting batch ${batchEntries.length + 1}: ${chunk.length} requests (${batchDocIds.length} docs)...`
    )

    const batch = await anthropic.messages.batches.create({
      requests: batchRequests,
    })

    console.log(`[Batch] Submitted: ${batch.id}`)

    batchEntries.push({
      batchId: batch.id,
      docIds: batchDocIds,
      status: 'submitted',
      docCount: batchDocIds.length,
      requestCount: chunk.length,
    })
  }

  const progress: BatchProgress = {
    batches: batchEntries,
    totalDocsSubmitted: docIdSet.size,
    totalRequestsSubmitted: allRequests.length,
    totalPrefixesWritten: 0,
    submittedAt: new Date().toISOString(),
    sourceType: args.sourceType,
    requestMap,
  }

  saveBatchProgress(progress)

  console.log(
    `\n[Batch] Submitted ${batchEntries.length} batches (${allRequests.length} requests, ${docIdSet.size} docs)`
  )
  console.log(`[Batch] Progress saved to ${BATCH_PROGRESS_FILE}`)

  return progress
}

// ============================================================================
// Batch API: Status
// ============================================================================

async function runBatchStatus(): Promise<BatchProgress> {
  const progress = loadBatchProgress()
  if (!progress) {
    console.log('No batch progress file found. Run --batch-submit first.')
    process.exit(1)
  }

  console.log('\n=== Batch Status ===\n')
  console.log(`Submitted at: ${progress.submittedAt}`)
  console.log(`Total batches: ${progress.batches.length}`)
  console.log(`Total requests: ${progress.totalRequestsSubmitted}`)
  console.log(`Total docs: ${progress.totalDocsSubmitted}`)
  console.log(`Prefixes written: ${progress.totalPrefixesWritten}`)
  console.log()

  const anthropic = new Anthropic()

  for (const entry of progress.batches) {
    if (entry.status === 'collected') {
      console.log(`  ${entry.batchId}: collected (${entry.requestCount} reqs)`)
      continue
    }

    const status = await anthropic.messages.batches.retrieve(entry.batchId)
    const counts = status.request_counts
    const total =
      counts.succeeded +
      counts.errored +
      counts.canceled +
      counts.expired +
      counts.processing

    if (status.processing_status === 'ended') {
      entry.status = 'ended'
      console.log(
        `  ${entry.batchId}: ENDED — ${counts.succeeded} succeeded, ${counts.errored} errored, ${counts.canceled} canceled, ${counts.expired} expired`
      )
    } else {
      entry.status = 'in_progress'
      const done =
        counts.succeeded + counts.errored + counts.canceled + counts.expired
      console.log(
        `  ${entry.batchId}: IN PROGRESS — ${done}/${total} complete (${counts.processing} processing)`
      )
    }
  }

  saveBatchProgress(progress)
  return progress
}

// ============================================================================
// Batch API: Collect results
// ============================================================================

const COLLECT_DB_BATCH_SIZE = 200 // chunks per raw SQL bulk update
const COLLECT_PROGRESS_FILE = path.join(
  __dirname,
  '..',
  'data',
  'collect-progress.json'
)

interface CollectProgress {
  /** Batch IDs already fully collected */
  collectedBatchIds: string[]
  totalPrefixesWritten: number
  totalFailed: number
  totalErrored: number
  startedAt: string
  lastUpdatedAt: string
}

function loadCollectProgress(): CollectProgress | null {
  try {
    if (fs.existsSync(COLLECT_PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(COLLECT_PROGRESS_FILE, 'utf-8'))
    }
  } catch {
    // ignore
  }
  return null
}

function saveCollectProgress(cp: CollectProgress): void {
  cp.lastUpdatedAt = new Date().toISOString()
  fs.writeFileSync(COLLECT_PROGRESS_FILE, JSON.stringify(cp, null, 2))
}

/**
 * Bulk-write prefix updates using raw SQL for speed.
 * Writes ~200 chunk prefixes per query (1 round-trip = 200 updates).
 */
async function bulkWritePrefixes(
  updates: { sourceId: string; chunkPath: string; prefix: string }[]
): Promise<number> {
  if (updates.length === 0) return 0

  // Build a VALUES clause: (source_id, path, prefix)
  const values = updates
    .map((u, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
    .join(', ')

  const params: string[] = []
  for (const u of updates) {
    params.push(u.sourceId, u.chunkPath, u.prefix)
  }

  const sql = `
    UPDATE content_chunks cc
    SET context_prefix = v.prefix, updated_at = NOW()
    FROM (VALUES ${values}) AS v(source_id, path, prefix)
    WHERE cc.source_id = v.source_id
      AND cc.path = v.path
      AND cc.context_prefix IS NULL
  `

  const result = await prisma.$executeRawUnsafe(sql, ...params)
  return result
}

async function runBatchCollect(): Promise<void> {
  const progress = loadBatchProgress()
  if (!progress) {
    console.log('No batch progress file found. Run --batch-submit first.')
    process.exit(1)
  }

  // Load or create collect-specific progress (survives crashes)
  const cp = loadCollectProgress() || {
    collectedBatchIds: [],
    totalPrefixesWritten: 0,
    totalFailed: 0,
    totalErrored: 0,
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  }

  console.log('\n=== Batch Collect: Writing Prefixes to DB ===\n')
  console.log(
    `[Collect] ${progress.batches.length} batches, ${progress.totalRequestsSubmitted} requests total`
  )
  console.log(
    `[Collect] Previously collected: ${cp.collectedBatchIds.length} batches, ${cp.totalPrefixesWritten} prefixes`
  )
  console.log()

  const anthropic = new Anthropic()
  let sessionWritten = 0
  let sessionFailed = 0
  let sessionErrored = 0
  const startTime = Date.now()

  for (let bIdx = 0; bIdx < progress.batches.length; bIdx++) {
    const entry = progress.batches[bIdx]

    // Skip if already collected (check both progress files)
    if (
      entry.status === 'collected' ||
      cp.collectedBatchIds.includes(entry.batchId)
    ) {
      continue
    }

    // Check batch is complete
    const status = await anthropic.messages.batches.retrieve(entry.batchId)
    if (status.processing_status !== 'ended') {
      console.log(
        `[Collect] Skipping ${entry.batchId} — still ${status.processing_status}`
      )
      continue
    }

    console.log(
      `[Collect] Batch ${bIdx + 1}/${progress.batches.length}: ${entry.batchId} (${entry.requestCount} requests)...`
    )

    // Phase 1: Stream all results into memory buffer
    const prefixBuffer: {
      sourceId: string
      chunkPath: string
      prefix: string
    }[] = []
    let batchErrored = 0
    let batchFailed = 0

    const decoder = await anthropic.messages.batches.results(entry.batchId)

    for await (const item of decoder) {
      if (item.result.type !== 'succeeded') {
        batchErrored++
        continue
      }

      const textBlock = item.result.message.content.find(
        (b) => b.type === 'text'
      )
      if (!textBlock || textBlock.type !== 'text') {
        batchFailed++
        continue
      }

      const mapping = progress.requestMap[item.custom_id]
      if (!mapping) {
        batchFailed++
        continue
      }

      const fakeChunks: ChunkForContext[] = mapping.chunkPaths.map((p) => ({
        path: p,
        content: '',
      }))

      const prefixes = parsePrefixResponse(textBlock.text, fakeChunks)

      for (const [chunkPath, prefix] of prefixes) {
        prefixBuffer.push({
          sourceId: mapping.docId,
          chunkPath,
          prefix,
        })
      }
    }

    // Phase 2: Bulk-write to DB in batches of COLLECT_DB_BATCH_SIZE
    let batchWritten = 0
    for (let i = 0; i < prefixBuffer.length; i += COLLECT_DB_BATCH_SIZE) {
      const slice = prefixBuffer.slice(i, i + COLLECT_DB_BATCH_SIZE)
      try {
        const count = await bulkWritePrefixes(slice)
        batchWritten += count
      } catch (_err) {
        // Fallback: try smaller chunks on failure
        for (const item of slice) {
          try {
            const r = await bulkWritePrefixes([item])
            batchWritten += r
          } catch {
            batchFailed++
          }
        }
      }
    }

    // Mark collected
    entry.status = 'collected'
    cp.collectedBatchIds.push(entry.batchId)
    cp.totalPrefixesWritten += batchWritten
    cp.totalFailed += batchFailed
    cp.totalErrored += batchErrored
    sessionWritten += batchWritten
    sessionFailed += batchFailed
    sessionErrored += batchErrored

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
    const batchesDone = cp.collectedBatchIds.length
    const _batchesRemaining = progress.batches.length - batchesDone
    console.log(
      `[Collect] Batch ${bIdx + 1}: ${batchWritten} prefixes (${batchFailed} failed, ${batchErrored} errors) — ` +
        `${batchesDone}/${progress.batches.length} batches done — ${elapsed}s elapsed`
    )

    // Save progress after each batch (crash-safe)
    saveBatchProgress(progress)
    saveCollectProgress(cp)
  }

  // Final summary
  progress.totalPrefixesWritten = cp.totalPrefixesWritten
  saveBatchProgress(progress)
  saveCollectProgress(cp)

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(0)
  console.log(
    `\n=== Collect Complete ===\n` +
      `Session: ${sessionWritten} prefixes written, ${sessionFailed} failures, ${sessionErrored} errors\n` +
      `Total: ${cp.totalPrefixesWritten} prefixes written across all sessions\n` +
      `Time: ${totalElapsed}s\n`
  )
}

// ============================================================================
// Batch API: Full (submit + poll + collect)
// ============================================================================

async function runBatchFull(args: CliArgs): Promise<void> {
  // Step 1: Submit
  const progress = await runBatchSubmit(args)
  if (progress.batches.length === 0) return

  // Step 2: Poll until all batches are done
  console.log('\n=== Polling for batch completion ===\n')
  const anthropic = new Anthropic()

  let allDone = false
  while (!allDone) {
    allDone = true
    for (const entry of progress.batches) {
      if (entry.status === 'ended' || entry.status === 'collected') continue

      const status = await anthropic.messages.batches.retrieve(entry.batchId)
      const counts = status.request_counts
      const total =
        counts.succeeded +
        counts.errored +
        counts.canceled +
        counts.expired +
        counts.processing

      if (status.processing_status === 'ended') {
        entry.status = 'ended'
        console.log(
          `[Poll] ${entry.batchId}: ENDED — ${counts.succeeded}/${total} succeeded`
        )
      } else {
        allDone = false
        const done =
          counts.succeeded + counts.errored + counts.canceled + counts.expired
        console.log(`[Poll] ${entry.batchId}: ${done}/${total} complete`)
      }
    }

    saveBatchProgress(progress)

    if (!allDone) {
      console.log(
        `[Poll] Waiting ${BATCH_POLL_INTERVAL_MS / 1000}s before next poll...`
      )
      await sleep(BATCH_POLL_INTERVAL_MS)
    }
  }

  // Step 3: Collect
  await runBatchCollect()
}

// ============================================================================
// HNSW Index Management
// ============================================================================

async function recreateHnswIndexIfMissing(): Promise<void> {
  const indexExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE indexname = 'content_chunks_embedding_idx'
    ) as exists
  `

  if (indexExists[0]?.exists) {
    console.log('[Index] HNSW index already exists — skipping recreation')
    return
  }

  console.log('[Index] Recreating HNSW index (this may take a few minutes)...')
  const startTime = Date.now()

  await prisma.$executeRawUnsafe(`
    CREATE INDEX content_chunks_embedding_idx ON content_chunks
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
  `)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
  console.log(`[Index] HNSW index created in ${elapsed}s`)
}

// ============================================================================
// Main
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main(): Promise<void> {
  const args = parseArgs()

  if (args.estimate) {
    await runEstimate(args.sourceType)
    await prisma.$disconnect()
    return
  }

  // Batch mode: submit / status / collect / full
  if (args.batchSubmit) {
    await runBatchSubmit(args)
    await prisma.$disconnect()
    return
  }
  if (args.batchStatus) {
    await runBatchStatus()
    await prisma.$disconnect()
    return
  }
  if (args.batchCollect) {
    await runBatchCollect()
    await prisma.$disconnect()
    return
  }
  if (args.batchFull) {
    await runBatchFull(args)
    await prisma.$disconnect()
    return
  }

  // Sequential mode (original behavior)

  // Load or initialize progress
  let progress: Progress
  if (args.resume) {
    const saved = loadProgress()
    if (saved) {
      console.log(`Resuming from phase: ${saved.phase}`)
      console.log(`  Docs processed: ${saved.totalDocsProcessed}`)
      console.log(`  Chunks embedded: ${saved.totalChunksEmbedded}`)
      console.log(`  Cost so far: $${saved.totalCost.toFixed(2)}`)
      progress = saved
    } else {
      console.log('No progress file found, starting fresh.')
      progress = {
        phase: 'context',
        lastProcessedDocId: null,
        lastProcessedChunkId: null,
        totalDocsProcessed: 0,
        totalChunksEmbedded: 0,
        totalCost: 0,
        lastRunAt: new Date().toISOString(),
      }
    }
  } else {
    progress = {
      phase: 'context',
      lastProcessedDocId: null,
      lastProcessedChunkId: null,
      totalDocsProcessed: 0,
      totalChunksEmbedded: 0,
      totalCost: 0,
      lastRunAt: new Date().toISOString(),
    }
  }

  // Phase 1: Context prefix generation
  if (!args.skipContext && progress.phase === 'context') {
    console.log('\n=== Phase 1: Context Prefix Generation (Claude Haiku) ===\n')
    await runContextGeneration(args, progress)
  } else if (args.skipContext && progress.phase === 'context') {
    console.log('Skipping context generation (--skip-context)')
    progress.phase = 'embedding'
  }

  // Phase 2: Embedding generation
  if (progress.phase === 'embedding') {
    console.log('\n=== Phase 2: Embedding Generation (OpenAI) ===\n')
    await runEmbeddingGeneration(args, progress)

    // Recreate HNSW index if it was dropped for bulk loading
    await recreateHnswIndexIfMissing()
  }

  console.log('\n=== Done ===')
  console.log(`Total cost: $${progress.totalCost.toFixed(2)}`)
  console.log(`Docs processed: ${progress.totalDocsProcessed}`)
  console.log(`Chunks embedded: ${progress.totalChunksEmbedded}`)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  prisma.$disconnect()
  process.exit(1)
})
