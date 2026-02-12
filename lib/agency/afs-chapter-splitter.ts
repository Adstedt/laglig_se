/**
 * AFS Chapter Splitter — Split transformed HTML at chapter boundaries
 * Story 9.1, Task 5
 *
 * For SPLIT-tier documents, walks the transformed HTML DOM and splits
 * at chapter heading boundaries. Each chapter gets the kap. 1 content
 * prepended as a general-provisions preamble.
 *
 * Heading patterns expected in transformed HTML:
 * - chapters-only: <h2> "N kap. Title" or <h3> "N kap. Title"
 * - avdelningar-chapters: <h2> "Avdelning N ...", <h3> "N kap. Title"
 */

import * as cheerio from 'cheerio'
import type { AfsDocument } from './afs-registry'
import { formatChapterDocumentNumber, formatChapterTitle } from './afs-registry'

// ============================================================================
// Types
// ============================================================================

export interface ChapterEntry {
  /** Document number: "AFS 2023:10 kap. 3" */
  documentNumber: string
  /** Title: "Risker i arbetsmiljön — kap. 3: Vibrationer" */
  title: string
  /** Chapter number */
  chapterNumber: number
  /** Chapter title (from registry) */
  chapterTitle: string
  /** Complete HTML for this chapter, including kap. 1 preamble */
  html: string
}

export interface ParentEntry {
  /** Document number: "AFS 2023:10" */
  documentNumber: string
  /** Title: "Risker i arbetsmiljön" */
  title: string
  /** Parent HTML: lovhead + kap. 1 + TOC */
  html: string
  /** Övergångsbestämmelser HTML (stored on parent) */
  transitionalHtml: string
  /** Full appendices HTML for bilagor not assigned to a chapter */
  unassignedAppendicesHtml: string
}

export interface SplitResult {
  parent: ParentEntry
  chapters: ChapterEntry[]
}

// ============================================================================
// Chapter Detection
// ============================================================================

/** Regex to match chapter headings like "1 kap." or "2 kap. Buller" */
const CHAPTER_HEADING_RE = /^(\d+)\s*kap\./i

/**
 * Detect if a heading element is a chapter heading.
 * Returns the chapter number or null.
 */
function getChapterNumber(headingText: string): number | null {
  const match = CHAPTER_HEADING_RE.exec(headingText.trim())
  return match ? parseInt(match[1]!, 10) : null
}

// ============================================================================
// Core Splitter
// ============================================================================

/**
 * Split a transformed AFS document into parent + chapter entries.
 *
 * @param transformedHtml - The complete HTML from transformAfsHtml()
 * @param doc - The AFS document registry entry
 * @returns Parent entry + array of chapter entries
 */
