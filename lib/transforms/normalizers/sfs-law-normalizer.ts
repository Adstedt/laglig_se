/**
 * SFS Law Normalizer — Riksdag API HTML → Canonical HTML
 * Story 14.1, Task 2
 *
 * Converts the cleaned Riksdag HTML (output of cleanLawHtml) into
 * canonical HTML conforming to lib/transforms/canonical-html-schema.md.
 *
 * Input patterns:
 *   - Chapter headings: <h3><a name="K1">1 kap.</a> Title</h3>
 *   - Section anchors:  <a class="paragraf" name="K1P1"><b>1 §</b></a>
 *   - Content:          <p>paragraph text</p>
 *   - Stycke anchors:   <a name="K1P1S2"></a>Text...
 *   - Transition:       <a name="overgang"></a>
 *
 * Also handles the class-based format from some Riksdag endpoints:
 *   - <p class="LedKapitel">7 kap. Tillsyn</p>
 *   - <p class="LedParagraf">15 §</p>
 *   - <p class="LedParagrafText">Content...</p>
 */

import * as cheerio from 'cheerio'

export interface SfsLawNormalizerOptions {
  /** Document number, e.g. "SFS 1977:1160" */
  documentNumber: string
  /** Document title, e.g. "Arbetsmiljölag" */
  title: string
}

/**
 * Generate DOC_ID from document number.
 * Removes spaces, replaces colon with hyphen.
 * "SFS 1977:1160" → "SFS1977-1160"
 */
export function generateDocId(documentNumber: string): string {
  return documentNumber.replace(/\s+/g, '').replace(/:/g, '-')
}

/**
 * Normalize Riksdag API HTML into canonical structure.
 * Idempotent: already-normalized HTML is returned unchanged.
 */
export function normalizeSfsLaw(
  html: string,
  options: SfsLawNormalizerOptions
): string {
  if (!html || html.trim().length === 0) {
    return buildEmptyDocument(options)
  }

  // Idempotent: if already fully canonical, return as-is.
  // Check both the outer wrapper AND inner structure markers.
  // Docs that were previously wrapped (class rename) but never had inner
  // structure normalized will have the wrapper but old anchors like
  // <a class="paragraf" name="P1"><b>1 §</b></a> inside <p class="text">
  // instead of <h3 class="paragraph"><a class="paragraf" id="...">1 §</a></h3>
  if (html.includes('<article class="legal-document"')) {
    // Fully canonical: has inner paragraph structure OR has no § at all (simple doc)
    if (html.includes('class="paragraph"') || !html.includes('§')) {
      return html
    }
    // Partially wrapped: already has article wrapper but missing inner structure.
    // Return as-is — the wrapper is sufficient for the canonical parser.
    return html
  }

  const docId = generateDocId(options.documentNumber)
  const $ = cheerio.load(html, {
    decodeEntities: false,
  } as cheerio.CheerioOptions)

  // Measure original text content (after metadata header) for safety-net comparison
  const originalTextLength = extractBodyTextLength($)

  // Detect format: anchor-based (classic) or class-based (LedParagraf)
  const isClassBased =
    $('p.LedKapitel, p.LedParagraf').length > 0 && $('a.paragraf').length === 0

  let result: string
  if (isClassBased) {
    result = normalizeClassBasedFormat($, docId, options)
  } else {
    result = normalizeAnchorBasedFormat($, docId, options)
  }

  // Safety net: if normalization lost too much content, fall back to
  // a simple canonical wrap that preserves the cleaned HTML as-is.
  // This protects non-standard documents (tillkännagivanden, etc.)
  // from having content silently dropped.
  if (originalTextLength > 100) {
    const $result = cheerio.load(result, {
      decodeEntities: false,
    } as cheerio.CheerioOptions)
    // Compare body + footer text to catch both main content and transition provisions
    const bodyText =
      $result('.body').text() + ' ' + $result('footer.back').text()
    const normalizedTextLength = bodyText.replace(/\s+/g, ' ').trim().length
    const ratio = normalizedTextLength / originalTextLength
    if (ratio < 0.2) {
      return buildFallbackDocument(docId, options, html)
    }
  }

  return result
}

