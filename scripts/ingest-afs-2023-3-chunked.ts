#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Two-pass ingestion for AFS 2023:3 (KEEP_WHOLE, 82 pages, 11 chapters)
 *
 * Pass 1: Send full PDF, ask Claude for page→chapter mapping (JSON)
 * Pass 2: Split PDF by chapter page ranges, extract each chapter individually
 * Assemble: Merge all chapter HTML into one document, store as single entry
 *
 * Usage:
 *   npx tsx scripts/ingest-afs-2023-3-chunked.ts
 *   npx tsx scripts/ingest-afs-2023-3-chunked.ts --dry-run
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import * as fs from 'fs'
import * as path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { PDFDocument } from 'pdf-lib'
import { PrismaClient, ContentType, DocumentStatus } from '@prisma/client'
import { validateLlmOutput } from '../lib/sfs/llm-output-validator'
import {
  htmlToMarkdown,
  htmlToPlainText,
} from '../lib/transforms/html-to-markdown'
import {
  AFS_FULL_DOCUMENT_SYSTEM_PROMPT,
  AFS_DEFAULT_MODEL,
} from '../lib/agency/afs-prompt'
import {
  generateAfsSlug,
  buildStandaloneMetadata,
} from '../lib/agency/afs-registry'
import { AFS_URL_REGISTRY } from './download-afs-consolidated'

const prisma = new PrismaClient()
const MODEL = process.env.AFS_INGESTION_MODEL || AFS_DEFAULT_MODEL
const API_DELAY_MS = 2000
const DOC_NUMBER = 'AFS 2023:3'
const DOC_TITLE = 'Projektering och byggarbetsmiljösamordning'
const PDF_PATH = path.resolve(__dirname, '../data/afs-pdfs/AFS-2023-3.pdf')

const dryRun = process.argv.includes('--dry-run')

// ============================================================================
// Cost tracking
// ============================================================================

let totalInput = 0
let totalOutput = 0
let apiCalls = 0

function logTokens(
  label: string,
  usage: { input_tokens: number; output_tokens: number }
) {
  totalInput += usage.input_tokens
  totalOutput += usage.output_tokens
  apiCalls++
  console.log(
    `  [TOKENS] ${label}: ${usage.input_tokens} in / ${usage.output_tokens} out`
  )
}

function logCostSummary() {
  const inputCost = (totalInput / 1_000_000) * 3
  const outputCost = (totalOutput / 1_000_000) * 15
  console.log(`\n--- Cost Summary ---`)
  console.log(`  API calls: ${apiCalls}`)
  console.log(`  Input tokens: ${totalInput.toLocaleString()}`)
  console.log(`  Output tokens: ${totalOutput.toLocaleString()}`)
  console.log(`  Estimated cost: $${(inputCost + outputCost).toFixed(2)}`)
}

// ============================================================================
// PDF helpers
// ============================================================================

async function extractPageRange(
  srcDoc: PDFDocument,
  startPage: number,
  endPage: number
): Promise<string> {
  const chunkDoc = await PDFDocument.create()
  const indices = Array.from(
    { length: endPage - startPage },
    (_, i) => startPage + i
  )
  const pages = await chunkDoc.copyPages(srcDoc, indices)
  for (const page of pages) {
    chunkDoc.addPage(page)
  }
  const bytes = await chunkDoc.save()
  return Buffer.from(bytes).toString('base64')
}

// ============================================================================
// Pass 1: Get page→chapter mapping
// ============================================================================

interface ChapterMapping {
  chapter: number
  title: string
  startPage: number
  endPage: number
}

async function getChapterPageMapping(
  anthropic: Anthropic,
  pdfBase64: string
): Promise<ChapterMapping[]> {
  console.log('\n=== Pass 1: Page→Chapter Mapping ===')

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    system: `You are analyzing a Swedish regulatory document (AFS) to identify chapter boundaries.
Return ONLY a JSON array. No explanation, no markdown fences.

Each entry should be:
{"chapter": N, "title": "chapter title in Swedish", "startPage": N, "endPage": N}

startPage is 1-indexed (first page of PDF = 1).
endPage is INCLUSIVE (last page containing content for that chapter).
Chapters must not overlap and should cover the entire document.
Include appendices (bilagor) as part of the last chapter they belong to, or as a separate entry if they are standalone.
Include transition provisions (övergångsbestämmelser) as part of the last chapter.`,
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
            text: `Analyze this AFS document (AFS 2023:3 — Projektering och byggarbetsmiljösamordning).

It has 11 chapters (kap. 1–11) grouped into Avdelningar (divisions).
Identify the exact page ranges for each chapter.

Return ONLY the JSON array. No other text.`,
          },
        ],
      },
    ],
  })

  const response = await stream.finalMessage()
  logTokens('page-mapping', response.usage)

  const text = response.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text')
    throw new Error('No text in mapping response')

  // Parse JSON — strip any markdown fences if present
  const cleaned = text.text
    .replace(/```json?\n?/g, '')
    .replace(/```/g, '')
    .trim()
  const mapping: ChapterMapping[] = JSON.parse(cleaned)

  console.log(`  Found ${mapping.length} chapters:`)
  for (const ch of mapping) {
    console.log(
      `    kap. ${ch.chapter}: "${ch.title}" — pages ${ch.startPage}–${ch.endPage}`
    )
  }

  return mapping
}

