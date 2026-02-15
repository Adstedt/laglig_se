/**
 * Deterministic HTML to JSON parser for legal documents
 * Story 2.29: Used to derive json_content from html_content
 *
 * Produces a structured JSON representation suitable for:
 * - Programmatic access to document sections
 * - Structured queries
 * - Section-level operations
 */

import * as cheerio from 'cheerio'

// Type helper for DOM nodes
interface DomNode {
  type: string
  data?: string
  tagName?: string
  childNodes?: DomNode[]
  attribs?: Record<string, string>
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface LegalDocumentJson {
  /** Document type (e.g., "amendment", "law", "regulation") */
  type: 'amendment' | 'law' | 'regulation' | 'court_case' | 'eu_document'
  /** Document title */
  title: string | null
  /** Document metadata */
  metadata: DocumentMetadata
  /** Main content sections */
  sections: Section[]
  /** Transition provisions (Övergångsbestämmelser) */
  transitionProvisions: TransitionProvision[]
  /** Footnotes */
  footnotes: Footnote[]
  /** Definition lists */
  definitions: Definition[]
  /** Legislative references (prop, bet, rskr) extracted from footnotes - for Story 9.1 */
  legislativeReferences: LegislativeReference[]
}

export interface DocumentMetadata {
  /** SFS number if applicable */
  sfsNumber: string | null
  /** Base law SFS number (for amendments) */
  baseLawSfs: string | null
  /** Effective date */
  effectiveDate: string | null
  /** Publication date */
  publicationDate: string | null
  /** Any data attributes from the HTML */
  dataAttributes: Record<string, string>
}

export interface Section {
  /** Unique ID within document */
  id: string
  /** Section type */
  type: 'chapter' | 'section' | 'paragraph' | 'subsection'
  /** Chapter number if applicable */
  chapter: string | null
  /** Section number (e.g., "15", "2a") */
  number: string | null
  /** Section heading */
  heading: string | null
  /** Section content (HTML stripped to text) */
  content: string
  /** HTML content for rendering */
  htmlContent: string
  /** Nested subsections */
  children: Section[]
  /** Change type (for amendments) */
  changeType: 'amended' | 'new' | 'repealed' | null
  /** Footnote references */
  footnoteRefs: string[]
}

export interface TransitionProvision {
  /** Provision number (e.g., "1", "2") */
  number: string | null
  /** Effective date if specified */
  effectiveDate: string | null
  /** Content text */
  content: string
}

export interface Footnote {
  /** Footnote ID/number */
  id: string
  /** Footnote content */
  content: string
  /** Legislative references extracted from footnote */
  legislativeRefs?: LegislativeReference[]
}

export interface LegislativeReference {
  /** Reference type */
  type: 'prop' | 'bet' | 'rskr' | 'sou' | 'ds'
  /** Full reference string (e.g., "prop. 2025/26:22") */
  reference: string
  /** Parliamentary year (e.g., "2025/26") */
  year: string
  /** Document number (e.g., "22", "SkU5") */
  number: string
}

export interface Definition {
  /** Term being defined */
  term: string
  /** Definition text */
  definition: string
  /** Section reference (e.g., "i 2 §") */
  sectionRef: string | null
}

// ============================================================================
// Main Parser
// ============================================================================

export interface HtmlToJsonOptions {
  /** Document type hint */
  documentType?: LegalDocumentJson['type']
  /** SFS number hint */
  sfsNumber?: string
  /** Base law SFS (for amendments) */
  baseLawSfs?: string
}

/**
 * Parse HTML content into structured JSON
 * Deterministic: same input always produces same output
 */
export function htmlToJson(
  html: string,
  options: HtmlToJsonOptions = {}
): LegalDocumentJson {
  if (!html || html.trim().length === 0) {
    return createEmptyDocument(options)
  }

  const $ = cheerio.load(html)

  // Extract metadata from data attributes
  const metadata = extractMetadata($, options)

  // Extract title
  const title = extractTitle($)

  // Determine document type
  const type = options.documentType || inferDocumentType($, metadata)

  // Extract main sections
  const sections = extractSections($)

  // Extract transition provisions
  const transitionProvisions = extractTransitionProvisions($)

  // Extract footnotes
  const footnotes = extractFootnotes($)

  // Extract definitions
  const definitions = extractDefinitions($)

  // Aggregate all legislative references from footnotes
  const legislativeReferences: LegislativeReference[] = []
  for (const fn of footnotes) {
    if (fn.legislativeRefs) {
      legislativeReferences.push(...fn.legislativeRefs)
    }
  }

  return {
    type,
    title,
    metadata,
    sections,
    transitionProvisions,
    footnotes,
    definitions,
    legislativeReferences,
  }
}

// ============================================================================
// Extraction Functions
// ============================================================================

function createEmptyDocument(options: HtmlToJsonOptions): LegalDocumentJson {
  return {
    type: options.documentType || 'law',
    title: null,
    metadata: {
      sfsNumber: options.sfsNumber || null,
      baseLawSfs: options.baseLawSfs || null,
      effectiveDate: null,
      publicationDate: null,
      dataAttributes: {},
    },
    sections: [],
    transitionProvisions: [],
    footnotes: [],
    definitions: [],
    legislativeReferences: [],
  }
}

function extractMetadata(
  $: cheerio.CheerioAPI,
  options: HtmlToJsonOptions
): DocumentMetadata {
  const dataAttributes: Record<string, string> = {}

  // Look for data attributes on root elements
  $('[data-sfs], [data-effective-date], [data-publication-date]').each(
    (_, el) => {
      const attrs = (el as unknown as DomNode).attribs || {}
      for (const [key, value] of Object.entries(attrs)) {
        if (key.startsWith('data-') && typeof value === 'string') {
          dataAttributes[key.replace('data-', '')] = value
        }
      }
    }
  )

  return {
    sfsNumber: options.sfsNumber || dataAttributes['sfs'] || null,
    baseLawSfs: options.baseLawSfs || dataAttributes['base-law'] || null,
    effectiveDate: dataAttributes['effective-date'] || null,
    publicationDate: dataAttributes['publication-date'] || null,
    dataAttributes,
  }
}

function extractTitle($: cheerio.CheerioAPI): string | null {
  // Try h1 first
  const h1 = $('h1').first().text().trim()
  if (h1) return h1

  // Try title element
  const titleEl = $('title').text().trim()
  if (titleEl) return titleEl

  // Try article header
  const articleHeader = $('article header h1, article h1').first().text().trim()
  if (articleHeader) return articleHeader

  return null
}

function inferDocumentType(
  $: cheerio.CheerioAPI,
  metadata: DocumentMetadata
): LegalDocumentJson['type'] {
  const html = $.html().toLowerCase()

  // Check for amendment indicators
  if (
    html.includes('ändring i') ||
    html.includes('ändringsförfattning') ||
    metadata.baseLawSfs
  ) {
    return 'amendment'
  }

  // Check for EU document indicators
  if (
    html.includes('förordning (eu)') ||
    html.includes('direktiv') ||
    html.includes('celex')
  ) {
    return 'eu_document'
  }

  // Check for court case indicators
  if (
    html.includes('dom ') ||
    html.includes('mål nr') ||
    html.includes('högsta domstolen')
  ) {
    return 'court_case'
  }

  // Check for regulation (förordning)
  if (html.includes('förordning (') && !html.includes('(eu)')) {
    return 'regulation'
  }

  // Default to law
  return 'law'
}

function extractSections($: cheerio.CheerioAPI): Section[] {
  const sections: Section[] = []
  let sectionIndex = 0

  // First try structured sections
  $('section, [data-section]').each((_, el) => {
    const section = parseSection($, el as unknown as DomNode, sectionIndex++)
    if (section) {
      sections.push(section)
    }
  })

  // If no structured sections found, try heading-based extraction
  if (sections.length === 0) {
    sections.push(...extractSectionsByHeadings($))
  }

  return sections
}

function parseSection(
  $: cheerio.CheerioAPI,
  node: DomNode,
  index: number
): Section | null {
  const $el = $(node as never)

  // Extract section info — check element id, then child heading id (for amendment HTML
  // where the id lives on h3.paragraph instead of the wrapper section)
  const id =
    $el.attr('id') ||
    $el.find('h2[id], h3[id], h4[id]').first().attr('id') ||
    $el.attr('data-section') ||
    `section-${index}`
  const dataAttrs = node.attribs || {}

  // Determine section type and number
  let type: Section['type'] = 'section'
  let chapter: string | null = null
  let number: string | null = null
  let heading: string | null = null

  // Check for chapter
  if (dataAttrs['data-chapter']) {
    type = 'chapter'
    chapter = dataAttrs['data-chapter']
  }

  // Check for section number
  if (dataAttrs['data-section']) {
    number = dataAttrs['data-section']
  }

  // Try to extract from heading
  const headingEl = $el.find('h1, h2, h3, h4, h5').first()
  if (headingEl.length > 0) {
    const headingText = headingEl.text().trim()
    heading = headingText

    // Parse Swedish section patterns
    const sectionMatch = headingText.match(/^(\d+[a-z]?)\s*§/)
    if (sectionMatch) {
      number = sectionMatch[1] || null
    }

    const chapterMatch = headingText.match(/^(\d+)\s*kap\./)
    if (chapterMatch) {
      type = 'chapter'
      chapter = chapterMatch[1] || null
    }
  }

  // Extract change type
  let changeType: Section['changeType'] = null
  const classAttr = $el.attr('class') || ''
  if (classAttr.includes('amended') || classAttr.includes('andrad')) {
    changeType = 'amended'
  } else if (classAttr.includes('new') || classAttr.includes('ny')) {
    changeType = 'new'
  } else if (classAttr.includes('repealed') || classAttr.includes('upphavd')) {
    changeType = 'repealed'
  }

  // Extract footnote references
  const footnoteRefs: string[] = []
  $el.find('sup a[href^="#fn"], sup.footnote-ref').each((_, fnRef) => {
    const ref =
      $(fnRef).text().trim() || $(fnRef).attr('href')?.replace('#fn', '') || ''
    if (ref) {
      footnoteRefs.push(ref)
    }
  })

  // Get content
  const htmlContent = $el.html() || ''
  const content = $el.text().trim()

  // Skip empty sections
  if (!content && !htmlContent) {
    return null
  }

  return {
    id,
    type,
    chapter,
    number,
    heading,
    content,
    htmlContent,
    children: [],
    changeType,
    footnoteRefs,
  }
}

function extractSectionsByHeadings($: cheerio.CheerioAPI): Section[] {
  const sections: Section[] = []
  let currentChapter: string | null = null
  let sectionIndex = 0

  // Find all headings and extract sections between them
  $('h1, h2, h3, h4').each((_, heading) => {
    const $heading = $(heading)
    const text = $heading.text().trim()

    // Check for chapter (kap.)
    const chapterMatch = text.match(/^(\d+)\s*kap\./)
    if (chapterMatch) {
      currentChapter = chapterMatch[1] || null
      sections.push({
        id: `chapter-${currentChapter}`,
        type: 'chapter',
        chapter: currentChapter,
        number: null,
        heading: text,
        content: text,
        htmlContent: $heading.html() || '',
        children: [],
        changeType: null,
        footnoteRefs: [],
      })
      return
    }

    // Check for section (§)
    const sectionMatch = text.match(/^(\d+[a-z]?)\s*§/)
    if (sectionMatch) {
      // Get content until next heading
      const contentData = getContentUntilNextHeading($, $heading)

      sections.push({
        id: `section-${sectionIndex++}`,
        type: 'section',
        chapter: currentChapter,
        number: sectionMatch[1] || null,
        heading: text,
        content: contentData.text,
        htmlContent: contentData.html,
        children: [],
        changeType: null,
        footnoteRefs: [],
      })
    }
  })

  return sections
}

function getContentUntilNextHeading(
  _$: cheerio.CheerioAPI,
  $heading: ReturnType<cheerio.CheerioAPI>
): { text: string; html: string } {
  const content: string[] = []
  const htmlContent: string[] = []

  let next = $heading.next()
  while (next.length > 0) {
    const nextNode = next.get(0) as unknown as DomNode | undefined
    const tagName = nextNode?.tagName?.toLowerCase()
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName || '')) {
      break
    }
    content.push(next.text().trim())
    htmlContent.push(next.prop('outerHTML') || '')
    next = next.next()
  }

  return {
    text: content.join('\n').trim(),
    html: htmlContent.join(''),
  }
}

