#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Story 9.1 — Task 4: AFS Regulation Ingestion Pipeline
 *
 * Processes consolidated AFS PDFs through Claude PDF→HTML pipeline,
 * then stores results in legal_documents with proper tier classification.
 *
 * Usage:
 *   npx tsx scripts/ingest-afs-regulations.ts
 *   npx tsx scripts/ingest-afs-regulations.ts --dry-run
 *   npx tsx scripts/ingest-afs-regulations.ts --limit 3
 *   npx tsx scripts/ingest-afs-regulations.ts --force
 *   npx tsx scripts/ingest-afs-regulations.ts --tier STANDALONE
 *   npx tsx scripts/ingest-afs-regulations.ts --skip-existing
 *   npx tsx scripts/ingest-afs-regulations.ts --filter AFS2023:10
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'node:url'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import * as fs from 'fs'
import * as path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { PDFDocument } from 'pdf-lib'
import { PrismaClient, ContentType, DocumentStatus } from '@prisma/client'
import {
  AFS_REGISTRY,
  type AfsDocument,
  type AfsChapter,
  type AfsTier,
  getAfsByTier,
  formatChapterDocumentNumber,
  formatChapterTitle,
  generateAfsSlug,
  buildStandaloneMetadata,
  buildParentMetadata,
  buildChapterMetadata,
} from '../lib/agency/afs-registry'
import {
  AFS_FULL_DOCUMENT_SYSTEM_PROMPT,
  AFS_PER_CHAPTER_SYSTEM_PROMPT,
  AFS_MAX_TOKENS,
  AFS_DEFAULT_MODEL,
  getAfsFullDocumentUserPrompt,
  getAfsChapterExtractionUserPrompt,
  getAfsParentExtractionUserPrompt,
} from '../lib/agency/afs-prompt'
import { validateLlmOutput } from '../lib/sfs/llm-output-validator'
import {
  htmlToMarkdown,
  htmlToPlainText,
} from '../lib/transforms/html-to-markdown'
import { AFS_URL_REGISTRY } from './download-afs-consolidated'

const prisma = new PrismaClient()

// ============================================================================
// Configuration
// ============================================================================

const PDF_DIR = path.resolve(__dirname, '../data/afs-pdfs')
const MODEL = process.env.AFS_INGESTION_MODEL || AFS_DEFAULT_MODEL
const API_DELAY_MS = 2000 // Rate limiting: 2s between API calls
const MAX_RETRIES = 2

interface IngestionConfig {
  dryRun: boolean
  force: boolean
  limit: number
  tier: AfsTier | null
  skipExisting: boolean
  filter: string | null
}

export function parseArgs(
  argv: string[] = process.argv.slice(2)
): IngestionConfig {
  const config: IngestionConfig = {
    dryRun: false,
    force: false,
    limit: 0,
    tier: null,
    skipExisting: false,
    filter: null,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') config.dryRun = true
    else if (arg === '--force') config.force = true
    else if (arg === '--skip-existing') config.skipExisting = true
    else if (arg === '--limit' && argv[i + 1]) {
      config.limit = parseInt(argv[i + 1]!, 10)
      i++
    } else if (arg === '--tier' && argv[i + 1]) {
      config.tier = argv[i + 1]!.toUpperCase() as AfsTier
      i++
    } else if (arg === '--filter' && argv[i + 1]) {
      config.filter = argv[i + 1]!
      i++
    }
  }

  return config
}

// ============================================================================
// Cost Tracking
// ============================================================================

interface CostTracker {
  totalInputTokens: number
  totalOutputTokens: number
  apiCalls: number
  documentsProcessed: number
  chaptersProcessed: number
  errors: number
}

function createCostTracker(): CostTracker {
  return {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    apiCalls: 0,
    documentsProcessed: 0,
    chaptersProcessed: 0,
    errors: 0,
  }
}

