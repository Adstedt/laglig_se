/**
 * Parse SFS amendment text into structured components
 * Matches the visual structure of official SFS PDFs and Notisum rendering
 *
 * Key patterns handled:
 * - Section headers: "X kap. Y §" or just "Y §"
 * - Group headers: Title-case lines before sections (e.g., "Intäktsramens omfattning")
 * - Definition lists: "term i X §" pattern
 * - Numbered lists: "1. text, 2. text" with nested a), b), c)
 * - Footnotes: "N) Senaste lydelse YYYY:NNNN"
 * - Transition provisions: "1. Denna lag träder i kraft..."
 */

import { cleanPdfArtifacts } from './clean-pdf-artifacts'

export interface AmendmentStructure {
  // Header info
  documentType: string // "Svensk författningssamling"
  title: string // "Lag om ändring i..."
  sfsNumber: string // "SFS 2025:1448"
  publishedDate: string | null // "Publicerad den 9 december 2025"
  issuedDate: string | null // "Utfärdad den 4 december 2025"

  // Intro
  introText: string | null // "Enligt riksdagens beslut..."

  // Content sections (flat list for backward compatibility)
  sections: AmendmentSection[]

  // Transition provisions (structured)
  transitionProvisions: TransitionProvision[]

  // Signature block
  signatureBlock: {
    prefix: string | null // "På regeringens vägnar"
    minister: string | null // "PARISA LILJESTRAND"
    official: string | null // "Maria Fjellman Lundqvist"
    department: string | null // "(Kulturdepartementet)"
  } | null

  // Footnotes (structured)
  footnotes: Footnote[]

  // Unparsed content (if any)
  unparsedContent: string | null

  // Generated HTML content (Notisum-style)
  htmlContent: string | null
}

export interface ListItem {
  marker: string // "1.", "2.", "a)", "b)"
  text: string
  subItems?: ListItem[]
}

export interface DefinitionItem {
  term: string // "allmänt erkänd redovisningsstandard"
  reference: string // "20 §" or "3 kap. 13 §"
}

export interface Footnote {
  marker: string // "1)", "2)", "3)"
  content: string // "Senaste lydelse 2024:1248."
}

export interface TransitionProvision {
  number: string // "1.", "2."
  text: string
}

export interface AmendmentSection {
  chapter: string | null // "5 kap."
  sectionNumber: string // "4 §"
  groupHeader: string | null // Group header this section belongs to
  leadText: string | null // Text before the first list item
  items: ListItem[] // Numbered/lettered list items
  definitions?: DefinitionItem[] // Definition list items (term -> section reference)
  footnoteRefs: string[] // Footnote markers referenced in this section
  text: string // Full text (fallback if no items parsed)
}

/**
 * Clean OCR artifacts from text
 */
function cleanOcrArtifacts(text: string): string {
  let cleaned = text
    // Remove ruler/scale bar patterns at the start
    .replace(/^[\d\s:;.,]+(?=\s*Svensk)/i, '')
    .replace(/^[\d\s:;.,]{10,}/g, '')

  // Remove PDF page footers: "SFS YYYY:NNNN" repeated with page number
  // Pattern: "SFS 2025:1461 Publicerad ... SFS 2025:14612" where "2" is page 2
  // Only remove if we see the SAME SFS number repeated with an extra digit
  const sfsMatch = cleaned.match(/SFS\s+(\d{4}:\d+)/i)
  if (sfsMatch && sfsMatch[1]) {
    const baseSfs = sfsMatch[1]
    // Remove repeated SFS numbers with concatenated page numbers (e.g., "SFS 2025:14612" -> "")
    // This pattern matches: SFS + base number + single digit + space + uppercase letter
    const pageFooterPattern = new RegExp(
      `SFS\\s*${baseSfs.replace(':', ':')}(\\d)(?=\\s+[A-ZÅÄÖ])`,
      'g'
    )
    cleaned = cleaned.replace(pageFooterPattern, '')
  }

  // Remove footnote blocks that got concatenated
  // Pattern: "N Senaste lydelse YYYY:NNNN" or references in footnotes
  cleaned = cleaned.replace(
    /\d+\s+Senaste\s+lydelse\s+(?:av\s+)?\d+\s*kap\.\s*\d+\s*[a-z]?\s*§\s*\d{4}:\d+/gi,
    ''
  )
  cleaned = cleaned.replace(/\d+\s+Senaste\s+lydelse\s+\d{4}:\d+/gi, '')

  return cleaned.trim()
}

