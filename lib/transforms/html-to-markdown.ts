/**
 * Deterministic HTML to Markdown converter for legal documents
 * Story 2.29: Used to derive markdown_content from html_content
 *
 * This converter is optimized for Swedish legal document structure:
 * - Section headers (§)
 * - Chapter headers (kap.)
 * - Definition lists
 * - Transition provisions (Övergångsbestämmelser)
 * - Footnotes
 */

import * as cheerio from 'cheerio'

export interface HtmlToMarkdownOptions {
  /** Preserve line breaks within paragraphs */
  preserveLineBreaks?: boolean
  /** Include heading anchors */
  includeAnchors?: boolean
  /** Maximum heading level to use (1-6) */
  maxHeadingLevel?: number
}

const DEFAULT_OPTIONS: HtmlToMarkdownOptions = {
  preserveLineBreaks: false,
  includeAnchors: false,
  maxHeadingLevel: 6,
}

// Type helper for DOM nodes
interface DomNode {
  type: string
  data?: string
  tagName?: string
  childNodes?: DomNode[]
  attribs?: Record<string, string>
}

/**
 * Convert HTML content to Markdown
 * Deterministic: same input always produces same output
 */
export function htmlToMarkdown(
  html: string,
  options: HtmlToMarkdownOptions = {}
): string {
  if (!html || html.trim().length === 0) {
    return ''
  }

  const opts = { ...DEFAULT_OPTIONS, ...options }
  const $ = cheerio.load(html)

  // Remove script and style tags
  $('script, style, noscript').remove()

  // Process the body or root element
  const bodyEl = $('body')
  const rootEl = bodyEl.length > 0 ? bodyEl : $.root()
  const rawNode = (rootEl as ReturnType<typeof $>).get(0)
  if (!rawNode) return ''
  const firstNode = rawNode as unknown as DomNode

  const markdown = processNode($, firstNode, opts)

  // Clean up excessive whitespace
  return cleanMarkdown(markdown)
}

function processNode(
  $: cheerio.CheerioAPI,
  node: DomNode,
  opts: HtmlToMarkdownOptions,
  listDepth = 0
): string {
  if (node.type === 'text') {
    const text = node.data || ''
    // Collapse whitespace but preserve single spaces
    return text.replace(/\s+/g, ' ')
  }

  if (node.type !== 'tag') {
    return ''
  }

  const tagName = node.tagName?.toLowerCase() || ''
  const children = node.childNodes || []
  const className = node.attribs?.['class'] || ''

  // Process children
  const childContent = children
    .map((child) => processNode($, child, opts, listDepth))
    .join('')

  switch (tagName) {
    // Headings - use class-based hierarchy for legal documents
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      // Determine heading level based on semantic class
      let level: number
      if (className.includes('paragraph')) {
        // Section numbers like "1 §" -> ### (level 3)
        level = 3
      } else if (className.includes('group')) {
        // Group headers like "Jakten" -> ## (level 2)
        level = 2
      } else if (tagName === 'h1') {
        // Main title -> # (level 1)
        level = 1
      } else {
        // Default to tag's own level
        level = Math.min(parseInt(tagName.slice(1), 10), opts.maxHeadingLevel!)
      }
      const prefix = '#'.repeat(level)
      const id = node.attribs?.['id']
      const anchor = opts.includeAnchors && id ? ` {#${id}}` : ''
      return `\n\n${prefix} ${childContent.trim()}${anchor}\n\n`
    }

    // Paragraphs - skip if empty or just whitespace/nbsp
    case 'p': {
      const trimmed = childContent.trim()
      // Skip empty paragraphs or those with only non-breaking spaces
      if (!trimmed || /^[\s\u00A0]*$/.test(trimmed)) {
        return ''
      }
      return `\n\n${trimmed}\n\n`
    }

    // Line breaks
    case 'br':
      return opts.preserveLineBreaks ? '\n' : ' '

    // Horizontal rule
    case 'hr':
      return '\n\n---\n\n'

    // Bold/Strong
    case 'strong':
    case 'b':
      return `**${childContent.trim()}**`

    // Italic/Emphasis
    case 'em':
    case 'i':
      return `*${childContent.trim()}*`

    // Underline (convert to emphasis in Markdown)
    case 'u':
      return `_${childContent.trim()}_`

    // Code
    case 'code':
      return `\`${childContent}\``

    // Preformatted/Code blocks
    case 'pre': {
      const $el = $(node as never)
      const codeEl = $el.find('code').first()
      const codeContent = codeEl.length > 0 ? codeEl.text() : childContent
      return `\n\n\`\`\`\n${codeContent.trim()}\n\`\`\`\n\n`
    }

    // Links
    case 'a': {
      const href = node.attribs?.['href'] || ''
      const title = node.attribs?.['title']
      if (!href) {
        return childContent
      }
      const titlePart = title ? ` "${title}"` : ''
      return `[${childContent.trim()}](${href}${titlePart})`
    }

    // Images
    case 'img': {
      const src = node.attribs?.['src'] || ''
      const alt = node.attribs?.['alt'] || ''
      const title = node.attribs?.['title']
      const titlePart = title ? ` "${title}"` : ''
      return `![${alt}](${src}${titlePart})`
    }

    // Unordered lists
    case 'ul':
      return `\n\n${processListItems($, node, opts, listDepth, 'ul')}\n\n`

    // Ordered lists
    case 'ol':
      return `\n\n${processListItems($, node, opts, listDepth, 'ol')}\n\n`

    // List items (handled by processListItems)
    case 'li':
      return childContent

    // Definition lists (important for legal documents)
    case 'dl': {
      // Check if this is a footnote definition
      if (className.includes('footnote-content')) {
        return `\n\n${processFootnoteDefinition($, node, opts)}\n\n`
      }
      return `\n\n${processDefinitionList($, node, opts)}\n\n`
    }

    case 'dt':
      return `**${childContent.trim()}**`

    case 'dd':
      return `: ${childContent.trim()}`

    // Blockquote
    case 'blockquote': {
      const quoted = childContent
        .trim()
        .split('\n')
        .map((line: string) => `> ${line}`)
        .join('\n')
      return `\n\n${quoted}\n\n`
    }

    // Tables
    case 'table':
      return `\n\n${processTable($, node, opts)}\n\n`

    // Sections and articles (semantic containers)
    case 'section':
    case 'article':
    case 'main':
    case 'header':
    case 'footer':
    case 'nav':
    case 'aside':
      return `\n\n${childContent}\n\n`

    // Divs and spans (pass through)
    case 'div':
      return `\n${childContent}\n`

    case 'span':
      return childContent

    // Sup/Sub - special handling for footnotes
    case 'sup': {
      // Check if this is a footnote reference
      if (className.includes('footnote')) {
        // Extract footnote number from content like "1) " -> "[^1]"
        const match = childContent.match(/(\d+)\)?/)
        if (match) {
          return `[^${match[1]}]`
        }
      }
      // Regular superscript
      return `^${childContent.trim()}^`
    }

    case 'sub':
      return `~${childContent}~`

    // Abbreviations
    case 'abbr': {
      const title = node.attribs?.['title']
      return title ? `${childContent} (${title})` : childContent
    }

    // Default: just return child content
    default:
      return childContent
  }
}