function logCost(tracker: CostTracker): void {
  // Sonnet standard pricing: $3/M input, $15/M output
  const inputCost = (tracker.totalInputTokens / 1_000_000) * 3
  const outputCost = (tracker.totalOutputTokens / 1_000_000) * 15
  const totalCost = inputCost + outputCost

  console.log(`  API calls: ${tracker.apiCalls}`)
  console.log(`  Input tokens: ${tracker.totalInputTokens.toLocaleString()}`)
  console.log(`  Output tokens: ${tracker.totalOutputTokens.toLocaleString()}`)
  console.log(`  Estimated cost: $${totalCost.toFixed(2)}`)
  console.log(`  Documents processed: ${tracker.documentsProcessed}`)
  console.log(`  Chapters processed: ${tracker.chaptersProcessed}`)
  console.log(`  Errors: ${tracker.errors}`)
}

// ============================================================================
// PDF Loading
// ============================================================================

function getPdfFilePath(documentNumber: string): string {
  const fileName =
    documentNumber.replace(/\s+/g, '-').replace(/:/g, '-') + '.pdf'
  return path.join(PDF_DIR, fileName)
}

function loadPdfBuffer(documentNumber: string): Buffer | null {
  const filePath = getPdfFilePath(documentNumber)

  if (!fs.existsSync(filePath)) {
    console.error(`  [FAIL] PDF not found: ${filePath}`)
    return null
  }

  return fs.readFileSync(filePath)
}

function loadPdfBase64(documentNumber: string): string | null {
  const buffer = loadPdfBuffer(documentNumber)
  return buffer ? buffer.toString('base64') : null
}

// ============================================================================
// LLM API Call
// ============================================================================

async function callClaude(
  anthropic: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  pdfBase64: string,
  maxTokens: number,
  tracker: CostTracker,
  label: string
): Promise<string | null> {
  let autoReducedOnce = false
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const backoff = Math.pow(2, attempt) * 1000
        console.log(
          `  [RETRY] Attempt ${attempt + 1}/${MAX_RETRIES + 1} for ${label} (waiting ${backoff}ms)`
        )
        await new Promise((r) => setTimeout(r, backoff))
      }

      // Use streaming to avoid timeout on large PDFs
      const stream = anthropic.messages.stream({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
      })

      const response = await stream.finalMessage()

      tracker.apiCalls++

      // Track tokens
      if (response.usage) {
        tracker.totalInputTokens += response.usage.input_tokens
        tracker.totalOutputTokens += response.usage.output_tokens
        console.log(
          `  [TOKENS] ${label}: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`
        )
      }

      // Extract text response
      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        console.error(`  [FAIL] No text response for ${label}`)
        continue
      }

      return textBlock.text
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)

      // Auto-reduce max_tokens if context limit exceeded (try once)
      const contextMatch = msg.match(
        /input length and `max_tokens` exceed context limit: (\d+) \+ (\d+) > (\d+)/
      )
      if (contextMatch && !autoReducedOnce) {
        const inputLen = parseInt(contextMatch[1]!, 10)
        const contextLimit = parseInt(contextMatch[3]!, 10)
        const newMax = contextLimit - inputLen - 100 // small buffer
        if (newMax > 4096) {
          console.log(
            `  [AUTO] Reducing max_tokens to ${newMax} (input: ${inputLen}, limit: ${contextLimit})`
          )
          maxTokens = newMax
          autoReducedOnce = true
          attempt-- // don't count this as a retry
          continue
        }
      }

      console.error(`  [FAIL] API error for ${label}: ${msg}`)
      if (attempt === MAX_RETRIES) {
        tracker.errors++
        return null
      }
    }
  }

  return null
}

// ============================================================================
// PDF Chunking for Oversized Documents (>100 pages)
// ============================================================================

const MAX_PDF_PAGES = 100
// Token limit is 200K; large regulatory PDFs average ~2K tokens/page
// 50 pages ≈ 100K tokens input, leaving room for output + system prompt
const CHUNK_SIZE_PAGES = 50

/**
 * Get page count from a PDF buffer.
 */
async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  return pdfDoc.getPageCount()
}

/**
 * Split a PDF buffer into chunks of maxPages or fewer.
 * Returns base64-encoded chunks.
 */