// ============================================================================
// Anchor-Based Format (Classic Riksdag)
// ============================================================================

function normalizeAnchorBasedFormat(
  $: cheerio.CheerioAPI,
  docId: string,
  options: SfsLawNormalizerOptions
): string {
  // ---- Preprocessing: clean up Riksdag HTML structure ----

  // Remove metadata header (h2 title, b/br metadata, hr) and TOC
  $('div.sfstoc').remove()
  $('body > h2').first().remove()
  $('body > hr').remove()

  // Remove top-level metadata: <b>SFS nr</b>: ... <br> patterns
  // These are direct children of body before the content div
  $('body')
    .contents()
    .each((_, node) => {
      // Remove bare <b> metadata labels and <br> before the content div
      const tagName = (
        node as unknown as { tagName?: string }
      ).tagName?.toLowerCase()
      if (tagName === 'b' || tagName === 'br') {
        $(node).remove()
      }
    })
  // Remove orphaned top-level text nodes (metadata values like "1977:1160")
  $('body')
    .contents()
    .each((_, node) => {
      if (node.type === 'text') {
        const text = (node as unknown as { data?: string }).data?.trim()
        // Only remove short metadata-like text, not real content
        if (text && !text.includes('§') && !text.includes('kap.')) {
          $(node).remove()
        }
      }
    })

  // Unwrap the content <div> — Riksdag wraps all law text in a plain <div>
  // First try divs containing law anchors; fall back to any remaining div
  let $contentDiv = $('body > div')
    .not('.sfstoc')
    .filter((_, el) => {
      return $(el).find('a.paragraf, a[name^="K"]').length > 0
    })
  if ($contentDiv.length === 0) {
    // Non-standard documents (tillkännagivanden etc.) may lack § and chapter
    // anchors — unwrap the sole remaining content div anyway
    $contentDiv = $('body > div').not('.sfstoc')
  }
  if ($contentDiv.length > 0) {
    // Replace the div with its contents
    $contentDiv.each((_, el) => {
      $(el).replaceWith($(el).html() || '')
    })
  }

  // Remove empty anchor-wrapper <p> tags: <p><a name="S1"></a></p>
  // These are section spacers in Riksdag HTML, not real content
  $('p').each((_, el) => {
    const $el = $(el)
    const children = $el.children()
    if (
      children.length <= 1 &&
      children.filter('a[name]').length === children.length &&
      !$el.text().trim()
    ) {
      // Preserve the anchor, remove the wrapping <p>
      if (children.length === 1) {
        $el.replaceWith(children)
      } else {
        $el.remove()
      }
    }
  })

  // ---- Detect structure ----
  const body = $('body')
  const hasChapters =
    $('h3 a[name^="K"]').length > 0 ||
    $('h3[name^="K"]').length > 0 ||
    body.html()?.match(/<a[^>]+name="K\d+"/i) !== null

  // Find transition provisions boundary
  const overgangAnchor = $('a[name="overgang"]')
  let transitionHtml = ''
  if (overgangAnchor.length > 0) {
    // The anchor may be inside an <h3> — work from the parent element so we
    // capture all sibling content after the heading (the actual provisions text)
    let startEl = overgangAnchor
    const anchorParent = overgangAnchor.parent()
    if (
      anchorParent.length > 0 &&
      anchorParent.prop('tagName')?.toLowerCase() === 'h3'
    ) {
      startEl = anchorParent
    }

    // Use .contents() to include text nodes (loose text after <h3>)
    const containerEl = startEl.parent()
    const allContents = containerEl.contents()
    const startIndex = allContents.index(startEl)

    if (startIndex >= 0) {
      const transitionParts: string[] = []
      allContents.slice(startIndex).each((_, node) => {
        const html = $.html(node)
        if (html) transitionParts.push(html)
      })
      transitionHtml = transitionParts.join('\n')
      allContents.slice(startIndex).remove()
    }
  }

  // ---- Build the document ----
  const parts: string[] = []

  parts.push(`<article class="legal-document" id="${docId}">`)
  parts.push(`  <div class="lovhead">`)
  parts.push(`    <h1>`)
  parts.push(`      <p class="text">${escapeHtml(options.documentNumber)}</p>`)
  parts.push(`      <p class="text">${escapeHtml(options.title)}</p>`)
  parts.push(`    </h1>`)
  parts.push(`  </div>`)
  parts.push(`  <div class="body">`)

  if (hasChapters) {
    parts.push(buildChapteredBody($, docId, options))
  } else {
    parts.push(buildFlatBody($, docId, options))
  }

  parts.push(`  </div>`)

  // Transition provisions
  if (transitionHtml.trim()) {
    parts.push(`  <footer class="back">`)
    parts.push(`    <h2>Övergångsbestämmelser</h2>`)
    parts.push(normalizeTransitionContent(transitionHtml))
    parts.push(`  </footer>`)
  }

  parts.push(`</article>`)

  return parts.join('\n')
}