function extractTransitionProvisions(
  $: cheerio.CheerioAPI
): TransitionProvision[] {
  const provisions: TransitionProvision[] = []

  // Look for transition provisions section
  const transitionSelectors = [
    'footer',
    '.transition-provisions',
    '.overgangsbstammelser',
    '[data-transition-provisions]',
  ]

  for (const selector of transitionSelectors) {
    $(selector).each((_, container) => {
      const $container = $(container)

      // Check if this is actually transition provisions
      const text = $container.text().toLowerCase()
      if (
        !text.includes('övergångsbestämmelser') &&
        !text.includes('träder i kraft')
      ) {
        return
      }

      // Try structured lists first
      $container.find('ol > li, dl > dd').each((i, item) => {
        const itemContent = $(item).text().trim()
        const dateMatch = itemContent.match(
          /(\d{4}-\d{2}-\d{2}|\d{1,2}\s+\w+\s+\d{4})/
        )

        provisions.push({
          number: String(i + 1),
          effectiveDate: dateMatch?.[1] ?? null,
          content: itemContent,
        })
      })

      // If no list items, treat paragraphs as provisions
      if (provisions.length === 0) {
        $container.find('p').each((i, p) => {
          const pContent = $(p).text().trim()
          if (pContent) {
            provisions.push({
              number: String(i + 1),
              effectiveDate: null,
              content: pContent,
            })
          }
        })
      }
    })

    if (provisions.length > 0) break
  }

  return provisions
}