async function splitPdfIntoChunks(
  pdfBuffer: Buffer,
  maxPages: number = MAX_PDF_PAGES
): Promise<string[]> {
  const srcDoc = await PDFDocument.load(pdfBuffer)
  const totalPages = srcDoc.getPageCount()
  const chunks: string[] = []

  for (let start = 0; start < totalPages; start += maxPages) {
    const end = Math.min(start + maxPages, totalPages)
    const chunkDoc = await PDFDocument.create()
    const pages = await chunkDoc.copyPages(
      srcDoc,
      Array.from({ length: end - start }, (_, i) => start + i)
    )
    for (const page of pages) {
      chunkDoc.addPage(page)
    }
    const chunkBytes = await chunkDoc.save()
    chunks.push(Buffer.from(chunkBytes).toString('base64'))
  }

  return chunks
}

/**
 * Process an oversized PDF by splitting into chunks, sending each to Claude,
 * and merging the resulting HTML sections.
 */
async function callClaudeChunked(
  anthropic: Anthropic,
  systemPrompt: string,
  doc: AfsDocument,
  pdfBuffer: Buffer,
  maxTokens: number,
  tracker: CostTracker,
  chunkSize: number = CHUNK_SIZE_PAGES
): Promise<string | null> {
  const totalPages = await getPdfPageCount(pdfBuffer)
  const chunks = await splitPdfIntoChunks(pdfBuffer, chunkSize)

  console.log(
    `  [CHUNKED] ${totalPages} pages → ${chunks.length} chunks of ≤${chunkSize} pages`
  )

  const htmlParts: string[] = []

  for (let i = 0; i < chunks.length; i++) {
    const chunkBase64 = chunks[i]!
    const isFirst = i === 0
    const isLast = i === chunks.length - 1
    const label = `${doc.documentNumber} chunk ${i + 1}/${chunks.length}`

    // Tailor the user prompt based on chunk position
    let userPrompt: string
    if (chunks.length === 1) {
      userPrompt = getAfsFullDocumentUserPrompt(doc.documentNumber, doc.title)
    } else if (isFirst) {
      userPrompt =
        `This is part 1 of ${chunks.length} of ${doc.documentNumber} (${doc.title}). ` +
        `Convert this portion to semantic HTML. Include the document header and ` +
        `all sections found in these pages. Do NOT close the <article> tag — more content follows.`
    } else if (isLast) {
      userPrompt =
        `This is the final part (${i + 1} of ${chunks.length}) of ${doc.documentNumber} (${doc.title}). ` +
        `Continue the HTML conversion from where the previous part ended. ` +
        `Include all remaining sections and the closing footer/article tags.`
    } else {
      userPrompt =
        `This is part ${i + 1} of ${chunks.length} of ${doc.documentNumber} (${doc.title}). ` +
        `Continue the HTML conversion. Include all sections in these pages. ` +
        `Do NOT include opening <article> or closing </article> tags.`
    }

    // Cap max_tokens per chunk — each chunk only outputs a portion of the document
    const chunkMaxTokens = Math.min(maxTokens, 16384)

    const html = await callClaude(
      anthropic,
      systemPrompt,
      userPrompt,
      chunkBase64,
      chunkMaxTokens,
      tracker,
      label
    )

    if (!html) {
      console.error(
        `  [FAIL] Chunk ${i + 1}/${chunks.length} failed for ${doc.documentNumber}`
      )
      return null
    }

    htmlParts.push(html)

    // Rate limit between chunks
    if (!isLast) {
      await new Promise((r) => setTimeout(r, API_DELAY_MS))
    }
  }

  // Merge: for multi-chunk, strip article wrappers from inner parts and merge
  if (htmlParts.length === 1) {
    return htmlParts[0]!
  }

  // Merge strategy: take first chunk's opening, middle chunks as body, last chunk's closing
  const merged = htmlParts
    .map((part, i) => {
      if (i === 0) {
        // Remove closing </article> if present
        return part.replace(/<\/article>\s*$/, '')
      } else if (i === htmlParts.length - 1) {
        // Remove opening <article...> if present
        return part.replace(/^<article[^>]*>\s*/, '')
      } else {
        // Remove both opening and closing article tags
        return part
          .replace(/^<article[^>]*>\s*/, '')
          .replace(/<\/article>\s*$/, '')
      }
    })
    .join('\n')

  return merged
}