/**
 * Parse nested sub-items from list item text
 * Handles patterns like: "a) text, b) text" or "– text, – text"
 */
function parseSubItems(text: string): {
  mainText: string
  subItems: ListItem[]
} {
  const subItems: ListItem[] = []

  // Pattern for lettered sub-items: a), b), c) or a., b., c.
  const subItemPattern =
    /(?:^|,\s*)([a-z])[)\.]\s+([^,]+?)(?=,\s*[a-z][)\.]|\s*$|,\s*och\s+[a-z][)\.]|,\s*eller\s+[a-z][)\.])/gi

  let mainText = text
  let match

  // Reset lastIndex for the regex
  subItemPattern.lastIndex = 0

  while ((match = subItemPattern.exec(text)) !== null) {
    const letter = match[1]
    const subText = match[2]?.trim()

    if (letter && subText && subText.length > 2) {
      subItems.push({
        marker: `${letter})`,
        text: subText,
      })
    }
  }

  // If we found sub-items, extract the main text (before the first sub-item)
  if (subItems.length >= 2) {
    const firstSubMatch = text.match(/[a-z][)\.]\s+/i)
    if (
      firstSubMatch &&
      firstSubMatch.index !== undefined &&
      firstSubMatch.index > 0
    ) {
      mainText = text
        .substring(0, firstSubMatch.index)
        .trim()
        .replace(/[,;:]\s*$/, '')
    } else {
      mainText = ''
    }
  }

  return { mainText, subItems: subItems.length >= 2 ? subItems : [] }
}

/**
 * Parse numbered list items from section text
 * Handles patterns like: "1. text, 2. text" with nested a), b), c) sub-items
 */
function parseListItems(text: string): {
  leadText: string | null
  items: ListItem[]
} {
  const items: ListItem[] = []
  let leadText: string | null = null

  // Find the first numbered item "1." - this is where the list starts
  // We need to find where the actual number starts, not the introducing word
  const firstItemPattern = /(\s)(1)\.\s+(?=[A-ZÅÄÖa-zåäö])/
  const firstItemMatch = text.match(firstItemPattern)

  let restText = text

  if (firstItemMatch && firstItemMatch.index !== undefined) {
    // firstItemMatch.index points to the space before "1."
    // Lead text is everything before that space (including "avser" etc.)
    const beforeIndex = firstItemMatch.index
    if (beforeIndex > 0) {
      leadText = text.substring(0, beforeIndex).trim()
      // Clean trailing punctuation but keep list-introducing words
      leadText = leadText.replace(/[,;]\s*$/, '').trim()
    }
    // restText starts at "1." (skip the leading space)
    restText = text.substring(beforeIndex + 1)
  } else {
    // Fallback: look for any numbered item after punctuation
    const punctuationMatch = text.match(/([,;.]\s*)(\d+)\.\s+/)
    if (punctuationMatch && punctuationMatch.index !== undefined) {
      const beforeIndex = punctuationMatch.index
      if (beforeIndex > 0) {
        leadText = text.substring(0, beforeIndex).trim()
      }
      // Include the punctuation in restText for proper splitting
      restText = text.substring(beforeIndex)
    }
  }

  // Split by numbered items pattern - only at clear boundaries
  // Pattern: comma/semicolon/period (optionally followed by "och"/"eller") then number and period
  const parts = restText.split(
    /(?=[,;.]\s*(?:och|eller)?\s*\d+\.\s+|^\s*\d+\.\s+)/m
  )

  for (const part of parts) {
    // Match numbered items, handling leading punctuation and connectors
    const numMatch = part.match(
      /^[,;.]?\s*(?:och|eller)?\s*(\d+)\.\s+([\s\S]+)$/
    )
    if (numMatch && numMatch[1] && numMatch[2]) {
      const marker = `${numMatch[1]}.`
      const itemText = numMatch[2].trim()

      // Skip if this looks like OCR noise (very short or contains suspicious patterns)
      if (itemText.length < 3) continue

      // Try to parse nested sub-items
      const { mainText, subItems } = parseSubItems(itemText)

      if (subItems.length > 0) {
        items.push({
          marker,
          text: mainText || itemText,
          subItems,
        })
      } else {
        items.push({
          marker,
          text: itemText,
        })
      }
    }
  }

  return { leadText, items }
}

