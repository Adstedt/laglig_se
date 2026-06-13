import { describe, it, expect, vi } from 'vitest'

const mockPdf = vi.fn().mockResolvedValue(Buffer.from('fake-pdf'))
const mockSetContent = vi.fn().mockResolvedValue(undefined)
const mockNewPage = vi.fn().mockResolvedValue({
  setContent: mockSetContent,
  pdf: mockPdf,
})
const mockClose = vi.fn().mockResolvedValue(undefined)

vi.mock('puppeteer-core', () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      newPage: mockNewPage,
      close: mockClose,
    }),
  },
}))

vi.mock('@sparticuz/chromium', () => ({
  default: {
    args: ['--no-sandbox'],
    executablePath: vi.fn().mockResolvedValue('/usr/bin/chromium'),
  },
}))

// Story 21.12: force the @sparticuz path in tests regardless of host OS.
delete process.env.PUPPETEER_EXECUTABLE_PATH

describe('generatePdf', () => {
  it('renders HTML and returns a PDF buffer', async () => {
    const { generatePdf } = await import('@/lib/documents/tiptap-to-pdf')

    const result = await generatePdf('<p>Hello</p>', {
      title: 'Test Doc',
      version: 1,
      status: 'DRAFT',
      workspaceName: 'Test AB',
    })

    expect(result).toBeInstanceOf(Buffer)
    expect(mockSetContent).toHaveBeenCalledWith(
      expect.stringContaining('Test Doc'),
      expect.objectContaining({ waitUntil: 'networkidle0' })
    )
    expect(mockPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'A4',
        margin: { top: '2cm', bottom: '2cm', left: '2cm', right: '2cm' },
      })
    )
  })

  it('includes metadata in the HTML', async () => {
    const { generatePdf } = await import('@/lib/documents/tiptap-to-pdf')

    await generatePdf('<p>Content</p>', {
      title: 'Policy ABC',
      documentNumber: 'POL-001',
      version: 3,
      status: 'APPROVED',
      approvedAt: new Date('2026-01-15'),
      workspaceName: 'Company AB',
    })

    const htmlArg = mockSetContent.mock.calls.at(-1)?.[0] as string
    expect(htmlArg).toContain('Policy ABC')
    expect(htmlArg).toContain('POL-001')
    expect(htmlArg).toContain('v3')
    expect(htmlArg).toContain('APPROVED')
    expect(htmlArg).toContain('Company AB')
    expect(htmlArg).toContain('Godkänd')
  })

  // 19.8 QA: wide (agent-authored) tables must fit the page and wrap, not
  // overflow past the margin — assert the print CSS forces fixed layout + wrap.
  it('emits fixed-layout + wrapping table CSS so wide tables fit the page', async () => {
    const { generatePdf } = await import('@/lib/documents/tiptap-to-pdf')

    await generatePdf('<table><tr><td>x</td></tr></table>', {
      title: 'T',
      version: 1,
      status: 'DRAFT',
      approvedAt: null,
      workspaceName: 'W',
    })

    const htmlArg = mockSetContent.mock.calls.at(-1)?.[0] as string
    expect(htmlArg).toContain('table-layout: fixed')
    expect(htmlArg).toContain('word-break: break-word')
  })

  it('closes browser in finally block', async () => {
    const { generatePdf } = await import('@/lib/documents/tiptap-to-pdf')

    await generatePdf('<p>Test</p>', {
      title: 'Test',
      version: 1,
      status: 'DRAFT',
      workspaceName: 'Test',
    })

    expect(mockClose).toHaveBeenCalled()
  })

  it('closes browser even on error', async () => {
    mockPdf.mockRejectedValueOnce(new Error('PDF failed'))

    const { generatePdf } = await import('@/lib/documents/tiptap-to-pdf')

    await expect(
      generatePdf('<p>Test</p>', {
        title: 'Test',
        version: 1,
        status: 'DRAFT',
        workspaceName: 'Test',
      })
    ).rejects.toThrow('PDF failed')

    expect(mockClose).toHaveBeenCalled()
  })
})
