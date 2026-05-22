/**
 * Story 17.8: Per-format uploaded-file extraction → structure-preserving markdown.
 *
 * Routing:
 *   PDF  → Claude `document` block (text-layer AND scanned/OCR, uniform) → HTML → markdown
 *   DOCX → mammoth (`convertDocxToHtml`, Swedish styleMap) → HTML → markdown
 *   XLS/XLSX → SheetJS → markdown tables
 *   CSV  → papaparse → markdown table
 *   TXT/MD → direct
 *   anything else → UNSUPPORTED
 *
 * The LLM step is PDF-only — office/text formats are already structured, so we
 * convert them directly (faithful + free). See Story 17.8 Dev Notes.
 */

import Anthropic from '@anthropic-ai/sdk'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import type { FileExtractionStatus } from '@prisma/client'
import { htmlToMarkdown } from '@/lib/transforms/html-to-markdown'
import { convertDocxToHtml } from '@/lib/documents/docx-to-tiptap'
import {
  FILE_TRANSCRIPTION_PROMPT,
  validateExtraction,
} from '@/lib/documents/file-extraction-prompt'
import { EXTRACTABLE_MIME as MIME } from '@/lib/documents/extractable-mime'

const MAX_CHARS = 200_000
const PDF_MODEL = 'claude-haiku-4-5' // cost: OCR/transcription doesn't need top-tier reasoning
// 16384 keeps us under the SDK's non-streaming "10-minute" guard (matches the
// proven amendment path). A doc whose transcription exceeds this is "oversized"
// → handled as FAILED (see extractPdf) pending the page-splitting follow-up.
const PDF_MAX_TOKENS = 16_384
const PDF_MAX_RETRIES = 3

export interface ExtractFileResult {
  status: FileExtractionStatus
  /** Canonical markdown; null for any non-DONE status. */
  markdown: string | null
  /** True when output hit the MAX_CHARS cap (caller records in metadata). */
  truncated?: boolean
  /** PDF (LLM) path only — for FILE_EXTRACTION cost telemetry. */
  usage?: { model: string; inputTokens: number; outputTokens: number }
}

/**
 * Extract a file's text content as markdown. Pure w.r.t. persistence — the
 * caller (cron / manual action) is responsible for storing the result.
 * Never throws: any unexpected error is mapped to FAILED.
 */
export async function extractFile(
  buffer: Buffer,
  mimeType: string | null
): Promise<ExtractFileResult> {
  try {
    switch (mimeType) {
      case MIME.PDF:
        return await extractPdf(buffer)
      case MIME.DOCX:
        return await extractDocx(buffer)
      case MIME.XLSX:
      case MIME.XLS:
        return extractSpreadsheet(buffer)
      case MIME.CSV:
        return extractCsv(buffer)
      case MIME.TXT:
      case MIME.MD:
        return finalizeText(buffer.toString('utf-8'))
      default:
        return { status: 'UNSUPPORTED', markdown: null }
    }
  } catch (err) {
    console.error('[EXTRACT-FILE] extraction error:', err)
    return { status: 'FAILED', markdown: null }
  }
}

// ---------------------------------------------------------------------------
// PDF — Claude document block (mirrors lib/external/llm-amendment-parser.ts shape)
// ---------------------------------------------------------------------------

async function extractPdf(buffer: Buffer): Promise<ExtractFileResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set — cannot extract PDF')
  }
  const client = new Anthropic({ apiKey })
  const pdfBase64 = buffer.toString('base64')
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= PDF_MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: PDF_MODEL,
        max_tokens: PDF_MAX_TOKENS,
        system: FILE_TRANSCRIPTION_PROMPT,
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
                text: 'Transcribe this document to semantic HTML, following your instructions exactly.',
              },
            ],
          },
        ],
      })

      const usage = {
        model: PDF_MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      }

      // Oversized: the model hit the output cap, so the transcription is
      // incomplete. We do NOT index a partial document (compliance faithfulness)
      // — mark FAILED. Large docs need the page-splitting follow-up (AC 7).
      if (response.stop_reason === 'max_tokens') {
        console.error(
          '[EXTRACT-FILE] PDF too large for a single call (stop_reason=max_tokens) — needs page-splitting'
        )
        return { status: 'FAILED', markdown: null, usage }
      }

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        return { status: 'FAILED', markdown: null, usage }
      }

      // A successful response is terminal — validation outcome is NOT retried.
      const validation = validateExtraction(textBlock.text)
      if (!validation.ok) {
        // `no text content` = the model saw a blank/imageless doc → EMPTY;
        // truncated/empty output → FAILED.
        const status: FileExtractionStatus =
          validation.reason === 'no text content' ? 'EMPTY' : 'FAILED'
        return { status, markdown: null, usage }
      }

      return finalizeText(htmlToMarkdown(textBlock.text), usage)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (/encrypt|password/i.test(lastError.message)) {
        return { status: 'ENCRYPTED', markdown: null }
      }
      if (attempt < PDF_MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000))
      }
    }
  }

  console.error('[EXTRACT-FILE] PDF extraction failed:', lastError?.message)
  return { status: 'FAILED', markdown: null }
}

