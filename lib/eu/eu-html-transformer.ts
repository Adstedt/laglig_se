/**
 * EU HTML Transformer — CELLAR ELI HTML → Laglig schema
 *
 * Converts raw EUR-Lex CELLAR API HTML (ELI format) into the Laglig
 * document schema used by StickyDocNav and .legal-document CSS.
 *
 * Three structure types:
 * 1. Chaptered: chapters (cpt_* or chp_*) containing articles → section.kapitel + h2/h3
 * 2. Flat: articles only (art_*) → a.paragraf anchors
 * 3. Minimal: no recognizable structure → body only
 *
 * Real CELLAR HTML patterns:
 * - Chapters: div[id="cpt_I"], NOT eli-subdivision — headings in p.oj-ti-section-1
 * - Chapter subtitles: div.eli-title > p.oj-ti-section-2
 * - Articles: div.eli-subdivision[id="art_N"] — headings in p.oj-ti-art
 * - Recitals use layout tables (colgroup 4%/96%) — these are NOT real tables
 * - Footnotes: a[id^="ntc"] wrapping span.oj-super.oj-note-tag
 */

import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'

// ============================================================================
// Types
// ============================================================================

export interface EuDocumentInfo {
  /** CELEX number, e.g. "32016R0679" */
  celex: string
  /** Document number for display, e.g. "(EU) 2016/679" */
  documentNumber: string
  /** Short/popular title, e.g. "Allmän dataskyddsförordning (GDPR)" */
  shortTitle?: string
}

export interface EuTransformResult {
  /** Complete transformed HTML wrapped in <article class="legal-document"> */
  html: string
  /** Detected structure type */
  structureType: 'chaptered' | 'flat' | 'minimal'
  /** Stats for verification */
  stats: {
    chapterCount: number
    articleCount: number
    recitalCount: number
    footnoteCount: number
    tableCount: number
  }
}

// ============================================================================
// Core Transformer
// ============================================================================

/**
 * Transform CELLAR ELI HTML into Laglig schema HTML.
 *
 * @param rawHtml - Raw HTML from fetchDocumentContentViaCellar
 * @param doc - Document identification info
 * @returns Transformed HTML with stats
 */
export function transformEuHtml(
  rawHtml: string,
  doc: EuDocumentInfo
): EuTransformResult {
  const $ = cheerio.load(rawHtml, { xml: false })

  const stats = {
    chapterCount: 0,
    articleCount: 0,
    recitalCount: 0,
    footnoteCount: 0,
    tableCount: 0,
  }

  // Phase 1: Strip OJ header
  stripOjHeader($)

  // Phase 2: Extract footnotes
  const footnoteMap = extractFootnotes($)
  stats.footnoteCount = footnoteMap.size

  // Phase 3: Detect structure
  const structureType = detectStructure($)

  // Phase 4: Transform footnote markers
  transformFootnoteMarkers($, footnoteMap)

  // Phase 5: Remove recital layout tables, then tag real content tables
  removeRecitalLayoutTables($)
  $('table').each((_i, el) => {
    $(el).addClass('legal-table')
    stats.tableCount++
  })

  // Phase 6: Extract preamble
  const preambleHtml = extractPreamble($, stats)

  // Compute docId early — needed by body transforms for semantic IDs
  const docId = `eu-${doc.celex.toLowerCase()}`

  // Phase 7: Transform body
  let bodyHtml: string
  if (structureType === 'chaptered') {
    bodyHtml = transformChapteredBody($, stats, docId)
  } else if (structureType === 'flat') {
    bodyHtml = transformFlatBody($, stats, docId)
  } else {
    bodyHtml = transformMinimalBody($, stats, docId)
  }

  // Phase 8: Clean up remaining ELI/OJ classes
  const bodyDoc = cheerio.load(bodyHtml, { xml: false })
  cleanupClasses(bodyDoc)
  addTextClass(bodyDoc)
  bodyHtml = bodyDoc.html() || ''

  const preambleDoc = cheerio.load(preambleHtml, { xml: false })
  cleanupClasses(preambleDoc)
  const cleanedPreamble = preambleDoc.html() || ''

  // Phase 9: Assemble final document
  const html = assembleDocument(docId, doc, cleanedPreamble, bodyHtml)

  return { html, structureType, stats }
}

// ============================================================================
// Phase 1: Strip OJ Header
// ============================================================================