/**
 * Parse definition list from section text
 * Pattern A: "term i X §" or "term i X kap. Y §" (reference style)
 * Pattern B: "term: definition text" (italicized term style from Notisum)
 * Returns null if not a definition list
 */
function parseDefinitionList(
  text: string
): { leadText: string | null; definitions: DefinitionItem[] } | null {
  // Check if this looks like a definition list
  const defListIndicators = [
    /finns i nedan angivna paragrafer/i,
    /definitioner av följande begrepp/i,
    /i övrigt avses/i,
    /avses i lagen med/i,
    /i lagen avses med/i,
    /har följande betydelse/i,
  ]

  const isDefinitionList = defListIndicators.some((pattern) =>
    pattern.test(text)
  )

  if (!isDefinitionList) {
    return null
  }

  const definitions: DefinitionItem[] = []

  // Pattern A: term (lowercase text) + "i" + section reference (ending with § or §§)
  // Section reference can be: "20 §", "3 kap. 13 §", "1 kap. 11–16 §§", "29 a–29 e §§"
  const defPatternA =
    /([a-zåäö][a-zåäö\s\-–]+?)\s+i\s+((?:\d+\s*kap\.\s*)?\d+(?:\s*[a-z])?\s*(?:–\d+(?:\s*[a-z])?\s*)?§§?(?:\s+(?:första|andra|tredje)\s+stycket)?)/gi

  let match: RegExpExecArray | null
  while ((match = defPatternA.exec(text)) !== null) {
    const term = match[1]?.trim()
    const reference = match[2]?.trim()

    // Skip if term or reference is undefined or too short
    if (!term || !reference) continue
    if (term.length < 3) continue
    // Skip if term starts with common noise patterns
    if (term.match(/^(och|eller|samt|som|att|för|med|vid|av|om)\s/i)) continue

    definitions.push({ term, reference })
  }

  // Pattern B: "term: definition" (less common, but used in some contexts)
  // Only use if we haven't found Pattern A definitions
  if (definitions.length < 3) {
    const defPatternB =
      /([A-ZÅÄÖ][a-zåäö]+(?:\s+[a-zåäö]+)*)\s*:\s+([^,]+(?:,\s*[^,]+)*)/g

    while ((match = defPatternB.exec(text)) !== null) {
      const term = match[1]?.trim()
      const reference = match[2]?.trim()

      if (term && reference && term.length >= 3 && reference.length >= 3) {
        definitions.push({ term, reference })
      }
    }
  }

  // Only return as definition list if we found multiple definitions
  if (definitions.length >= 3) {
    // Extract lead text (before the first definition)
    const firstDef = definitions[0]
    if (!firstDef) return null

    const firstIndex = text.toLowerCase().indexOf(firstDef.term.toLowerCase())
    const leadText =
      firstIndex > 0 ? text.substring(0, firstIndex).trim() : null

    return { leadText, definitions }
  }

  return null
}

/**
 * Extract SFS references from text for linking
 * Returns the text with markers for SFS references
 */
