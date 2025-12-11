/**
 * PDF Parser for Swedish Legal Amendment Documents
 *
 * Story 2.13: Extract text and structured data from SFS amendment PDFs
 *
 * Handles both modern (svenskforfattningssamling.se, 2018+) and
 * historical (rkrattsdb.gov.se, 1998-2018) amendment PDFs.
 */

import { extractText } from 'unpdf'

export interface ParsedAmendment {
  sfsNumber: string
  title: string | null
  baseLaw: {
    name: string
    sfsNumber: string
  } | null
  effectiveDate: string | null // ISO format: YYYY-MM-DD
  publicationDate: string | null
  affectedSections: AffectedSection[]
  fullText: string
  pageCount: number
}

export interface AffectedSection {
  chapter: string | null // e.g., "6" for "6 kap."
  section: string // e.g., "17" or "17 a"
  type: 'amended' | 'repealed' | 'new'
  newText?: string // The new text for amended sections
}

// Swedish month names to ISO month numbers
const SWEDISH_MONTHS: Record<string, string> = {
  januari: '01',
  februari: '02',
  mars: '03',
  april: '04',
  maj: '05',
  juni: '06',
  juli: '07',
  augusti: '08',
  september: '09',
  oktober: '10',
  november: '11',
  december: '12',
}

/**
 * Parse a Swedish date string to ISO format
 * Handles formats like "1 juli 2028", "15 november 2019"
 */
export function parseSwedishDate(dateStr: string): string | null {
  const match = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/)
  if (match && match[1] && match[2] && match[3]) {
    const day = match[1].padStart(2, '0')
    const month = SWEDISH_MONTHS[match[2].toLowerCase()]
    const year = match[3]
    if (month) {
      return `${year}-${month}-${day}`
    }
  }
  return null
}

/**
 * Extract the base law being amended from the document text
 * Pattern: "i X (SFS YYYY:NNN)" or "i X (YYYY:NNN)"
 */
export function extractBaseLaw(
  text: string
): { name: string; sfsNumber: string } | null {
  // Match patterns like "i arbetsmiljölagen (1977:1160)" or "i lagen (2023:875)"
  // Also handles "i fråga om X (...)" pattern
  const patterns = [
    // "i fråga om arbetsmiljölagen (1977:1160)" -> extracts "arbetsmiljölagen"
    /i\s+fråga\s+om\s+([^(]+?)\s*\((?:SFS\s*)?(\d{4}:\d+)\)/i,
    // "ändringar i miljötillsynsförordningen (2011:13)" -> extracts "miljötillsynsförordningen"
    /ändr(?:ing(?:ar)?|\.)\s+i\s+([^(]+?)\s*\((?:SFS\s*)?(\d{4}:\d+)\)/i,
    // "i arbetsmiljölagen (1977:1160)" -> extracts "arbetsmiljölagen"
    /i\s+([^(]+?)\s*\((?:SFS\s*)?(\d{4}:\d+)\)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1] && match[2]) {
      const name = match[1].trim()
      const sfsNumber = match[2]
      return { name, sfsNumber }
    }
  }

  return null
}

/**
 * Extract the effective date (ikraftträdande) from the document
 * Pattern: "Denna lag träder i kraft den X" or "träder i kraft den X"
 */
export function extractEffectiveDate(text: string): string | null {
  // Try multiple patterns
  const patterns = [
    /(?:Denna\s+(?:lag|förordning)|Lagen|Förordningen)\s+träder\s+i\s+kraft\s+den\s+(\d{1,2}\s+\w+\s+\d{4})/i,
    /träder\s+i\s+kraft\s+(?:den\s+)?(\d{1,2}\s+\w+\s+\d{4})/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      return parseSwedishDate(match[1])
    }
  }

  return null
}

/**
 * Extract the publication date from the document header
 * Pattern: "Utfärdad den X"
 */
export function extractPublicationDate(text: string): string | null {
  const pattern = /[Uu]tfärdad\s+den\s+(\d{1,2}\s+\w+\s+\d{4})/
  const match = text.match(pattern)

  if (match && match[1]) {
    return parseSwedishDate(match[1])
  }

  return null
}

/**
 * Extract affected sections from the document
 * Identifies amended, repealed, and new sections
 */