function stripOjHeader($: cheerio.CheerioAPI): void {
  // Remove OJ separator lines
  $('hr.oj-separator').remove()

  // Remove the initial OJ reference table (usually the first table in the doc)
  const firstTable = $('table').first()
  if (firstTable.length) {
    const text = firstTable.text()
    if (
      text.includes('officiella tidning') ||
      text.includes('Official Journal') ||
      text.includes('EUT ') ||
      text.includes('EGT ')
    ) {
      firstTable.remove()
    }
  }
}

// ============================================================================
// Phase 2: Extract Footnotes
// ============================================================================

function extractFootnotes($: cheerio.CheerioAPI): Map<string, string> {
  const footnoteMap = new Map<string, string>()

  // EUR-Lex footnotes are in div.oj-final or as ntr* anchors at the bottom
  $('div.oj-final').each((_i, el) => {
    const $div = $(el)
    $div.find('p').each((_j, p) => {
      const text = $(p).text().trim()
      const match = text.match(/^\((\d+)\)\s+(.+)/)
      if (match) {
        footnoteMap.set(match[1]!, match[2]!)
      }
    })
    $div.remove()
  })

  // ntr* footnote target anchors (e.g., id="ntr1-L_2016119SV...")
  $('[id^="ntr"]').each((_i, el) => {
    const $el = $(el)
    const id = $el.attr('id') || ''
    const numMatch = id.match(/^ntr(\d+)/)
    if (numMatch) {
      const text = $el.text().trim()
      // Footnote text is usually "(N) actual text"
      const contentMatch = text.match(/^\(?\d+\)?\s*(.+)/)
      footnoteMap.set(numMatch[1]!, contentMatch ? contentMatch[1]! : text)
    }
    $el.remove()
  })

  return footnoteMap
}

// ============================================================================
// Phase 3: Detect Structure
// ============================================================================

/**
 * Match article-level IDs only (art_1, art_2, etc) but NOT paragraph IDs (art_1.par_1).
 */
function isArticleId(id: string): boolean {
  return /^art_\d+[a-z]?$/.test(id)
}

/**
 * Match top-level chapter IDs (cpt_I, cpt_II) but NOT sub-elements (cpt_I.tit_1, cpt_III.sct_1).
 */
function isTopLevelChapterId(id: string): boolean {
  return (
    /^cpt_[IVX]+$/.test(id) || /^chp_[IVX]+$/.test(id) || /^chp_\d+$/.test(id)
  )
}

/** Select only article-level eli-subdivisions (not paragraph-level) */
function selectArticles(
  $: cheerio.CheerioAPI,
  $parent?: cheerio.Cheerio<Element>
): cheerio.Cheerio<Element> {
  const selector = '[id^="art_"]'
  const all = $parent ? $parent.find(selector) : $(selector)
  const results: Element[] = []

  all.each((_i, el) => {
    const id = $(el).attr('id') || ''
    if (isArticleId(id)) {
      results.push(el as Element)
    }
  })

  return $(results)
}

/** Select only top-level chapter divs */
function selectChapters($: cheerio.CheerioAPI): cheerio.Cheerio<Element> {
  const results: Element[] = []

  // CELLAR uses cpt_* (e.g., cpt_I, cpt_II) — most common real pattern
  $('[id^="cpt_"], [id^="chp_"]').each((_i, el) => {
    const id = $(el).attr('id') || ''
    if (isTopLevelChapterId(id)) {
      results.push(el as Element)
    }
  })

  return $(results)
}

export function detectStructure(
  $: cheerio.CheerioAPI
): 'chaptered' | 'flat' | 'minimal' {
  // Check for chapter divs (cpt_* or chp_*)
  const chapters = selectChapters($)
  if (chapters.length >= 2) return 'chaptered'

  // Check for article subdivisions (art_N only, not art_N.par_N)
  const articles = selectArticles($)
  if (articles.length >= 2) return 'flat'

  // Also check for article headings without eli-subdivision wrappers
  const artHeadings = $('p.oj-ti-art')
  if (artHeadings.length >= 2) return 'flat'

  return 'minimal'
}

// ============================================================================
// Phase 4: Transform Footnote Markers
// ============================================================================

