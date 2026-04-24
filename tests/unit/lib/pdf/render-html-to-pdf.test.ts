import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPdf = vi.fn().mockResolvedValue(Buffer.from('fake-pdf'))
const mockSetContent = vi.fn().mockResolvedValue(undefined)
const mockNewPage = vi.fn().mockResolvedValue({
  setContent: mockSetContent,
  pdf: mockPdf,
})
const mockClose = vi.fn().mockResolvedValue(undefined)
const mockLaunch = vi.fn().mockResolvedValue({
  newPage: mockNewPage,
  close: mockClose,
})

vi.mock('puppeteer-core', () => ({
  default: {
    launch: mockLaunch,
  },
}))

vi.mock('@sparticuz/chromium', () => ({
  default: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: vi.fn().mockResolvedValue('/usr/bin/chromium'),
  },
}))

// Ensure the tests always exercise the @sparticuz path regardless of dev env.
// The helper checks PUPPETEER_EXECUTABLE_PATH first and short-circuits when
// present; clear it at module load so assertions remain predictable.
delete process.env.PUPPETEER_EXECUTABLE_PATH

describe('renderHtmlToPdf', () => {
  beforeEach(() => {
    mockPdf.mockClear()
    mockSetContent.mockClear()
    mockNewPage.mockClear()
    mockClose.mockClear()
    mockLaunch.mockClear()
    mockPdf.mockResolvedValue(Buffer.from('fake-pdf'))
  })

  it('launches Chromium with sparticuz args and headless mode', async () => {
    const { renderHtmlToPdf } = await import('@/lib/pdf/render-html-to-pdf')

    await renderHtmlToPdf('<p>Hello</p>')

    expect(mockLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: '/usr/bin/chromium',
        headless: true,
      })
    )
  })

  it('sets content with waitUntil networkidle0', async () => {
    const { renderHtmlToPdf } = await import('@/lib/pdf/render-html-to-pdf')

    await renderHtmlToPdf('<p>Hello</p>')

    expect(mockSetContent).toHaveBeenCalledWith(
      '<p>Hello</p>',
      expect.objectContaining({ waitUntil: 'networkidle0' })
    )
  })

  it('uses default A4 + 2cm margins + printBackground when no options supplied', async () => {
    const { renderHtmlToPdf } = await import('@/lib/pdf/render-html-to-pdf')

    await renderHtmlToPdf('<p>Defaults</p>')

    expect(mockPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'A4',
        margin: { top: '2cm', bottom: '2cm', left: '2cm', right: '2cm' },
        printBackground: true,
      })
    )
  })

  it('propagates custom margins', async () => {
    const { renderHtmlToPdf } = await import('@/lib/pdf/render-html-to-pdf')

    await renderHtmlToPdf('<p>Custom</p>', {
      margin: { top: '3cm', bottom: '2.5cm', left: '2cm', right: '2cm' },
    })

    expect(mockPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        margin: { top: '3cm', bottom: '2.5cm', left: '2cm', right: '2cm' },
      })
    )
  })

  it('propagates headerTemplate + footerTemplate only when displayHeaderFooter is true', async () => {
    const { renderHtmlToPdf } = await import('@/lib/pdf/render-html-to-pdf')

    await renderHtmlToPdf('<p>With header</p>', {
      displayHeaderFooter: true,
      headerTemplate: '<div>HEAD</div>',
      footerTemplate: '<div>FOOT</div>',
    })

    expect(mockPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        displayHeaderFooter: true,
        headerTemplate: '<div>HEAD</div>',
        footerTemplate: '<div>FOOT</div>',
      })
    )
  })

  it('omits header/footer templates when displayHeaderFooter is undefined', async () => {
    const { renderHtmlToPdf } = await import('@/lib/pdf/render-html-to-pdf')

    await renderHtmlToPdf('<p>No header</p>', {
      headerTemplate: '<div>ignored</div>',
    })

    const pdfCall = mockPdf.mock.calls.at(-1)?.[0]
    expect(pdfCall).not.toHaveProperty('displayHeaderFooter')
    expect(pdfCall).not.toHaveProperty('headerTemplate')
  })

  it('returns a Buffer', async () => {
    const { renderHtmlToPdf } = await import('@/lib/pdf/render-html-to-pdf')

    const result = await renderHtmlToPdf('<p>Buffer check</p>')

    expect(result).toBeInstanceOf(Buffer)
  })

  it('closes the browser even when page.pdf throws', async () => {
    mockPdf.mockRejectedValueOnce(new Error('render failed'))

    const { renderHtmlToPdf } = await import('@/lib/pdf/render-html-to-pdf')

    await expect(renderHtmlToPdf('<p>Fail</p>')).rejects.toThrow(
      'render failed'
    )

    expect(mockClose).toHaveBeenCalled()
  })
})
