/**
 * Canonical HTML → JSON Parser
 * Story 14.1, Task 6 (AC: 15)
 *
 * Single parser that works on all content types — no content-type-specific
 * branching. Reads canonical HTML (article.legal-document) and produces
 * CanonicalDocumentJson.
 */

import * as cheerio from 'cheerio'
import type { Element, AnyNode } from 'domhandler'
import type {
  CanonicalDocumentJson,
  CanonicalDivision,
  CanonicalChapter,
  CanonicalParagraf,
  CanonicalStycke,
  CanonicalPreamble,
  CanonicalAppendix,
  DocumentType,
} from './document-json-schema'

// ============================================================================
// Options
// ============================================================================

export interface CanonicalParserOptions {
  /** Override document type detection */
  documentType?: DocumentType
  /** Override SFS number */
  sfsNumber?: string
  /** Base law SFS (for amendments) */
  baseLawSfs?: string
  /** Effective date */
  effectiveDate?: string
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse canonical HTML into structured JSON.
 * Deterministic: same input always produces same output.
 */
export function parseCanonicalHtml(
  html: string,
  options: CanonicalParserOptions = {}
): CanonicalDocumentJson {
  if (!html || !html.trim()) {
    return createEmpty(options)
  }

  const $ = cheerio.load(html, { xml: false })
  const $article = $('article.legal-document')

  if ($article.length === 0) {
    return createEmpty(options)
  }

  // Extract header
  const { title, documentNumber } = extractHeader($article)

  // Detect document type
  const documentType =
    options.documentType || inferDocumentType(documentNumber, $article)

  // Extract preamble
  const preamble = extractPreamble($article)

  // Extract body structure
  const $body = $article.find('> div.body')
  const hasAvdelningar = $body.find('> section.avdelning').length > 0
  const hasKapitel = $body.find('section.kapitel').length > 0

  let divisions: CanonicalDivision[] | null = null
  let chapters: CanonicalChapter[] = []

  if (hasAvdelningar) {
    divisions = extractDivisions($, $body)
    chapters = [] // mutually exclusive
  } else if (hasKapitel) {
    divisions = null
    chapters = extractChapters($, $body)
  } else {
    // Flat document — wrap all paragrafer in implicit chapter
    divisions = null
    chapters = [extractImplicitChapter($, $body)]
  }

  // Extract transition provisions
  const transitionProvisions = extractTransitionProvisions($, $article)

  // Extract appendices
  const appendices = extractAppendices($, $article)

  return {
    schemaVersion: '1.0',
    documentType,
    title,
    documentNumber,
    divisions,
    chapters,
    preamble,
    transitionProvisions,
    appendices,
    metadata: {
      sfsNumber: options.sfsNumber || documentNumber,
      baseLawSfs: options.baseLawSfs || null,
      effectiveDate: options.effectiveDate || null,
    },
  }
}

// ============================================================================
// Header Extraction
// ============================================================================

function extractHeader($article: cheerio.Cheerio<Element>): {
  title: string | null
  documentNumber: string | null
} {
  const $lovhead = $article.find('> div.lovhead')
  const textEls = $lovhead.find('p.text')

  const documentNumber = textEls.eq(0).text().trim() || null
  const title = textEls.eq(1).text().trim() || null

  return { title, documentNumber }
}

// ============================================================================
// Document Type Inference
// ============================================================================

function inferDocumentType(
  documentNumber: string | null,
  $article: cheerio.Cheerio<Element>
): DocumentType {
  const num = (documentNumber || '').toUpperCase()
  const id = ($article.attr('id') || '').toLowerCase()

  if (id.startsWith('eu-')) return 'EU_REGULATION'
  if (num.startsWith('SFS')) {
    // Check for amendment markers
    const classAttr = $article.attr('class') || ''
    if (classAttr.includes('amendment')) return 'SFS_AMENDMENT'
    return 'SFS_LAW'
  }
  // Agency regulation prefixes
  if (
    /^(MSBFS|NFS|AFS|ELSÄK-FS|BFS|SKVFS|KIFS|SSMFS|STAFS|SRVFS|SCB-FS|MCFFS)/i.test(
      num
    )
  ) {
    return 'AGENCY_REGULATION'
  }

  return 'SFS_LAW'
}

// ============================================================================
// Preamble
// ============================================================================

function extractPreamble(
  $article: cheerio.Cheerio<Element>
): CanonicalPreamble | null {
  const $preamble = $article.find('> div.preamble')
  if ($preamble.length === 0) return null

  return {
    htmlContent: $preamble.html() || '',
    text: $preamble.text().trim(),
  }
}

// ============================================================================
// Divisions (Avdelningar)
// ============================================================================

function extractDivisions(
  $: cheerio.CheerioAPI,
  $body: cheerio.Cheerio<Element>
): CanonicalDivision[] {
  const divisions: CanonicalDivision[] = []

  $body.find('> section.avdelning').each((_i, el) => {
    const $avd = $(el)
    const headingText = $avd.find('> h2.avdelning-rubrik').first().text().trim()
    const numMatch = headingText.match(/^Avdelning\s+(\d+)/i)
    const number = numMatch ? numMatch[1]! : String(_i + 1)
    const title = headingText.replace(/^Avdelning\s+\d+\s*/i, '').trim() || null

    const chapters = extractChapters($, $avd)

    divisions.push({ number, title, chapters })
  })

  return divisions
}

// ============================================================================
// Chapters
// ============================================================================

function extractChapters(
  $: cheerio.CheerioAPI,
  $parent: cheerio.Cheerio<Element>
): CanonicalChapter[] {
  const chapters: CanonicalChapter[] = []

  $parent.find('> section.kapitel').each((_i, el) => {
    const $kap = $(el)
    const headingText = $kap
      .find('> h2.kapitel-rubrik, > h3.kapitel-rubrik')
      .first()
      .text()
      .trim()
    const numMatch = headingText.match(/^(\d+)\s*kap\./)
    const number = numMatch ? numMatch[1]! : null

    // Title is everything after "N kap. "
    const title = headingText.replace(/^\d+\s*kap\.\s*/, '').trim() || null

    // If no chapter number found, try chapter heading formats like "KAPITEL I"
    let chapterNum = number
    if (!chapterNum) {
      const romanMatch = headingText.match(/^KAPITEL\s+([IVXLCivxlc]+)/i)
      if (romanMatch) {
        chapterNum = romanMatch[1]!
      }
    }

    const paragrafer = extractParagrafer($, $kap)
    chapters.push({ number: chapterNum, title, paragrafer })
  })

  return chapters
}

// ============================================================================
// Implicit Chapter (flat docs)
// ============================================================================

function extractImplicitChapter(
  $: cheerio.CheerioAPI,
  $body: cheerio.Cheerio<Element>
): CanonicalChapter {
  const paragrafer = extractParagrafer($, $body)
  return { number: null, title: null, paragrafer }
}

// ============================================================================
// Amendment Reference Detection
// ============================================================================

/** Matches "Lag (YYYY:NNN)" or "Förordning (YYYY:NNN)" amendment citations */
const AMENDMENT_REF_RE = /^(?:Lag|Förordning)\s+\(\d{4}:\d+[a-z]?\)\.?$/

/**
 * Matches list items in Swedish legal text:
 * - Numbered: "1. text", "2. text"
 * - Dash-prefixed: "- text"
 * - Letter-prefixed: "a) text", "b) text"
 */
const LIST_ITEM_NUMBERED_RE = /^\d+\.\s/
const LIST_ITEM_DASH_RE = /^- /
const LIST_ITEM_LETTER_RE = /^[a-z]\)\s/