function transformFootnoteMarkers(
  $: cheerio.CheerioAPI,
  footnoteMap: Map<string, string>
): void {
  // EUR-Lex wraps footnote markers in: a[id^="ntc"] > (span.oj-super.oj-note-tag)
  // Handle the outer anchor first (replaces the whole thing including inner span)
  $('a[id^="ntc"]').each((_i, el) => {
    const $el = $(el)
    const innerSpan = $el.find('span.oj-super.oj-note-tag')
    const text = (innerSpan.length ? innerSpan.text() : $el.text())
      .trim()
      .replace(/[()]/g, '')
    if (/^\d+$/.test(text)) {
      const noteContent = footnoteMap.get(text) || ''
      $el.replaceWith(
        `<sup class="footnote-ref" data-note="${escapeAttr(text)}" title="${escapeAttr(noteContent)}">${text}</sup>`
      )
    }
  })

  // Handle any remaining standalone spans or anchors
  $('span.oj-super.oj-note-tag, a.oj-note-tag').each((_i, el) => {
    const $el = $(el)
    const noteText = $el.text().trim().replace(/[()]/g, '')
    if (/^\d+$/.test(noteText)) {
      const noteContent = footnoteMap.get(noteText) || ''
      $el.replaceWith(
        `<sup class="footnote-ref" data-note="${escapeAttr(noteText)}" title="${escapeAttr(noteContent)}">${noteText}</sup>`
      )
    }
  })
}

// ============================================================================
// Phase 5: Remove recital layout tables
// ============================================================================

/**
 * EUR-Lex recitals are rendered as two-column layout tables (4%/96%).
 * These are NOT real content tables — they're a typographic formatting device.
 * Replace them with just the text content from the right column.
 */
function removeRecitalLayoutTables($: cheerio.CheerioAPI): void {
  // Target tables inside recital subdivisions
  $('[id^="rct_"] > table, [id^="cit_"] > table').each((_i, el) => {
    const $table = $(el)
    // Verify it's a layout table: has colgroup with 4%/96% or similar narrow/wide split
    const cols = $table.find('colgroup col')
    if (cols.length === 2) {
      const w1 = cols.first().attr('width') || ''
      const w2 = cols.last().attr('width') || ''
      if (
        (w1.includes('4%') || w1.includes('5%') || parseInt(w1) <= 10) &&
        (w2.includes('96%') || w2.includes('95%') || parseInt(w2) >= 80)
      ) {
        // It's a layout table — extract the content from the right column
        const rightTd = $table.find('td').last()
        const content = rightTd.html() || ''
        $table.replaceWith(content)
        return
      }
    }

    // Also check for single-cell layout tables used for indentation
    const tds = $table.find('td')
    if (tds.length === 1) {
      const content = tds.first().html() || ''
      $table.replaceWith(content)
    }
  })

  // Also handle layout tables in numbered paragraphs (article points/subpoints)
  // These use (a), (b), (c) style numbering in layout tables
  $('[id^="art_"] table').each((_i, el) => {
    const $table = $(el)
    const cols = $table.find('colgroup col')
    if (cols.length === 2) {
      const w1 = cols.first().attr('width') || ''
      if (w1.includes('4%') || w1.includes('5%') || parseInt(w1) <= 10) {
        // Layout table for point numbering — convert to paragraphs
        const rows: string[] = []
        $table.find('tr').each((_j, tr) => {
          const cells = $(tr).find('td')
          if (cells.length >= 2) {
            const marker = cells.first().text().trim()
            const content = cells.last().html() || ''
            rows.push(`<p>${marker} ${content}</p>`)
          }
        })
        $table.replaceWith(rows.join('\n'))
      }
    }
  })
}

// ============================================================================
// Phase 6: Extract Preamble
// ============================================================================

function extractPreamble(
  $: cheerio.CheerioAPI,
  stats: { recitalCount: number }
): string {
  const preambleParts: string[] = []

  // Preamble subdivisions: pbl_*, cit_*, rct_*
  $('[id^="pbl_"]').each((_i, el) => {
    const $el = $(el)

    // Count recitals
    $el.find('[id^="rct_"]').each(() => {
      stats.recitalCount++
    })

    const inner = $el.html()
    if (inner) {
      preambleParts.push(inner)
    }
    $el.remove()
  })

  // Also capture standalone citation/recital blocks outside pbl_*
  $('[id^="cit_"], [id^="rct_"]').each((_i, el) => {
    const $el = $(el)
    if ($el.parents('[id^="pbl_"]').length === 0) {
      const id = $el.attr('id') || ''
      if (id.startsWith('rct_')) stats.recitalCount++
      const inner = $el.html()
      if (inner) preambleParts.push(inner)
      $el.remove()
    }
  })

  if (preambleParts.length === 0) return ''
  return preambleParts.join('\n')
}