function buildChapteredBody(
  $: cheerio.CheerioAPI,
  docId: string,
  options: SfsLawNormalizerOptions
): string {
  const parts: string[] = []
  const body = $('body')

  // Walk ALL nodes (elements + text nodes) in document order
  const nodes = body.contents().toArray()
  let currentChapterNum: string | null = null
  let currentChapterParts: string[] = []

  function flushChapter() {
    if (currentChapterNum !== null && currentChapterParts.length > 0) {
      parts.push(
        `    <section class="kapitel" id="${docId}_K${currentChapterNum}">`
      )
      parts.push(...currentChapterParts)
      parts.push(`    </section>`)
      currentChapterParts = []
    }
  }

  function target(): string[] {
    return currentChapterNum !== null ? currentChapterParts : parts
  }

  for (const node of nodes) {
    // Text nodes — loose paragraph content (common in Riksdag HTML)
    if (node.type === 'text') {
      const text = (node as unknown as { data?: string }).data?.trim()
      if (text && text.length > 1) {
        // Clean up &nbsp; padding at start
        const cleaned = text.replace(/^\s*/, '').replace(/\s+/g, ' ')
        if (!cleaned || isPreambleText(cleaned, options.title)) continue
        target().push(`      <p class="text">${escapeHtml(cleaned)}</p>`)
      }
      continue
    }

    if (node.type !== 'tag') continue

    const el = $(node)
    const tagName =
      (node as unknown as { tagName?: string }).tagName?.toLowerCase() || ''

    // Chapter heading: <h3><a name="K1">1 kap.</a> Title</h3>
    // Also handles: <h3 name="K1"><a name="K1">1 kap. Title</a></h3>
    if (tagName === 'h3') {
      const anchor = el.find('a[name^="K"]')
      const nameAttr = el.attr('name') || ''
      const anchorName =
        anchor.length > 0 ? anchor.attr('name') || '' : nameAttr
      const chapterMatch = anchorName.match(/^K(\d+)$/)
      if (chapterMatch) {
        flushChapter()
        currentChapterNum = chapterMatch[1]!
        const fullText = el.text().trim()
        currentChapterParts.push(
          `      <h2 class="kapitel-rubrik">${escapeHtml(fullText)}</h2>`
        )
        continue
      }
    }

    // Paragraf anchor: <a class="paragraf" name="K1P1"><b>1 §</b></a>
    if (
      tagName === 'a' &&
      (el.hasClass('paragraf') || el.attr('class')?.includes('paragraf'))
    ) {
      const name = el.attr('name') || el.attr('id') || ''
      const sectionNum = extractSectionNumber(el.text())
      const semanticId = buildSectionId(
        docId,
        name,
        currentChapterNum,
        sectionNum
      )

      target().push(
        `      <h3 class="paragraph">`,
        `        <a class="paragraf" id="${semanticId}" name="${semanticId}">${escapeHtml(sectionNum)} §</a>`,
        `      </h3>`
      )
      continue
    }

    // Stycke anchor: <a name="K1P1S2"></a> — skip (acts as paragraph separator)
    // Also skip other non-content anchors (e.g., <a name="S1">)
    if (tagName === 'a') {
      continue
    }

    // <br> tags — skip (paragraph boundaries handled by text nodes)
    if (tagName === 'br') {
      continue
    }

    // Content paragraphs
    if (tagName === 'p') {
      const text = el.text().trim()
      if (!text) continue
      // Skip preamble text (title, "utfärdad den...", "Regeringen föreskriver...")
      if (isPreambleText(text, options.title)) continue
      target().push(`      <p class="text">${el.html()?.trim() || ''}</p>`)
      continue
    }

    // Italic amendment references: <i>Lag (2022:1109)</i>
    if (tagName === 'i') {
      const text = el.text().trim()
      if (!text || isPreambleText(text, options.title)) continue
      target().push(
        `      <p class="text"><em>${el.html()?.trim() || ''}</em></p>`
      )
      continue
    }

    // Tables
    if (tagName === 'table') {
      const tableHtml = $.html(el)
      target().push(
        `      ${tableHtml.replace(/<table/g, '<table class="legal-table"')}`
      )
      continue
    }

    // Lists (ol, ul)
    if (tagName === 'ol' || tagName === 'ul') {
      target().push(`      ${$.html(el)}`)
      continue
    }

    // h4 section headings — preserve as-is with class
    if (tagName === 'h4') {
      const text = el.text().trim()
      // Skip preamble headings (title, "utfärdad den...")
      if (!text || isPreambleText(text, options.title)) continue
      const slug = slugify(text)
      target().push(`      <h3 id="${docId}_${slug}">${escapeHtml(text)}</h3>`)
      continue
    }

    // Definition lists
    if (tagName === 'dl') {
      target().push(`      ${$.html(el)}`)
      continue
    }

    // Bold — might be a heading like <b>Övergångsbestämmelser</b>
    // (already removed by overgang handling, but catch stragglers)
    if (tagName === 'b') {
      const text = el.text().trim()
      if (text && !text.includes('SFS nr') && !text.includes('Departement')) {
        target().push(
          `      <p class="text"><strong>${escapeHtml(text)}</strong></p>`
        )
      }
      continue
    }

    // Divs — might contain remaining content (shouldn't happen after preprocessing)
    if (tagName === 'div') {
      const innerHtml = el.html()?.trim()
      if (innerHtml && el.find('a.paragraf, a[name^="K"]').length > 0) {
        // This div has law content — shouldn't reach here after preprocessing
        // but handle defensively by appending its inner HTML
        target().push(`      ${innerHtml}`)
      }
      continue
    }
  }

  flushChapter()
  return parts.join('\n')
}

