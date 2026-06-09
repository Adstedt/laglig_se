/**
 * Story 17.8: Tests for the per-format extraction module + the generic
 * transcription validator + the extractable-mime guard.
 *
 * Real libs are used for the deterministic paths (xlsx, papaparse, htmlToMarkdown);
 * the Anthropic SDK (PDF path) and mammoth (DOCX path) are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreate, mockConvertDocx } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockConvertDocx: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate }
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

describe('extractFile — PDF (Claude document block)', () => {
  it('transcribes a PDF to markdown on DONE + returns Haiku usage', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '<h1>Avtal</h1><p>Innehåll</p>' }],
      usage: { input_tokens: 120, output_tokens: 40 },
    })
    const r = await extractFile(Buffer.from('pdfbytes'), PDF)
    expect(r.status).toBe('DONE')
    expect(r.markdown).toContain('Avtal')
    expect(r.markdown).toContain('Innehåll')
    expect(r.usage).toEqual({
      model: 'claude-haiku-4-5',
      inputTokens: 120,
      outputTokens: 40,
    })
  })

  it('wires the generic prompt + a document block on the Anthropic call', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '<p>x</p>' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    })
    await extractFile(Buffer.from('pdfbytes'), PDF)
    const call = mockCreate.mock.calls[0]![0]
    expect(call.model).toBe('claude-haiku-4-5')
    expect(call.system).toBe(FILE_TRANSCRIPTION_PROMPT)
    expect(call.messages[0].content[0].type).toBe('document')
    expect(call.messages[0].content[0].source.media_type).toBe(
      'application/pdf'
    )
  })

  it('maps a no-text transcription to EMPTY', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '<p></p>' }],
      usage: { input_tokens: 10, output_tokens: 1 },
    })
    const r = await extractFile(Buffer.from('x'), PDF)
    expect(r.status).toBe('EMPTY')
    expect(r.markdown).toBeNull()
  })

  it('maps an oversized doc (stop_reason=max_tokens) to FAILED, not partial', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '<h1>Stor</h1><p>Massor av text</p>' }],
      usage: { input_tokens: 90000, output_tokens: 16384 },
      stop_reason: 'max_tokens',
    })
    const r = await extractFile(Buffer.from('x'), PDF)
    expect(r.status).toBe('FAILED')
    expect(r.markdown).toBeNull()
  })

  it('maps truncated (mid-tag) output to FAILED', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '<h1>T</h1><p>cut<' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })
    const r = await extractFile(Buffer.from('x'), PDF)
    expect(r.status).toBe('FAILED')
  })

  it('maps an encryption error to ENCRYPTED (no retry)', async () => {
    mockCreate.mockRejectedValue(new Error('The PDF is password-protected'))
    const r = await extractFile(Buffer.from('x'), PDF)
    expect(r.status).toBe('ENCRYPTED')
    expect(mockCreate).toHaveBeenCalledTimes(1)
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

  it('truncates oversized output on a clean boundary', async () => {
    const block = 'word '.repeat(40) + '\n\n' // ~205 chars
    const r = await extractFile(Buffer.from(block.repeat(1100)), TXT)
    expect(r.status).toBe('DONE')
    expect(r.truncated).toBe(true)
    expect(r.markdown!.length).toBeLessThanOrEqual(200_000)
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