export function extractSfsReferences(
  text: string
): Array<{ type: 'text' | 'sfs'; content: string; sfsNumber?: string }> {
  const result: Array<{
    type: 'text' | 'sfs'
    content: string
    sfsNumber?: string
  }> = []

  // Pattern for SFS references: (YYYY:NNN) or SFS YYYY:NNN
  const sfsPattern = /(?:\((\d{4}:\d+)\)|SFS\s+(\d{4}:\d+))/g

  let lastIndex = 0
  let match

  while ((match = sfsPattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      result.push({
        type: 'text',
        content: text.substring(lastIndex, match.index),
      })
    }

    // Add the SFS reference
    const sfsNumber = match[1] ?? match[2]
    if (sfsNumber) {
      result.push({
        type: 'sfs',
        content: match[0],
        sfsNumber,
      })
    } else {
      result.push({
        type: 'text',
        content: match[0],
      })
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push({
      type: 'text',
      content: text.substring(lastIndex),
    })
  }

  return result.length > 0 ? result : [{ type: 'text', content: text }]
}

/**
 * Check if a chapter/section pattern is an inline reference (not a header)
 * Inline references are preceded by words like "enligt", "av", "i", "om", etc.
 */
function isInlineReference(text: string, matchIndex: number): boolean {
  // Look at the 50 characters before the match
  const before = text
    .substring(Math.max(0, matchIndex - 50), matchIndex)
    .toLowerCase()

  // Check for footnote patterns - these should NOT be treated as section headers
  const footnotePatterns = [
    /senaste\s+lydelse\s+(?:av\s+)?$/i, // "Senaste lydelse av X kap. Y §"
    /senaste\s+lydelse\s+\d{4}:\d+\s*$/i, // After an SFS reference
    /prop\.\s+\d{4}\/\d+:\d+[^§]*$/i, // After a proposition reference
    /\d+\s+senaste\s+lydelse/i, // Footnote number before "Senaste lydelse"
  ]

  if (footnotePatterns.some((pattern) => pattern.test(before))) {
    return true
  }

  // Common words that precede inline references to other sections
  const referenceIndicators = [
    /enligt\s*$/,
    /av\s*$/,
    /i\s*$/,
    /om\s*$/,
    /från\s*$/,
    /till\s*$/,
    /se\s*$/,
    /jfr\s*$/,
    /och\s*$/,
    /eller\s*$/,
    /samt\s*$/,
    /med\s*$/,
    /vid\s*$/,
    /för\s*$/,
    /som\s+avses\s+i\s*$/,
    /som\s+följer\s+av\s*$/,
    /\d+\s*§\s*$/, // Another section reference right before
    /kap\.\s*$/, // Chapter reference right before
    /stycket\s*$/, // "stycket" (paragraph) reference
    /,\s*$/, // Comma before (likely continuation)
    /\d+[–\-−]\s*$/, // Range pattern like "1–" (sections 1 through X) - en-dash, hyphen, minus
    /\d+\s*[a-z][–\-−]\s*$/, // Range pattern with letter suffix like "29 a–" (for "29 a–29 e §§")
    /\d+\s*[a-z]?\s*§§\s*$/, // Double section sign (§§)
    /\d{4}:\d+\s*$/, // After an SFS number (like "2024:1248 7 kap. 25 §")
    /i\s+\d+\s*[a-z]?[–\-−]\s*$/, // Definition reference range: "i 29 a–" before "29 e §§"
  ]

  return referenceIndicators.some((pattern) => pattern.test(before))
}

/**
 * Find actual section headers in the text (not inline references)
 * Returns array of {index, chapter, section} for each real section header
 */
function findSectionHeaders(text: string): Array<{
  index: number
  chapter: string | null
  section: string
  endIndex: number
}> {
  const headers: Array<{
    index: number
    chapter: string | null
    section: string
    endIndex: number
  }> = []

  // Pattern to find potential section headers: "X kap. Y §" or just "Y §"
  const potentialHeaderPattern = /(\d+\s*kap\.\s*)?(\d+\s*[a-z]?\s*§)/gi

  let match
  while ((match = potentialHeaderPattern.exec(text)) !== null) {
    // Skip if this is an inline reference
    if (isInlineReference(text, match.index)) {
      continue
    }

    // Skip if this appears in the intro/header area (before intro ends)
    // Intro typically ends with "följande lydelse.", "föreskrivs följande.", or similar
    const introEndPatterns = [
      /följande\s+lydelse\.\s*/i,
      /föreskrivs\s+följande\.\s*/i,
      /ska\s+ha\s+följande\s+lydelse\.\s*/i,
      /träder\s+i\s+kraft\.\s*/i,
    ]

    let introEndIndex = -1
    for (const pattern of introEndPatterns) {
      const introMatch = text.match(pattern)
      if (introMatch && introMatch.index !== undefined) {
        const endPos = introMatch.index + introMatch[0].length
        if (endPos > introEndIndex) {
          introEndIndex = endPos
        }
      }
    }

    // Skip if this section appears before the intro ends
    if (introEndIndex !== -1 && match.index < introEndIndex) {
      continue
    }

    headers.push({
      index: match.index,
      chapter: match[1]?.trim() || null,
      section: match[2]?.trim() ?? '',
      endIndex: match.index + match[0].length,
    })
  }

  return headers
}

/**
 * Extract footnote markers from section text
 * Pattern: superscript numbers like "¹)" or just "1)" or "1 "
 */
function extractFootnoteRefs(text: string): string[] {
  const refs: string[] = []
  const pattern = /(\d+)\s*\)/g
  let match
  while ((match = pattern.exec(text)) !== null) {
    if (match[1]) refs.push(`${match[1]})`)
  }
  return Array.from(new Set(refs)) // deduplicate
}