/**
 * Extract legislative references (prop, bet, rskr, etc.) from text
 * Examples:
 *   - Prop. 2025/26:22
 *   - Bet. 2025/26:SkU5
 *   - Rskr. 2025/26:95
 */
/**
 * Canonical format for legislative reference types (Swedish standard)
 */
const CANONICAL_REF_FORMAT: Record<LegislativeReference['type'], string> = {
  prop: 'Prop.',
  bet: 'Bet.',
  rskr: 'Rskr.',
  sou: 'SOU',
  ds: 'Ds',
}

function extractLegislativeReferences(text: string): LegislativeReference[] {
  const refs: LegislativeReference[] = []

  // Patterns for different reference types
  const patterns: Array<{ type: LegislativeReference['type']; regex: RegExp }> =
    [
      // prop. 2025/26:22 or Prop. 1996/97:141
      { type: 'prop', regex: /[Pp]rop\.\s*(\d{4}\/\d{2,4}):(\d+)/g },
      // bet. 2025/26:SkU5 or Bet. 1997/98:UbU3
      { type: 'bet', regex: /[Bb]et\.\s*(\d{4}\/\d{2,4}):([A-Za-z]+\d+)/g },
      // rskr. 2025/26:95 or Rskr. 1997/98:12
      { type: 'rskr', regex: /[Rr]skr\.\s*(\d{4}\/\d{2,4}):(\d+)/g },
      // SOU 2024:15
      { type: 'sou', regex: /SOU\s*(\d{4}):(\d+)/gi },
      // Ds 2024:15
      { type: 'ds', regex: /Ds\s*(\d{4}):(\d+)/gi },
    ]

  for (const { type, regex } of patterns) {
    let match
    while ((match = regex.exec(text)) !== null) {
      const year = match[1] ?? ''
      const number = match[2] ?? ''
      if (!year || !number) continue

      // Build canonical reference format: "Prop. 2024/25:59", "Bet. 2024/25:JuU18", etc.
      const canonicalRef = `${CANONICAL_REF_FORMAT[type]} ${year}:${number}`

      refs.push({
        type,
        reference: canonicalRef,
        year,
        number,
      })
    }
  }

  return refs
}