export function splitByChapters(
  transformedHtml: string,
  doc: AfsDocument
): SplitResult {
  const $ = cheerio.load(transformedHtml, { xml: false })

  // Extract the body content (where chapters live)
  const $body = $('div.body')
  if ($body.length === 0) {
    throw new Error(
      `No div.body found in transformed HTML for ${doc.documentNumber}`
    )
  }

  // Determine which heading level contains chapter headings
  // In avdelningar docs: h3 = chapters (h2 = avdelningar)
  // In chapters-only docs: h2 = chapters
  const chapterHeadingTag = doc.hasAvdelningar ? 'h3' : 'h2'

  // Walk through body children and group by chapter
  const bodyChildren = $body.contents().toArray()

  // Chapter accumulators
  const chapterHtmlMap = new Map<number, string[]>()
  let currentChapter: number | null = null
  const preChapterHtml: string[] = [] // Content before any chapter heading (lovhead area, avdelning headers)
  let currentAvdelningHtml = '' // Current avdelning header (for context)

  for (const node of bodyChildren) {
    const $node = $(node)

    // Check if this is a chapter heading
    if (node.type === 'tag') {
      const tagName = (
        'tagName' in node ? (node as { tagName: string }).tagName : ''
      ).toLowerCase()
      const text = $node.text().trim()

      // Track avdelning headers (h2 in avdelningar docs)
      if (doc.hasAvdelningar && tagName === 'h2') {
        currentAvdelningHtml = $.html(node)
        // Avdelning headers go into the next chapter they precede
        // but also into the pre-chapter area if before kap. 1
        if (currentChapter === null) {
          preChapterHtml.push($.html(node))
        } else {
          // Add to current chapter — it will be part of the chapter after next heading
          const arr = chapterHtmlMap.get(currentChapter)
          if (arr) arr.push($.html(node))
        }
        continue
      }

      if (tagName === chapterHeadingTag) {
        const chapNum = getChapterNumber(text)
        if (chapNum !== null) {
          currentChapter = chapNum
          if (!chapterHtmlMap.has(chapNum)) {
            chapterHtmlMap.set(chapNum, [])
          }
          // If there's a pending avdelning header, prepend it to this chapter
          if (doc.hasAvdelningar && currentAvdelningHtml && chapNum > 1) {
            const arr = chapterHtmlMap.get(chapNum)!
            // Only add if not already added via pre-chapter flow
            if (!arr.includes(currentAvdelningHtml)) {
              arr.push(currentAvdelningHtml)
            }
            currentAvdelningHtml = ''
          }
          chapterHtmlMap.get(chapNum)!.push($.html(node))
          continue
        }
      }
    }

    // Accumulate content
    const nodeHtml = $.html(node)
    if (currentChapter === null) {
      preChapterHtml.push(nodeHtml)
    } else {
      const arr = chapterHtmlMap.get(currentChapter)
      if (arr) arr.push(nodeHtml)
    }
  }

  // ---- Extract kap. 1 for preamble ----
  const kap1Html = chapterHtmlMap.get(1)?.join('\n') || ''
  chapterHtmlMap.delete(1) // Don't create a separate entry for kap. 1

  const preambleSection = kap1Html
    ? `<section class="general-provisions-preamble">\n${kap1Html}\n</section>`
    : ''

  // ---- Extract non-body sections ----
  const $transitional = $('footer.back')
  const transitionalHtml = $transitional.length > 0 ? $.html($transitional) : ''

  const $appendices = $('div.appendices')
  const appendicesOuterHtml =
    $appendices.length > 0 ? $appendices.html() || '' : ''

  // ---- Assign bilagor to chapters ----
  // Parse appendices to find "Denna bilaga hör till N kap." or "Bilaga till N kap."
  const chapterBilagor = new Map<number, string[]>()
  const unassignedBilagor: string[] = []

  if ($appendices.length > 0) {
    const $appContent = cheerio.load(appendicesOuterHtml, { xml: false })
    const headings = $appContent('h2').toArray()

    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i]!
      const $heading = $appContent(heading)
      const nextHeading = headings[i + 1]

      // Collect all content between this heading and the next
      let bilagaHtml = $appContent.html(heading)
      let sibling = $heading.next()
      while (sibling.length > 0 && sibling[0] !== nextHeading) {
        bilagaHtml += $appContent.html(sibling[0]!)
        sibling = sibling.next()
      }

      // Check if the bilaga text mentions which chapter it belongs to
      const bilagaText = $heading.text() + ' ' + bilagaHtml
      const chapMatch = /(?:hör till|till)\s+(\d+)\s*kap\./i.exec(bilagaText)
      if (chapMatch) {
        const chapNum = parseInt(chapMatch[1]!, 10)
        if (!chapterBilagor.has(chapNum)) {
          chapterBilagor.set(chapNum, [])
        }
        chapterBilagor.get(chapNum)!.push(bilagaHtml)
      } else {
        unassignedBilagor.push(bilagaHtml)
      }
    }
  }

  // ---- Build chapter entries ----
  const chapters: ChapterEntry[] = []
  const registeredChapters = doc.chapters

  for (const regChapter of registeredChapters) {
    const chapHtml = chapterHtmlMap.get(regChapter.number)?.join('\n') || ''
    if (!chapHtml) continue

    // Build chapter with preamble
    const parts: string[] = []
    parts.push(
      `<article class="sfs" id="${doc.documentNumber.replace(/\s+/g, '').replace(/:/g, '-')}-K${regChapter.number}">`
    )
    if (preambleSection) {
      parts.push(preambleSection)
    }
    parts.push(`<div class="body">`)
    parts.push(chapHtml)
    parts.push(`</div>`)

    // Add chapter-specific bilagor
    const chapBilagor = chapterBilagor.get(regChapter.number)
    if (chapBilagor && chapBilagor.length > 0) {
      parts.push(`<div class="appendices">`)
      parts.push(chapBilagor.join('\n'))
      parts.push(`</div>`)
    }

    parts.push(`</article>`)

    chapters.push({
      documentNumber: formatChapterDocumentNumber(
        doc.documentNumber,
        regChapter.number
      ),
      title: formatChapterTitle(doc.title, regChapter.number, regChapter.title),
      chapterNumber: regChapter.number,
      chapterTitle: regChapter.title,
      html: parts.join('\n'),
    })
  }

  // ---- Build parent entry ----
  const $lovhead = $('div.lovhead')
  const lovheadHtml = $lovhead.length > 0 ? $.html($lovhead) : ''
  const $preamble = $('div.preamble')
  const preambleOuterHtml = $preamble.length > 0 ? $.html($preamble) : ''

  // Build TOC
  const tocItems = registeredChapters
    .map((ch) => `<li>kap. ${ch.number}: ${ch.title}</li>`)
    .join('\n    ')
  const tocHtml = `<nav class="chapter-toc">\n  <h2>Innehåll</h2>\n  <ol>\n    ${tocItems}\n  </ol>\n</nav>`

  const parentParts: string[] = []
  parentParts.push(
    `<article class="sfs" id="${doc.documentNumber.replace(/\s+/g, '').replace(/:/g, '-')}">`
  )
  parentParts.push(lovheadHtml)
  if (preambleOuterHtml) parentParts.push(preambleOuterHtml)
  parentParts.push(tocHtml)
  parentParts.push(`<div class="body">`)
  if (preChapterHtml.length > 0) parentParts.push(preChapterHtml.join('\n'))
  parentParts.push(kap1Html)
  parentParts.push(`</div>`)
  parentParts.push(`</article>`)

  return {
    parent: {
      documentNumber: doc.documentNumber,
      title: doc.title,
      html: parentParts.join('\n'),
      transitionalHtml,
      unassignedAppendicesHtml: unassignedBilagor.join('\n'),
    },
    chapters,
  }
}