// ============================================================================
// Phase 7a: Transform Chaptered Body
// ============================================================================

function transformChapteredBody(
  $: cheerio.CheerioAPI,
  stats: { chapterCount: number; articleCount: number },
  docId: string
): string {
  const sections: string[] = []

  selectChapters($).each((_i, el) => {
    const $chapter = $(el)
    const chapterId = $chapter.attr('id') || ''
    stats.chapterCount++

    // Extract chapter heading
    const chapterHeading = extractChapterHeading($chapter)

    // Extract articles within this chapter
    const articles = extractArticles($, $chapter, stats, docId)

    // Build section ID: cpt_I → {docId}_K1, cpt_II → {docId}_K2
    const romanNum = chapterId.replace(/^(cpt|chp)_/, '')
    const arabicNum = romanToArabic(romanNum)
    const sectionId = `${docId}_K${arabicNum}`

    let sectionHtml = `<section class="kapitel" id="${escapeAttr(sectionId)}">\n`
    sectionHtml += `  <h2 class="kapitel-rubrik">${chapterHeading}</h2>\n`
    sectionHtml += articles
    sectionHtml += `</section>\n`

    sections.push(sectionHtml)
    $chapter.remove()
  })

  // Any remaining articles outside chapters
  const remainingArticles = extractArticlesFromRoot($, stats, docId)
  if (remainingArticles) {
    sections.push(remainingArticles)
  }

  return sections.join('\n')
}

function extractChapterHeading($chapter: cheerio.Cheerio<Element>): string {
  // Real CELLAR pattern: p.oj-ti-section-1 > span.oj-italic for "KAPITEL I"
  // Subtitle in: div.eli-title > p.oj-ti-section-2 > span > span.oj-italic
  // Test fixture pattern: p.oj-ti-grseq-1 + p.oj-sti-grseq-1

  const sec1 = $chapter.find('p.oj-ti-section-1').first()
  const grseq1 = $chapter.find('p.oj-ti-grseq-1').first()
  const titleEl = sec1.length ? sec1 : grseq1

  const sec2 = $chapter.find('p.oj-ti-section-2').first()
  const stiGrseq1 = $chapter.find('p.oj-sti-grseq-1').first()
  const subtitleEl = sec2.length ? sec2 : stiGrseq1

  let heading = titleEl.text().trim()
  const subtitle = subtitleEl.text().trim()

  if (subtitle && heading) {
    heading = `${heading} — ${subtitle}`
  } else if (subtitle) {
    heading = subtitle
  }

  if (!heading) {
    const id = $chapter.attr('id') || ''
    const numMatch = id.match(/(?:cpt|chp)_(.+)/)
    heading = numMatch ? `KAPITEL ${numMatch[1]}` : 'KAPITEL'
  }

  return escapeHtml(heading)
}

function extractArticles(
  $: cheerio.CheerioAPI,
  $parent: cheerio.Cheerio<Element>,
  stats: { articleCount: number },
  docId: string
): string {
  const parts: string[] = []

  selectArticles($, $parent).each((_i, el) => {
    const $article = $(el)
    const artId = $article.attr('id') || ''
    stats.articleCount++

    const artTitleEl = $article.find('p.oj-ti-art').first()
    const artSubtitleEl = $article.find('p.oj-sti-art').first()

    let artTitle = artTitleEl.text().trim()
    const artSubtitle = artSubtitleEl.text().trim()

    if (!artTitle) {
      const numMatch = artId.match(/art_(\d+)/)
      artTitle = numMatch ? `Artikel ${numMatch[1]}` : 'Artikel'
    }

    artTitleEl.remove()
    artSubtitleEl.remove()

    const numMatch = artId.match(/art_(\d+[a-z]?)/)
    const anchorId = numMatch
      ? `${docId}_art${numMatch[1]}`
      : `${docId}_${artId.replace('_', '-')}`

    let label = escapeHtml(artTitle)
    if (artSubtitle) {
      label += ` — <em>${escapeHtml(artSubtitle)}</em>`
    }

    parts.push(
      `  <h3 class="paragraph" id="${escapeAttr(anchorId)}"><a class="paragraf" id="${escapeAttr(anchorId)}" name="${escapeAttr(anchorId)}">${label}</a></h3>\n`
    )

    const bodyHtml = extractArticleBody($, $article)
    if (bodyHtml) {
      parts.push(`  ${bodyHtml}\n`)
    }
  })

  return parts.join('')
}