// ============================================================================
// HTML Processing
// ============================================================================

/**
 * Split single-pass HTML output by data-chapter markers.
 * Returns a map of chapterNumber → chapterHtml
 */
export function splitByChapterMarkers(html: string): Map<number, string> {
  const chapters = new Map<number, string>()

  // Match <section data-chapter="N" ...> ... </section>
  // Use a simple approach: find all data-chapter sections
  const regex =
    /<section\s+data-chapter="(\d+)"[^>]*>([\s\S]*?)(?=<section\s+data-chapter="|\s*<\/div>\s*<footer|\s*<footer|\s*<\/article>|$)/gi
  let match

  while ((match = regex.exec(html)) !== null) {
    const chapterNum = parseInt(match[1]!, 10)
    const chapterContent = match[2]!.trim()

    // Remove trailing </section> if present
    const cleaned = chapterContent.replace(/<\/section>\s*$/, '').trim()

    // Wrap in a proper section
    chapters.set(
      chapterNum,
      `<section data-chapter="${chapterNum}" class="kapitel">${cleaned}</section>`
    )
  }

  return chapters
}

/**
 * Build the kap. 1 preamble wrapper for chapter entries.
 */
function buildPreambleHtml(kap1Html: string): string {
  return `<section class="general-provisions-preamble">
<h3 class="preamble-heading">1 kap. Allmänna bestämmelser</h3>
${kap1Html}
</section>`
}

/**
 * Build a standalone chapter article from chapter content + optional preamble.
 */
function buildChapterArticle(
  documentNumber: string,
  chapterNumber: number,
  chapterTitle: string,
  chapterHtml: string,
  preambleHtml: string | null
): string {
  const id = documentNumber.replace(/\s+/g, '').replace(/:/g, '-')
  const preamble = preambleHtml ? `\n${preambleHtml}\n` : ''

  return `<article class="sfs" id="${id}_K${chapterNumber}">
  <div class="lovhead">
    <h1>
      <p class="text">${documentNumber} kap. ${chapterNumber}</p>
      <p class="text">${chapterTitle}</p>
    </h1>
  </div>
  <div class="body">${preamble}
${chapterHtml}
  </div>
</article>`
}

// ============================================================================
// Database Upsert
// ============================================================================

interface UpsertData {
  documentNumber: string
  title: string
  slug: string
  htmlContent: string
  markdownContent: string
  fullText: string
  sourceUrl: string
  metadata: Record<string, unknown>
}

async function upsertLegalDocument(
  data: UpsertData,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    console.log(`  [DRY RUN] Would upsert: ${data.documentNumber}`)
    return
  }

  await prisma.legalDocument.upsert({
    where: { document_number: data.documentNumber },
    update: {
      title: data.title,
      slug: data.slug,
      html_content: data.htmlContent,
      markdown_content: data.markdownContent,
      full_text: data.fullText,
      source_url: data.sourceUrl,
      status: DocumentStatus.ACTIVE,
      metadata: data.metadata,
      updated_at: new Date(),
    },
    create: {
      document_number: data.documentNumber,
      title: data.title,
      slug: data.slug,
      content_type: ContentType.AGENCY_REGULATION,
      html_content: data.htmlContent,
      markdown_content: data.markdownContent,
      full_text: data.fullText,
      source_url: data.sourceUrl,
      status: DocumentStatus.ACTIVE,
      metadata: data.metadata,
    },
  })
}

// ============================================================================
// Tier 1 & 2: Standalone / Keep-Whole Processing
// ============================================================================

