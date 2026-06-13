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
  /** External URL for web search sources (null/undefined for DB sources) */
  url?: string | null
  /**
   * Workspace document ID for styrdokument citations (set by
   * search_workspace_documents / get_workspace_document tool extractors).
   * When present, the citation pill renders an "Öppna styrdokument" CTA that
   * navigates to `/workspace/styrdokument/{workspaceDocumentId}/edit`.
   */
  workspaceDocumentId?: string | null
  /**
   * Which dual-state tier this citation represents. APPROVED → the pill's CTA
   * opens the doc with `?view=approved` (read-only approved version). DRAFT →
   * opens the default editor view (which loads the draft). Set by the
   * search_workspace_documents / get_workspace_document / list_workspace_documents
   * extractors based on which citationKey form (`<title>` vs `<title> (utkast vN)`)
   * is being registered.
   */
  tier?: 'APPROVED' | 'DRAFT' | null
  /**
   * WorkspaceFile id for uploaded-file citations (set by the
   * search_workspace_files extractor — Story 17.9d). Presence of `fileId` is
   * the file discriminator: the citation pill renders a Paperclip icon +
   * "Öppna filen" preview and routes clicks to the file (QuickPreview) rather
   * than the legal sidebar. Mirrors the workspaceDocumentId convention.
   */
  fileId?: string | null
}

/** Metadata shape attached to assistant messages via messageMetadata callback */
export interface ChatMessageMetadata {
  citationSources?: Record<string, SourceInfo>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if text contains any [Källa: ...] or [Utkast: ...] markers.
 * Story 17.10b adds the `[Utkast:]` form for DRAFT/IN_REVIEW styrdokument
 * citations (DEC-3); both forms count as "this text references a source".
 */
export function hasCitationMarkers(text: string): boolean {
  return text.includes('[Källa:') || text.includes('[Utkast:')
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
            citationKey?: string
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
            snippet: item.snippet ?? null,
            slug: item.slug ?? null,
            path: item.path ?? null,
            anchorId,
          }

          // Path-based key for chunk-level lookup
          if (item.path) {
            set(`${item.documentNumber}::${item.path}`, chunkInfo)
          }

          // Citation key for direct label → source resolution
          if (item.citationKey) {
            set(item.citationKey, chunkInfo)
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
            citationKeys?: string[]
          }
        | undefined