/**
 * Parse structured footnotes from text
 * Pattern: "N) Senaste lydelse YYYY:NNNN." or "N) Prop. YYYY/YY:NNN"
 */
function parseFootnotes(text: string): Footnote[] {
  const footnotes: Footnote[] = []

  // Pattern for "Senaste lydelse" footnotes
  const lydelsePattern = /(\d+)\)\s+(Senaste\s+lydelse[^.]*\.)/gi
  let match: RegExpExecArray | null
  while ((match = lydelsePattern.exec(text)) !== null) {
    const marker = match[1]
    const content = match[2]
    if (marker && content) {
      footnotes.push({
        marker: `${marker})`,
        content: content.trim(),
      })
    }
  }

  // Pattern for proposition footnotes
  const propPattern = /(\d+)\)\s+(Prop\.\s+[^.]+\.)/gi
  while ((match = propPattern.exec(text)) !== null) {
    const marker = match[1]
    const content = match[2]
    if (marker && content) {
      // Avoid duplicates
      const markerStr = `${marker})`
      if (!footnotes.some((f) => f.marker === markerStr)) {
        footnotes.push({
          marker: markerStr,
          content: content.trim(),
        })
      }
    }
  }

  return footnotes.sort((a, b) => {
    const numA = parseInt(a.marker) || 0
    const numB = parseInt(b.marker) || 0
    return numA - numB
  })
}

/**
 * Parse structured transition provisions
 * Pattern: "1. Denna lag träder i kraft..." "2. Äldre föreskrifter..."
 */
function parseTransitionProvisions(text: string): TransitionProvision[] {
  const provisions: TransitionProvision[] = []

  // Find the transition provisions section
  const transitionMatch = text.match(
    /(\d+\.\s+Denna\s+(?:lag|förordning)[\s\S]*?)(?=På\s+regeringens|$)/i
  )

  if (transitionMatch && transitionMatch[1]) {
    const provisionText = transitionMatch[1]
    const parts = provisionText.split(/(?=\d+\.\s+)/).filter(Boolean)

    for (const part of parts) {
      const numMatch = part.match(/^(\d+)\.\s+([\s\S]+)$/)
      if (numMatch && numMatch[1] && numMatch[2]) {
        provisions.push({
          number: `${numMatch[1]}.`,
          text: numMatch[2].trim().replace(/\s+/g, ' '),
        })
      }
    }
  }

  return provisions
}

/**
 * Parse amendment full text into structured format
 */
