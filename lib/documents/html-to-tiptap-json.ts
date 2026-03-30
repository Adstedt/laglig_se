import * as cheerio from 'cheerio'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TiptapMark {
  type: string
  attrs?: Record<string, unknown>
}

interface TiptapNode {
  type: string
  attrs?: Record<string, unknown> | undefined
  content?: TiptapNode[] | undefined
  marks?: TiptapMark[] | undefined
  text?: string | undefined
}

export interface TiptapDocumentJSON {
  type: 'doc'
  content: TiptapNode[]
}

const EMPTY_DOC: TiptapDocumentJSON = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

// ---------------------------------------------------------------------------
// Element → Node mapping
// ---------------------------------------------------------------------------

type CheerioEl = ReturnType<cheerio.CheerioAPI>

function extractInlineContent(
  el: CheerioEl,
  $: cheerio.CheerioAPI,
  parentMarks: TiptapMark[] = []
): TiptapNode[] {
  const nodes: TiptapNode[] = []

  el.contents().each((_, child) => {
    if (child.type === 'text') {
      const text = $(child).text()
      if (text) {
        const node: TiptapNode = { type: 'text', text }
        if (parentMarks.length > 0) {
          node.marks = [...parentMarks]
        }
        nodes.push(node)
      }
    } else if (child.type === 'tag') {
      const $child = $(child)
      const tag = child.tagName?.toLowerCase()

      if (tag === 'br') {
        nodes.push({ type: 'hardBreak' })
        return
      }

      if (tag === 'img') {
        nodes.push({
          type: 'image',
          attrs: { src: $child.attr('src') ?? '' },
        })
        return
      }

      // Inline formatting tags
      const newMarks = [...parentMarks]
      if (tag === 'strong' || tag === 'b') newMarks.push({ type: 'bold' })
      else if (tag === 'em' || tag === 'i') newMarks.push({ type: 'italic' })
      else if (tag === 'u') newMarks.push({ type: 'underline' })
      else if (tag === 'a') {
        newMarks.push({
          type: 'link',
          attrs: { href: $child.attr('href') ?? '' },
        })
      }

      const inlineNodes = extractInlineContent($child, $, newMarks)
      nodes.push(...inlineNodes)
    }
  })

  return nodes
}

function parseTableCell(
  el: CheerioEl,
  $: cheerio.CheerioAPI,
  isHeader: boolean
): TiptapNode {
  const content = extractInlineContent(el, $)
  return {
    type: isHeader ? 'tableHeader' : 'tableCell',
    content: [
      {
        type: 'paragraph',
        content: content.length > 0 ? content : undefined,
      },
    ],
  }
}

function parseTableRow(el: CheerioEl, $: cheerio.CheerioAPI): TiptapNode {
  const cells: TiptapNode[] = []
  el.children('td, th').each((_, cell) => {
    const $cell = $(cell)
    const isHeader = cell.tagName?.toLowerCase() === 'th'
    cells.push(parseTableCell($cell, $, isHeader))
  })
  return { type: 'tableRow', content: cells }
}

function parseTable(el: CheerioEl, $: cheerio.CheerioAPI): TiptapNode {
  const rows: TiptapNode[] = []
  el.find('tr').each((_, row) => {
    rows.push(parseTableRow($(row), $))
  })
  return { type: 'table', content: rows }
}

function parseListItem(el: CheerioEl, $: cheerio.CheerioAPI): TiptapNode {
  const content: TiptapNode[] = []

  // Direct text content → paragraph
  const inlineContent = extractInlineContent(el, $)
  // Filter out nested list content (handled separately)
  const textContent = inlineContent.filter(
    (n) => n.type !== 'bulletList' && n.type !== 'orderedList'
  )
  if (textContent.length > 0) {
    content.push({ type: 'paragraph', content: textContent })
  }

  // Nested lists
  el.children('ul').each((_, nested) => {
    content.push(parseList($(nested), $, 'bulletList'))
  })
  el.children('ol').each((_, nested) => {
    content.push(parseList($(nested), $, 'orderedList'))
  })

  if (content.length === 0) {
    content.push({ type: 'paragraph' })
  }

  return { type: 'listItem', content }
}

function parseList(
  el: CheerioEl,
  $: cheerio.CheerioAPI,
  listType: 'bulletList' | 'orderedList'
): TiptapNode {
  const items: TiptapNode[] = []
  el.children('li').each((_, li) => {
    items.push(parseListItem($(li), $))
  })
  return { type: listType, content: items }
}

function clampHeadingLevel(level: number): number {
  if (level < 1) return 1
  if (level > 3) return 3
  return level
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Converts an HTML string (from mammoth output) to Tiptap-compatible JSON.
 */
export function htmlToTiptapJson(html: string): TiptapDocumentJSON {
  if (!html || !html.trim()) {
    return { ...EMPTY_DOC }
  }

  const $ = cheerio.load(html)
  const content: TiptapNode[] = []

  $('body')
    .children()
    .each((_, el) => {
      const $el = $(el)
      const tag = el.tagName?.toLowerCase()

      // Headings h1-h6
      const headingMatch = tag?.match(/^h([1-6])$/)
      if (headingMatch) {
        const level = clampHeadingLevel(parseInt(headingMatch[1]!, 10))
        const inlineContent = extractInlineContent($el, $)
        content.push({
          type: 'heading',
          attrs: { level },
          content: inlineContent.length > 0 ? inlineContent : undefined,
        })
        return
      }

      if (tag === 'p') {
        const inlineContent = extractInlineContent($el, $)
        content.push({
          type: 'paragraph',
          content: inlineContent.length > 0 ? inlineContent : undefined,
        })
        return
      }

      if (tag === 'ul') {
        content.push(parseList($el, $, 'bulletList'))
        return
      }

      if (tag === 'ol') {
        content.push(parseList($el, $, 'orderedList'))
        return
      }

      if (tag === 'table') {
        content.push(parseTable($el, $))
        return
      }

      if (tag === 'hr') {
        content.push({ type: 'horizontalRule' })
        return
      }

      if (tag === 'img') {
        content.push({
          type: 'image',
          attrs: { src: $el.attr('src') ?? '' },
        })
        return
      }

      // Fallback: treat as paragraph
      const inlineContent = extractInlineContent($el, $)
      if (inlineContent.length > 0) {
        content.push({ type: 'paragraph', content: inlineContent })
      }
    })

  if (content.length === 0) {
    return { ...EMPTY_DOC }
  }

  return { type: 'doc', content }
}