      if (data?.documentNumber) {
        // Document-level fallback
        set(data.documentNumber, {
          documentNumber: data.documentNumber,
          title: data.title ?? null,
          snippet: data.summary ?? null,
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

        // Register citationKey entries for direct label → source resolution
        if (Array.isArray(data.citationKeys)) {
          for (const key of data.citationKeys) {
            const parsed = parseCitationLabel(key)
            if (parsed) {
              const pathKey = `${data.documentNumber}::${parsed.path}`
              // Use existing path-based entry if available (has snippet),
              // otherwise create a document-level entry with anchor
              const existing = sources[pathKey]
              if (existing) {
                set(key, existing)
              } else {
                const aid = anchorIdFromPath(parsed.path)
                set(key, {
                  documentNumber: data.documentNumber,
                  title: data.title ?? null,
                  snippet: data.summary ?? null,
                  slug: data.slug ?? null,
                  path: parsed.path,
                  anchorId: aid,
                })
              }
            }
          }
        }
      }
    } else if (toolName === 'search_workspace_files') {
      // Story 17.9c: uploaded-file results. Files have no document number, so we
      // carry the filename in `documentNumber` (keeps SourceInfo.documentNumber a
      // non-optional string — no cross-cutting type change). The citationKey is the
      // filename; resolveSource's bare-label fallback (sourceMap.get(trimmed))
      // resolves `[Källa: <filename>]` against the keys we set here.
      const data = output.data as
        | Array<{
            fileId?: string
            filename?: string
            snippet?: string
            citationKey?: string
          }>
        | undefined

      if (Array.isArray(data)) {
        for (const item of data) {
          const filename = item.citationKey ?? item.filename
          if (!filename) continue
          set(filename, {
            documentNumber: filename,
            title: item.filename ?? filename,
            snippet: item.snippet ?? null,
            slug: null,
            path: null,
            anchorId: null,
            // Story 17.9d: carry the WorkspaceFile id so the pill can preview +
            // open the file. Presence of fileId is the file discriminator.
            fileId: item.fileId ?? null,
          })
        }
      }
    } else if (toolName === 'search_workspace_documents') {
      // Story 17.10 (DEC-2 + AC 20/21): authored styrdokument. citationKey = title.
      // Mirrors the file branch above (title carried in `documentNumber` to keep
      // SourceInfo.documentNumber a non-optional string).
      //
      // CITE-002 collision disambiguator (AC 21): two styrdokument can share
      // the same title (e.g. an older + a re-issued version both surfacing in
      // a search). We pre-scan the result set for title collisions; only
      // colliding titles get a short id suffix appended to the citationKey so
      // the model can disambiguate. Single-occurrence titles stay clean
      // (`[Källa: Dataskyddspolicy]`).
      const data = output.data as
        | Array<{
            documentId?: string
            title?: string
            snippet?: string
            citationKey?: string
            tier?: 'APPROVED' | 'DRAFT'
          }>
        | undefined

      if (Array.isArray(data)) {
        // Pre-scan: how many times does each base title appear?
        const titleCounts = new Map<string, number>()
        for (const item of data) {
          const t = item.citationKey ?? item.title
          if (!t) continue
          titleCounts.set(t, (titleCounts.get(t) ?? 0) + 1)
        }

        for (const item of data) {
          const baseTitle = item.citationKey ?? item.title
          if (!baseTitle) continue
          const isColliding = (titleCounts.get(baseTitle) ?? 0) > 1
          // Short id suffix = first 8 chars of the UUID (enough disambiguation
          // for in-result-set collisions while staying visually compact).
          const suffix =
            isColliding && item.documentId
              ? ` (${item.documentId.slice(0, 8)})`
              : ''
          const citationKey = `${baseTitle}${suffix}`
          set(citationKey, {
            documentNumber: citationKey,
            title: item.title ?? baseTitle,
            snippet: item.snippet ?? null,
            slug: null,
            path: null,
            anchorId: null,
            // Drives the "Öppna styrdokument" CTA on the citation pill.
            workspaceDocumentId: item.documentId ?? null,
            tier: item.tier ?? null,
          })
        }
      }
    } else if (toolName === 'get_workspace_document') {
      // Story 17.10 + smoke fix: when the agent reads a doc directly (instead
      // of via search), the citation pill should still resolve so the
      // "Öppna styrdokument" CTA renders. Tool returns a single doc shape
      // with `documentId` + `title` at the top level + nested approved/draft
      // tier snapshots. Story 17.18 SF-2 draft citationKey shape requires
      // BOTH the bare title AND the "title (utkast vN)" form to be in the
      // source map so [Källa: title] AND [Utkast: title (utkast vN)] both
      // resolve from the same agent turn.
      const data = output.data as
        | {
            documentId?: string
            title?: string
            content?: string
            draft?: { versionNumber?: number } | null
          }
        | undefined

      if (data?.documentId && data?.title) {
        const snippet =
          typeof data.content === 'string'
            ? data.content.slice(0, 200).replace(/\s+/g, ' ').trim() || null
            : null

        // Canonical/bare title — drives [Källa: <title>] resolution.
        set(data.title, {
          documentNumber: data.title,
          title: data.title,
          snippet,
          slug: null,
          path: null,
          anchorId: null,
          workspaceDocumentId: data.documentId,
          tier: 'APPROVED',
        })

        // Draft-tier citationKey — drives [Utkast: <title> (utkast vN)]
        // resolution. Mirrors Story 17.18 SF-2 shape used by search.
        if (typeof data.draft?.versionNumber === 'number') {
          const draftKey = `${data.title} (utkast v${data.draft.versionNumber})`
          set(draftKey, {
            documentNumber: draftKey,
            title: data.title,
            snippet,
            slug: null,
            path: null,
            anchorId: null,
            tier: 'DRAFT',
            workspaceDocumentId: data.documentId,
          })
        }
      }
    } else if (toolName === 'list_workspace_documents') {
      // Story 17.10 + smoke fix: when the agent lists docs (for triage or
      // overview), each entry should resolve as a citation source so any
      // follow-up [Källa: <title>] or [Utkast: <title> (utkast vN)] pill
      // gets the workspaceDocumentId + renders the navigation CTA.
      const data = output.data as
        | Array<{
            documentId?: string
            title?: string
            currentDraftVersionNumber?: number | null
          }>
        | undefined

      if (Array.isArray(data)) {
        for (const item of data) {
          if (!item.documentId || !item.title) continue
          set(item.title, {
            documentNumber: item.title,
            title: item.title,
            snippet: null,
            slug: null,
            path: null,
            anchorId: null,
            workspaceDocumentId: item.documentId,
            tier: 'APPROVED',
          })
          if (typeof item.currentDraftVersionNumber === 'number') {
            const draftKey = `${item.title} (utkast v${item.currentDraftVersionNumber})`
            set(draftKey, {
              documentNumber: draftKey,
              title: item.title,
              snippet: null,
              slug: null,
              path: null,
              anchorId: null,
              workspaceDocumentId: item.documentId,
              tier: 'DRAFT',
            })
          }
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
  let trimmed = label.trim()

  // Story 17.10b: chips emitted from [Utkast: <title>] carry the "Utkast: "
  // prefix in their visible text (DEC-3 — the prefix is the user-facing draft
  // marker). The source map is keyed by the title alone, so strip the prefix
  // before lookup. Källa pills never carry a prefix in the chip text.
  if (trimmed.startsWith('Utkast: ')) {
    trimmed = trimmed.slice('Utkast: '.length).trim()
  }

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
  const byLabel = sourceMap.get(trimmed)
  if (byLabel) return byLabel

  // 4. Direct web-source key lookup (model may put exact URL in citation)
  const byWebKey = sourceMap.get(`web:${trimmed}`)
  if (byWebKey) return byWebKey

  // 5. Web source fallback — match by title prefix
  for (const [key, info] of sourceMap.entries()) {
    if (!key.startsWith('web:') || !info.url) continue
    if (
      info.title &&
      trimmed.toLowerCase().startsWith(info.title.toLowerCase().slice(0, 20))
    ) {
      return info
    }
  }

  return null
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
        snippet: snippet || null,
        slug,
        path,
        anchorId,
      })
    }
  }
}