export function parseAmendmentStructure(
  fullText: string | null
): AmendmentStructure | null {
  if (!fullText) return null

  // First apply comprehensive PDF cleanup, then OCR-specific cleanup
  const cleaned = cleanPdfArtifacts(fullText)
  const text = cleanOcrArtifacts(cleaned || fullText)

  const structure: AmendmentStructure = {
    documentType: 'Svensk författningssamling',
    title: '',
    sfsNumber: '',
    publishedDate: null,
    issuedDate: null,
    introText: null,
    sections: [],
    transitionProvisions: [],
    signatureBlock: null,
    footnotes: [],
    unparsedContent: null,
    htmlContent: null,
  }

  // Extract title - "Lag om ändring i..." or "Förordning om ändring i..."
  const titleMatch = text.match(
    /((?:Lag|Förordning)\s+om\s+ändring\s+i[^.]+(?:\([^)]+\))?[^U]*?)(?=Utfärdad)/i
  )
  if (titleMatch && titleMatch[1]) {
    structure.title = titleMatch[1]
      .replace(/Svensk författningssamling\s*/i, '')
      .trim()
  }

  // Extract SFS number
  const sfsMatch = text.match(/SFS\s+(\d{4}:\d+)/i)
  if (sfsMatch) {
    structure.sfsNumber = `SFS ${sfsMatch[1]}`
  }

  // Extract published date
  const pubMatch = text.match(/Publicerad\s+den\s+(\d+\s+\w+\s+\d{4})/i)
  if (pubMatch && pubMatch[1]) {
    structure.publishedDate = pubMatch[1]
  }

  // Extract issued date
  const issuedMatch = text.match(/Utfärdad\s+den\s+(\d+\s+\w+\s+\d{4})/i)
  if (issuedMatch && issuedMatch[1]) {
    structure.issuedDate = issuedMatch[1]
  }

  // Extract intro text - "Enligt riksdagens beslut..."
  const introMatch = text.match(
    /Enligt riksdagens beslut[^.]*föreskrivs[^.]*\.(?:\s*\d+)?/i
  )
  if (introMatch) {
    // Clean footnote markers
    structure.introText = introMatch[0].replace(/\d+$/, '').trim()
  }

  // Extract structured footnotes
  structure.footnotes = parseFootnotes(text)

  // Find section end markers
  const transitionStart = text.search(/\d+\.\s+Denna\s+(?:lag|förordning)/i)
  const signatureStart = text.search(/På\s+regeringens\s+vägnar/i)
  const contentEndIndex =
    transitionStart !== -1
      ? transitionStart
      : signatureStart !== -1
        ? signatureStart
        : text.length

  // Find actual section headers (not inline references)
  const sectionHeaders = findSectionHeaders(text)

  let currentChapter: string | null = null
  let currentGroupHeader: string | null = null

  for (let i = 0; i < sectionHeaders.length; i++) {
    const header = sectionHeaders[i]
    if (!header) continue

    if (header.chapter) {
      currentChapter = header.chapter
    }

    // Look for group header between previous section and this one
    if (i > 0) {
      const prevHeader = sectionHeaders[i - 1]
      if (prevHeader) {
        const betweenText = text
          .substring(prevHeader.endIndex, header.index)
          .trim()
        // Group headers are typically Title Case or ALL CAPS, on their own line
        const groupMatch = betweenText.match(
          /\n([A-ZÅÄÖ][a-zåäö]+(?:\s+[a-zåäö]+)*(?:\s+[A-ZÅÄÖ][a-zåäö]+)*)\s*\n/
        )
        if (groupMatch && groupMatch[1] && groupMatch[1].length > 5) {
          currentGroupHeader = groupMatch[1].trim()
        }
      }
    }

    // Determine where this section's content ends
    const nextHeader = sectionHeaders[i + 1]
    const nextHeaderStart = nextHeader ? nextHeader.index : contentEndIndex

    // Extract section content
    const sectionContent = text
      .substring(header.endIndex, nextHeaderStart)
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^\s*[\d\s:;]+\s*/, '') // Remove any OCR noise at start

    // Skip if empty or just transition provision text
    if (
      !sectionContent ||
      sectionContent.match(/^Denna lag|^Äldre föreskrifter/i)
    ) {
      continue
    }

    // Extract footnote references from this section
    const footnoteRefs = extractFootnoteRefs(sectionContent)

    // First try parsing as definition list, then fall back to regular list items
    const defResult = parseDefinitionList(sectionContent)

    if (defResult) {
      // This section contains a definition list
      structure.sections.push({
        chapter: currentChapter,
        sectionNumber: header.section,
        groupHeader: currentGroupHeader,
        leadText: defResult.leadText,
        items: [],
        definitions: defResult.definitions,
        footnoteRefs,
        text: sectionContent,
      })
    } else {
      // Parse as regular list items
      const { leadText, items } = parseListItems(sectionContent)

      structure.sections.push({
        chapter: currentChapter,
        sectionNumber: header.section,
        groupHeader: currentGroupHeader,
        leadText,
        items,
        footnoteRefs,
        text: sectionContent,
      })
    }

    // Reset group header after using it (it only applies to the next section)
    currentGroupHeader = null
  }

  // Extract structured transition provisions
  structure.transitionProvisions = parseTransitionProvisions(text)

  // Extract signature block
  const sigMatch = text.match(
    /På\s+regeringens\s+vägnar\s+([A-ZÅÄÖ\s]+?)(?:\s+([A-ZÅÄÖa-zåäö\s]+?)\s*\(([^)]+)\))?(?=\s*\d|$)/i
  )
  if (sigMatch) {
    structure.signatureBlock = {
      prefix: 'På regeringens vägnar',
      minister: sigMatch[1]?.trim() || null,
      official: sigMatch[2]?.trim() || null,
      department: sigMatch[3] ? `(${sigMatch[3].trim()})` : null,
    }
  }

  // Generate HTML content
  structure.htmlContent = generateAmendmentHtml(structure)

  return structure
}

/**
 * Format parsed structure back into readable text blocks
 * For display when full parsing isn't possible
 */
