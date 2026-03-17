/**
 * Retry prefix generation for the 15 docs that exceeded 200K tokens.
 * Uses the updated splitting logic that respects token limits.
 * Makes direct sequential API calls (not batch — simpler for a small retry).
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from './lib/prisma'
import {
  buildBatchPrefixRequests,
  parsePrefixResponse,
  HAIKU_MODEL,
  type ChunkForContext,
  type BatchPrefixRequest,
} from './lib/chunks/generate-context-prefixes'
import { estimateTokenCount } from './lib/chunks/token-count'
import * as fs from 'fs'
import * as path from 'path'

const FAILED_DOC_IDS = [
  '1c4dc071-8bef-4d10-aa77-9932f1b68267', // Sjölag
  '368c0ee3-e415-4c07-bb6b-d2cd785754e3', // Rättegångsbalk
  '3a1a8e98-2628-4282-8950-a330a3913cdb', // Aktiebolagslag
  '620d076d-8095-4963-92d2-43ff542513cb', // Mervärdesskattelag
  '6591897f-a601-4002-9d5d-5168bc913065', // AFS Produkter stegar
  '68dc0745-89f9-47b8-be16-729b1da2db4d', // Värdepappersmarknaden
  '6b6fdf25-23ab-4a7e-bf78-ffb4f43815e9', // Jordabalk
  '7b2b0f1b-26ee-495a-abd5-16ec8de3ef10', // Försäkringsrörelselag 2010
  '88a6323e-a35b-40a3-a5b0-a3efee3a502a', // AFS Tryckbärande
  '97a3767b-3fe1-43bf-9490-5f4ba00bdd72', // Offentlighets- och sekretesslag
  'b3301284-c87e-4c1f-bf69-3c642fc8249b', // Skatteförfarandelag
  'b4711c5b-ffe4-4e68-a449-3ef2bca896de', // Utlänningslag
  'be42246f-cad4-41e0-82eb-5414ed11956c', // Miljöbalk
  'c21d856f-eeb2-416d-841e-2cca032c85d1', // Skollag
  'd457388e-a333-4467-aecf-3bb095dae12a', // Försäkringsrörelselag 1982
]

const PROGRESS_FILE = path.join(__dirname, 'data', 'retry-progress.json')
const DB_BATCH_SIZE = 200

interface RetryProgress {
  completedDocIds: string[]
  totalPrefixesWritten: number
  totalRequestsMade: number
  totalErrors: number
  startedAt: string
  lastUpdatedAt: string
}

function loadProgress(): RetryProgress {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
  } catch {
    return {
      completedDocIds: [],
      totalPrefixesWritten: 0,
      totalRequestsMade: 0,
      totalErrors: 0,
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    }
  }
}

function saveProgress(progress: RetryProgress) {
  progress.lastUpdatedAt = new Date().toISOString()
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

async function bulkWritePrefixes(
  prefixPairs: Array<{ sourceId: string; path: string; prefix: string }>
) {
  if (prefixPairs.length === 0) return 0

  let written = 0
  for (let i = 0; i < prefixPairs.length; i += DB_BATCH_SIZE) {
    const batch = prefixPairs.slice(i, i + DB_BATCH_SIZE)
    const values = batch
      .map((p) => {
        const safeSourceId = p.sourceId.replace(/'/g, "''")
        const safePath = p.path.replace(/'/g, "''")
        const safePrefix = p.prefix.replace(/'/g, "''")
        return `('${safeSourceId}', '${safePath}', '${safePrefix}')`
      })
      .join(',\n')

    const sql = `
      UPDATE content_chunks cc
      SET context_prefix = v.prefix, updated_at = NOW()
      FROM (VALUES ${values}) AS v(source_id, path, prefix)
      WHERE cc.source_id = v.source_id
        AND cc.path = v.path
        AND cc.context_prefix IS NULL
    `

    const result = await prisma.$executeRawUnsafe(sql)
    written += result
  }
  return written
}

async function main() {
  console.log(`\n=== Retrying ${FAILED_DOC_IDS.length} failed docs ===\n`)

  const anthropic = new Anthropic()
  const progress = loadProgress()

  // Skip already-completed docs
  const remainingDocIds = FAILED_DOC_IDS.filter(
    (id) => !progress.completedDocIds.includes(id)
  )

  if (remainingDocIds.length === 0) {
    console.log('All docs already completed! Nothing to do.')
    await prisma.$disconnect()
    return
  }

  console.log(
    `${progress.completedDocIds.length} already done, ${remainingDocIds.length} remaining\n`
  )

  for (const docId of remainingDocIds) {
    const doc = await prisma.legalDocument.findUnique({
      where: { id: docId },
      select: { title: true, document_number: true, markdown_content: true },
    })
    if (!doc || !doc.markdown_content) {
      console.log(`  SKIP: ${docId} — not found`)
      progress.completedDocIds.push(docId)
      saveProgress(progress)
      continue
    }

    const chunks = await prisma.contentChunk.findMany({
      where: { source_id: docId, context_prefix: null },
      select: { path: true, content: true },
      orderBy: { id: 'asc' },
    })

    if (chunks.length === 0) {
      console.log(`  SKIP: ${doc.document_number} — all chunks have prefixes`)
      progress.completedDocIds.push(docId)
      saveProgress(progress)
      continue
    }

    console.log(`\n  ${doc.document_number}: "${doc.title}"`)
    console.log(`    ${chunks.length} chunks without prefix`)

    // Build requests using updated splitting logic
    const requests = buildBatchPrefixRequests(
      docId,
      {
        markdown: doc.markdown_content,
        title: doc.title || '',
        documentNumber: doc.document_number || '',
      },
      chunks
    )

    console.log(`    Split into ${requests.length} requests`)

    // Process each request sequentially
    const allPrefixes: Array<{
      sourceId: string
      path: string
      prefix: string
    }> = []
    let requestErrors = 0

    for (let i = 0; i < requests.length; i++) {
      const req = requests[i]!
      const promptTokens = estimateTokenCount(req.prompt)
      process.stdout.write(
        `    [${i + 1}/${requests.length}] ${req.customId} (${promptTokens} tokens, ${req.chunkPaths.length} chunks)...`
      )

      try {
        const response = await anthropic.messages.create({
          model: HAIKU_MODEL,
          max_tokens: 8192,
          messages: [{ role: 'user', content: req.prompt }],
        })

        const textBlock = response.content.find((b) => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') {
          console.log(' ERROR: no text response')
          requestErrors++
          continue
        }

        // Build fake chunks for parsing
        const fakeChunks: ChunkForContext[] = req.chunkPaths.map((p) => ({
          path: p,
          content: '',
        }))
        const prefixes = parsePrefixResponse(textBlock.text, fakeChunks)

        for (const [chunkPath, prefix] of prefixes) {
          allPrefixes.push({ sourceId: docId, path: chunkPath, prefix })
        }

        console.log(` OK (${prefixes.size}/${req.chunkPaths.length} parsed)`)
        progress.totalRequestsMade++

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 300))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.log(` ERROR: ${msg}`)
        requestErrors++
        progress.totalErrors++

        // If credit/auth error, bail early
        if (msg.includes('credit') || msg.includes('balance')) {
          console.log('\n    FATAL: Credit balance issue — stopping.')
          saveProgress(progress)
          await prisma.$disconnect()
          return
        }

        // Wait longer on rate limit
        if (msg.includes('rate') || msg.includes('429')) {
          console.log('    Waiting 30s for rate limit...')
          await new Promise((r) => setTimeout(r, 30000))
        }
      }
    }

    // Bulk write all prefixes for this doc
    if (allPrefixes.length > 0) {
      const written = await bulkWritePrefixes(allPrefixes)
      console.log(
        `    DB: wrote ${written} prefixes (${allPrefixes.length} parsed, ${requestErrors} errors)`
      )
      progress.totalPrefixesWritten += written
    }

    progress.completedDocIds.push(docId)
    saveProgress(progress)
  }

  console.log(`\n=== Done ===`)
  console.log(`Requests made: ${progress.totalRequestsMade}`)
  console.log(`Prefixes written: ${progress.totalPrefixesWritten}`)
  console.log(`Errors: ${progress.totalErrors}`)

  await prisma.$disconnect()
}

main()