async function processStandaloneDocument(
  anthropic: Anthropic,
  doc: AfsDocument,
  config: IngestionConfig,
  tracker: CostTracker
): Promise<boolean> {
  console.log(
    `\n--- Processing ${doc.documentNumber}: ${doc.title} (${doc.tier}) ---`
  )

  // Check skip-existing
  if (config.skipExisting && !config.force) {
    const existing = await prisma.legalDocument.findUnique({
      where: { document_number: doc.documentNumber },
      select: { html_content: true },
    })
    if (existing?.html_content) {
      console.log(`  [SKIP] Already has content`)
      return true
    }
  }

  // Load PDF
  const pdfBuffer = loadPdfBuffer(doc.documentNumber)
  if (!pdfBuffer) return false

  // Check page count — use chunked approach for oversized PDFs
  const pageCount = await getPdfPageCount(pdfBuffer)
  let rawHtml: string | null

  if (pageCount > MAX_PDF_PAGES) {
    console.log(
      `  [INFO] PDF has ${pageCount} pages (>${MAX_PDF_PAGES}) — using chunked processing`
    )
    rawHtml = await callClaudeChunked(
      anthropic,
      AFS_FULL_DOCUMENT_SYSTEM_PROMPT,
      doc,
      pdfBuffer,
      AFS_MAX_TOKENS.fullDocument,
      tracker,
      CHUNK_SIZE_PAGES
    )
  } else {
    const pdfBase64 = pdfBuffer.toString('base64')
    const userPrompt = getAfsFullDocumentUserPrompt(
      doc.documentNumber,
      doc.title
    )
    rawHtml = await callClaude(
      anthropic,
      AFS_FULL_DOCUMENT_SYSTEM_PROMPT,
      userPrompt,
      pdfBase64,
      AFS_MAX_TOKENS.fullDocument,
      tracker,
      doc.documentNumber
    )
  }

  if (!rawHtml) return false

  // Validate
  const validation = validateLlmOutput(rawHtml, doc.documentNumber)
  if (!validation.valid || !validation.cleanedHtml) {
    console.error(`  [FAIL] Validation failed for ${doc.documentNumber}:`)
    for (const err of validation.errors) {
      console.error(`    ${err.code}: ${err.message}`)
    }
    tracker.errors++
    return false
  }

  for (const warn of validation.warnings) {
    console.log(`  [WARN] ${warn.code}: ${warn.message}`)
  }

  // Derive content
  const htmlContent = validation.cleanedHtml
  const markdownContent = htmlToMarkdown(htmlContent)
  const fullText = htmlToPlainText(htmlContent)

  // Get URLs
  const urls = AFS_URL_REGISTRY[doc.documentNumber]
  const sourceUrl = urls?.pageUrl ?? ''
  const historikUrl = urls?.historikUrl ?? ''

  // Build metadata
  const metadata = buildStandaloneMetadata(doc, historikUrl)

  // Upsert
  await upsertLegalDocument(
    {
      documentNumber: doc.documentNumber,
      title: doc.title,
      slug: generateAfsSlug(doc.documentNumber),
      htmlContent,
      markdownContent,
      fullText,
      sourceUrl,
      metadata: metadata as unknown as Record<string, unknown>,
    },
    config.dryRun
  )

  tracker.documentsProcessed++
  console.log(
    `  [OK] ${doc.documentNumber} — ${validation.metrics.charCount} chars, ${validation.metrics.sectionCount} sections`
  )

  return true
}

// ============================================================================
// Tier 3: Split Omnibus — Per-Chapter Strategy
// ============================================================================

