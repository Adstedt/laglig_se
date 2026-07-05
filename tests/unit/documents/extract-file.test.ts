/**
 * Story 17.8: Tests for the per-format extraction module + the generic
 * transcription validator + the extractable-mime guard.
 * Story 7.5b: large-PDF path — streaming collection at the raised 64K ceiling,
 * oversize no-retry, page-windowing >100 pages, halve-once fallback, summed
 * usage telemetry.
 *
 * Real libs are used for the deterministic paths (xlsx, papaparse, htmlToMarkdown,
 * pdf-lib); the Anthropic SDK (PDF path) and mammoth (DOCX path) are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PDFDocument } from 'pdf-lib'

const { mockStream, mockConvertDocx } = vi.hoisted(() => ({
  mockStream: vi.fn(),
  mockConvertDocx: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { stream: mockStream }
  },
}))
vi.mock('@/lib/documents/docx-to-tiptap', () => ({
  convertDocxToHtml: mockConvertDocx,
}))

import * as XLSX from 'xlsx'
import { extractFile } from '@/lib/documents/extract-file'
import {
  validateExtraction,
  FILE_TRANSCRIPTION_PROMPT,
} from '@/lib/documents/file-extraction-prompt'
import { isExtractableMimeType } from '@/lib/documents/extractable-mime'

const PDF = 'application/pdf'

/** Queue one successful streaming response (shape of MessageStream.finalMessage). */
function queueResponse(response: {
  content: unknown[]
  usage: { input_tokens: number; output_tokens: number }
  stop_reason?: string
}) {
  mockStream.mockReturnValueOnce({
    finalMessage: () => Promise.resolve(response),
  })
}

/** Queue one rejected streaming call (transient/API error). */
function queueRejection(error: Error) {
  mockStream.mockReturnValueOnce({
    finalMessage: () => Promise.reject(error),
  })
}

/** Build a real (blank-page) PDF with `pages` pages via pdf-lib. */
async function makePdf(pages: number): Promise<Buffer> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage()
  return Buffer.from(await doc.save())
}
const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const CSV = 'text/csv'
const TXT = 'text/plain'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ANTHROPIC_API_KEY = 'test-key'
})

afterEach(() => {
  vi.useRealTimers()
})