// ============================================================================
// Pass 2: Extract each chapter from its page range
// ============================================================================

async function extractChapter(
  anthropic: Anthropic,
  srcDoc: PDFDocument,
  chapter: ChapterMapping
): Promise<string | null> {
  // Convert 1-indexed to 0-indexed for pdf-lib
  const startIdx = chapter.startPage - 1
  const endIdx = chapter.endPage // endPage is inclusive, so this works as the exclusive end
  const pageCount = endIdx - startIdx

  console.log(
    `\n  Extracting kap. ${chapter.chapter}: "${chapter.title}" (${pageCount} pages)`
  )

  const chunkBase64 = await extractPageRange(srcDoc, startIdx, endIdx)

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 16384,
    system: AFS_FULL_DOCUMENT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: chunkBase64,
            },
          },
          {
            type: 'text',
            text: `Convert this section of AFS 2023:3 to semantic HTML.

This contains ${chapter.chapter} kap. "${chapter.title}" of the document "Projektering och byggarbetsmiljösamordning — grundläggande skyldigheter".

Output ONLY the <section class="kapitel"> element for this chapter. Do NOT output <article> wrappers or document headers — just the chapter section.

Include ALL paragraphs (§), ALL Allmänna råd, and any tables/lists within this chapter.
${chapter.chapter === 1 ? '\nThis is chapter 1 (Allmänna bestämmelser). Also include any Avdelning headers that appear before chapter content.' : ''}
${chapter.chapter >= 10 ? '\nAlso include any Ikraftträdande- och övergångsbestämmelser (transition provisions) and Bilagor (appendices) that appear in these pages.' : ''}

Output only HTML. No markdown fences, no explanations.`,
          },
        ],
      },
    ],
  })

  const response = await stream.finalMessage()
  logTokens(`kap. ${chapter.chapter}`, response.usage)

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    console.error(`  [FAIL] No text for kap. ${chapter.chapter}`)
    return null
  }

  const html = textBlock.text
  console.log(`  [OK] kap. ${chapter.chapter}: ${html.length} chars`)
  return html
}

// ============================================================================
// Assembly
// ============================================================================