function buildFlatBody(
  $: cheerio.CheerioAPI,
  docId: string,
  options: SfsLawNormalizerOptions
): string {
  const parts: string[] = []
  const body = $('body')
  const nodes = body.contents().toArray()

  for (const node of nodes) {
    // Text nodes — loose paragraph content
    if (node.type === 'text') {
      const text = (node as unknown as { data?: string }).data?.trim()
      if (text && text.length > 1) {
        const cleaned = text.replace(/^\s*/, '').replace(/\s+/g, ' ')
        if (!cleaned || isPreambleText(cleaned, options.title)) continue
        parts.push(`    <p class="text">${escapeHtml(cleaned)}</p>`)
      }
      continue
    }

    if (node.type !== 'tag') continue

    const el = $(node)
    const tagName =
      (node as unknown as { tagName?: string }).tagName?.toLowerCase() || ''

    // Paragraf anchor
    if (
      tagName === 'a' &&
      (el.hasClass('paragraf') || el.attr('class')?.includes('paragraf'))
    ) {
      const name = el.attr('name') || el.attr('id') || ''
      const sectionNum = extractSectionNumber(el.text())
      const semanticId = buildFlatSectionId(docId, name, sectionNum)

      parts.push(
        `    <h3 class="paragraph">`,
        `      <a class="paragraf" id="${semanticId}" name="${semanticId}">${escapeHtml(sectionNum)} §</a>`,
        `    </h3>`
      )
      continue
    }

    // Skip non-content anchors and br
    if (tagName === 'a' || tagName === 'br') continue

    // Content paragraphs
    if (tagName === 'p') {
      const text = el.text().trim()
      if (!text) continue
      // Skip preamble text (title, "utfärdad den...", "Regeringen föreskriver...")
      if (isPreambleText(text, options.title)) continue
      parts.push(`    <p class="text">${el.html()?.trim() || ''}</p>`)
      continue
    }

    // Italic amendment references
    if (tagName === 'i') {
      const text = el.text().trim()
      if (!text || isPreambleText(text, options.title)) continue
      parts.push(`    <p class="text"><em>${el.html()?.trim() || ''}</em></p>`)
      continue
    }

    // Tables
    if (tagName === 'table') {
      const tableHtml = $.html(el)
      parts.push(
        `    ${tableHtml.replace(/<table/g, '<table class="legal-table"')}`
      )
      continue
    }

    // Lists
    if (tagName === 'ol' || tagName === 'ul') {
      parts.push(`    ${$.html(el)}`)
      continue
    }

    // h4 section headings
    if (tagName === 'h4') {
      const text = el.text().trim()
      // Skip preamble headings (title, "utfärdad den...")
      if (!text || isPreambleText(text, options.title)) continue
      const slug = slugify(text)
      parts.push(`    <h3 id="${docId}_${slug}">${escapeHtml(text)}</h3>`)
      continue
    }

    // Definition lists
    if (tagName === 'dl') {
      parts.push(`    ${$.html(el)}`)
      continue
    }
  }

  return parts.join('\n')
}

