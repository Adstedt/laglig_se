import { describe, it, expect, vi } from 'vitest'

// Mock mammoth
vi.mock('mammoth', () => ({
  default: {
    convertToHtml: vi.fn().mockResolvedValue({
      value: '<h1>Title</h1><p>Content with <strong>bold</strong></p>',
      messages: [{ message: 'Some warning' }],
    }),
  },
}))

// Mock storage client
vi.mock('@/lib/supabase/storage', () => ({
  getStorageClient: vi.fn(() => ({
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://storage.test/image.png' },
        }),
      }),
    },
  })),
}))

describe('convertDocxToHtml', () => {
  it('converts buffer to HTML using mammoth', async () => {
    const { convertDocxToHtml } = await import('@/lib/documents/docx-to-tiptap')
    const buffer = Buffer.from('fake docx content')
    const result = await convertDocxToHtml(buffer)

    expect(result.html).toContain('<h1>Title</h1>')
    expect(result.messages).toEqual(['Some warning'])
  })

  it('clamps h4-h6 tags to h3 in output HTML', async () => {
    const mammoth = (await import('mammoth')).default
    vi.mocked(mammoth.convertToHtml).mockResolvedValueOnce({
      value: '<h4>H4</h4><h5>H5</h5><h6>H6</h6>',
      messages: [],
    } as never)

    const { convertDocxToHtml } = await import('@/lib/documents/docx-to-tiptap')
    const result = await convertDocxToHtml(Buffer.from('fake'))

    expect(result.html).not.toContain('<h4')
    expect(result.html).not.toContain('<h5')
    expect(result.html).not.toContain('<h6')
    expect(result.html).toContain('<h3')
  })
})

describe('convertDocxToTiptap', () => {
  it('returns full conversion result with json, html, extractedText', async () => {
    const { convertDocxToTiptap } = await import(
      '@/lib/documents/docx-to-tiptap'
    )
    const result = await convertDocxToTiptap(Buffer.from('fake'))

    expect(result.json.type).toBe('doc')
    expect(result.json.content.length).toBeGreaterThan(0)
    expect(result.html).toContain('Title')
    expect(result.extractedText).toContain('Title')
    expect(result.extractedText).toContain('Content')
    expect(result.messages).toEqual(['Some warning'])
  })

  it('strips HTML tags for extractedText', async () => {
    const { convertDocxToTiptap } = await import(
      '@/lib/documents/docx-to-tiptap'
    )
    const result = await convertDocxToTiptap(Buffer.from('fake'))

    expect(result.extractedText).not.toContain('<')
    expect(result.extractedText).not.toContain('>')
  })
})

describe('extractAndUploadImages', () => {
  it('replaces base64 images with storage URLs', async () => {
    const { extractAndUploadImages } = await import(
      '@/lib/documents/docx-to-tiptap'
    )
    const html = '<p><img src="data:image/png;base64,iVBORw0KGgo="></p>'
    const result = await extractAndUploadImages(html, 'ws-1', 'doc-1')

    expect(result).toContain('https://storage.test/image.png')
    expect(result).not.toContain('data:image/png;base64')
  })

  it('returns unchanged HTML when no base64 images', async () => {
    const { extractAndUploadImages } = await import(
      '@/lib/documents/docx-to-tiptap'
    )
    const html = '<p>No images here</p>'
    const result = await extractAndUploadImages(html, 'ws-1', 'doc-1')

    expect(result).toBe(html)
  })
})