export function extractAffectedSections(text: string): AffectedSection[] {
  const sections: AffectedSection[] = []
  const seen = new Set<string>()

  // Pattern for amended sections: "X § ska ha följande lydelse"
  // Handles chapter context like "6 kap. 17 §"
  // Also handles patterns with law name and footnotes between section and "ska ha":
  // "6 kap. 17 § arbetsmiljölagen (1977:1160)2 ska ha följande lydelse"
  // Uses non-greedy match [^§]*? to skip any content except another section marker
  const amendedPattern =
    /(?:(\d+)\s*kap\.\s*)?(\d+(?:\s*[a-z])?)\s*§[^§]*?(?:ska|skall)\s+ha\s+följande\s+lydelse/gi
  let match
  while ((match = amendedPattern.exec(text)) !== null) {
    const chapter = match[1] || null
    const section = match[2]?.replace(/\s+/g, '') ?? ''
    if (section) {
      const key = `${chapter || ''}:${section}:amended`
      if (!seen.has(key)) {
        seen.add(key)
        sections.push({ chapter, section, type: 'amended' })
      }
    }
  }

  // Pattern for repealed sections: "X § upphävs" or "X § ska upphävas" or "X § ska upphöra att gälla"
  const repealedPattern =
    /(?:(\d+)\s*kap\.\s*)?(\d+(?:\s*[a-z])?)\s*§\s*(?:upphävs|(?:ska|skall)\s+(?:upphävas|upphöra\s+att\s+gälla))/gi
  while ((match = repealedPattern.exec(text)) !== null) {
    const chapter = match[1] || null
    const section = match[2]?.replace(/\s+/g, '') ?? ''
    if (section) {
      const key = `${chapter || ''}:${section}:repealed`
      if (!seen.has(key)) {
        seen.add(key)
        sections.push({ chapter, section, type: 'repealed' })
      }
    }
  }

  // Pattern for new sections: "ny X §" or "nya X och Y §§"
  const newPattern =
    /(?:ny|nya)\s+(?:(\d+)\s*kap\.\s*)?(\d+(?:\s*[a-z])?)\s*§/gi
  while ((match = newPattern.exec(text)) !== null) {
    const chapter = match[1] || null
    const section = match[2]?.replace(/\s+/g, '') ?? ''
    if (section) {
      const key = `${chapter || ''}:${section}:new`
      if (!seen.has(key)) {
        seen.add(key)
        sections.push({ chapter, section, type: 'new' })
      }
    }
  }

  // Also check the ingress for patterns like "dels att X kap. Y § ska upphävas" or "dels att X kap. Y § ska upphöra att gälla"
  const ingressRepealPattern =
    /dels\s+att\s+(?:(\d+)\s*kap\.\s*)?(\d+(?:\s*[a-z])?)\s*§\s*(?:ska|skall)\s+(?:upphävas|upphöra\s+att\s+gälla)/gi
  while ((match = ingressRepealPattern.exec(text)) !== null) {
    const chapter = match[1] || null
    const section = match[2]?.replace(/\s+/g, '') ?? ''
    if (section) {
      const key = `${chapter || ''}:${section}:repealed`
      if (!seen.has(key)) {
        seen.add(key)
        sections.push({ chapter, section, type: 'repealed' })
      }
    }
  }

  return sections
}

/**
 * Extract the document title from the header
 * Pattern: "Lag om ändring i X" or "Förordning om ändring i X"
 */
export function extractTitle(text: string): string | null {
  // Look for the title pattern at the beginning
  const patterns = [
    /(?:Lag|Förordning)\s+om\s+ändring\s+i\s+[^(]+\([^)]+\)/i,
    /(?:Lag|Förordning)\s+om\s+[^.]+/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return match[0].trim()
    }
  }

  return null
}

/**
 * Extract SFS number from filename or text
 */
export function extractSfsNumber(
  filename: string,
  text: string
): string | null {
  // Try filename first (e.g., SFS2025-1461.pdf)
  const filenameMatch = filename.match(/SFS(\d{4})-(\d+)/i)
  if (filenameMatch && filenameMatch[1] && filenameMatch[2]) {
    return `${filenameMatch[1]}:${filenameMatch[2]}`
  }

  // Try text (e.g., "SFS 2025:1461" or just "2025:1461")
  const textMatch = text.match(/(?:SFS\s*)?(\d{4}:\d+)/)
  if (textMatch && textMatch[1]) {
    return textMatch[1]
  }

  return null
}

/**
 * Main PDF parsing function
 * Extracts text and structured data from a PDF buffer
 */
export async function parsePdf(
  pdfBuffer: Buffer | Uint8Array,
  filename?: string
): Promise<ParsedAmendment> {
  const data =
    pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer)

  // Extract text from PDF
  const result = await extractText(data, { mergePages: true })
  const fullText = result.text
  const pageCount = result.totalPages || 1

  // Extract structured data
  const sfsNumber = extractSfsNumber(filename || '', fullText) || 'Unknown'
  const title = extractTitle(fullText)
  const baseLaw = extractBaseLaw(fullText)
  const effectiveDate = extractEffectiveDate(fullText)
  const publicationDate = extractPublicationDate(fullText)
  const affectedSections = extractAffectedSections(fullText)

  return {
    sfsNumber,
    title,
    baseLaw,
    effectiveDate,
    publicationDate,
    affectedSections,
    fullText,
    pageCount,
  }
}

/**
 * Parse a PDF from a file path
 */
export async function parsePdfFromPath(
  filePath: string
): Promise<ParsedAmendment> {
  const fs = await import('fs')
  const path = await import('path')

  const buffer = fs.readFileSync(filePath)
  const data = new Uint8Array(buffer)
  const filename = path.basename(filePath)

  return parsePdf(data, filename)
}

/**
 * Download and parse a PDF from a URL
 */
export async function parsePdfFromUrl(url: string): Promise<ParsedAmendment> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  // Extract filename from URL
  const filename = url.split('/').pop() || 'unknown.pdf'

  return parsePdf(buffer, filename)
}
