/**
 * Story 7.5b: Page-window helpers for large-PDF extraction.
 *
 * The Anthropic API caps PDF input at 100 pages for 200K-context models
 * (claude-haiku-4-5). PDFs above that limit are split into page-range
 * windows, each extracted separately and concatenated in order.
 *
 * pdf-lib is used for page counting AND physical splitting (already in the
 * dependency tree; `unpdf`/`lib/external/pdf-parser.ts` can count pages but
 * cannot produce page-range sub-PDFs).
 */

import { PDFDocument } from 'pdf-lib'

/** Anthropic API PDF input limit (pages) for 200K-context models. */
export const PDF_PAGE_LIMIT = 100

export interface PageWindow {
  /** 0-based inclusive start page index. */
  start: number
  /** 0-based exclusive end page index. */
  end: number
}

/**
 * Split `pageCount` pages into the minimum number of contiguous windows of at
 * most `maxPages` pages each, sized as evenly as possible (a 250-page doc
 * becomes 84+83+83, not 100+100+50 — balances output tokens per window).
 */
export function computeWindows(
  pageCount: number,
  maxPages: number = PDF_PAGE_LIMIT
): PageWindow[] {
  if (pageCount <= 0) return []
  const count = Math.ceil(pageCount / maxPages)
  const base = Math.floor(pageCount / count)
  const remainder = pageCount % count
  const windows: PageWindow[] = []
  let start = 0
  for (let i = 0; i < count; i++) {
    const size = base + (i < remainder ? 1 : 0)
    windows.push({ start, end: start + size })
    start += size
  }
  return windows
}

/**
 * Halve a window for the oversize fallback (AC 4). Returns null when the
 * window is a single page and cannot be halved.
 */
export function halveWindow(
  window: PageWindow
): [PageWindow, PageWindow] | null {
  const size = window.end - window.start
  if (size < 2) return null
  const mid = window.start + Math.ceil(size / 2)
  return [
    { start: window.start, end: mid },
    { start: mid, end: window.end },
  ]
}

/**
 * Page count via pdf-lib. Throws on encrypted or unparseable input — the
 * caller maps encryption errors to ENCRYPTED and falls back to the legacy
 * single-call path for anything else.
 */
export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  const doc = await PDFDocument.load(new Uint8Array(buffer), {
    updateMetadata: false,
  })
  return doc.getPageCount()
}

/** Extract a page-range window into a standalone PDF buffer. */
export async function slicePdfPages(
  buffer: Buffer,
  window: PageWindow
): Promise<Buffer> {
  const src = await PDFDocument.load(new Uint8Array(buffer), {
    updateMetadata: false,
  })
  const out = await PDFDocument.create()
  const indices: number[] = []
  for (let i = window.start; i < window.end; i++) indices.push(i)
  const pages = await out.copyPages(src, indices)
  for (const page of pages) out.addPage(page)
  return Buffer.from(await out.save())
}