// ---------------------------------------------------------------------------
// DOCX — mammoth → HTML → markdown
// ---------------------------------------------------------------------------

async function extractDocx(buffer: Buffer): Promise<ExtractFileResult> {
  const { html } = await convertDocxToHtml(buffer)
  return finalizeText(htmlToMarkdown(html))
}

// ---------------------------------------------------------------------------
// XLS/XLSX — SheetJS → markdown tables (one per sheet)
// ---------------------------------------------------------------------------

function extractSpreadsheet(buffer: Buffer): ExtractFileResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const parts: string[] = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
    })
    const table = rowsToMarkdownTable(rows)
    if (table) {
      parts.push(`## ${sheetName}`, table)
    }
  }
  return finalizeText(parts.join('\n\n'))
}

// ---------------------------------------------------------------------------
// CSV — papaparse → markdown table
// ---------------------------------------------------------------------------

function extractCsv(buffer: Buffer): ExtractFileResult {
  const parsed = Papa.parse<string[]>(buffer.toString('utf-8'), {
    skipEmptyLines: true,
  })
  return finalizeText(rowsToMarkdownTable(parsed.data))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render a row matrix as a GitHub-flavoured markdown table (row 0 = header). */
function rowsToMarkdownTable(rows: unknown[][]): string {
  const clean = rows.filter(
    (r) =>
      Array.isArray(r) && r.some((c) => c != null && String(c).trim() !== '')
  )
  if (clean.length === 0) return ''

  const colCount = Math.max(...clean.map((r) => r.length))
  const cell = (v: unknown): string =>
    String(v ?? '')
      .replace(/\|/g, '\\|')
      .replace(/\r?\n/g, ' ')
      .trim()
  const padRow = (r: unknown[]): string[] =>
    Array.from({ length: colCount }, (_, i) => cell(r[i]))
  const renderLine = (cells: string[]): string => `| ${cells.join(' | ')} |`

  const header = padRow(clean[0]!)
  const separator = Array.from({ length: colCount }, () => '---')
  const body = clean.slice(1).map(padRow)

  return [
    renderLine(header),
    renderLine(separator),
    ...body.map(renderLine),
  ].join('\n')
}

/** Empty → EMPTY; otherwise DONE with the markdown truncated on a clean boundary. */
function finalizeText(
  markdown: string,
  usage?: ExtractFileResult['usage']
): ExtractFileResult {
  const trimmed = markdown.trim()
  if (trimmed.length === 0) {
    return { status: 'EMPTY', markdown: null, ...(usage ? { usage } : {}) }
  }
  const { text, truncated } = truncate(trimmed)
  return {
    status: 'DONE',
    markdown: text,
    truncated,
    ...(usage ? { usage } : {}),
  }
}

/** Cap at MAX_CHARS, backing up to the last blank-line/newline boundary so the
 *  final 17.9 chunk isn't a mid-table/mid-heading fragment (Story 17.8 AC 10). */
function truncate(markdown: string): { text: string; truncated: boolean } {
  if (markdown.length <= MAX_CHARS) return { text: markdown, truncated: false }
  const slice = markdown.slice(0, MAX_CHARS)
  const boundary = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('\n'))
  const cut = boundary > MAX_CHARS * 0.5 ? slice.slice(0, boundary) : slice
  return { text: cut.trimEnd(), truncated: true }
}