function extractFootnotes($: cheerio.CheerioAPI): Footnote[] {
  const footnotes: Footnote[] = []
  const seenIds = new Set<string>()

  // Pattern 1: dl.footnote-content structure (LLM-generated HTML)
  // <dl class="footnote-content" id="SFS1998-1003.FOOTNOTE.1">
  //   <dt>1) </dt>
  //   <dd><p>Jfr prop. 1996/97:141, bet. 1997/98:UbU3, rskr. 1997/98:12.</p></dd>
  // </dl>
  $('dl.footnote-content, dl[id*="FOOTNOTE"]').each((_, dl) => {
    const $dl = $(dl)
    const dlId = $dl.attr('id') || ''

    // Extract footnote number from id like "SFS1998-1003.FOOTNOTE.1"
    const idMatch = dlId.match(/FOOTNOTE\.?(\d+)/i)
    const fnNumber = idMatch?.[1] || String(footnotes.length + 1)

    // Get content from <dd> element (the actual footnote text)
    const ddContent = $dl.find('dd').text().trim()

    if (ddContent && !seenIds.has(fnNumber)) {
      seenIds.add(fnNumber)

      // Extract legislative references from the content
      const legislativeRefs = extractLegislativeReferences(ddContent)

      footnotes.push({
        id: fnNumber,
        content: ddContent,
        ...(legislativeRefs.length > 0 && { legislativeRefs }),
      })
    }
  })

  // Pattern 2: Generic footnote selectors (fallback)
  if (footnotes.length === 0) {
    const footnoteSelectors = [
      '.footnotes li',
      '.footnote',
      '[id^="fn"]',
      'aside.footnotes li',
      'dl.footnotes dd',
    ]

    for (const selector of footnoteSelectors) {
      $(selector).each((_, el) => {
        const $el = $(el)
        const id = $el.attr('id') || String(footnotes.length + 1)
        const fnContent = $el.text().trim()

        if (fnContent && !seenIds.has(id)) {
          seenIds.add(id)
          footnotes.push({
            id: id.replace(/^fn-?/, ''),
            content: fnContent,
          })
        }
      })

      if (footnotes.length > 0) break
    }
  }

  return footnotes
}

function extractDefinitions($: cheerio.CheerioAPI): Definition[] {
  const definitions: Definition[] = []

  // Look for definition lists
  $('dl').each((_, dl) => {
    const $dl = $(dl)
    let currentTerm = ''

    $dl.children().each((_, child) => {
      const childNode = child as unknown as DomNode
      const tagName = childNode.tagName?.toLowerCase()
      const text = $(child).text().trim()

      if (tagName === 'dt') {
        currentTerm = text
      } else if (tagName === 'dd' && currentTerm) {
        // Check for section reference pattern
        const sectionRefMatch = currentTerm.match(/i\s+(\d+[a-z]?\s*§)/)

        definitions.push({
          term: currentTerm.replace(/\s*i\s+\d+[a-z]?\s*§.*/, '').trim(),
          definition: text,
          sectionRef: sectionRefMatch?.[1] ?? null,
        })
      }
    })
  })

  return definitions
}

// ============================================================================
// Index Export
// ============================================================================

export { htmlToJson as parseHtmlToJson }
