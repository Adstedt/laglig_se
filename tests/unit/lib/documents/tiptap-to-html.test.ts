import { describe, it, expect } from 'vitest'
import { tiptapDocToHtml } from '@/lib/documents/tiptap-to-html'

describe('tiptapDocToHtml', () => {
  it('returns empty string for empty / malformed input', () => {
    expect(tiptapDocToHtml(undefined)).toBe('')
    expect(tiptapDocToHtml(null)).toBe('')
    expect(tiptapDocToHtml({})).toBe('')
    expect(tiptapDocToHtml({ type: 'doc' })).toBe('')
  })

  it('renders paragraphs and text', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
      ],
    }
    expect(tiptapDocToHtml(doc)).toBe('<p>Hello</p>')
  })

  it('renders headings at the correct level (clamped 1-6)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Syfte' }],
        },
        {
          type: 'heading',
          attrs: { level: 9 },
          content: [{ type: 'text', text: 'Bad' }],
        },
      ],
    }
    expect(tiptapDocToHtml(doc)).toBe('<h2>Syfte</h2><h6>Bad</h6>')
  })

  it('applies bold / italic / underline / strike marks', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'B' },
            { type: 'text', marks: [{ type: 'italic' }], text: 'I' },
            { type: 'text', marks: [{ type: 'underline' }], text: 'U' },
            { type: 'text', marks: [{ type: 'strike' }], text: 'S' },
          ],
        },
      ],
    }
    expect(tiptapDocToHtml(doc)).toBe(
      '<p><strong>B</strong><em>I</em><u>U</u><s>S</s></p>'
    )
  })

  it('escapes HTML in text content', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '<script>alert(1)</script>' }],
        },
      ],
    }
    expect(tiptapDocToHtml(doc)).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>'
    )
  })

  it('drops link marks with dangerous protocols (preserves visible text)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
              text: 'click',
            },
          ],
        },
      ],
    }
    expect(tiptapDocToHtml(doc)).toBe('<p>click</p>')
  })

  it('renders safe link marks with rel=noopener', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'link', attrs: { href: 'https://laglig.se' } }],
              text: 'site',
            },
          ],
        },
      ],
    }
    expect(tiptapDocToHtml(doc)).toBe(
      '<p><a href="https://laglig.se" rel="noopener noreferrer">site</a></p>'
    )
  })

  it('renders bullet and ordered lists with list items', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'A' }] },
              ],
            },
          ],
        },
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'B' }] },
              ],
            },
          ],
        },
      ],
    }
    expect(tiptapDocToHtml(doc)).toBe(
      '<ul><li><p>A</p></li></ul><ol><li><p>B</p></li></ol>'
    )
  })

  it('renders text-align style only when not the default', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'L' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [{ type: 'text', text: 'C' }],
        },
      ],
    }
    expect(tiptapDocToHtml(doc)).toBe(
      '<p>L</p><p style="text-align:center">C</p>'
    )
  })

  it('renders tables with rows / headers / cells', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'H' }],
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'C' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }
    expect(tiptapDocToHtml(doc)).toBe(
      '<table><tbody><tr><th><p>H</p></th></tr><tr><td><p>C</p></td></tr></tbody></table>'
    )
  })

  it('renders block-level images with escaped src + alt; drops dangerous src', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: 'https://x/y.png', alt: 'A "img"' } },
        { type: 'image', attrs: { src: 'javascript:bad' } },
      ],
    }
    expect(tiptapDocToHtml(doc)).toBe(
      '<img src="https://x/y.png" alt="A &quot;img&quot;">'
    )
  })

  it('WALKER-001: renders INLINE images inside a paragraph (Image.configure({inline:true}))', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Före ' },
            {
              type: 'image',
              attrs: { src: 'https://x/y.png', alt: 'A "img"' },
            },
            { type: 'text', text: ' efter.' },
          ],
        },
      ],
    }
    expect(tiptapDocToHtml(doc)).toBe(
      '<p>Före <img src="https://x/y.png" alt="A &quot;img&quot;"> efter.</p>'
    )
  })

  it('WALKER-001: inline image with dangerous src is dropped, surrounding text preserved', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Före ' },
            { type: 'image', attrs: { src: 'javascript:bad' } },
            { type: 'text', text: ' efter' },
          ],
        },
      ],
    }
    // Image is dropped silently; the surrounding text nodes keep their own
    // whitespace (the walker doesn't insert spaces around dropped nodes).
    expect(tiptapDocToHtml(doc)).toBe('<p>Före  efter</p>')
  })

  it('drops unknown wrapper but keeps nested content', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'someExperimentalBlock',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'inside' }] },
          ],
        },
      ],
    }
    expect(tiptapDocToHtml(doc)).toBe('<p>inside</p>')
  })

  it('renders hard breaks inside paragraphs', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a' },
            { type: 'hardBreak' },
            { type: 'text', text: 'b' },
          ],
        },
      ],
    }
    expect(tiptapDocToHtml(doc)).toBe('<p>a<br>b</p>')
  })
})
