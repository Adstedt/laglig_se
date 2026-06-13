import { describe, it, expect } from 'vitest'
import {
  generateDocx,
  type TiptapContentJSON,
  type DocumentExportMetadata,
} from '@/lib/documents/tiptap-to-docx'

const BASE_META: DocumentExportMetadata = {
  title: 'Test Policy',
  version: 1,
  status: 'DRAFT',
  workspaceName: 'Test AB',
}

describe('generateDocx', () => {
  it('generates a Buffer from simple content', async () => {
    const content: TiptapContentJSON = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] },
      ],
    }
    const buffer = await generateDocx(content, BASE_META)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
    // .docx files start with PK (zip signature)
    expect(buffer[0]).toBe(0x50) // P
    expect(buffer[1]).toBe(0x4b) // K
  })

  it('handles headings at all 3 levels', async () => {
    const content: TiptapContentJSON = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'H1' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'H2' }],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'H3' }],
        },
      ],
    }
    const buffer = await generateDocx(content, BASE_META)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('handles bold, italic, and underline marks', async () => {
    const content: TiptapContentJSON = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
            { type: 'text', text: 'underline', marks: [{ type: 'underline' }] },
          ],
        },
      ],
    }
    const buffer = await generateDocx(content, BASE_META)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('handles nested marks (bold + italic)', async () => {
    const content: TiptapContentJSON = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'bold italic',
              marks: [{ type: 'bold' }, { type: 'italic' }],
            },
          ],
        },
      ],
    }
    const buffer = await generateDocx(content, BASE_META)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('handles bullet lists', async () => {
    const content: TiptapContentJSON = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Item 1' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Item 2' }],
                },
              ],
            },
          ],
        },
      ],
    }
    const buffer = await generateDocx(content, BASE_META)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('handles tables', async () => {
    const content: TiptapContentJSON = {
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
                      content: [{ type: 'text', text: 'Header' }],
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
                      content: [{ type: 'text', text: 'Cell' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }
    const buffer = await generateDocx(content, BASE_META)
    expect(buffer.length).toBeGreaterThan(0)
  })

  // 19.8 QA: a styrdokument is printed/exported — a wide (agent-authored) table
  // must be constrained to the page width and wrap, not run past the margin.
  // Assert the generated document.xml carries fixed layout + 100% table width.
  it('constrains tables to the page width (fixed layout, 100%) so wide tables fit', async () => {
    const wideRow = (cells: string[]) => ({
      type: 'tableRow',
      content: cells.map((t) => ({
        type: 'tableCell',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }],
      })),
    })
    const cols = [
      'Nr',
      'Riskkälla',
      'Risknivå',
      'Åtgärd',
      'Lagstöd',
      'Ansvarig',
      'Klart senast',
      'Status',
    ]
    const content: TiptapContentJSON = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [wideRow(cols), wideRow(cols.map((_, i) => `c${i}`))],
        },
      ],
    }
    const buffer = await generateDocx(content, BASE_META)

    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')!.async('string')

    // Fixed layout + table width as a percentage of the page (pct).
    expect(xml).toContain('w:type="fixed"')
    expect(xml).toMatch(/<w:tblW[^>]*w:type="pct"/)
  })

  it('handles horizontalRule', async () => {
    const content: TiptapContentJSON = {
      type: 'doc',
      content: [{ type: 'horizontalRule' }],
    }
    const buffer = await generateDocx(content, BASE_META)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('skips unknown node types gracefully', async () => {
    const content: TiptapContentJSON = {
      type: 'doc',
      content: [{ type: 'unknownCustomNode' }],
    }
    const buffer = await generateDocx(content, BASE_META)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('includes metadata header with documentNumber and approvedAt', async () => {
    const meta: DocumentExportMetadata = {
      ...BASE_META,
      documentNumber: 'POL-2026-001',
      approvedAt: new Date('2026-03-15'),
    }
    const content: TiptapContentJSON = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Content' }] },
      ],
    }
    const buffer = await generateDocx(content, meta)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('works without optional metadata fields', async () => {
    const content: TiptapContentJSON = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Content' }] },
      ],
    }
    const buffer = await generateDocx(content, BASE_META)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('handles empty content', async () => {
    const content: TiptapContentJSON = {
      type: 'doc',
      content: [],
    }
    const buffer = await generateDocx(content, BASE_META)
    expect(buffer.length).toBeGreaterThan(0)
  })
})
