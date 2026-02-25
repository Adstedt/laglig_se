/* eslint-disable no-console */
/**
 * Batch embedding generation pipeline
 * Story 14.3, Task 4 (AC: 9-13)
 *
 * Two phases:
 * 1. Context prefix generation (Claude Haiku) — one call per document
 * 2. Embedding generation (OpenAI text-embedding-3-small) — batches of 100
 *
 * Usage:
 *   npx tsx scripts/generate-embeddings.ts                       # full run
 *   npx tsx scripts/generate-embeddings.ts --estimate            # cost estimate only
 *   npx tsx scripts/generate-embeddings.ts --limit 100           # first 100 docs
 *   npx tsx scripts/generate-embeddings.ts --resume              # resume from cursor
 *   npx tsx scripts/generate-embeddings.ts --skip-context        # skip LLM, embed only
 *   npx tsx scripts/generate-embeddings.ts --source-type SFS_LAW # filter by type
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import {
  generateContextPrefixes,
  type ChunkForContext,
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
const EMBEDDING_BATCH_SIZE = 100
const EMBEDDING_DELAY_MS = 200 // delay between OpenAI batches
const CONTEXT_DELAY_MS = 500 // delay between Haiku calls
const MAX_CONSECUTIVE_FAILURES = 5

// Cost rates
const HAIKU_INPUT_COST_PER_M = 0.8 // $/1M input tokens
const HAIKU_OUTPUT_COST_PER_M = 4.0 // $/1M output tokens
const EMBEDDING_COST_PER_M = 0.02 // $/1M tokens

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

interface CliArgs {
  estimate: boolean
  limit: number | null
  resume: boolean
  skipContext: boolean
  sourceType: string | null
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

  // Count total chunks needing embedding
  const sourceFilter = args.sourceType
    ? Prisma.sql`AND ld.content_type = ${args.sourceType}`
    : Prisma.sql``

  const cursorFilter = progress.lastProcessedChunkId
    ? Prisma.sql`AND cc.id > ${progress.lastProcessedChunkId}`
    : Prisma.sql``

  const totalResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM content_chunks cc
    JOIN legal_documents ld ON cc.source_id = ld.id
    WHERE cc.embedding IS NULL
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

      // Write embeddings via raw SQL (Prisma Unsupported type)
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j]!
        const embedding = result.embeddings[j]!
        await prisma.$executeRaw`
          UPDATE content_chunks
          SET embedding = ${vectorToString(embedding)}::vector
          WHERE id = ${chunk.id}
        `
      }

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