function isListItem(text: string): boolean {
  return (
    LIST_ITEM_NUMBERED_RE.test(text) ||
    LIST_ITEM_DASH_RE.test(text) ||
    LIST_ITEM_LETTER_RE.test(text)
  )
}

/** Extract list item number/identifier from text */
function extractListItemNumber(text: string): number | null {
  const numMatch = text.match(/^(\d+)\.\s/)
  if (numMatch) return parseInt(numMatch[1]!, 10)
  // For dash/letter lists, return null (no numeric index)
  return null
}

// ============================================================================
// Paragrafer (§ / Artikel)
// ============================================================================

function extractParagrafer(
  $: cheerio.CheerioAPI,
  $parent: cheerio.Cheerio<Element>
): CanonicalParagraf[] {
  const rawParagrafer: Array<{
    number: string
    heading: string | null
    rawStycken: CanonicalStycke[]
  }> = []

  // Walk direct children to find h3.paragraph boundaries
  const children = $parent.children().toArray()
  let current: (typeof rawParagrafer)[0] | null = null

  for (const child of children) {
    const $child = $(child)
    const tagName = child.type === 'tag' ? (child as Element).tagName : null

    // Skip chapter/avdelning headings (already processed)
    if (
      $child.hasClass('kapitel-rubrik') ||
      $child.hasClass('avdelning-rubrik')
    ) {
      continue
    }

    // Skip nested sections (already extracted by extractChapters)
    if ($child.hasClass('kapitel') || $child.hasClass('avdelning')) {
      continue
    }

    // h3.paragraph > a.paragraf = new paragraf (§)
    if (tagName === 'h3' && $child.hasClass('paragraph')) {
      // Save previous paragraf
      if (current) {
        rawParagrafer.push(current)
      }

      const $a = $child.find('a.paragraf')
      const sectionText = $a.text().trim()
      const numMatch = sectionText
        .replace(/\u00a0/g, ' ')
        .match(/^(\d+[a-z]?)\s*§/)
      // EU articles: "Artikel N" or "Artikel N — subtitle"
      const artMatch = sectionText.match(/^Artikel\s+(\d+[a-z]?)/)
      const number = numMatch
        ? numMatch[1]!
        : artMatch
          ? `art${artMatch[1]}`
          : sectionText.replace(/\s*§.*/, '').trim()

      // Check for subtitle in the anchor text (EU pattern: "Artikel 1 — Syfte")
      let heading: string | null = null
      if (artMatch) {
        const subtitleMatch = sectionText.match(/—\s*(.+)$/)
        if (subtitleMatch) heading = subtitleMatch[1]!.trim()
      }

      current = { number, heading, rawStycken: [] }
      continue
    }

    // Non-§ heading (group heading within chapter)
    if (
      tagName === 'h3' &&
      !$child.hasClass('paragraph') &&
      !$child.hasClass('kapitel-rubrik')
    ) {
      if (current) {
        current.rawStycken.push({
          number: null,
          text: $child.text().trim(),
          role: 'HEADING',
        })
      }
      continue
    }

    // Content elements — add to current paragraf
    if (current) {
      const stycken = parseContentElement($, $child, tagName)
      current.rawStycken.push(...stycken)
    }
  }

  // Push final paragraf
  if (current) {
    rawParagrafer.push(current)
  }

  // P0 fix: Shift trailing HEADINGs from par N to heading of par N+1
  for (let i = 0; i < rawParagrafer.length - 1; i++) {
    const par = rawParagrafer[i]!
    const stk = par.rawStycken
    if (stk.length > 0 && stk[stk.length - 1]!.role === 'HEADING') {
      const headingStycke = stk.pop()!
      const next = rawParagrafer[i + 1]!
      if (!next.heading) {
        next.heading = headingStycke.text
      }
    }
  }

  // Post-process: extract amendment refs, number stycken, detect list items
  return rawParagrafer.map(postProcessParagraf)
}

