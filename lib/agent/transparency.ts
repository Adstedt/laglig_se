/**
 * Transparency Module
 * Story 14.9, Task 2 (AC: 13-14)
 *
 * Provides formatting utilities for search transparency blocks and source
 * citations. These are utility exports for downstream consumers (14.10
 * assessment UI, chat UI enhancements) — not wired into the chat route here.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransparencySource {
  documentTitle: string
  documentNumber?: string | null
  sourceType: 'LEGAL_DOCUMENT' | 'USER_FILE' | 'CHANGE_EVENT'
  relevanceScore?: number | undefined
}

export interface CitationSource {
  documentNumber?: string | null
  contextualHeader?: string | null
  sourceType: 'LEGAL_DOCUMENT' | 'USER_FILE' | 'CHANGE_EVENT'
  path?: string | null
}

// ---------------------------------------------------------------------------
// formatTransparencyBlock
// ---------------------------------------------------------------------------

/**
 * Generates a "Jag sökte i..." block showing which documents were searched
 * and how many relevant sections were found.
 *
 * Deduplicates by document title — multiple chunks from the same document
 * are listed once.
 */
export function formatTransparencyBlock(
  searchResults: TransparencySource[]
): string {
  if (searchResults.length === 0) {
    return 'Inga dokument genomsöktes.'
  }

  // Deduplicate by document title
  const seen = new Set<string>()
  const uniqueLabels: string[] = []

  for (const source of searchResults) {
    const key = source.documentTitle
    if (seen.has(key)) continue
    seen.add(key)

    let label: string
    switch (source.sourceType) {
      case 'LEGAL_DOCUMENT':
        label = source.documentNumber
          ? `${source.documentTitle} (${source.documentNumber})`
          : source.documentTitle
        break
      case 'USER_FILE':
        label = source.documentTitle
        break
      case 'CHANGE_EVENT':
        label = `Ändring i ${source.documentTitle}`
        break
    }
    uniqueLabels.push(label)
  }

  const docList = uniqueLabels.join(', ')
  const count = searchResults.length

  return `Sökte i: ${docList}\nHittade ${count} relevanta avsnitt`
}

// ---------------------------------------------------------------------------
// formatSourceCitation
// ---------------------------------------------------------------------------

/**
 * Formats an inline source citation in [Källa: ...] format.
 *
 * For LEGAL_DOCUMENT: parses contextualHeader or path for chapter/section info.
 * For USER_FILE: shows filename from path.
 * For CHANGE_EVENT: shows amendment reference.
 */
export function formatSourceCitation(source: CitationSource): string {
  switch (source.sourceType) {
    case 'LEGAL_DOCUMENT': {
      const docRef = source.documentNumber ?? 'okänt dokument'
      const locationPart = extractLocation(source.contextualHeader, source.path)
      return locationPart
        ? `[Källa: ${docRef}, ${locationPart}]`
        : `[Källa: ${docRef}]`
    }
    case 'USER_FILE': {
      const filename = extractFilename(source.path)
      return `[Källa: ${filename}]`
    }
    case 'CHANGE_EVENT': {
      const changeRef = source.documentNumber
        ? `Ändring ${source.documentNumber}`
        : 'Ändring'
      return `[Källa: ${changeRef}]`
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts chapter/section location from contextualHeader or path.
 * Looks for patterns like "Kap 2, 3 §" or "2 kap. 3 §".
 */
function extractLocation(
  contextualHeader?: string | null,
  path?: string | null
): string | null {
  const text = contextualHeader ?? path
  if (!text) return null

  // Match patterns like "Kap 2, 3 §", "2 kap. 3 §", "3 §", "Kapitel 2"
  const kapSection = text.match(/(\d+)\s*kap\.?\s*,?\s*(\d+)\s*§/i)
  if (kapSection) {
    return `Kap ${kapSection[1]}, ${kapSection[2]} §`
  }

  const kapOnly = text.match(/[Kk]ap(?:itel)?\s*(\d+)/)
  const sectionOnly = text.match(/(\d+)\s*§/)

  if (kapOnly && sectionOnly) {
    return `Kap ${kapOnly[1]}, ${sectionOnly[1]} §`
  }
  if (kapOnly) {
    return `Kap ${kapOnly[1]}`
  }
  if (sectionOnly) {
    return `${sectionOnly[1]} §`
  }

  return null
}

/**
 * Extracts a filename from a path string.
 */
function extractFilename(path?: string | null): string {
  if (!path) return 'okänd fil'
  const parts = path.split('/')
  return parts[parts.length - 1] ?? 'okänd fil'
}
