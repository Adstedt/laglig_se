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
import {
  computeWindows,
  halveWindow,
  getPdfPageCount,
  slicePdfPages,
  type PageWindow,
} from '@/lib/documents/pdf-windows'

// Story 7.5b: raised proportionally with PDF_MAX_TOKENS (was 200k @ 16,384) so
// a full 64k-token transcription — and multi-window concatenations — are not
// silently truncated. Downstream chunking self-bounds (chunks by section; per-
// chunk size unchanged), so only the chunk COUNT scales with this.
const MAX_CHARS = 800_000
const PDF_MODEL = 'claude-haiku-4-5' // cost: OCR/transcription doesn't need top-tier reasoning
// Story 7.5b: claude-haiku-4-5's real output ceiling is 64K tokens (200K
// context tier). Output is collected via the streaming API — non-streaming
// requests at this size risk SDK HTTP timeouts (streaming is required above
// ~16K). A window whose transcription still exceeds this is halved once
// (see runWindow) before FAILED.
const PDF_MAX_TOKENS = 64_000
// Transient API errors only — a deterministic oversize (stop_reason ===
// 'max_tokens') exits after exactly ONE call (Story 7.5b AC 2).
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
// PDF — Claude document block, page-windowed for large docs (Story 7.5b).
//
// ≤100 pages (or page count undetectable): ONE call with the original buffer —
// byte-equivalent to the pre-7.5b path where it already worked.
// >100 pages (API input limit): split into even page windows, extract each
// sequentially, concatenate markdown in order with a page-window marker.
// A window hitting stop_reason=max_tokens is halved ONCE and re-extracted;
// a second oversize (or an unhalvable window) → FAILED. max_tokens is never
// blind-retried — the retry loop covers transient API errors only.
// ---------------------------------------------------------------------------

type ClaudeCallResult =
  | { kind: 'ok'; html: string }
  | { kind: 'oversize' }
  | { kind: 'encrypted' }
  | { kind: 'failed' }

/** One transcription call (streaming collection) with transient-error retries.
 *  A completed response — including a deterministic oversize — is terminal:
 *  exactly one call is made for it. */
async function transcribePdfBuffer(
  client: Anthropic,
  pdfBuffer: Buffer,
  addUsage: (_usage: { input_tokens: number; output_tokens: number }) => void
): Promise<ClaudeCallResult> {
  const pdfBase64 = pdfBuffer.toString('base64')
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= PDF_MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages
        .stream({
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
        .finalMessage()

      addUsage(response.usage)

      // Deterministic oversize — NEVER retried (Story 7.5b AC 2). The caller
      // decides whether the halve-once fallback applies.
      if (response.stop_reason === 'max_tokens') {
        return { kind: 'oversize' }
      }

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        return { kind: 'failed' }
      }
      return { kind: 'ok', html: textBlock.text }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (/encrypt|password/i.test(lastError.message)) {
        return { kind: 'encrypted' }
      }
      if (attempt < PDF_MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000))
      }
    }
  }

  console.error('[EXTRACT-FILE] PDF extraction failed:', lastError?.message)
  return { kind: 'failed' }
}

async function extractPdf(buffer: Buffer): Promise<ExtractFileResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set — cannot extract PDF')
  }
  const client = new Anthropic({ apiKey })

  // Page-count detection (pdf-lib). Encrypted → ENCRYPTED without burning an
  // API call; any other detection failure (corrupt/exotic PDF) falls back to
  // the legacy single-call path and lets the API be the arbiter.
  let pageCount: number | null = null
  try {
    pageCount = await getPdfPageCount(buffer)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/encrypt|password/i.test(msg)) {
      return { status: 'ENCRYPTED', markdown: null }
    }
    console.warn(
      '[EXTRACT-FILE] PDF page-count detection failed — single-call fallback:',
      msg
    )
  }

  const windows: (PageWindow | null)[] =
    pageCount === null ? [null] : computeWindows(pageCount)
  const multiWindow = windows.length > 1

  // Telemetry: ONE usage object summed across all calls for this file — the
  // caller keeps writing a single FILE_EXTRACTION row per file (existing
  // pattern; return contract unchanged).
  const usage = { model: PDF_MODEL, inputTokens: 0, outputTokens: 0 }
  const addUsage = (u: { input_tokens: number; output_tokens: number }) => {
    usage.inputTokens += u.input_tokens
    usage.outputTokens += u.output_tokens
  }
  const usageIfAnyCalls = () =>
    usage.inputTokens + usage.outputTokens > 0 ? { usage } : {}

  const segments: { window: PageWindow | null; markdown: string }[] = []

  /** Extract one window (whole doc when `window` is null or the doc fits in a
   *  single window). On oversize, halve ONCE and extract both halves; halves
   *  themselves may not halve again. Returns a terminal failure status or
   *  null on success (blank windows succeed silently with no segment). */
  async function runWindow(
    window: PageWindow | null,
    useWholeBuffer: boolean,
    allowHalve: boolean
  ): Promise<'FAILED' | 'ENCRYPTED' | null> {
    const windowBuffer = useWholeBuffer
      ? buffer
      : await slicePdfPages(buffer, window!)
    const result = await transcribePdfBuffer(client, windowBuffer, addUsage)

    if (result.kind === 'encrypted') return 'ENCRYPTED'
    if (result.kind === 'failed') return 'FAILED'

    if (result.kind === 'oversize') {
      const halves = allowHalve && window ? halveWindow(window) : null
      if (!halves) {
        console.error(
          '[EXTRACT-FILE] PDF window transcription hit max_tokens with no halving left — FAILED',
          window ?? '(whole document, page count unknown)'
        )
        return 'FAILED'
      }
      console.warn(
        `[EXTRACT-FILE] PDF window ${window!.start + 1}-${window!.end} hit max_tokens — halving once`
      )
      for (const half of halves) {
        const status = await runWindow(half, false, false)
        if (status) return status
      }
      return null
    }

    // Successful response — validation outcome is terminal, NOT retried.
    // `no text content` = blank/imageless window → contributes no segment
    // (whole-doc EMPTY is decided after all windows); anything else → FAILED.
    const validation = validateExtraction(result.html)
    if (!validation.ok) {
      return validation.reason === 'no text content' ? null : 'FAILED'
    }
    segments.push({ window, markdown: htmlToMarkdown(result.html) })
    return null
  }

  // Sequential window extraction (cron maxDuration 300 is the budget).
  for (const window of windows) {
    const failure = await runWindow(window, !multiWindow, window !== null)
    if (failure === 'ENCRYPTED') return { status: 'ENCRYPTED', markdown: null }
    if (failure === 'FAILED') {
      return { status: 'FAILED', markdown: null, ...usageIfAnyCalls() }
    }
  }

  if (segments.length === 0) {
    return { status: 'EMPTY', markdown: null, ...usageIfAnyCalls() }
  }

  // Ordered concatenation with a page-window comment marker between segments.
  const joined = segments
    .map((segment, i) =>
      i === 0 || !segment.window
        ? segment.markdown
        : `<!-- [pdf-window] sidor ${segment.window.start + 1}-${segment.window.end} -->\n\n${segment.markdown}`
    )
    .join('\n\n')

  return finalizeText(joined, usage)
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