function assembleDocument(chapterHtmls: Map<number, string>): string {
  const sortedChapters = [...chapterHtmls.entries()].sort(([a], [b]) => a - b)
  const body = sortedChapters.map(([, html]) => html).join('\n\n')

  return `<article class="sfs" id="AFS2023-3">
  <div class="lovhead">
    <h1 id="AFS2023-3_GENH0000">
      <p class="text">AFS 2023:3</p>
      <p class="text">Arbetsmiljöverkets föreskrifter och allmänna råd om projektering och byggarbetsmiljösamordning — grundläggande skyldigheter</p>
    </h1>
  </div>
  <div class="body" id="AFS2023-3_BODY0001">
${body}
  </div>
</article>`
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('='.repeat(60))
  console.log('AFS 2023:3 — Two-Pass Chunked Ingestion')
  console.log('='.repeat(60))
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Model: ${MODEL}`)
  console.log()

  if (!fs.existsSync(PDF_PATH)) {
    console.error(`PDF not found: ${PDF_PATH}`)
    process.exit(1)
  }

  const pdfBuffer = fs.readFileSync(PDF_PATH)
  const pdfBase64 = pdfBuffer.toString('base64')
  const srcDoc = await PDFDocument.load(pdfBuffer)
  const totalPages = srcDoc.getPageCount()
  console.log(
    `PDF: ${totalPages} pages, ${(pdfBuffer.length / 1024).toFixed(0)} KB`
  )

  const anthropic = new Anthropic()

  // Pass 1: Get chapter→page mapping
  const mapping = await getChapterPageMapping(anthropic, pdfBase64)

  if (mapping.length === 0) {
    console.error('No chapters found in mapping!')
    process.exit(1)
  }

  await new Promise((r) => setTimeout(r, API_DELAY_MS))

  // Pass 2: Extract each chapter using only its pages
  const chapterHtmls = new Map<number, string>()
  let errors = 0

  for (const chapter of mapping) {
    const html = await extractChapter(anthropic, srcDoc, chapter)
    if (html) {
      chapterHtmls.set(chapter.chapter, html)
    } else {
      errors++
    }
    await new Promise((r) => setTimeout(r, API_DELAY_MS))
  }

  console.log(`\n=== Assembly ===`)
  console.log(`  Chapters extracted: ${chapterHtmls.size}/${mapping.length}`)

  if (errors > 0) {
    console.error(`  ${errors} chapters failed!`)
  }

  // Assemble full document
  const fullHtml = assembleDocument(chapterHtmls)
  console.log(`  Assembled HTML: ${fullHtml.length} chars`)

  // Write review file
  const reviewPath = path.resolve(__dirname, '../data/afs-2023-3-review.html')
  const reviewHtml = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <title>${DOC_TITLE} — ${DOC_NUMBER}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }
    h1 { font-size: 1.5rem; border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    h2 { font-size: 1.3rem; margin-top: 2rem; color: #222; }
    h3 { font-size: 1.1rem; margin-top: 1.5rem; color: #333; }
    section { margin: 1rem 0; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ccc; padding: 0.4rem 0.8rem; text-align: left; }
    th { background: #f5f5f5; }
    .kapitel { border-left: 3px solid #0066cc; padding-left: 1rem; margin: 2rem 0; }
    .avdelning { border-left: 4px solid #cc6600; padding-left: 1rem; margin: 2rem 0; }
    .allmanna-rad { background: #f9f6f0; border-left: 3px solid #c9a96e; padding: 0.5rem 1rem; margin: 0.5rem 0; }
    article { background: #fafafa; padding: 1rem; border: 1px solid #e0e0e0; border-radius: 4px; }
  </style>
</head>
<body>
${fullHtml}
</body>
</html>`

  fs.writeFileSync(reviewPath, reviewHtml)
  console.log(`  Review file: ${reviewPath}`)

  // Validate
  const validation = validateLlmOutput(fullHtml, DOC_NUMBER)
  if (!validation.valid || !validation.cleanedHtml) {
    console.error('  [WARN] Validation issues:')
    for (const err of validation.errors) {
      console.error(`    ${err.code}: ${err.message}`)
    }
    // Continue anyway — we want to review the output
  }
  for (const warn of validation.warnings) {
    console.log(`  [WARN] ${warn.code}: ${warn.message}`)
  }

  // Store in DB
  if (!dryRun) {
    const htmlContent = validation.cleanedHtml || fullHtml
    const markdownContent = htmlToMarkdown(htmlContent)
    const fullText = htmlToPlainText(htmlContent)
    const urls = AFS_URL_REGISTRY[DOC_NUMBER]

    const metadata = buildStandaloneMetadata(
      {
        documentNumber: DOC_NUMBER,
        title: DOC_TITLE,
        tier: 'KEEP_WHOLE',
        chapterCount: 11,
        chapters: [],
        hasAvdelningar: true,
        consolidatedThrough: 'AFS 2024:1',
        amendments: [],
      },
      urls?.historikUrl ?? ''
    )

    await prisma.legalDocument.upsert({
      where: { document_number: DOC_NUMBER },
      update: {
        title: DOC_TITLE,
        slug: generateAfsSlug(DOC_NUMBER),
        html_content: htmlContent,
        markdown_content: markdownContent,
        full_text: fullText,
        source_url: urls?.pageUrl ?? '',
        status: DocumentStatus.ACTIVE,
        metadata: metadata as unknown as Record<string, unknown>,
        updated_at: new Date(),
      },
      create: {
        document_number: DOC_NUMBER,
        title: DOC_TITLE,
        slug: generateAfsSlug(DOC_NUMBER),
        content_type: ContentType.AGENCY_REGULATION,
        html_content: htmlContent,
        markdown_content: markdownContent,
        full_text: fullText,
        source_url: urls?.pageUrl ?? '',
        status: DocumentStatus.ACTIVE,
        metadata: metadata as unknown as Record<string, unknown>,
      },
    })
    console.log(`  [OK] Stored in DB`)
  } else {
    console.log(`  [DRY RUN] Would store in DB`)
  }

  logCostSummary()

  console.log('\n' + '='.repeat(60))
  console.log('Done! Review the HTML file to verify completeness.')
  console.log('='.repeat(60))
}

main()
  .catch((e) => {
    console.error('Fatal:', e)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
