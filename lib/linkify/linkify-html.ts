/**
 * HTML-aware legal reference linkification
 *
 * Processes HTML content using cheerio, detects legal references in text nodes,
 * and injects <a> tags pointing to the correct document pages.
 *
 * Key behaviors:
 * - Only modifies text nodes (skips <a>, <code>, <script>, <style> content)
 * - Idempotent: strips existing <a class="legal-ref"> before re-linkifying
 * - Self-references excluded (a doc doesn't link to itself)
 * - Missing documents left as plain text (no broken links)
 */

import * as cheerio from 'cheerio'
import type { AnyNode, Text as TextNode, Element } from 'domhandler'
import { detectReferences, type DetectedReference } from './detect-references'
import { getDocumentUrl } from '@/lib/prefetch/get-document-url'
import type { SlugMap } from './build-slug-map'

/** Tags whose text content should NOT be scanned for references */
const SKIP_TAGS = new Set(['a', 'code', 'script', 'style', 'pre'])

export interface LinkifyResult {
  /** The linkified HTML string */
  html: string
  /** References that were successfully linked (for CrossReference population) */
  linkedReferences: LinkedReference[]
}

export interface LinkedReference {
  /** The detected reference data */
  reference: DetectedReference
  /** The target document's database ID */
  targetDocumentId: string
}

/**
 * Escape a string for use in an HTML attribute value (double-quoted).
 */
function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Escape text for safe insertion as HTML text content.
 */
function escapeText(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Check whether a detected reference's type is compatible with the
 * slug map entry's content_type. SFS references match both SFS_LAW
 * and SFS_AMENDMENT (amendment förordningar like "Förordning (2009:38)").
 */
function isContentTypeMatch(
  ref: DetectedReference,
  entryContentType: string
): boolean {
  if (ref.contentType === 'SFS_LAW') {
    return (
      entryContentType === 'SFS_LAW' || entryContentType === 'SFS_AMENDMENT'
    )
  }
  if (ref.contentType === 'AGENCY_REGULATION') {
    return entryContentType === 'AGENCY_REGULATION'
  }
  if (ref.contentType === 'COURT_CASE') {
    const courtMap: Record<string, string> = {
      hd: 'COURT_CASE_HD',
      hfd: 'COURT_CASE_HFD',
      ad: 'COURT_CASE_AD',
      hovr: 'COURT_CASE_HOVR',
      mod: 'COURT_CASE_MOD',
      mig: 'COURT_CASE_MIG',
    }
    const expectedType = ref.courtId ? courtMap[ref.courtId] : undefined
    return expectedType ? entryContentType === expectedType : true
  }
  return true
}

/**
 * Linkify HTML content by detecting legal references and injecting <a> tags.
 *
 * @param html - The HTML content to process
 * @param slugMap - Map from document_number → {slug, contentType, title, id}
 * @param sourceDocNumber - The document number of the source document (to exclude self-references)
 * @returns LinkifyResult with the processed HTML and linked references
 */
export function linkifyHtmlContent(
  html: string,
  slugMap: SlugMap,
  sourceDocNumber?: string
): LinkifyResult {
  // decodeEntities: false preserves original character encoding in both
  // parsing and serialization. We handle attribute escaping manually via
  // escapeAttr(). The option is passed through to htmlparser2 but not
  // exposed in cheerio's TypeScript definitions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- htmlparser2 option not in cheerio types
  const $ = cheerio.load(html, { decodeEntities: false } as any)
  const linkedReferences: LinkedReference[] = []

  // Step 1: Strip all <a> links except section anchors (.paragraf) so their
  // text becomes available for reference detection. This covers:
  //   - Our own legal-ref links (idempotency for re-runs)
  //   - Riksdagen internal links (/rn/goext.aspx, class="ref", class="change-sfs-nr", etc.)
  // Name-only anchors (no href) are section markers, not links — preserved automatically.
  $('a[href]:not(.paragraf)').each(function () {
    const $el = $(this)
    $el.replaceWith($el.text())
  })

  // Step 2: Re-parse to merge adjacent text nodes left by link unwrapping.
  // Without this, compound names like "aktiebolags" + "lagen (2005:551)" remain
  // split across two text nodes and the compound prefix is missed.
  const $2 = cheerio.load($('body').html() ?? '', {
    decodeEntities: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- htmlparser2 option not in cheerio types
  } as any)

  // Step 3: Walk all text nodes and linkify
  const body = $2('body')
  processNode(body[0]!, $2, slugMap, sourceDocNumber, linkedReferences)

  // Return the inner HTML of the body (cheerio wraps in <html><body>)
  return {
    html: $2('body').html() ?? html,
    linkedReferences,
  }
}

/**
 * Resolve a reference to a link target, returning null if it shouldn't be linked.
 */
function resolveLink(
  ref: DetectedReference,
  slugMap: SlugMap,
  sourceDocNumber: string | undefined
): { href: string; title: string; id: string } | null {
  // Skip self-references
  if (sourceDocNumber && ref.documentNumber === sourceDocNumber) return null

  // Look up the target document
  const entry = slugMap.get(ref.documentNumber)
  if (!entry) return null

  // Verify content type match
  if (!isContentTypeMatch(ref, entry.contentType)) return null

  let href = getDocumentUrl({
    contentType: entry.contentType,
    slug: entry.slug,
  })

  // Append section anchor fragment for deep-linking
  if (ref.chapter && ref.section) {
    href += `#K${ref.chapter}P${ref.section}`
  } else if (ref.section) {
    href += `#P${ref.section}`
  }

  return { href, title: entry.title, id: entry.id }
}

/**
 * Build an <a> tag string with properly escaped attributes.
 */
function buildLinkHtml(href: string, title: string, text: string): string {
  return `<a href="${escapeAttr(href)}" class="legal-ref" title="${escapeAttr(title)}" target="_blank" rel="noopener">${escapeText(text)}</a>`
}

/**
 * Recursively process a DOM node, linkifying text nodes.
 */
function processNode(
  node: AnyNode,
  $: cheerio.CheerioAPI,
  slugMap: SlugMap,
  sourceDocNumber: string | undefined,
  linkedReferences: LinkedReference[]
): void {
  const children = $(node).contents().toArray()

  for (const child of children) {
    if (child.type === 'text') {
      const textContent = (child as TextNode).data
      if (!textContent?.trim()) continue

      const refs = detectReferences(textContent)
      if (refs.length === 0) continue

      // Build replacement HTML string from the text, injecting <a> tags
      const parts: string[] = []
      let lastIndex = 0
      let hasLinks = false

      for (const ref of refs) {
        const target = resolveLink(ref, slugMap, sourceDocNumber)
        if (!target) continue

        // Add text before this match (unescaped — it was already in the DOM as text)
        parts.push(textContent.slice(lastIndex, ref.start))
        // Add the link with escaped attributes
        parts.push(buildLinkHtml(target.href, target.title, ref.matchedText))
        lastIndex = ref.end
        hasLinks = true

        linkedReferences.push({
          reference: ref,
          targetDocumentId: target.id,
        })
      }

      if (!hasLinks) continue

      // Add remaining text after last match
      parts.push(textContent.slice(lastIndex))

      // Replace the text node with the assembled HTML
      $(child).replaceWith(parts.join(''))
    } else if (child.type === 'tag') {
      const tagName = (child as Element).tagName?.toLowerCase()
      if (tagName && SKIP_TAGS.has(tagName)) continue
      processNode(child, $, slugMap, sourceDocNumber, linkedReferences)
    }
  }
}