/**
 * Format internal chunk path (e.g. "kap3.§1a") to human-readable (e.g. "Kap 3, 1a §").
 * Returns null if the path doesn't match the expected format.
 */
export function formatChunkPath(path: string): string | null {
  const match = path.match(/^kap(\w+)\.§(\w+)$/)
  if (!match) return null
  const [, chapter, section] = match
  if (chapter === '0') return `${section} §`
  return `Kap ${chapter}, ${section} §`
}

function parseTitle(contextualHeader: string): string {
  const idx = contextualHeader.indexOf(' > ')
  return idx >= 0 ? contextualHeader.slice(0, idx) : contextualHeader
}

// ---------------------------------------------------------------------------
// Document browse path — infer route from document number
// ---------------------------------------------------------------------------

/** Agency regulation prefixes that use /browse/foreskrifter/ */
const AGENCY_PREFIXES = [
  'AFS',
  'BFS',
  'NFS',
  'HSLF-FS',
  'KIFS',
  'LVFS',
  'MSBFS',
  'SJVFS',
  'SKVFS',
  'SOSFS',
  'TSFS',
  'FFS',
  'ELSÄK-FS',
]

/**
 * Returns the browse base path for a document based on its document number.
 * - Agency regulations (AFS, BFS, etc.) → /browse/foreskrifter
 * - EU documents → /browse/eu
 * - Everything else (SFS) → /browse/lagar
 */
export function getDocBrowsePath(documentNumber: string): string {
  const upper = documentNumber.toUpperCase()
  if (AGENCY_PREFIXES.some((p) => upper.startsWith(p))) {
    return '/browse/foreskrifter'
  }
  if (upper.startsWith('EU ') || upper.startsWith('CELEX')) {
    return '/browse/eu'
  }
  return '/browse/lagar'
}