// ============================================================================
// Class-Based Format (LedParagraf)
// ============================================================================

function normalizeClassBasedFormat(
  $: cheerio.CheerioAPI,
  docId: string,
  options: SfsLawNormalizerOptions
): string {
  const parts: string[] = []

  parts.push(`<article class="legal-document" id="${docId}">`)
  parts.push(`  <div class="lovhead">`)
  parts.push(`    <h1>`)
  parts.push(`      <p class="text">${escapeHtml(options.documentNumber)}</p>`)
  parts.push(`      <p class="text">${escapeHtml(options.title)}</p>`)
  parts.push(`    </h1>`)
  parts.push(`  </div>`)
  parts.push(`  <div class="body">`)

  const hasChapters = $('p.LedKapitel').length > 0
  let currentChapterNum: string | null = null
  let currentChapterParts: string[] = []
  const transitionParts: string[] = []
  let inTransition = false

  const title = options.title

  function flushChapter() {
    if (currentChapterNum !== null && currentChapterParts.length > 0) {
      parts.push(
        `    <section class="kapitel" id="${docId}_K${currentChapterNum}">`
      )
      parts.push(...currentChapterParts)
      parts.push(`    </section>`)
      currentChapterParts = []
    }
  }

  $('body')
    .children()
    .each((_, child) => {
      const el = $(child)
      const text = el.text().trim()
      const className = el.attr('class') || ''

      if (
        text.toLowerCase().includes('övergångsbestämmelser') ||
        text.toLowerCase().includes('ikraftträdande')
      ) {
        inTransition = true
      }

      if (inTransition) {
        if (className === 'LedParagrafText' || className === 'LedParagraf') {
          const cls = classForTransitionText(text)
          transitionParts.push(`    <p class="${cls}">${text}</p>`)
        }
        return
      }

      if (className === 'LedKapitel') {
        flushChapter()
        const chapterMatch = text.match(/^(\d+)\s*kap\./)
        currentChapterNum = chapterMatch?.[1] ?? null
        if (currentChapterNum) {
          currentChapterParts.push(
            `      <h2 class="kapitel-rubrik">${escapeHtml(text)}</h2>`
          )
        }
        return
      }

      if (className === 'LedParagraf') {
        const sectionMatch = text.match(/^(\d+[a-z]?)\s*§/)
        if (sectionMatch) {
          const sectionNum = sectionMatch[1]!
          const id =
            hasChapters && currentChapterNum
              ? `${docId}_K${currentChapterNum}_P${sectionNum}`
              : `${docId}_P${sectionNum}`
          const target = hasChapters ? currentChapterParts : parts
          target.push(
            `      <h3 class="paragraph">`,
            `        <a class="paragraf" id="${id}" name="${id}">${escapeHtml(sectionNum)} §</a>`,
            `      </h3>`
          )
        }
        return
      }

      if (className === 'LedParagrafText') {
        // Skip preamble boilerplate (e.g. "Regeringen föreskriver följande.")
        if (isPreambleText(text, title)) return
        const target = hasChapters ? currentChapterParts : parts
        target.push(`      <p class="text">${escapeHtml(text)}</p>`)
        return
      }

      // Elements without a Led* class — may be section sub-headings
      // (e.g. "Inledande bestämmelser", "Tillsynsmyndigheter")
      // Skip preamble elements (title, issue date), emit others as headings
      if (!text || isPreambleText(text, title)) return
      if (!className && !text.includes('§')) {
        const target = hasChapters ? currentChapterParts : parts
        const slug = slugify(text)
        target.push(`      <h3 id="${docId}_${slug}">${escapeHtml(text)}</h3>`)
      }
    })

  if (hasChapters) {
    flushChapter()
  }

  parts.push(`  </div>`)

  if (transitionParts.length > 0) {
    parts.push(`  <footer class="back">`)
    parts.push(`    <h2>Övergångsbestämmelser</h2>`)
    parts.push(...transitionParts)
    parts.push(`  </footer>`)
  }

  parts.push(`</article>`)
  return parts.join('\n')
}