function processListItems(
  $: cheerio.CheerioAPI,
  listNode: DomNode,
  opts: HtmlToMarkdownOptions,
  depth: number,
  listType: 'ul' | 'ol'
): string {
  const items: string[] = []
  const indent = '  '.repeat(depth)
  let itemIndex = 1

  const $list = $(listNode as never)
  $list.children('li').each((_: number, liEl: unknown) => {
    const content = processNode($, liEl as DomNode, opts, depth + 1).trim()
    const prefix = listType === 'ol' ? `${itemIndex}.` : '-'
    items.push(`${indent}${prefix} ${content}`)
    itemIndex++
  })

  return items.join('\n')
}

function processDefinitionList(
  $: cheerio.CheerioAPI,
  dlNode: DomNode,
  opts: HtmlToMarkdownOptions
): string {
  const items: string[] = []
  let currentTerm = ''

  const $dl = $(dlNode as never)
  $dl.children().each((_: number, child: unknown) => {
    const childNode = child as DomNode
    const tagName = childNode.tagName?.toLowerCase()
    const content = processNode($, childNode, opts).trim()

    if (tagName === 'dt') {
      currentTerm = content
    } else if (tagName === 'dd') {
      // Format as "**term**: definition"
      if (currentTerm) {
        items.push(`${currentTerm}: ${content}`)
      } else {
        items.push(content)
      }
    }
  })

  return items.join('\n\n')
}

/**
 * Process footnote definition lists
 * Converts <dl class="footnote-content"> to markdown footnote syntax
 */
function processFootnoteDefinition(
  $: cheerio.CheerioAPI,
  dlNode: DomNode,
  opts: HtmlToMarkdownOptions
): string {
  const $dl = $(dlNode as never)
  let footnoteNum = ''
  let footnoteText = ''

  $dl.children().each((_: number, child: unknown) => {
    const childNode = child as DomNode
    const tagName = childNode.tagName?.toLowerCase()
    const content = processNode($, childNode, opts).trim()

    if (tagName === 'dt') {
      // Extract number from "1) " or "1)"
      const match = content.match(/(\d+)\)?/)
      if (match?.[1]) {
        footnoteNum = match[1]
      }
    } else if (tagName === 'dd') {
      // Remove leading colon if present (from nested p.text processing)
      footnoteText = content.replace(/^:\s*/, '')
    }
  })

  if (footnoteNum && footnoteText) {
    return `[^${footnoteNum}]: ${footnoteText}`
  }
  return ''
}

