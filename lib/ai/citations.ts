/**
 * Story 3.3: Citation parsing utilities
 * Extracts and maps citation markers from AI responses
 */

export interface Citation {
  id: string
  number: number
  lawTitle: string
  sfsNumber: string
  snippet: string
  lawId: string
}

export interface TextSegment {
  type: 'text' | 'citation'
  content: string
}

export interface ParsedCitations {
  segments: TextSegment[]
  citationNumbers: number[]
}

/**
 * Parse text for citation markers [1], [2], etc.
 * Returns segments for rendering and extracted citation numbers
 */
export function parseCitations(text: string): ParsedCitations {
  const segments: TextSegment[] = []
  const citationNumbers: number[] = []
  const regex = /\[(\d+)\]/g

  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    // Add text before citation
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      })
    }

    // Add citation marker
    const citationMatch = match[1]
    if (citationMatch) {
      const citationNumber = parseInt(citationMatch, 10)
      segments.push({
        type: 'citation',
        content: citationMatch,
      })
      citationNumbers.push(citationNumber)
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    })
  }

  return { segments, citationNumbers }
}

/**
 * Create citation objects from RAG context
 * Used to map citation numbers to actual law references
 */
export function createCitationsFromContext(
  context: Array<{
    id: string
    title: string
    sfsNumber: string
    content: string
  }>
): Citation[] {
  return context.map((item, index) => ({
    id: item.id,
    number: index + 1,
    lawTitle: item.title,
    sfsNumber: item.sfsNumber,
    snippet: truncateSnippet(item.content, 100),
    lawId: item.id,
  }))
}

/**
 * Truncate snippet to specified length with ellipsis
 */
function truncateSnippet(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}