async function processSplitPerChapter(
  anthropic: Anthropic,
  doc: AfsDocument,
  config: IngestionConfig,
  tracker: CostTracker
): Promise<boolean> {
  console.log(
    `\n--- Processing ${doc.documentNumber}: ${doc.title} (SPLIT, per-chapter) ---`
  )

  const pdfBase64 = loadPdfBase64(doc.documentNumber)
  if (!pdfBase64) return false

  const urls = AFS_URL_REGISTRY[doc.documentNumber]
  const sourceUrl = urls?.pageUrl ?? ''
  const historikUrl = urls?.historikUrl ?? ''

  // Step 1: Extract parent (TOC + kap. 1)
  const parentPrompt = getAfsParentExtractionUserPrompt(
    doc.documentNumber,
    doc.title,
    doc.chapters
  )

  const parentRawHtml = await callClaude(
    anthropic,
    AFS_FULL_DOCUMENT_SYSTEM_PROMPT,
    parentPrompt,
    pdfBase64,
    AFS_MAX_TOKENS.parentExtraction,
    tracker,
    `${doc.documentNumber} (parent)`
  )

  if (!parentRawHtml) return false

  await delay(API_DELAY_MS)

  // Extract kap. 1 content from parent for preamble
  // The parent HTML should contain kap. 1 — use it as preamble
  const preambleHtml = buildPreambleHtml(parentRawHtml)

  // Step 2: Extract each chapter
  const chapterResults: Array<{ chapter: AfsChapter; html: string }> = []

  for (const chapter of doc.chapters) {
    if (config.skipExisting && !config.force) {
      const chapterDocNum = formatChapterDocumentNumber(
        doc.documentNumber,
        chapter.number
      )
      const existing = await prisma.legalDocument.findUnique({
        where: { document_number: chapterDocNum },
        select: { html_content: true },
      })
      if (existing?.html_content) {
        console.log(`  [SKIP] ${chapterDocNum} already has content`)
        continue
      }
    }

    const chapterPrompt = getAfsChapterExtractionUserPrompt(
      doc.documentNumber,
      chapter.number,
      chapter.title
    )

    const chapterRawHtml = await callClaude(
      anthropic,
      AFS_PER_CHAPTER_SYSTEM_PROMPT,
      chapterPrompt,
      pdfBase64,
      AFS_MAX_TOKENS.perChapter,
      tracker,
      `${doc.documentNumber} kap. ${chapter.number}`
    )

    if (chapterRawHtml) {
      chapterResults.push({ chapter, html: chapterRawHtml })
    } else {
      console.error(`  [FAIL] Could not extract kap. ${chapter.number}`)
      tracker.errors++
    }

    await delay(API_DELAY_MS)
  }

  // Step 3: Build parent TOC HTML
  const tocItems = doc.chapters
    .map(
      (ch) =>
        `<li>${formatChapterDocumentNumber(doc.documentNumber, ch.number)}: ${ch.title}</li>`
    )
    .join('\n')
  const parentHtml = `<article class="sfs" id="${doc.documentNumber.replace(/\s+/g, '').replace(/:/g, '-')}">
  <div class="lovhead">
    <h1>
      <p class="text">${doc.documentNumber}</p>
      <p class="text">${doc.title}</p>
    </h1>
  </div>
  <div class="body">
    <h2>Innehållsförteckning</h2>
    <ol class="list">${tocItems}</ol>
    ${parentRawHtml}
  </div>
</article>`

  if (config.dryRun) {
    console.log(
      `  [DRY RUN] Would upsert parent + ${chapterResults.length} chapters`
    )
    tracker.documentsProcessed++
    tracker.chaptersProcessed += chapterResults.length
    return true
  }

  // Transaction: parent + all chapters
  const parentMetadata = buildParentMetadata(doc, historikUrl)

  await prisma.$transaction(async (tx) => {
    // Upsert parent
    await tx.legalDocument.upsert({
      where: { document_number: doc.documentNumber },
      update: {
        title: doc.title,
        slug: generateAfsSlug(doc.documentNumber),
        html_content: parentHtml,
        markdown_content: htmlToMarkdown(parentHtml),
        full_text: htmlToPlainText(parentHtml),
        source_url: sourceUrl,
        status: DocumentStatus.ACTIVE,
        metadata: parentMetadata as unknown as Record<string, unknown>,
        updated_at: new Date(),
      },
      create: {
        document_number: doc.documentNumber,
        title: doc.title,
        slug: generateAfsSlug(doc.documentNumber),
        content_type: ContentType.AGENCY_REGULATION,
        html_content: parentHtml,
        markdown_content: htmlToMarkdown(parentHtml),
        full_text: htmlToPlainText(parentHtml),
        source_url: sourceUrl,
        status: DocumentStatus.ACTIVE,
        metadata: parentMetadata as unknown as Record<string, unknown>,
      },
    })

    // Upsert each chapter
    for (const { chapter, html: rawChapterHtml } of chapterResults) {
      const chapterArticle = buildChapterArticle(
        doc.documentNumber,
        chapter.number,
        chapter.title,
        rawChapterHtml,
        preambleHtml
      )

      const chapterDocNum = formatChapterDocumentNumber(
        doc.documentNumber,
        chapter.number
      )
      const chapterMeta = buildChapterMetadata(doc, chapter)

      await tx.legalDocument.upsert({
        where: { document_number: chapterDocNum },
        update: {
          title: formatChapterTitle(doc.title, chapter.number, chapter.title),
          slug: generateAfsSlug(chapterDocNum),
          html_content: chapterArticle,
          markdown_content: htmlToMarkdown(chapterArticle),
          full_text: htmlToPlainText(chapterArticle),
          source_url: sourceUrl,
          status: DocumentStatus.ACTIVE,
          metadata: chapterMeta as unknown as Record<string, unknown>,
          updated_at: new Date(),
        },
        create: {
          document_number: chapterDocNum,
          title: formatChapterTitle(doc.title, chapter.number, chapter.title),
          slug: generateAfsSlug(chapterDocNum),
          content_type: ContentType.AGENCY_REGULATION,
          html_content: chapterArticle,
          markdown_content: htmlToMarkdown(chapterArticle),
          full_text: htmlToPlainText(chapterArticle),
          source_url: sourceUrl,
          status: DocumentStatus.ACTIVE,
          metadata: chapterMeta as unknown as Record<string, unknown>,
        },
      })

      tracker.chaptersProcessed++
    }
  })

  tracker.documentsProcessed++
  console.log(
    `  [OK] ${doc.documentNumber} — parent + ${chapterResults.length} chapters`
  )

  return true
}

