/**
 * Citation utilities for inline citation pills.
 *
 * Two modes:
 *   1. Server-side: `extractSourcesFromToolResult()` — called from the API route's
 *      `messageMetadata` callback when a tool-result stream part arrives.
 *   2. Client-side: `resolveSource()` — matches a citation label to a SourceInfo
 *      entry using chapter/section path parsing.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SourceInfo {
  documentNumber: string
  title: string | null
  snippet: string | null
  slug: string | null
  /** Chunk path from retrieval, e.g. "kap3.§2a" */
  path: string | null
  /** Anchor ID for deep-linking into the law reader, e.g. "K3P2a" */
  anchorId: string | null
}

/** Metadata shape attached to assistant messages via messageMetadata callback */
export interface ChatMessageMetadata {
  citationSources?: Record<string, SourceInfo>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if text contains any [Källa: ...] markers.
 */
export function hasCitationMarkers(text: string): boolean {
  return text.includes('[Källa:')
}

// ---------------------------------------------------------------------------
// Server-side: extract sources from tool results
// ---------------------------------------------------------------------------

/**
 * Extract citation source entries from a single tool result.
 * Called from the API route's `messageMetadata` callback for each tool-result part.
 *
 * Returns a record of path-based keys → SourceInfo, plus document-level fallbacks.
 */
export function extractSourcesFromToolResult(
  toolName: string,
  result: unknown
): Record<string, SourceInfo> {
  const sources: Record<string, SourceInfo> = {}

  function set(key: string, info: SourceInfo) {
    const k = key.trim()
    if (!(k in sources)) {
      sources[k] = info
    }
  }

  const output = result as Record<string, unknown> | undefined
  if (!output) return sources

  try {
    if (toolName === 'search_laws') {
      const data = output.data as
        | Array<{
            documentNumber?: string
            contextualHeader?: string
            snippet?: string
            slug?: string
            path?: string
          }>
        | undefined

      if (Array.isArray(data)) {
        for (const item of data) {
          if (!item.documentNumber) continue

          const anchorId = item.path ? anchorIdFromPath(item.path) : null
          const title = item.contextualHeader
            ? parseTitle(item.contextualHeader)
            : null

          const chunkInfo: SourceInfo = {
            documentNumber: item.documentNumber,
            title,
            snippet: item.snippet ? truncate(item.snippet, 150) : null,
            slug: item.slug ?? null,
            path: item.path ?? null,
            anchorId,
          }

          // Path-based key for chunk-level lookup
          if (item.path) {
            set(`${item.documentNumber}::${item.path}`, chunkInfo)
          }

          // Document-level fallback (no chunk-specific fields)
          set(item.documentNumber, {
            ...chunkInfo,
            path: null,
            anchorId: null,
          })
        }
      }
    } else if (toolName === 'get_document_details') {
      const data = output.data as
        | {
            documentNumber?: string
            title?: string
            slug?: string
            summary?: string
            markdownContent?: string
          }
        | undefined

      if (data?.documentNumber) {
        // Document-level fallback
        set(data.documentNumber, {
          documentNumber: data.documentNumber,
          title: data.title ?? null,
          snippet: data.summary ? truncate(data.summary, 150) : null,
          slug: data.slug ?? null,
          path: null,
          anchorId: null,
        })

        // Extract section-level entries from markdownContent
        if (data.markdownContent) {
          extractSectionsFromMarkdown(
            data.documentNumber,
            data.title ?? null,
            data.slug ?? null,
            data.markdownContent,
            set
          )
        }
      }
    } else if (toolName === 'get_change_details') {
      const data = output.data as
        | {
            baseLaw?: { documentNumber?: string; title?: string; slug?: string }
          }
        | undefined

      if (data?.baseLaw?.documentNumber) {
        set(data.baseLaw.documentNumber, {
          documentNumber: data.baseLaw.documentNumber,
          title: data.baseLaw.title ?? null,
          snippet: null,
          slug: data.baseLaw.slug ?? null,
          path: null,
          anchorId: null,
        })
      }
    }
  } catch {
    // Skip malformed tool output
  }

  return sources
}

// ---------------------------------------------------------------------------
// Client-side: resolve citation label → SourceInfo
// ---------------------------------------------------------------------------

/**
 * Resolve a citation label to a SourceInfo entry from the source map.
 *
 * Strategy:
 *   1. Parse label to extract chapter + section → construct path-based key
 *   2. Fall back to document number only
 */
export function resolveSource(
  label: string,
  sourceMap: Map<string, SourceInfo>
): SourceInfo | null {
  const trimmed = label.trim()

  // 1. Parse label to extract section reference and look up by path
  const parsed = parseCitationLabel(trimmed)
  if (parsed) {
    const pathKey = `${parsed.docNum}::${parsed.path}`
    const chunk = sourceMap.get(pathKey)
    if (chunk) return chunk

    // Fall back to document number, but enrich with anchor from the label
    const doc = sourceMap.get(parsed.docNum)
    if (doc) {
      const anchorId = anchorIdFromPath(parsed.path)
      if (anchorId && !doc.anchorId) {
        return { ...doc, anchorId }
      }
      return doc
    }
  }

  // 2. Simple fallback: extract document number (before first comma)
  const commaIdx = trimmed.indexOf(',')
  if (commaIdx >= 0) {
    const docNum = trimmed.slice(0, commaIdx).trim()
    const doc = sourceMap.get(docNum)
    if (doc) return doc
  }

  // 3. Try full label as document number
  return sourceMap.get(trimmed) ?? null
}

/**
 * Convert a citationSources record (from message metadata) to a Map
 * for use with the CitationSourceContext.
 */
export function sourcesToMap(
  sources: Record<string, SourceInfo> | undefined
): Map<string, SourceInfo> {
  if (!sources) return new Map()
  return new Map(Object.entries(sources))
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Parse chunk path (e.g. "kap3.§2a") into an anchor ID for the law reader.
 */
export function anchorIdFromPath(path: string): string | null {
  const match = path.match(/^kap(\w+)\.§(\w+)$/)
  if (!match) return null
  const [, chapter, section] = match
  if (chapter === '0') return `P${section}`
  return `K${chapter}P${section}`
}

/**
 * Build a citation-style display key from document number and chunk path.
 */
export function chunkCitationKey(
  documentNumber: string,
  path: string
): string | null {
  const match = path.match(/^kap(\w+)\.§(\w+)$/)
  if (!match) return null
  const [, chapter, section] = match
  if (chapter === '0') return `${documentNumber}, ${section} §`
  return `${documentNumber}, Kap ${chapter}, ${section} §`
}

/**
 * Parse a citation label into document number and chunk path.
 *
 * Handles formats:
 *   - "SFS 1977:1160, Kap 3, 2a §"  → path: "kap3.§2a"
 *   - "SFS 1977:1160, 7 §"           → path: "kap0.§7"
 *   - "SFS 1977:1160, 3 kap. 2a §"   → path: "kap3.§2a"
 *   - "SFS 1977:1160, 3 kap 2a §"    → path: "kap3.§2a"
 */
export function parseCitationLabel(
  label: string
): { docNum: string; path: string } | null {
  // "DOC_NUM, Kap N, M §"
  const chapComma = label.match(/^(.+?),\s*[Kk]ap\.?\s+(\w+),\s*(\w+)\s*§\s*$/)
  if (chapComma) {
    return {
      docNum: chapComma[1]!.trim(),
      path: `kap${chapComma[2]}.§${chapComma[3]}`,
    }
  }

  // "DOC_NUM, N kap. M §" or "DOC_NUM, N kap M §"
  const chapDot = label.match(/^(.+?),\s*(\w+)\s+kap\.?\s+(\w+)\s*§\s*$/)
  if (chapDot) {
    return {
      docNum: chapDot[1]!.trim(),
      path: `kap${chapDot[2]}.§${chapDot[3]}`,
    }
  }

  // "DOC_NUM, M §" (flat doc, no chapter)
  const flat = label.match(/^(.+?),\s*(\w+)\s*§\s*$/)
  if (flat) {
    return {
      docNum: flat[1]!.trim(),
      path: `kap0.§${flat[2]}`,
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/**
 * Extract section-level entries from a document's markdown content.
 * Looks for § markers (e.g. "### 2a §", "**3 §**") and extracts
 * a snippet of the following text, keyed by chapter + section path.
 */
function extractSectionsFromMarkdown(
  documentNumber: string,
  title: string | null,
  slug: string | null,
  markdown: string,
  set: (_key: string, _info: SourceInfo) => void
) {
  // Match section headings: "### 2a §", "**3 §**", "2a §" at line start
  // Track current chapter from headings like "## 3 kap." or "## Kapitel 3"
  let currentChapter = '0'
  const lines = markdown.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    // Chapter heading: "## 3 kap", "## Kapitel 3", "# 3 kap."
    const chapMatch = line.match(/^#{1,3}\s+(\d+)\s*kap/i)
    if (chapMatch) {
      currentChapter = chapMatch[1]!
      continue
    }

    // Section: "### 2a §", "**3 §**", or just "2a §" at start of line
    const secMatch = line.match(/(?:^#{1,4}\s+|\*\*)(\d+\w*)\s*§/)
    if (secMatch) {
      const section = secMatch[1]!
      const path = `kap${currentChapter}.§${section}`
      const anchorId = anchorIdFromPath(path)

      // Collect next few non-empty lines as snippet
      const snippetLines: string[] = []
      for (let j = i + 1; j < lines.length && snippetLines.length < 3; j++) {
        const nextLine = lines[j]!.trim()
        if (!nextLine) continue
        // Stop at next heading or section
        if (nextLine.startsWith('#') || /^\*?\*?\d+\w*\s*§/.test(nextLine))
          break
        // Strip markdown formatting for snippet
        snippetLines.push(nextLine.replace(/[*#>\[\]]/g, '').trim())
      }

      const snippet = snippetLines.join(' ')

      set(`${documentNumber}::${path}`, {
        documentNumber,
        title,
        snippet: snippet ? truncate(snippet, 150) : null,
        slug,
        path,
        anchorId,
      })
    }
  }
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

function parseTitle(contextualHeader: string): string {
  const idx = contextualHeader.indexOf(' > ')
  return idx >= 0 ? contextualHeader.slice(0, idx) : contextualHeader
}
