/**
 * Section Parser for Swedish Laws (SFS)
 *
 * Parses Riksdagen HTML to extract individual law sections (paragrafer).
 * Used for historical version reconstruction in Story 2.13.
 *
 * HTML Structure from Riksdagen:
 * - Laws WITH chapters: <a class="paragraf" name="K1P1"> for chapter 1, section 1
 * - Laws WITHOUT chapters: <a class="paragraf" name="P1"> for section 1
 * - Lettered sections: name="K1P2a" for section 2a in chapter 1
 * - Section content follows anchor until next anchor or chapter heading
 */

export interface ParsedSection {
  chapter: string | null // "1", "2", etc. or null for laws without chapters
  section: string // "1", "2a", "12", etc.
  htmlContent: string // Raw HTML for this section
  textContent: string // Plain text version
  heading: string | null // Section heading if present (e.g., "Tillämpningsområde")
}

export interface ParseResult {
  sections: ParsedSection[]
  hasChapters: boolean
  totalSections: number
  errors: string[]
}

/**
 * Parse a law's HTML content into individual sections
 */
export function parseLawSections(html: string): ParseResult {
  const errors: string[] = []
  const sections: ParsedSection[] = []

  if (!html || html.trim().length === 0) {
    return {
      sections: [],
      hasChapters: false,
      totalSections: 0,
      errors: ['Empty HTML content'],
    }
  }

  // Detect if law has chapters by looking for K{n}P{n} pattern
  const hasChapters = /name="K\d+P/.test(html)

  // Find all section anchors: <a class="paragraf" name="K1P1"> or <a class="paragraf" name="P1">
  // Pattern matches both chapter (KxPy) and non-chapter (Py) formats
  const sectionPattern = hasChapters
    ? /<a\s+class="paragraf"\s+name="K(\d+)P(\d+[a-z]?)"/gi
    : /<a\s+class="paragraf"\s+name="P(\d+[a-z]?)"/gi

  // Get all matches with their positions
  const matches: Array<{
    fullMatch: string
    chapter: string | null
    section: string
    index: number
  }> = []

  let match: RegExpExecArray | null
  while ((match = sectionPattern.exec(html)) !== null) {
    if (hasChapters) {
      matches.push({
        fullMatch: match[0],
        chapter: match[1] || null,
        section: match[2] || '',
        index: match.index,
      })
    } else {
      matches.push({
        fullMatch: match[0],
        chapter: null,
        section: match[1] || '',
        index: match.index,
      })
    }
  }

  if (matches.length === 0) {
    // Try alternate pattern - some laws use different anchor formats
    const altPattern = /<a\s+name="P(\d+[a-z]?)"\s+class="paragraf"/gi
    while ((match = altPattern.exec(html)) !== null) {
      matches.push({
        fullMatch: match[0],
        chapter: null,
        section: match[1] || '',
        index: match.index,
      })
    }
  }

  if (matches.length === 0) {
    errors.push('No section anchors found in HTML')
    return { sections: [], hasChapters: false, totalSections: 0, errors }
  }

  // Extract content for each section
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]!
    const next = matches[i + 1]

    // Find the end of this section:
    // - Next section anchor
    // - Chapter heading (<h3 name="K...)
    // - End of content div
    // - Övergångsbestämmelser section
    let endIndex: number

    if (next) {
      endIndex = next.index
    } else {
      // Last section - find end of content or transition provisions
      const transitionMatch = html.indexOf('<a name="overgang">', current.index)
      const endDivMatch = html.lastIndexOf('</div>')
      if (transitionMatch > current.index) {
        endIndex = transitionMatch
      } else if (endDivMatch > current.index) {
        endIndex = endDivMatch
      } else {
        endIndex = html.length
      }
    }

    // Extract HTML content
    let htmlContent = html.substring(current.index, endIndex).trim()

    // Also check for chapter heading changes that should end this section
    if (hasChapters && next && current.chapter !== next.chapter) {
      // Section spans to a different chapter - check if there's a chapter heading
      const chapterHeadingPattern = new RegExp(
        `<h3\\s+name="K${next.chapter}">`,
        'i'
      )
      const chapterHeadingMatch = chapterHeadingPattern.exec(htmlContent)
      if (chapterHeadingMatch) {
        htmlContent = htmlContent.substring(0, chapterHeadingMatch.index).trim()
      }
    }

    // Clean up trailing chapter headings that might have been captured
    htmlContent = cleanTrailingContent(htmlContent)

    // Extract plain text
    const textContent = htmlToText(htmlContent)

    // Try to find a heading for this section (h4 immediately before or within)
    const heading = extractSectionHeading(html, current.index, htmlContent)

    sections.push({
      chapter: current.chapter,
      section: current.section,
      htmlContent,
      textContent,
      heading,
    })
  }

  // Sort sections by chapter then section number
  sections.sort((a, b) => {
    const chapterA = a.chapter ? parseInt(a.chapter, 10) : 0
    const chapterB = b.chapter ? parseInt(b.chapter, 10) : 0
    if (chapterA !== chapterB) return chapterA - chapterB

    // Sort sections numerically, handling letters (1, 2, 2a, 2b, 3...)
    return compareSectionNumbers(a.section, b.section)
  })

  return {
    sections,
    hasChapters,
    totalSections: sections.length,
    errors,
  }
}