export function formatAmendmentText(text: string | null): string | null {
  if (!text) return null

  let formatted = cleanOcrArtifacts(text)

  // Add breaks after key structural elements
  formatted = formatted
    // Title block
    .replace(/(Svensk författningssamling)\s+/gi, '$1\n\n')
    // After document title (before "Utfärdad")
    .replace(
      /((?:Lag|Förordning)\s+om\s+ändring[^U]+)\s*(Utfärdad)/gi,
      '$1\n\n$2'
    )
    // After issued date
    .replace(/(Utfärdad den \d+ \w+ \d{4})\s+/gi, '$1\n\n')
    // After intro paragraph (ends with "följande lydelse.")
    .replace(/(följande lydelse\.)\s*/gi, '$1\n\n')
    // Before chapter headings
    .replace(/\s+(\d+\s*kap\.)/gi, '\n\n$1\n')
    // Before section numbers
    .replace(/\s+(\d+\s*[a-z]?\s*§)/gi, '\n\n$1 ')
    // Before transition provisions
    .replace(/\s+(1\.\s+Denna\s+lag)/gi, '\n\n---\n\n$1')
    // Between numbered provisions
    .replace(/\.\s+(\d+\.\s+(?:Äldre|Denna))/gi, '.\n\n$1')
    // Before signature block
    .replace(/\s+(På\s+regeringens\s+vägnar)/gi, '\n\n$1\n')
    // After minister name (all caps)
    .replace(/([A-ZÅÄÖ]{3,}\s+[A-ZÅÄÖ]+)\s+([A-Z][a-zåäö])/g, '$1\n\n$2')
    // Before footnotes
    .replace(/\s+(\d+\s+Prop\.)/gi, '\n\n---\n\n$1')
    // Before SFS at end
    .replace(/\s+(SFS\s+\d{4}:\d+\s+Publicerad)/gi, '\n\n$1')
    // Clean up multiple newlines
    .replace(/\n{3,}/g, '\n\n')

  return formatted.trim()
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Convert SFS references in text to links
 */
function linkifySfsReferences(text: string): string {
  // Pattern for SFS references: (YYYY:NNN) or SFS YYYY:NNN
  return text.replace(
    /(?:\((\d{4}:\d+)\)|SFS\s+(\d{4}:\d+))/g,
    (match, p1, p2) => {
      const sfsNum = p1 || p2
      return `<a class="ref" href="/lagar/${sfsNum}">${escapeHtml(match)}</a>`
    }
  )
}

/**
 * Generate Notisum-style HTML from parsed amendment structure
 * This creates HTML that closely matches the Notisum rendering
 */
export function generateAmendmentHtml(structure: AmendmentStructure): string {
  const sfsId = structure.sfsNumber.replace(/\s+/g, '').replace(':', '-')
  const parts: string[] = []

  // Article wrapper
  parts.push(`<article class="legal-document amendment" id="${sfsId}">`)

  // Header section
  parts.push(`<div class="lovhead">`)
  parts.push(`<h1 id="${sfsId}_HEADER">`)
  parts.push(`<p class="text">${escapeHtml(structure.sfsNumber)}</p>`)
  if (structure.title) {
    parts.push(`<p class="text title">${escapeHtml(structure.title)}</p>`)
  }
  if (structure.issuedDate) {
    parts.push(
      `<p class="text issued">Utfärdad den ${escapeHtml(structure.issuedDate)}</p>`
    )
  }
  parts.push(`</h1>`)
  parts.push(`</div>`)

  // Body content
  parts.push(`<div class="body" id="${sfsId}_BODY">`)

  // Intro text
  if (structure.introText) {
    parts.push(
      `<p class="intro-text">${linkifySfsReferences(escapeHtml(structure.introText))}</p>`
    )
  }

  // Group sections by chapter
  let currentChapter: string | null = null
  let currentGroupHeader: string | null = null

  for (const section of structure.sections) {
    // Chapter header
    if (section.chapter && section.chapter !== currentChapter) {
      if (currentChapter !== null) {
        // Close previous chapter
        parts.push(`</section>`)
      }
      currentChapter = section.chapter
      const chapterNum = currentChapter.replace(/\s*kap\.?\s*/i, '')
      parts.push(`<section class="kapitel" id="${sfsId}_K${chapterNum}">`)
      parts.push(
        `<h2><span class="kapitel">${escapeHtml(currentChapter)}</span></h2>`
      )
    }

    // Group header
    if (section.groupHeader && section.groupHeader !== currentGroupHeader) {
      currentGroupHeader = section.groupHeader
      parts.push(`<section class="group">`)
      parts.push(`<h3 class="group">${escapeHtml(currentGroupHeader)}</h3>`)
    }

    // Section wrapper
    const sectionNum = section.sectionNumber.replace(/\s*§\s*/, '')
    const chapterPrefix = currentChapter
      ? `K${currentChapter.replace(/\s*kap\.?\s*/i, '')}_`
      : ''
    const sectionId = `${sfsId}_${chapterPrefix}P${sectionNum}`

    parts.push(`<section class="paragraf" id="${sectionId}">`)
    parts.push(`<div class="element-body">`)

    // Section header
    parts.push(`<h3 class="paragraph">`)
    if (section.chapter) {
      parts.push(`<span class="kapitel">${escapeHtml(section.chapter)}</span> `)
    }
    parts.push(`${escapeHtml(section.sectionNumber)}`)
    parts.push(`</h3>`)

    // Footnote references (as superscript)
    if (section.footnoteRefs.length > 0) {
      parts.push(`<sup class="footnote">`)
      parts.push(section.footnoteRefs.map(escapeHtml).join(' '))
      parts.push(`</sup>`)
    }

    // Lead text
    if (section.leadText) {
      parts.push(
        `<p class="text">${linkifySfsReferences(escapeHtml(section.leadText))}</p>`
      )
    }

    // Definition list
    if (section.definitions && section.definitions.length > 0) {
      parts.push(`<ul class="list definition-list" style="list-style: none;">`)
      for (const def of section.definitions) {
        parts.push(`<li>`)
        parts.push(
          `<p class="text"><em>${escapeHtml(def.term)}</em> i ${escapeHtml(def.reference)}</p>`
        )
        parts.push(`</li>`)
      }
      parts.push(`</ul>`)
    }

    // Numbered list items
    if (section.items.length > 0) {
      parts.push(`<ol class="list" type="1">`)
      for (const item of section.items) {
        parts.push(`<li>`)
        parts.push(
          `<p class="text">${linkifySfsReferences(escapeHtml(item.text))}</p>`
        )

        // Sub-items
        if (item.subItems && item.subItems.length > 0) {
          parts.push(`<ol class="list sub-list" type="a">`)
          for (const subItem of item.subItems) {
            parts.push(`<li>`)
            parts.push(
              `<p class="text">${linkifySfsReferences(escapeHtml(subItem.text))}</p>`
            )
            parts.push(`</li>`)
          }
          parts.push(`</ol>`)
        }

        parts.push(`</li>`)
      }
      parts.push(`</ol>`)
    }

    // Plain text (if no list items or definitions)
    if (
      section.items.length === 0 &&
      (!section.definitions || section.definitions.length === 0) &&
      !section.leadText
    ) {
      parts.push(
        `<p class="text">${linkifySfsReferences(escapeHtml(section.text))}</p>`
      )
    }

    parts.push(`</div>`)
    parts.push(`</section>`)

    // Close group section if next section has different group header
    if (currentGroupHeader) {
      const nextSection =
        structure.sections[structure.sections.indexOf(section) + 1]
      if (!nextSection || nextSection.groupHeader !== currentGroupHeader) {
        parts.push(`</section>`) // Close group
        currentGroupHeader = null
      }
    }
  }

  // Close any open chapter
  if (currentChapter !== null) {
    parts.push(`</section>`)
  }

  parts.push(`</div>`) // Close body

  // Transition provisions (footer)
  if (structure.transitionProvisions.length > 0) {
    parts.push(`<footer class="back" id="${sfsId}_BACK">`)
    parts.push(`<section class="in-force-info">`)
    parts.push(`<h2>Ikraftträdande- och övergångsbestämmelser</h2>`)
    parts.push(`<dl class="in-force">`)
    parts.push(`<dt class="in-force">${escapeHtml(structure.sfsNumber)}</dt>`)
    parts.push(`<dd class="in-force">`)
    parts.push(`<ol class="list" type="1">`)
    for (const provision of structure.transitionProvisions) {
      parts.push(`<li>`)
      parts.push(
        `<p class="text">${linkifySfsReferences(escapeHtml(provision.text))}</p>`
      )
      parts.push(`</li>`)
    }
    parts.push(`</ol>`)
    parts.push(`</dd>`)
    parts.push(`</dl>`)
    parts.push(`</section>`)
    parts.push(`</footer>`)
  }

  parts.push(`</article>`)

  return parts.join('\n')
}
