import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRenderHtmlToPdf = vi.fn().mockResolvedValue(Buffer.from('fake-pdf'))

vi.mock('@/lib/pdf/render-html-to-pdf', () => ({
  renderHtmlToPdf: mockRenderHtmlToPdf,
}))

describe('renderRevisionsrapportPdf', () => {
  beforeEach(() => {
    mockRenderHtmlToPdf.mockClear()
    mockRenderHtmlToPdf.mockResolvedValue(Buffer.from('fake-pdf'))
  })

  it('applies revisionsrapport-specific margins (top/bottom wider than default)', async () => {
    const { renderRevisionsrapportPdf } = await import(
      '@/lib/compliance-audit/revisionsrapport-to-pdf'
    )

    await renderRevisionsrapportPdf('<!DOCTYPE html><html></html>', {
      cycleIdShort: '12345678',
      generatedAt: '2026-04-24 14:00',
      sealHash: null,
    })

    expect(mockRenderHtmlToPdf).toHaveBeenCalledWith(
      '<!DOCTYPE html><html></html>',
      expect.objectContaining({
        margin: {
          top: '3cm',
          bottom: '2.5cm',
          left: '2cm',
          right: '2cm',
        },
        displayHeaderFooter: true,
      })
    )
  })

  it('includes truncated 16-char seal hash in the header template when sealed', async () => {
    const { renderRevisionsrapportPdf } = await import(
      '@/lib/compliance-audit/revisionsrapport-to-pdf'
    )

    const fullHash =
      'abc123def456789012345678901234567890abcdef1234567890abcdef123456'

    await renderRevisionsrapportPdf('<!DOCTYPE html><html></html>', {
      cycleIdShort: '12345678',
      generatedAt: '2026-04-24 14:00',
      sealHash: fullHash,
    })

    const call = mockRenderHtmlToPdf.mock.calls[0]?.[1]
    expect(call.headerTemplate).toContain('abc123def4567890…') // slice(0,16)
    expect(call.headerTemplate).not.toContain(fullHash) // only truncated version
  })

  it('omits hash from header template when cycle is not sealed', async () => {
    const { renderRevisionsrapportPdf } = await import(
      '@/lib/compliance-audit/revisionsrapport-to-pdf'
    )

    await renderRevisionsrapportPdf('<!DOCTYPE html><html></html>', {
      cycleIdShort: '12345678',
      generatedAt: '2026-04-24 14:00',
      sealHash: null,
    })

    const call = mockRenderHtmlToPdf.mock.calls[0]?.[1]
    const headerText = call.headerTemplate as string
    const spanMatch = headerText.match(/<span>([^<]*)<\/span>/)
    expect(spanMatch?.[1]).toBe('')
  })

  it('footer template includes full 64-char seal hash when sealed', async () => {
    const { renderRevisionsrapportPdf } = await import(
      '@/lib/compliance-audit/revisionsrapport-to-pdf'
    )

    const fullHash =
      'abc123def456789012345678901234567890abcdef1234567890abcdef123456'

    await renderRevisionsrapportPdf('<!DOCTYPE html><html></html>', {
      cycleIdShort: '12345678',
      generatedAt: '2026-04-24 14:00',
      sealHash: fullHash,
    })

    const call = mockRenderHtmlToPdf.mock.calls[0]?.[1]
    expect(call.footerTemplate).toContain(`· Seal: ${fullHash}`)
  })

  it('footer template omits seal suffix when cycle is not sealed', async () => {
    const { renderRevisionsrapportPdf } = await import(
      '@/lib/compliance-audit/revisionsrapport-to-pdf'
    )

    await renderRevisionsrapportPdf('<!DOCTYPE html><html></html>', {
      cycleIdShort: '12345678',
      generatedAt: '2026-04-24 14:00',
      sealHash: null,
    })

    const call = mockRenderHtmlToPdf.mock.calls[0]?.[1]
    expect(call.footerTemplate).not.toContain('Seal:')
  })

  it('footer template includes Kontroll-ID prefix + generatedAt + pagination placeholders', async () => {
    const { renderRevisionsrapportPdf } = await import(
      '@/lib/compliance-audit/revisionsrapport-to-pdf'
    )

    await renderRevisionsrapportPdf('<!DOCTYPE html><html></html>', {
      cycleIdShort: 'abcd1234',
      generatedAt: '2026-04-24 14:00',
      sealHash: null,
    })

    const call = mockRenderHtmlToPdf.mock.calls[0]?.[1]
    const footer = call.footerTemplate as string
    expect(footer).toContain('Rapport genererad 2026-04-24 14:00')
    expect(footer).toContain('Kontroll-ID: abcd1234…')
    expect(footer).toContain('<span class="pageNumber">')
    expect(footer).toContain('<span class="totalPages">')
  })

  it('escapes HTML in the seal hash (defensive — should never contain HTML)', async () => {
    const { renderRevisionsrapportPdf } = await import(
      '@/lib/compliance-audit/revisionsrapport-to-pdf'
    )

    // Defensive: even if a future bug somehow produced HTML in the hash,
    // the template must escape it rather than inject it into Puppeteer's DOM.
    await renderRevisionsrapportPdf('<!DOCTYPE html><html></html>', {
      cycleIdShort: '<script>',
      generatedAt: '2026-04-24 14:00',
      sealHash: '<img src=x>',
    })

    const call = mockRenderHtmlToPdf.mock.calls[0]?.[1]
    expect(call.footerTemplate).toContain('&lt;script&gt;')
    expect(call.footerTemplate).not.toContain('<script>')
  })

  it('returns the Buffer from the underlying renderer', async () => {
    mockRenderHtmlToPdf.mockResolvedValueOnce(Buffer.from('specific-output'))

    const { renderRevisionsrapportPdf } = await import(
      '@/lib/compliance-audit/revisionsrapport-to-pdf'
    )

    const result = await renderRevisionsrapportPdf(
      '<!DOCTYPE html><html></html>',
      {
        cycleIdShort: '12345678',
        generatedAt: '2026-04-24 14:00',
        sealHash: null,
      }
    )

    expect(result.toString()).toBe('specific-output')
  })
})