/**
 * Post-process a raw paragraf:
 * - Extract amendment reference (last stycke matching "Lag (YYYY:NNN)")
 * - Number stycken (1, 2, 3...) for STYCKE role items
 * - Detect numbered list items (role: LIST_ITEM)
 * - Build content string for chunking
 */
function postProcessParagraf(raw: {
  number: string
  heading: string | null
  rawStycken: CanonicalStycke[]
}): CanonicalParagraf {
  const stycken = [...raw.rawStycken]
  let amendedBy: string | null = null

  // Extract amendment reference — scan backwards, skip HEADINGs and rubric-like text
  for (let i = stycken.length - 1; i >= 0; i--) {
    const s = stycken[i]!
    if (s.role === 'HEADING') continue
    if (s.role === 'STYCKE' && AMENDMENT_REF_RE.test(s.text)) {
      amendedBy = s.text.replace(/\.$/, '')
      stycken.splice(i, 1)
      break
    }
    // If we hit actual content (more than a short rubric), stop scanning
    if (s.text.length > 80) break
  }

  // Detect list items and number stycken
  let styckeNum = 0
  for (const s of stycken) {
    if (s.role === 'STYCKE') {
      if (isListItem(s.text)) {
        s.role = 'LIST_ITEM'
        s.number = extractListItemNumber(s.text)
      } else {
        styckeNum++
        s.number = styckeNum
      }
    }
  }

  // Build content string: all non-HEADING, non-TABLE stycke texts
  const contentParts: string[] = []
  for (const s of stycken) {
    if (s.role === 'HEADING' || s.role === 'TABLE') continue
    if (s.text) contentParts.push(s.text)
  }
  const content = contentParts.join('\n')

  return {
    number: raw.number,
    heading: raw.heading,
    content,
    amendedBy,
    stycken,
  }
}