describe('extractFile — PDF (Claude document block, streaming)', () => {
  it('transcribes a small PDF in ONE call to markdown on DONE + returns Haiku usage', async () => {
    queueResponse({
      content: [{ type: 'text', text: '<h1>Avtal</h1><p>Innehåll</p>' }],
      usage: { input_tokens: 120, output_tokens: 40 },
    })
    const r = await extractFile(await makePdf(3), PDF)
    expect(r.status).toBe('DONE')
    expect(r.markdown).toContain('Avtal')
    expect(r.markdown).toContain('Innehåll')
    expect(r.markdown).not.toContain('pdf-window') // no marker on single-window docs
    expect(r.usage).toEqual({
      model: 'claude-haiku-4-5',
      inputTokens: 120,
      outputTokens: 40,
    })
    expect(mockStream).toHaveBeenCalledTimes(1)
  })

  it('wires the generic prompt, the raised 64K ceiling + a document block on the streaming call', async () => {
    const pdf = await makePdf(2)
    queueResponse({
      content: [{ type: 'text', text: '<p>x</p>' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    })
    await extractFile(pdf, PDF)
    const call = mockStream.mock.calls[0]![0]
    expect(call.model).toBe('claude-haiku-4-5')
    expect(call.max_tokens).toBe(64_000)
    expect(call.system).toBe(FILE_TRANSCRIPTION_PROMPT)
    expect(call.messages[0].content[0].type).toBe('document')
    expect(call.messages[0].content[0].source.media_type).toBe(
      'application/pdf'
    )
    // Small PDF: the ORIGINAL buffer is sent, not a re-sliced copy.
    expect(call.messages[0].content[0].source.data).toBe(pdf.toString('base64'))
  })

  it('still extracts an unparseable-by-pdf-lib buffer via the single-call fallback', async () => {
    queueResponse({
      content: [{ type: 'text', text: '<p>legacy</p>' }],
      usage: { input_tokens: 5, output_tokens: 2 },
    })
    const r = await extractFile(Buffer.from('pdfbytes'), PDF)
    expect(r.status).toBe('DONE')
    expect(r.markdown).toContain('legacy')
    expect(mockStream).toHaveBeenCalledTimes(1)
  })

  it('maps a no-text transcription to EMPTY', async () => {
    queueResponse({
      content: [{ type: 'text', text: '<p></p>' }],
      usage: { input_tokens: 10, output_tokens: 1 },
    })
    const r = await extractFile(await makePdf(1), PDF)
    expect(r.status).toBe('EMPTY')
    expect(r.markdown).toBeNull()
  })

  it('maps truncated (mid-tag) output to FAILED', async () => {
    queueResponse({
      content: [{ type: 'text', text: '<h1>T</h1><p>cut<' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })
    const r = await extractFile(await makePdf(1), PDF)
    expect(r.status).toBe('FAILED')
  })

  it('maps an API encryption error to ENCRYPTED (no retry)', async () => {
    queueRejection(new Error('The PDF is password-protected'))
    const r = await extractFile(Buffer.from('x'), PDF)
    expect(r.status).toBe('ENCRYPTED')
    expect(mockStream).toHaveBeenCalledTimes(1)
  })

  it('retries a transient API error (retry loop kept for non-deterministic failures)', async () => {
    vi.useFakeTimers()
    const pdf = await makePdf(1)
    queueRejection(new Error('529 overloaded_error'))
    queueResponse({
      content: [{ type: 'text', text: '<p>andra försöket</p>' }],
      usage: { input_tokens: 7, output_tokens: 3 },
    })
    const promise = extractFile(pdf, PDF)
    await vi.advanceTimersByTimeAsync(10_000) // skip exponential backoff
    const r = await promise
    expect(r.status).toBe('DONE')
    expect(r.markdown).toContain('andra försöket')
    expect(mockStream).toHaveBeenCalledTimes(2)
  })
})

describe('extractFile — PDF oversize (Story 7.5b: no deterministic retry + halve-once)', () => {
  it('makes exactly ONE call when a 1-page doc hits max_tokens (unhalvable) → FAILED', async () => {
    queueResponse({
      content: [{ type: 'text', text: '<h1>Stor</h1><p>Massor av text</p>' }],
      usage: { input_tokens: 90000, output_tokens: 64000 },
      stop_reason: 'max_tokens',
    })
    const r = await extractFile(await makePdf(1), PDF)
    expect(r.status).toBe('FAILED')
    expect(r.markdown).toBeNull()
    expect(mockStream).toHaveBeenCalledTimes(1) // the cost bug: was 3× before 7.5b
  })

  it('makes exactly ONE call on max_tokens when the page count is unknown → FAILED', async () => {
    queueResponse({
      content: [{ type: 'text', text: '<p>partial</p>' }],
      usage: { input_tokens: 90000, output_tokens: 64000 },
      stop_reason: 'max_tokens',
    })
    const r = await extractFile(Buffer.from('not-a-real-pdf'), PDF)
    expect(r.status).toBe('FAILED')
    expect(mockStream).toHaveBeenCalledTimes(1)
  })

  it('halves ONCE on oversize and concatenates both halves in order', async () => {
    // 4-page doc: full-window call oversizes → halves {1-2} and {3-4} succeed.
    queueResponse({
      content: [{ type: 'text', text: '<p>för stort</p>' }],
      usage: { input_tokens: 100, output_tokens: 64000 },
      stop_reason: 'max_tokens',
    })
    queueResponse({
      content: [{ type: 'text', text: '<p>Första halvan</p>' }],
      usage: { input_tokens: 60, output_tokens: 30 },
    })
    queueResponse({
      content: [{ type: 'text', text: '<p>Andra halvan</p>' }],
      usage: { input_tokens: 55, output_tokens: 25 },
    })
    const r = await extractFile(await makePdf(4), PDF)
    expect(r.status).toBe('DONE')
    expect(mockStream).toHaveBeenCalledTimes(3)
    const first = r.markdown!.indexOf('Första halvan')
    const second = r.markdown!.indexOf('Andra halvan')
    expect(first).toBeGreaterThanOrEqual(0)
    expect(second).toBeGreaterThan(first)
    // Marker between the two half-segments (pages 3–4 follow the split point).
    expect(r.markdown).toContain('<!-- [pdf-window] sidor 3-4 -->')
    // Usage summed across all three calls (one telemetry row per file).
    expect(r.usage).toEqual({
      model: 'claude-haiku-4-5',
      inputTokens: 215,
      outputTokens: 64055,
    })
  })

  it('fails honestly when a halved window STILL hits max_tokens (halve once, not twice)', async () => {
    queueResponse({
      content: [{ type: 'text', text: '<p>x</p>' }],
      usage: { input_tokens: 100, output_tokens: 64000 },
      stop_reason: 'max_tokens',
    })
    queueResponse({
      content: [{ type: 'text', text: '<p>y</p>' }],
      usage: { input_tokens: 50, output_tokens: 64000 },
      stop_reason: 'max_tokens',
    })
    const r = await extractFile(await makePdf(4), PDF)
    expect(r.status).toBe('FAILED')
    // Full window + first half only — no second halving, no second half attempted.
    expect(mockStream).toHaveBeenCalledTimes(2)
  })
})

describe('extractFile — PDF page-windowing >100 pages (Story 7.5b)', () => {
  it('splits a 150-page PDF into two windows, concatenates in order with a marker', async () => {
    queueResponse({
      content: [{ type: 'text', text: '<h1>Del 1</h1><p>Kapitel ett</p>' }],
      usage: { input_tokens: 1000, output_tokens: 500 },
    })
    queueResponse({
      content: [{ type: 'text', text: '<h1>Del 2</h1><p>Kapitel två</p>' }],
      usage: { input_tokens: 900, output_tokens: 400 },
    })
    const r = await extractFile(await makePdf(150), PDF)
    expect(r.status).toBe('DONE')
    expect(mockStream).toHaveBeenCalledTimes(2)

    // Ordered concatenation with the page-window marker between segments.
    const del1 = r.markdown!.indexOf('Del 1')
    const marker = r.markdown!.indexOf('<!-- [pdf-window] sidor 76-150 -->')
    const del2 = r.markdown!.indexOf('Del 2')
    expect(del1).toBeGreaterThanOrEqual(0)
    expect(marker).toBeGreaterThan(del1)
    expect(del2).toBeGreaterThan(marker)

    // Each window call carries its own sliced sub-PDF (75 pages each), not the original.
    const dataA = mockStream.mock.calls[0]![0].messages[0].content[0].source
      .data as string
    const dataB = mockStream.mock.calls[1]![0].messages[0].content[0].source
      .data as string
    const sliceA = await PDFDocument.load(
      new Uint8Array(Buffer.from(dataA, 'base64'))
    )
    const sliceB = await PDFDocument.load(
      new Uint8Array(Buffer.from(dataB, 'base64'))
    )
    expect(sliceA.getPageCount()).toBe(75)
    expect(sliceB.getPageCount()).toBe(75)

    // Telemetry: summed usage across window calls.
    expect(r.usage).toEqual({
      model: 'claude-haiku-4-5',
      inputTokens: 1900,
      outputTokens: 900,
    })
  })

  it('treats a blank window as empty segment, not whole-doc EMPTY/FAILED', async () => {
    queueResponse({
      content: [{ type: 'text', text: '<p></p>' }], // blank first window
      usage: { input_tokens: 10, output_tokens: 1 },
    })
    queueResponse({
      content: [{ type: 'text', text: '<p>Innehåll</p>' }],
      usage: { input_tokens: 20, output_tokens: 5 },
    })
    const r = await extractFile(await makePdf(120), PDF)
    expect(r.status).toBe('DONE')
    expect(r.markdown).toContain('Innehåll')
  })

  it('returns EMPTY when ALL windows are blank', async () => {
    queueResponse({
      content: [{ type: 'text', text: '<p></p>' }],
      usage: { input_tokens: 10, output_tokens: 1 },
    })
    queueResponse({
      content: [{ type: 'text', text: '<p></p>' }],
      usage: { input_tokens: 10, output_tokens: 1 },
    })
    const r = await extractFile(await makePdf(120), PDF)
    expect(r.status).toBe('EMPTY')
    expect(r.markdown).toBeNull()
  })
})

describe('extractFile — DOCX (mammoth → markdown)', () => {
  it('converts DOCX HTML to markdown and preserves Swedish characters', async () => {
    mockConvertDocx.mockResolvedValue({
      html: '<h1>Policy</h1><p>Text å ä ö</p>',
      messages: [],
    })
    const r = await extractFile(Buffer.from('docxbytes'), DOCX)
    expect(r.status).toBe('DONE')
    expect(r.markdown).toContain('Policy')
    expect(r.markdown).toContain('å ä ö')
  })

  it('maps a corrupt DOCX (mammoth throws) to FAILED', async () => {
    mockConvertDocx.mockRejectedValue(new Error('bad zip'))
    const r = await extractFile(Buffer.from('x'), DOCX)
    expect(r.status).toBe('FAILED')
  })
})

describe('extractFile — spreadsheets (SheetJS) + CSV (papaparse)', () => {
  it('renders XLSX sheets as markdown tables', async () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      ['Namn', 'Status'],
      ['Brandskydd', 'Uppfylld'],
    ])
    XLSX.utils.book_append_sheet(wb, ws, 'Krav')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    const r = await extractFile(buf, XLSX_MIME)
    expect(r.status).toBe('DONE')
    expect(r.markdown).toContain('## Krav')
    expect(r.markdown).toContain('| Namn | Status |')
    expect(r.markdown).toContain('Brandskydd')
  })

  it('renders a CSV as a markdown table', async () => {
    const r = await extractFile(Buffer.from('Rubrik,Värde\nA,1\nB,2'), CSV)
    expect(r.status).toBe('DONE')
    expect(r.markdown).toContain('| Rubrik | Värde |')
    expect(r.markdown).toContain('| A | 1 |')
  })
})

describe('extractFile — text + routing + truncation', () => {
  it('returns plain text verbatim (Swedish UTF-8)', async () => {
    const r = await extractFile(Buffer.from('Hej å ä ö', 'utf-8'), TXT)
    expect(r.status).toBe('DONE')
    expect(r.markdown).toBe('Hej å ä ö')
  })

  it('returns UNSUPPORTED for an image', async () => {
    const r = await extractFile(Buffer.from('x'), 'image/png')
    expect(r.status).toBe('UNSUPPORTED')
    expect(r.markdown).toBeNull()
  })

  it('returns EMPTY for whitespace-only content', async () => {
    const r = await extractFile(Buffer.from('   \n  '), TXT)
    expect(r.status).toBe('EMPTY')
  })

  it('truncates oversized output on a clean boundary (Story 7.5b: cap raised to 800k)', async () => {
    const block = 'word '.repeat(40) + '\n\n' // ~202 chars
    const r = await extractFile(Buffer.from(block.repeat(4200)), TXT) // ~848k chars
    expect(r.status).toBe('DONE')
    expect(r.truncated).toBe(true)
    expect(r.markdown!.length).toBeLessThanOrEqual(800_000)
    expect(r.markdown!.length).toBeGreaterThan(200_000) // old cap no longer applies
  })
})

describe('validateExtraction', () => {
  it('rejects empty output', () => {
    expect(validateExtraction('').ok).toBe(false)
    expect(validateExtraction('   ').ok).toBe(false)
  })
  it('accepts HTML with text content', () => {
    expect(validateExtraction('<p>hej</p>').ok).toBe(true)
  })
  it('flags no-text content', () => {
    expect(validateExtraction('<p></p>')).toMatchObject({
      ok: false,
      reason: 'no text content',
    })
  })
  it('flags truncated mid-tag output', () => {
    expect(validateExtraction('<p>hej<')).toMatchObject({
      ok: false,
      reason: 'truncated mid-tag',
    })
  })
})

describe('isExtractableMimeType', () => {
  it('accepts the supported set, rejects others/null', () => {
    expect(isExtractableMimeType('application/pdf')).toBe(true)
    expect(isExtractableMimeType('text/csv')).toBe(true)
    expect(isExtractableMimeType('text/markdown')).toBe(true)
    expect(isExtractableMimeType('image/png')).toBe(false)
    expect(isExtractableMimeType(null)).toBe(false)
  })
})