function processTable(
  $: cheerio.CheerioAPI,
  tableNode: DomNode,
  opts: HtmlToMarkdownOptions
): string {
  const rows: string[][] = []
  let headerRow: string[] | null = null

  const $table = $(tableNode as never)

  // Process thead
  $table
    .find('thead tr')
    .first()
    .each((_: number, tr: unknown) => {
      const cells: string[] = []
      $(tr as never)
        .find('th, td')
        .each((__: number, cell: unknown) => {
          cells.push(processNode($, cell as DomNode, opts).trim())
        })
      if (cells.length > 0) {
        headerRow = cells
      }
    })

  // Process tbody
  $table.find('tbody tr, tr').each((_: number, tr: unknown) => {
    // Skip if this is in thead
    if ($(tr as never).parents('thead').length > 0) return

    const cells: string[] = []
    $(tr as never)
      .find('td, th')
      .each((__: number, cell: unknown) => {
        cells.push(processNode($, cell as DomNode, opts).trim())
      })
    if (cells.length > 0) {
      rows.push(cells)
    }
  })

  if (rows.length === 0 && !headerRow) {
    return ''
  }

  // Check if this is a "grouped" table (has empty first cells indicating row spans)
  // This is common in legal documents for categorized lists
  const hasGroupedRows = rows.some(
    (row, idx) => idx > 0 && row.length >= 2 && row[0] === ''
  )

  if (hasGroupedRows && rows.length > 0 && (rows[0]?.length ?? 0) >= 3) {
    // Convert to nested list format for better readability
    return convertGroupedTableToLists(rows)
  }

  // Use first row as header if no thead
  if (!headerRow && rows.length > 0) {
    headerRow = rows.shift()!
  }

  const lines: string[] = []

  // Header row
  if (headerRow) {
    lines.push(`| ${headerRow.join(' | ')} |`)
    lines.push(`| ${headerRow.map(() => '---').join(' | ')} |`)
  }

  // Data rows
  for (const row of rows) {
    lines.push(`| ${row.join(' | ')} |`)
  }

  return lines.join('\n')
}

/**
 * Convert a grouped table (with row spans indicated by empty first cells)
 * into a nested list format that's more readable for LLMs
 */
function convertGroupedTableToLists(rows: string[][]): string {
  const lines: string[] = []
  let currentGroup = ''

  for (const row of rows) {
    if (row.length < 2) continue

    const firstCell = row[0]
    const remainingCells = row.slice(1)

    if (firstCell && firstCell.trim() !== '') {
      // New group - output as bold header
      currentGroup = firstCell.trim()
      lines.push(`\n**${currentGroup}:**`)
    }

    // Format remaining cells as "key: value" or just value
    if (remainingCells.length >= 2) {
      const key = remainingCells[0]?.trim() ?? ''
      const value = remainingCells.slice(1).join(' – ').trim()
      if (key && value) {
        lines.push(`- ${key}: ${value}`)
      } else if (key) {
        lines.push(`- ${key}`)
      }
    } else if (remainingCells.length === 1 && remainingCells[0]?.trim()) {
      lines.push(`- ${remainingCells[0]?.trim()}`)
    }
  }

  return lines.join('\n')
}

/**
 * Clean up markdown output
 */
function cleanMarkdown(markdown: string): string {
  return (
    markdown
      // Remove lines that are only whitespace/nbsp
      .replace(/^\s*[\u00A0\s]+\s*$/gm, '')
      // Convert bold section numbers to headings (Riksdagen HTML pattern)
      // Matches **1 §**, **2 a §**, **12 §** etc.
      .replace(/\*\*(\d+\s*[a-z]?\s*§)\*\*/gi, '\n\n### $1\n\n')
      // Collapse multiple blank lines to single blank line
      .replace(/\n{3,}/g, '\n\n')
      // Remove blank lines after headings
      .replace(/(^#{1,6}\s+.+)\n{2,}/gm, '$1\n\n')
      // Remove leading/trailing whitespace
      .trim()
      // Ensure single newline at end
      .concat('\n')
  )
}

/**
 * Extract plain text from HTML (for search indexing)
 * Removes all markup, keeps only text content
 */
export function htmlToPlainText(html: string): string {
  if (!html || html.trim().length === 0) {
    return ''
  }

  const $ = cheerio.load(html)

  // Remove script and style tags
  $('script, style, noscript').remove()

  // Get text content
  const text = $.text()

  // Clean up whitespace
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim()
}