/**
 * Compare section numbers, handling lettered sections (2a, 2b, etc.)
 */
function compareSectionNumbers(a: string, b: string): number {
  const numA = parseInt(a, 10)
  const numB = parseInt(b, 10)

  if (numA !== numB) return numA - numB

  // Same base number, compare letters
  const letterA = a.replace(/\d+/, '')
  const letterB = b.replace(/\d+/, '')

  return letterA.localeCompare(letterB)
}

/**
 * Clean up trailing content that shouldn't be part of the section
 */
function cleanTrailingContent(html: string): string {
  // Remove trailing chapter headings
  let cleaned = html.replace(/<h3\s+name="K\d+">[\s\S]*$/i, '').trim()

  // Remove trailing <p><a name="S\d+"... markers
  cleaned = cleaned
    .replace(/<p>\s*<a\s+name="S\d+"><\/a><\/p>\s*$/gi, '')
    .trim()

  // Remove any trailing empty elements
  cleaned = cleaned.replace(/<p>\s*<\/p>\s*$/gi, '').trim()

  return cleaned
}

/**
 * Convert HTML to plain text
 */
function htmlToText(html: string): string {
  let text = html

  // Replace <br> and </p> with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n')
  text = text.replace(/<\/div>/gi, '\n')

  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))

  // Normalize whitespace
  text = text.replace(/\n\s*\n/g, '\n\n') // Multiple newlines to double
  text = text.replace(/[ \t]+/g, ' ') // Multiple spaces to single
  text = text.trim()

  return text
}

/**
 * Extract a section heading if present
 * Swedish laws sometimes have headings like:
 * <h4 name="Tillämpningsområde">Tillämpningsområde</h4>
 */
function extractSectionHeading(
  fullHtml: string,
  sectionStart: number,
  sectionHtml: string
): string | null {
  // Look for h4 heading within the section content
  const h4Match = sectionHtml.match(/<h4[^>]*>([^<]+)<\/h4>/i)
  if (h4Match && h4Match[1]) {
    return h4Match[1].trim()
  }

  // Look for heading in the 500 chars before this section
  const contextStart = Math.max(0, sectionStart - 500)
  const context = fullHtml.substring(contextStart, sectionStart)

  // Find the last h4 heading in the context (closest to our section)
  const h4Matches = [...context.matchAll(/<h4[^>]*>([^<]+)<\/h4>/gi)]
  if (h4Matches.length > 0) {
    const lastH4 = h4Matches[h4Matches.length - 1]
    // Only use if it's close to the section (within 200 chars)
    if (lastH4 && lastH4[1] !== undefined) {
      const distanceFromSection =
        sectionStart - contextStart - (lastH4.index ?? 0)
      if (distanceFromSection < 200) {
        return lastH4[1].trim()
      }
    }
  }

  return null
}

/**
 * Normalize a section reference for consistent matching
 * "1 §" -> "1", "2a §" -> "2a", etc.
 */
export function normalizeSectionRef(ref: string): string {
  return ref
    .replace(/\s*§\s*/, '')
    .trim()
    .toLowerCase()
}

/**
 * Format a section reference for display
 * "1" -> "1 §", "2a" -> "2 a §", etc.
 */
export function formatSectionRef(
  chapter: string | null,
  section: string
): string {
  const sectionDisplay = section.replace(/(\d+)([a-z])/i, '$1 $2')

  if (chapter) {
    return `${chapter} kap. ${sectionDisplay} §`
  }
  return `${sectionDisplay} §`
}

/**
 * Create a unique section key for database lookups
 */
export function createSectionKey(
  chapter: string | null,
  section: string
): string {
  if (chapter) {
    return `${chapter}:${section}`
  }
  return `:${section}`
}