function extractArticlesFromRoot(
  $: cheerio.CheerioAPI,
  stats: { articleCount: number },
  docId: string
): string {
  const parts: string[] = []

  selectArticles($).each((_i, el) => {
    const $article = $(el)
    // Skip if inside a chapter (already processed)
    if (
      $article.parents('[id^="cpt_"]').length > 0 ||
      $article.parents('[id^="chp_"]').length > 0
    ) {
      return
    }

    stats.articleCount++

    const artTitleEl = $article.find('p.oj-ti-art').first()
    const artSubtitleEl = $article.find('p.oj-sti-art').first()

    let artTitle = artTitleEl.text().trim()
    const artSubtitle = artSubtitleEl.text().trim()
    const artId = $article.attr('id') || ''

    if (!artTitle) {
      const numMatch = artId.match(/art_(\d+)/)
      artTitle = numMatch ? `Artikel ${numMatch[1]}` : 'Artikel'
    }

    artTitleEl.remove()
    artSubtitleEl.remove()

    const numMatch = artId.match(/art_(\d+[a-z]?)/)
    const anchorId = numMatch
      ? `${docId}_art${numMatch[1]}`
      : `${docId}_${artId.replace('_', '-')}`

    let label = escapeHtml(artTitle)
    if (artSubtitle) {
      label += ` — <em>${escapeHtml(artSubtitle)}</em>`
    }

    parts.push(
      `<h3 class="paragraph" id="${escapeAttr(anchorId)}"><a class="paragraf" id="${escapeAttr(anchorId)}" name="${escapeAttr(anchorId)}">${label}</a></h3>\n`
    )

    const bodyHtml = extractArticleBody($, $article)
    if (bodyHtml) {
      parts.push(`${bodyHtml}\n`)
    }
  })

  return parts.join('')
}

function extractArticleBody(
  $: cheerio.CheerioAPI,
  $article: cheerio.Cheerio<Element>
): string {
  const bodyParts: string[] = []

  $article.children().each((_i, child) => {
    const $child = $(child)
    const id = $child.attr('id') || ''
    const tagName = (
      'tagName' in child ? (child as Element).tagName : ''
    )?.toLowerCase()

    // Skip already-processed headings
    if ($child.hasClass('oj-ti-art') || $child.hasClass('oj-sti-art')) {
      return
    }

    if (id.match(/par_\d/)) {
      // Numbered paragraph subdivision
      const innerHtml = $child.html() || ''
      bodyParts.push(innerHtml)
    } else if (tagName === 'p') {
      bodyParts.push($.html($child) || '')
    } else if (tagName === 'table') {
      bodyParts.push($.html($child) || '')
    } else if (tagName === 'div' || tagName === 'ol' || tagName === 'ul') {
      const innerHtml = $child.html() || ''
      if (innerHtml.trim()) {
        bodyParts.push(innerHtml)
      }
    }
  })

  return bodyParts.join('\n')
}

// ============================================================================
// Phase 7b: Transform Flat Body (articles only, no chapters)
// ============================================================================

function transformFlatBody(
  $: cheerio.CheerioAPI,
  stats: { articleCount: number },
  docId: string
): string {
  const parts: string[] = []

  selectArticles($).each((_i, el) => {
    const $article = $(el)
    const artId = $article.attr('id') || ''
    stats.articleCount++

    const artTitleEl = $article.find('p.oj-ti-art').first()
    const artSubtitleEl = $article.find('p.oj-sti-art').first()

    let artTitle = artTitleEl.text().trim()
    const artSubtitle = artSubtitleEl.text().trim()

    if (!artTitle) {
      const numMatch = artId.match(/art_(\d+)/)
      artTitle = numMatch ? `Artikel ${numMatch[1]}` : 'Artikel'
    }

    artTitleEl.remove()
    artSubtitleEl.remove()

    const numMatch = artId.match(/art_(\d+[a-z]?)/)
    const anchorId = numMatch
      ? `${docId}_art${numMatch[1]}`
      : `${docId}_${artId.replace('_', '-')}`

    let label = escapeHtml(artTitle)
    if (artSubtitle) label += ` — ${escapeHtml(artSubtitle)}`

    parts.push(
      `<h3 class="paragraph" id="${escapeAttr(anchorId)}"><a class="paragraf" id="${escapeAttr(anchorId)}" name="${escapeAttr(anchorId)}">${label}</a></h3>\n`
    )

    const bodyHtml = extractArticleBody($, $article)
    if (bodyHtml) {
      parts.push(`${bodyHtml}\n`)
    }
  })

  return parts.join('')
}