// ============================================================================
// Content Element Parsing
// ============================================================================

function parseContentElement(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<AnyNode>,
  tagName: string | null
): CanonicalStycke[] {
  // p.text = regular stycke
  if (tagName === 'p' && $el.hasClass('text')) {
    return [
      {
        number: null,
        text: $el.text().trim(),
        role: 'STYCKE',
      },
    ]
  }

  // div.allmanna-rad
  if ($el.hasClass('allmanna-rad')) {
    const texts: CanonicalStycke[] = []
    $el.find('p').each((_i, p) => {
      const text = $(p).text().trim()
      if (text) {
        texts.push({
          number: null,
          text,
          role: 'ALLMANT_RAD',
        })
      }
    })
    return texts
  }

  // table.legal-table
  if (tagName === 'table') {
    return [
      {
        number: null,
        text: $el.text().trim(),
        role: 'TABLE',
        htmlContent: $.html($el) || '',
      },
    ]
  }

  // Generic p without class (fallback)
  if (tagName === 'p') {
    const text = $el.text().trim()
    if (text) {
      return [{ number: null, text, role: 'STYCKE' }]
    }
  }

  // ol/ul lists — flatten into stycke
  if (tagName === 'ol' || tagName === 'ul') {
    return [
      {
        number: null,
        text: $el.text().trim(),
        role: 'STYCKE',
        htmlContent: $.html($el) || '',
      },
    ]
  }

  return []
}

// ============================================================================
// Transition Provisions
// ============================================================================

function extractTransitionProvisions(
  $: cheerio.CheerioAPI,
  $article: cheerio.Cheerio<Element>
): CanonicalStycke[] | null {
  const $footer = $article.find('> footer.back')
  if ($footer.length === 0) return null

  const stycken: CanonicalStycke[] = []
  $footer.find('p.text, p').each((_i, el) => {
    const text = $(el).text().trim()
    if (text) {
      stycken.push({
        number: null,
        text,
        role: 'TRANSITION_PROVISION',
      })
    }
  })

  return stycken.length > 0 ? stycken : null
}

// ============================================================================
// Appendices
// ============================================================================

function extractAppendices(
  $: cheerio.CheerioAPI,
  $article: cheerio.Cheerio<Element>
): CanonicalAppendix[] | null {
  const $appendices = $article.find('> div.appendices')
  if ($appendices.length === 0) return null

  const result: CanonicalAppendix[] = []
  const headings = $appendices.find('> h2').toArray()

  if (headings.length === 0) {
    // Single appendix without heading
    result.push({
      title: null,
      htmlContent: $appendices.html() || '',
      text: $appendices.text().trim(),
    })
  } else {
    // Multiple appendices separated by h2 headings
    for (let i = 0; i < headings.length; i++) {
      const $heading = $(headings[i]!)
      const title = $heading.text().trim()
      const parts: string[] = [$.html(headings[i]!) || '']

      let $next = $heading.next()
      while ($next.length && $next.get(0) !== headings[i + 1]) {
        parts.push($.html($next) || '')
        $next = $next.next()
      }

      const htmlContent = parts.join('\n')
      const tempDoc = cheerio.load(htmlContent)
      result.push({
        title,
        htmlContent,
        text: tempDoc.text().trim(),
      })
    }
  }

  return result.length > 0 ? result : null
}

// ============================================================================
// Empty Document
// ============================================================================

function createEmpty(options: CanonicalParserOptions): CanonicalDocumentJson {
  return {
    schemaVersion: '1.0',
    documentType: options.documentType || 'SFS_LAW',
    title: null,
    documentNumber: null,
    divisions: null,
    chapters: [],
    preamble: null,
    transitionProvisions: null,
    appendices: null,
    metadata: {
      sfsNumber: options.sfsNumber || null,
      baseLawSfs: options.baseLawSfs || null,
      effectiveDate: options.effectiveDate || null,
    },
  }
}
