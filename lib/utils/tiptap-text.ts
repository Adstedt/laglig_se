/**
 * Story 17.20: paragraph-preserving plaintext ↔ Tiptap-paragraph-nodes helpers.
 *
 * Used by the UPDATE_DOCUMENT approval renderer to seed an inline-edit textarea
 * from a proposal's `newSectionContentJson` and re-wrap the edited text back into
 * `TiptapNode[]` (a flat array of block nodes, NOT a `{type:'doc'}` wrapper).
 *
 * WHY a new pair (and not the existing flatteners): both the renderer's local
 * `plainText` and the tool's `tiptapToPlainText` join nodes with a single SPACE,
 * which collapses paragraph boundaries. Seeding a textarea from a space-joined
 * string and re-wrapping it would merge a multi-paragraph body into one
 * paragraph. These helpers join block nodes with a blank line (`\n\n`) so the
 * round-trip is stable for paragraphs-only content.
 *
 * Client-safe: no server-only imports — the renderer is a `'use client'`
 * component.
 */

interface TiptapNode {
  type?: string
  text?: string
  content?: TiptapNode[]
}

/**
 * Flatten a single node to text. Inline runs inside a paragraph concatenate with
 * NO separator (they're adjacent within one line); block-level children (list
 * items, nested paragraphs, table cells) join with a newline so sentences don't
 * run together when the read-only diff preview flattens rich content (AC 6 —
 * rich proposals must read as before). Paragraphs-only round-trip is unaffected:
 * a paragraph's children are all text runs → joined with ''.
 */
function nodeText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as TiptapNode
  if (typeof n.text === 'string') return n.text
  if (Array.isArray(n.content)) {
    const childrenAreInline = n.content.every(
      (c) => c != null && typeof (c as TiptapNode).text === 'string'
    )
    return n.content.map(nodeText).join(childrenAreInline ? '' : '\n')
  }
  return ''
}

/**
 * Flatten a block-node array to plain text, preserving paragraph boundaries by
 * joining top-level blocks with a blank line (`\n\n`). Stable seed for the
 * inline-edit textarea.
 */
export function tiptapParagraphsToText(nodes: unknown): string {
  if (!Array.isArray(nodes)) return ''
  return nodes.map(nodeText).join('\n\n')
}

/**
 * Re-wrap edited plaintext into paragraph block nodes — one node per
 * blank-line-separated block. Empty blocks are dropped. Round-trips
 * paragraphs-only input from {@link tiptapParagraphsToText} idempotently.
 */
export function textToTiptapParagraphs(text: string): TiptapNode[] {
  if (typeof text !== 'string') return []
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: block }],
    }))
}

/**
 * True when `nodes` is a non-empty array of paragraph-only block nodes — the
 * gate for offering the lossless plaintext textarea. Lists / tables / headings /
 * other block types return false (rich content must not be silently flattened).
 */
export function isParagraphsOnly(nodes: unknown): boolean {
  return (
    Array.isArray(nodes) &&
    nodes.length > 0 &&
    nodes.every(
      (n) =>
        n != null &&
        typeof n === 'object' &&
        (n as TiptapNode).type === 'paragraph'
    )
  )
}
