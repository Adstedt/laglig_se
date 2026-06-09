/**
 * Story 17.11: server-friendly Tiptap-JSON → HTML walker for the
 * `update_document` approval dispatch.
 *
 * Why not `generateHTML` from `@tiptap/core`? That export only works in the
 * browser — server-side needs `@tiptap/html`, which is not installed. Rather
 * than pull in a new dep for a single dispatch path, this module walks the
 * Tiptap JSON tree directly (same pattern as `lib/documents/tiptap-to-docx.ts`).
 *
 * Coverage matches the editor's StarterKit + table + image + text-align +
 * underline + link + color + highlight extensions (`document-editor.tsx`).
 * Unknown nodes are skipped silently — never throw, since the agent
 * occasionally emits experimental shapes and we don't want a render failure
 * to break the approval flow.
 *
 * Security: all text and attribute values are HTML-escaped. Link `href`
 * attributes are filtered through the same dangerous-protocol denylist used
 * by 14.24's `sanitizeLinkHrefs`.
 */

import type { TiptapNode } from './update-document-section'

const DANGEROUS_HREF = /^\s*(javascript|data|vbscript):/i

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s)
}

function clampHeadingLevel(level: unknown): 1 | 2 | 3 | 4 | 5 | 6 {
  const n = typeof level === 'number' ? level : 1
  if (n < 1) return 1
  if (n > 6) return 6
  return n as 1 | 2 | 3 | 4 | 5 | 6
}

interface Mark {
  type?: string
  attrs?: Record<string, unknown>
}

function renderTextWithMarks(node: TiptapNode): string {
  const text = typeof node.text === 'string' ? escapeHtml(node.text) : ''
  if (!text) return ''
  const marks = Array.isArray(node.marks) ? (node.marks as Mark[]) : []
  let html = text
  for (const mark of marks) {
    const t = mark?.type
    if (t === 'bold' || t === 'strong') html = `<strong>${html}</strong>`
    else if (t === 'italic' || t === 'em') html = `<em>${html}</em>`
    else if (t === 'underline') html = `<u>${html}</u>`
    else if (t === 'strike') html = `<s>${html}</s>`
    else if (t === 'code') html = `<code>${html}</code>`
    else if (t === 'highlight') html = `<mark>${html}</mark>`
    else if (t === 'link') {
      const href = String(mark.attrs?.href ?? '')
      if (!DANGEROUS_HREF.test(href)) {
        html = `<a href="${escapeAttr(href)}" rel="noopener noreferrer">${html}</a>`
      }
    }
  }
  return html
}

function renderImage(node: TiptapNode): string {
  const src = String(node.attrs?.src ?? '')
  if (!src || DANGEROUS_HREF.test(src)) return ''
  const alt = String(node.attrs?.alt ?? '')
  return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}">`
}

function renderInline(nodes: TiptapNode[] | undefined): string {
  if (!Array.isArray(nodes)) return ''
  let out = ''
  for (const n of nodes) {
    if (n.type === 'text') out += renderTextWithMarks(n)
    else if (n.type === 'hardBreak') out += '<br>'
    // Editor configures Image.configure({ inline: true }) — an image inside a
    // paragraph is a legitimate Tiptap shape and must render through the
    // inline path too, not just at block level.
    else if (n.type === 'image') out += renderImage(n)
    else if (Array.isArray(n.content)) out += renderInline(n.content)
  }
  return out
}

function textAlignAttr(node: TiptapNode): string {
  const ta = node.attrs?.textAlign
  if (typeof ta === 'string' && ta && ta !== 'left') {
    return ` style="text-align:${escapeAttr(ta)}"`
  }
  return ''
}

function renderBlock(node: TiptapNode): string {
  switch (node.type) {
    case 'paragraph':
      return `<p${textAlignAttr(node)}>${renderInline(node.content)}</p>`
    case 'heading': {
      const level = clampHeadingLevel(node.attrs?.level)
      return `<h${level}${textAlignAttr(node)}>${renderInline(node.content)}</h${level}>`
    }
    case 'bulletList':
      return `<ul>${renderBlocks(node.content)}</ul>`
    case 'orderedList':
      return `<ol>${renderBlocks(node.content)}</ol>`
    case 'listItem':
      return `<li>${renderBlocks(node.content)}</li>`
    case 'blockquote':
      return `<blockquote>${renderBlocks(node.content)}</blockquote>`
    case 'horizontalRule':
      return '<hr>'
    case 'hardBreak':
      return '<br>'
    case 'codeBlock':
      return `<pre><code>${renderInline(node.content)}</code></pre>`
    case 'image':
      return renderImage(node)
    case 'table':
      return `<table><tbody>${renderBlocks(node.content)}</tbody></table>`
    case 'tableRow':
      return `<tr>${renderBlocks(node.content)}</tr>`
    case 'tableHeader':
      return `<th>${renderBlocks(node.content)}</th>`
    case 'tableCell':
      return `<td>${renderBlocks(node.content)}</td>`
    default:
      // Unknown shapes — render any nested content, drop the wrapper. Conservative:
      // never throw, never emit unknown raw markup.
      return renderBlocks(node.content)
  }
}

function renderBlocks(nodes: TiptapNode[] | undefined): string {
  if (!Array.isArray(nodes)) return ''
  return nodes.map(renderBlock).join('')
}

/**
 * Render the body of a Tiptap doc to an HTML string. Pass the top-level `doc`
 * node — its `.content` array is walked. Empty / malformed input yields '',
 * matching the existing autosave fallback (`html ?? ''`).
 */
export function tiptapDocToHtml(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return ''
  const node = doc as TiptapNode
  if (!Array.isArray(node.content)) return ''
  return renderBlocks(node.content)
}