// ============================================================================
// Main Orchestrator
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function main(): Promise<void> {
  const config = parseArgs()
  const startTime = Date.now()

  console.log('='.repeat(60))
  console.log('AFS Regulation Ingestion Pipeline (Story 9.1)')
  console.log('='.repeat(60))
  console.log(`Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Model: ${MODEL}`)
  console.log(`Force: ${config.force}`)
  console.log(`Skip existing: ${config.skipExisting}`)
  if (config.tier) console.log(`Tier filter: ${config.tier}`)
  if (config.filter) console.log(`Document filter: ${config.filter}`)
  if (config.limit > 0) console.log(`Limit: ${config.limit}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log()

  // Verify PDF directory
  if (!fs.existsSync(PDF_DIR)) {
    console.error(`PDF directory not found: ${PDF_DIR}`)
    console.error('Run: npx tsx scripts/download-afs-consolidated.ts')
    process.exit(1)
  }

  // Initialize Anthropic client
  const anthropic = new Anthropic()

  // Filter documents
  let documents = [...AFS_REGISTRY]
  if (config.tier) {
    documents = getAfsByTier(config.tier)
  }
  if (config.filter) {
    const filterNormalized = config.filter.replace(/\s+/g, '').toUpperCase()
    documents = documents.filter((d) =>
      d.documentNumber
        .replace(/\s+/g, '')
        .toUpperCase()
        .includes(filterNormalized)
    )
  }
  if (config.limit > 0) {
    documents = documents.slice(0, config.limit)
  }

  console.log(`Processing ${documents.length} documents`)
  console.log()

  const tracker = createCostTracker()

  for (const doc of documents) {
    let success = false

    if (doc.tier === 'STANDALONE' || doc.tier === 'KEEP_WHOLE') {
      success = await processStandaloneDocument(anthropic, doc, config, tracker)
    } else if (doc.tier === 'SPLIT') {
      // Old pipeline: default to per-chapter extraction (extractionStrategy field removed)
      success = await processSplitPerChapter(anthropic, doc, config, tracker)
    }

    if (!success) {
      console.error(`  [FAIL] ${doc.documentNumber} failed`)
    }

    // Rate limit between documents
    if (!config.dryRun) {
      await delay(API_DELAY_MS)
    }
  }

  // Summary
  console.log()
  console.log('='.repeat(60))
  console.log('Summary')
  console.log('='.repeat(60))
  logCost(tracker)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`  Duration: ${elapsed}s`)
  console.log('='.repeat(60))

  if (tracker.errors > 0) {
    process.exit(1)
  }
}

const isDirectExecution =
  typeof process !== 'undefined' &&
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isDirectExecution) {
  main()
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
    .finally(() => {
      void prisma.$disconnect()
    })
}
