/**
 * Rehype plugin that transforms [Källa: ...] AND [Utkast: ...] text into <cite>
 * elements. Runs during Streamdown's markdown→HTML pipeline so citations become
 * React components via the `components` prop.
 *
 * Story 17.10b: `[Utkast: <title>]` is the draft-policy citation label used
 * when the underlying styrdokument is DRAFT or IN_REVIEW. Same <cite> tag
 * (the resolver looks up by the inner label text, which is the title); the
 * label semantics are carried by the visible prefix in the rendered prose,
 * not by the source-lookup machinery.
 *
 * Punctuation reordering: trailing punctuation like "text [Källa: X]."
 * becomes "text. <cite>X</cite>" — sentence ends before the citation pill,
 * matching academic reference style.
 */

import type { Root, Text, Element } from 'hast'
import { visit } from 'unist-util-visit'

// Match [Källa: ...] OR [Utkast: ...] with optional trailing punctuation
// (. , ; :) + whitespace. Group 1 = the prefix word (Källa | Utkast), group 2
// = the inner label (title). For Källa the pill renders the bare label; for
// Utkast the pill renders "Utkast: <label>" so the draft tier stays visible
// to the reader (DEC-3 — `[Utkast:]` is the visible-by-design hedge).
const CITATION_RE = /\[(Källa|Utkast):\s*([^\]]+)\]([.,;:]?\s*)/g

export function rehypeCitationPills() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (index === undefined || !parent) return
      const text = node.value
      if (!text.includes('[Källa:') && !text.includes('[Utkast:')) return

      CITATION_RE.lastIndex = 0
      const parts: (Text | Element)[] = []
      let lastIndex = 0
      let match: RegExpExecArray | null

      while ((match = CITATION_RE.exec(text)) !== null) {
        const before = text.slice(lastIndex, match.index)
        const prefix = (match[1] ?? 'Källa').trim() as 'Källa' | 'Utkast'
        const label = (match[2] ?? '').trim()
        const raw = match[3] ?? ''
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

        // Create <cite> element. For Källa the pill shows the bare label
        // (existing 17.10 chip UX); for Utkast the pill keeps the "Utkast: "
        // prefix in its text so the reader visibly sees this is a draft, not
        // canonical policy (DEC-3). data-tier lets the chip component apply
        // distinct styling without needing to re-parse the label.
        const pillText = prefix === 'Utkast' ? `Utkast: ${label}` : label
        parts.push({
          type: 'element',
          tagName: 'cite',
          properties: {
            'data-tier': prefix === 'Utkast' ? 'draft' : 'canonical',
          },
          children: [{ type: 'text', value: pillText }],
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
