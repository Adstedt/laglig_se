/**
 * Story 7.5b: window math + pdf-lib helpers for large-PDF extraction.
 * computeWindows/halveWindow are pure; page count + slicing use real pdf-lib.
 */

import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import {
  PDF_PAGE_LIMIT,
  computeWindows,
  halveWindow,
  getPdfPageCount,
  slicePdfPages,
  type PageWindow,
} from '@/lib/documents/pdf-windows'

async function makePdf(pages: number): Promise<Buffer> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage()
  return Buffer.from(await doc.save())
}

/** Windows must be contiguous, ordered, and cover [0, pageCount). */
function assertCoverage(windows: PageWindow[], pageCount: number) {
  expect(windows[0]!.start).toBe(0)
  expect(windows[windows.length - 1]!.end).toBe(pageCount)
  for (let i = 1; i < windows.length; i++) {
    expect(windows[i]!.start).toBe(windows[i - 1]!.end)
  }
  for (const w of windows) {
    expect(w.end - w.start).toBeGreaterThan(0)
    expect(w.end - w.start).toBeLessThanOrEqual(PDF_PAGE_LIMIT)
  }
}

describe('computeWindows (API input limit = 100 pages)', () => {
  it('99 pages → one window (under the limit)', () => {
    expect(computeWindows(99)).toEqual([{ start: 0, end: 99 }])
  })

  it('100 pages → one window (at the limit)', () => {
    expect(computeWindows(100)).toEqual([{ start: 0, end: 100 }])
  })

  it('101 pages → two even-ish windows', () => {
    const windows = computeWindows(101)
    expect(windows).toEqual([
      { start: 0, end: 51 },
      { start: 51, end: 101 },
    ])
    assertCoverage(windows, 101)
  })

  it('250 pages → three even-ish windows, all ≤100 pages', () => {
    const windows = computeWindows(250)
    expect(windows).toEqual([
      { start: 0, end: 84 },
      { start: 84, end: 167 },
      { start: 167, end: 250 },
    ])
    assertCoverage(windows, 250)
  })

  it('1 page → single 1-page window; 0 pages → no windows', () => {
    expect(computeWindows(1)).toEqual([{ start: 0, end: 1 }])
    expect(computeWindows(0)).toEqual([])
  })
})

describe('halveWindow', () => {
  it('halves an even window at the midpoint', () => {
    expect(halveWindow({ start: 0, end: 100 })).toEqual([
      { start: 0, end: 50 },
      { start: 50, end: 100 },
    ])
  })

  it('halves an odd window with the extra page in the first half', () => {
    expect(halveWindow({ start: 84, end: 167 })).toEqual([
      { start: 84, end: 126 },
      { start: 126, end: 167 },
    ])
  })

  it('returns null for a 1-page window (cannot halve)', () => {
    expect(halveWindow({ start: 3, end: 4 })).toBeNull()
  })
})

describe('getPdfPageCount + slicePdfPages (real pdf-lib)', () => {
  it('counts pages of a real PDF', async () => {
    expect(await getPdfPageCount(await makePdf(5))).toBe(5)
  })

  it('throws on a non-PDF buffer', async () => {
    await expect(getPdfPageCount(Buffer.from('not a pdf'))).rejects.toThrow()
  })

  it('slices a page-range window into a standalone PDF', async () => {
    const pdf = await makePdf(7)
    const slice = await slicePdfPages(pdf, { start: 2, end: 5 })
    expect(await getPdfPageCount(slice)).toBe(3)
  })
})
