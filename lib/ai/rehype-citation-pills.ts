/**
 * Rehype plugin that transforms [Källa: ...] text into <cite> elements.
 * Runs during Streamdown's markdown→HTML pipeline so citations become
 * React components via the `components` prop.
 *
 * Punctuation reordering: trailing punctuation like "text [Källa: X]."
 * becomes "text. <cite>X</cite>" — sentence ends before the citation pill,
 * matching academic reference style.
 */

import type { Root, Text, Element } from 'hast'
import { visit } from 'unist-util-visit'

// Match [Källa: ...] with optional trailing punctuation (. , ; :) + whitespace
const CITATION_RE = /\[Källa:\s*([^\]]+)\]([.,;:]?\s*)/g

export function rehypeCitationPills() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (index === undefined || !parent) return
      const text = node.value
      if (!text.includes('[Källa:')) return

      CITATION_RE.lastIndex = 0
      const parts: (Text | Element)[] = []
      let lastIndex = 0
      let match: RegExpExecArray | null

      while ((match = CITATION_RE.exec(text)) !== null) {
        const before = text.slice(lastIndex, match.index)
        const label = (match[1] ?? '').trim()
        const raw = match[2] ?? ''
        const hasPunct = /^[.,;:]/.test(raw)

        if (hasPunct) {
          // Move punctuation BEFORE the cite pill:
          // "text [Källa: X]. Next" → "text. " + <cite>X</cite> + "Next"
          const punct = raw.trimEnd() // e.g. "." or ","
          const beforeTrimmed = before.replace(/\s+$/, '') // remove space before [
          if (beforeTrimmed || punct) {
            parts.push({ type: 'text', value: beforeTrimmed + punct + ' ' })
          }
        } else {
          // No punctuation — keep text before citation as-is
          if (before) {
            parts.push({ type: 'text', value: before })
          }
        }

        // Create <cite> element with label as text child
        parts.push({
          type: 'element',
          tagName: 'cite',
          properties: {},
          children: [{ type: 'text', value: label }],
        })

        lastIndex = match.index + match[0].length
      }

      if (parts.length === 0) return

      // Remaining text after last citation
      const remaining = text.slice(lastIndex)
      if (remaining) {
        parts.push({ type: 'text', value: remaining })
      }

      // Replace the text node with our parts
      ;(parent as Element).children.splice(index, 1, ...parts)
      return index + parts.length
    })
  }
}
