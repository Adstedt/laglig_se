import { describe, it, expect } from 'vitest'
import { htmlToTiptapJson } from '@/lib/documents/html-to-tiptap-json'

describe('htmlToTiptapJson', () => {
  it('returns empty doc for empty input', () => {
    const result = htmlToTiptapJson('')
    expect(result).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
  })

  it('returns empty doc for whitespace-only input', () => {
    const result = htmlToTiptapJson('   ')
    expect(result).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
  })

  it('converts paragraphs', () => {
    const result = htmlToTiptapJson('<p>Hello world</p>')
    expect(result.content).toHaveLength(1)
    expect(result.content[0]!.type).toBe('paragraph')
    expect(result.content[0]!.content![0]!.text).toBe('Hello world')
  })

  it('converts headings h1-h3', () => {
    const result = htmlToTiptapJson(
      '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>'
    )
    expect(result.content).toHaveLength(3)
    expect(result.content[0]!.type).toBe('heading')
    expect(result.content[0]!.attrs!.level).toBe(1)
    expect(result.content[1]!.attrs!.level).toBe(2)
    expect(result.content[2]!.attrs!.level).toBe(3)
  })

  it('clamps h4-h6 to h3', () => {
    const result = htmlToTiptapJson('<h4>H4</h4><h5>H5</h5><h6>H6</h6>')
    expect(result.content).toHaveLength(3)
    for (const node of result.content) {
      expect(node.attrs!.level).toBe(3)
    }
  })

  it('converts bold marks', () => {
    const result = htmlToTiptapJson('<p><strong>bold</strong></p>')
    const textNode = result.content[0]!.content![0]!
    expect(textNode.text).toBe('bold')
    expect(textNode.marks).toEqual([{ type: 'bold' }])
  })

  it('converts bold marks via <b> tag', () => {
    const result = htmlToTiptapJson('<p><b>bold</b></p>')
    const textNode = result.content[0]!.content![0]!
    expect(textNode.text).toBe('bold')
    expect(textNode.marks).toEqual([{ type: 'bold' }])
  })

  it('converts italic marks', () => {
    const result = htmlToTiptapJson('<p><em>italic</em></p>')
    const textNode = result.content[0]!.content![0]!
    expect(textNode.marks).toEqual([{ type: 'italic' }])
  })

  it('converts italic marks via <i> tag', () => {
    const result = htmlToTiptapJson('<p><i>italic</i></p>')
    const textNode = result.content[0]!.content![0]!
    expect(textNode.marks).toEqual([{ type: 'italic' }])
  })

  it('converts underline marks', () => {
    const result = htmlToTiptapJson('<p><u>underlined</u></p>')
    const textNode = result.content[0]!.content![0]!
    expect(textNode.marks).toEqual([{ type: 'underline' }])
  })

  it('handles nested marks (bold + italic)', () => {
    const result = htmlToTiptapJson(
      '<p><strong><em>bold italic</em></strong></p>'
    )
    const textNode = result.content[0]!.content![0]!
    expect(textNode.text).toBe('bold italic')
    expect(textNode.marks).toContainEqual({ type: 'bold' })
    expect(textNode.marks).toContainEqual({ type: 'italic' })
  })

  it('converts links', () => {
    const result = htmlToTiptapJson(
      '<p><a href="https://example.com">link</a></p>'
    )
    const textNode = result.content[0]!.content![0]!
    expect(textNode.text).toBe('link')
    expect(textNode.marks).toContainEqual({
      type: 'link',
      attrs: { href: 'https://example.com' },
    })
  })

  it('converts bullet lists', () => {
    const result = htmlToTiptapJson('<ul><li>Item 1</li><li>Item 2</li></ul>')
    expect(result.content[0]!.type).toBe('bulletList')
    expect(result.content[0]!.content).toHaveLength(2)
    expect(result.content[0]!.content![0]!.type).toBe('listItem')
  })

  it('converts ordered lists', () => {
    const result = htmlToTiptapJson('<ol><li>First</li><li>Second</li></ol>')
    expect(result.content[0]!.type).toBe('orderedList')
    expect(result.content[0]!.content).toHaveLength(2)
  })

  it('converts tables', () => {
    const html = '<table><tr><th>Header</th></tr><tr><td>Cell</td></tr></table>'
    const result = htmlToTiptapJson(html)
    expect(result.content[0]!.type).toBe('table')
    const rows = result.content[0]!.content!
    expect(rows).toHaveLength(2)
    expect(rows[0]!.type).toBe('tableRow')
    expect(rows[0]!.content![0]!.type).toBe('tableHeader')
    expect(rows[1]!.content![0]!.type).toBe('tableCell')
  })

  it('converts images', () => {
    const result = htmlToTiptapJson('<p><img src="https://img.test/a.png"></p>')
    const imgNode = result.content[0]!.content![0]!
    expect(imgNode.type).toBe('image')
    expect(imgNode.attrs!.src).toBe('https://img.test/a.png')
  })

  it('handles Swedish characters (å, ä, ö)', () => {
    const result = htmlToTiptapJson(
      '<p>Årsredovisning för företag med ärenden och ölkalas</p>'
    )
    expect(result.content[0]!.content![0]!.text).toBe(
      'Årsredovisning för företag med ärenden och ölkalas'
    )
  })

  it('converts horizontal rules', () => {
    const result = htmlToTiptapJson('<p>Before</p><hr><p>After</p>')
    expect(result.content).toHaveLength(3)
    expect(result.content[1]!.type).toBe('horizontalRule')
  })
})