// ============================================================================
// Phase 7c: Transform Minimal Body (no recognizable structure)
// ============================================================================

function transformMinimalBody(
  $: cheerio.CheerioAPI,
  stats: { articleCount: number },
  docId: string
): string {
  // Check for article-like headings in p tags (p.oj-ti-art)
  const artHeadings = $('p.oj-ti-art')
  if (artHeadings.length >= 2) {
    const parts: string[] = []
    let artNum = 0

    artHeadings.each((_i, el) => {
      const $heading = $(el)
      const artTitle = $heading.text().trim()
      artNum++
      stats.articleCount++

      const anchorId = `${docId}_art${artNum}`
      parts.push(
        `<h3 class="paragraph" id="${escapeAttr(anchorId)}"><a class="paragraf" id="${escapeAttr(anchorId)}" name="${escapeAttr(anchorId)}">${escapeHtml(artTitle)}</a></h3>\n`
      )

      let $next = $heading.next()
      while ($next.length && !$next.hasClass('oj-ti-art')) {
        parts.push($.html($next) || '')
        $next = $next.next()
      }
    })

    return parts.join('\n')
  }

  // Fallback: extract the main container content
  const mainContainer =
    $('.eli-container').html() ||
    $('[id="document"]').html() ||
    $('body').html() ||
    ''

  return mainContainer
}

// ============================================================================
// Phase 8: Cleanup
// ============================================================================

function cleanupClasses($: cheerio.CheerioAPI): void {
  $('[class]').each((_i, el) => {
    const $el = $(el)
    const classes = ($el.attr('class') || '').split(/\s+/)
    const kept = classes.filter(
      (c) =>
        !c.startsWith('oj-') &&
        !c.startsWith('eli-') &&
        c !== 'eli-container' &&
        c !== 'eli-main-title' &&
        c !== 'eli-subdivision' &&
        c !== ''
    )

    if (kept.length > 0) {
      $el.attr('class', kept.join(' '))
    } else {
      $el.removeAttr('class')
    }
  })

  // Remove empty div wrappers
  $('div:not([id]):not([class])').each((_i, el) => {
    const $el = $(el)
    if (!$el.attr('style') && !$el.attr('data-note')) {
      $el.replaceWith($el.html() || '')
    }
  })
}

// ============================================================================
// Phase 9: Assemble
// ============================================================================

function assembleDocument(
  docId: string,
  doc: EuDocumentInfo,
  preambleHtml: string,
  bodyHtml: string
): string {
  const parts: string[] = []

  parts.push(`<article class="legal-document" id="${escapeAttr(docId)}">`)

  parts.push(`  <div class="lovhead">`)
  parts.push(`    <h1>`)
  parts.push(`      <p class="text">${escapeHtml(doc.documentNumber)}</p>`)
  if (doc.shortTitle) {
    parts.push(`      <p class="text">${escapeHtml(doc.shortTitle)}</p>`)
  }
  parts.push(`    </h1>`)
  parts.push(`  </div>`)

  if (preambleHtml.trim()) {
    parts.push(`  <details class="preamble-accordion">`)
    parts.push(`    <summary>Inledning och skäl</summary>`)
    parts.push(`    <div class="preamble">`)
    parts.push(`      ${preambleHtml}`)
    parts.push(`    </div>`)
    parts.push(`  </details>`)
  }

  parts.push(`  <div class="body">`)
  parts.push(`    ${bodyHtml}`)
  parts.push(`  </div>`)

  parts.push(`</article>`)

  return parts.join('\n')
}

// ============================================================================
// Helpers
// ============================================================================

/** Add class="text" to bare <p> elements (no existing class) */
function addTextClass($: cheerio.CheerioAPI): void {
  $('p').each((_i, el) => {
    const $p = $(el)
    if (!$p.attr('class')) {
      $p.addClass('text')
    }
  })
}

/** Convert Roman numeral string to Arabic number */
function romanToArabic(roman: string): number {
  const map: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
  }
  let result = 0
  const upper = roman.toUpperCase()
  for (let i = 0; i < upper.length; i++) {
    const curr = map[upper[i]!] || 0
    const next = map[upper[i + 1]!] || 0
    result += curr < next ? -curr : curr
  }
  return result
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