// ============================================================================
// Helpers
// ============================================================================

function extractSectionNumber(text: string): string {
  // Handle "2 a §" (space before letter) and "2a §" (no space)
  const match = text.trim().match(/^(\d+)\s*([a-z])?\s*§/)
  if (!match) return '0'
  const num = match[1] ?? '0'
  const letter = match[2] ?? ''
  return `${num}${letter}`
}

function buildSectionId(
  docId: string,
  rawName: string,
  currentChapter: string | null,
  sectionNum: string
): string {
  // If the raw anchor already has a K prefix, use it
  const chapterMatch = rawName.match(/^K(\d+)/)
  const chapter = chapterMatch?.[1] ?? currentChapter

  if (chapter) {
    return `${docId}_K${chapter}_P${sectionNum}`
  }
  return `${docId}_P${sectionNum}`
}

function buildFlatSectionId(
  docId: string,
  _rawName: string,
  sectionNum: string
): string {
  return `${docId}_P${sectionNum}`
}

/**
 * Detect preamble text that should be stripped from the body.
 * These are already represented by the lovhead and hero card.
 */
function isPreambleText(text: string, title: string): boolean {
  const lower = text.toLowerCase()
  const titleLower = title
    .toLowerCase()
    .replace(/\(.*\)/, '')
    .trim()
  if (lower === titleLower) return true
  if (lower.startsWith('utfärdad den ')) return true
  if (lower.startsWith('regeringen föreskriver')) return true
  // "/Träder i kraft I:2026-03-01/" — entry-into-force marker
  if (/^\/?träder i kraft/i.test(text.replace(/^\//, ''))) return true
  return false
}

// SFS number pattern: "2025:1535", "1977:1160", etc.
const SFS_NUMBER_RE = /^\d{4}:\d+$/

function classForTransitionText(text: string): string {
  return SFS_NUMBER_RE.test(text) ? 'text sfs-number' : 'text'
}

function normalizeTransitionContent(html: string): string {
  const $ = cheerio.load(html, {
    decodeEntities: false,
  } as cheerio.CheerioOptions)
  const parts: string[] = []

  // Walk all nodes — Riksdag transition content has loose text, <p>, <b>, <i> etc.
  $('body')
    .contents()
    .each((_, node) => {
      if (node.type === 'text') {
        const text = (node as unknown as { data?: string }).data?.trim()
        if (text && text.length > 1) {
          const cls = classForTransitionText(text)
          parts.push(`    <p class="${cls}">${escapeHtml(text)}</p>`)
        }
        return
      }
      const tagName = (
        node as unknown as { tagName?: string }
      ).tagName?.toLowerCase()
      if (!tagName) return
      const el = $(node)
      const text = el.text().trim()
      if (!text) return

      // Skip anchor elements and br
      if (tagName === 'a' || tagName === 'br') return
      // Skip "Övergångsbestämmelser" heading (already added by caller) — may be <b>, <h3>, etc.
      if (text === 'Övergångsbestämmelser') return

      const cls = classForTransitionText(text)
      if (tagName === 'p') {
        parts.push(`    <p class="${cls}">${el.html()?.trim() || ''}</p>`)
      } else if (tagName === 'i') {
        parts.push(
          `    <p class="text"><em>${el.html()?.trim() || ''}</em></p>`
        )
      } else {
        parts.push(`    <p class="${cls}">${escapeHtml(text)}</p>`)
      }
    })

  return parts.join('\n')
}

/**
 * Measure text content length of the law body (content div or full body).
 * Used to detect when normalization drops too much content.
 */
function extractBodyTextLength($: cheerio.CheerioAPI): number {
  // The content is typically inside a <div> after metadata, or the full body
  const contentDiv = $('body > div').not('.sfstoc').last()
  const source = contentDiv.length > 0 ? contentDiv : $('body')
  return source.text().replace(/\s+/g, ' ').trim().length
}

/**
 * Fallback: wrap cleaned Riksdag HTML in canonical structure without
 * structural parsing. Strips metadata header but preserves all body content.
 */
function buildFallbackDocument(
  docId: string,
  options: SfsLawNormalizerOptions,
  originalHtml: string
): string {
  // Parse from original HTML to get a clean copy
  const $fresh = cheerio.load(originalHtml, {
    decodeEntities: false,
  } as cheerio.CheerioOptions)

  // Remove metadata header
  $fresh('div.sfstoc').remove()
  $fresh('body > h2').first().remove()
  $fresh('body > hr').remove()
  $fresh('body > style').remove()
  // Remove metadata <b>/<br> pairs
  $fresh('body')
    .contents()
    .each((_, node) => {
      const tagName = (
        node as unknown as { tagName?: string }
      ).tagName?.toLowerCase()
      if (tagName === 'b' || tagName === 'br') $fresh(node).remove()
    })
  // Remove orphaned metadata text nodes
  $fresh('body')
    .contents()
    .each((_, node) => {
      if (node.type === 'text') {
        const text = (node as unknown as { data?: string }).data?.trim()
        if (
          text &&
          text.length < 100 &&
          !text.includes('§') &&
          !text.includes('kap.')
        ) {
          $fresh(node).remove()
        }
      }
    })

  // Get the remaining body content
  const bodyHtml = $fresh('body').html()?.trim() || ''

  return [
    `<article class="legal-document" id="${docId}">`,
    `  <div class="lovhead">`,
    `    <h1>`,
    `      <p class="text">${escapeHtml(options.documentNumber)}</p>`,
    `      <p class="text">${escapeHtml(options.title)}</p>`,
    `    </h1>`,
    `  </div>`,
    `  <div class="body">`,
    `    ${bodyHtml}`,
    `  </div>`,
    `</article>`,
  ].join('\n')
}

function buildEmptyDocument(options: SfsLawNormalizerOptions): string {
  const docId = generateDocId(options.documentNumber)
  return [
    `<article class="legal-document" id="${docId}">`,
    `  <div class="lovhead">`,
    `    <h1>`,
    `      <p class="text">${escapeHtml(options.documentNumber)}</p>`,
    `      <p class="text">${escapeHtml(options.title)}</p>`,
    `    </h1>`,
    `  </div>`,
    `  <div class="body">`,
    `  </div>`,
    `</article>`,
  ].join('\n')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&(?!amp;|lt;|gt;|quot;|#)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}
