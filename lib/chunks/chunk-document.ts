/**
 * Document chunking pipeline
 * Story 14.2, Tasks 4-6 (AC: 12-15)
 *
 * Three-tier strategy:
 * 1. Paragraf-level: each § becomes one chunk (primary)
 * 2. Non-§ content: transition provisions, preamble, appendices
 * 3. Markdown fallback: paragraph-merge when JSON has 0 paragrafer
 *
 * See docs/architecture/chunking-strategy.md for design decisions.
 */

import type {
  CanonicalDocumentJson,
  CanonicalChapter,
  CanonicalParagraf,
  ContentRole as TSContentRole,
} from '@/lib/transforms/document-json-schema'
import { htmlToPlainText } from '@/lib/transforms/html-to-markdown'
import { estimateTokenCount } from './token-count'

// Prisma ContentRole enum values (superset of TS ContentRole)
type ChunkContentRole =
  | 'STYCKE'
  | 'ALLMANT_RAD'
  | 'TABLE'
  | 'HEADING'
  | 'TRANSITION_PROVISION'
  | 'FOOTNOTE'
  | 'MARKDOWN_CHUNK'

/** Shape of a chunk ready for DB insertion (minus id, embedding, timestamps) */
export interface ChunkInput {
  source_type: 'LEGAL_DOCUMENT'
  source_id: string
  workspace_id: null
  path: string
  contextual_header: string
  content: string
  content_role: ChunkContentRole
  token_count: number
  metadata: Record<string, unknown> | null
}

export interface ChunkDocumentInput {
  documentId: string
  title: string | null
  documentNumber: string | null
  contentType: string | null
  slug: string | null
  jsonContent: CanonicalDocumentJson | null
  markdownContent: string | null
  htmlContent: string | null
}

// Markdown fallback tuning parameters
const MERGE_TARGET_TOKENS = 400
const CAP_THRESHOLD_TOKENS = 1000
const MIN_CHUNK_CHARS = 20

// Non-§ content tuning (higher merge target for structured legal content)
const NON_PARA_MERGE_TARGET_TOKENS = 800
const NON_PARA_CAP_TOKENS = 1000

// SFS transition provision boundary pattern: "YYYY:NNN" at start of line
const SFS_TRANSITION_BOUNDARY = /^(\d{4}:\d{1,4})\b/m

/** Convert document number to the anchor ID prefix used by the reader UI */
function toDocId(documentNumber: string): string {
  return documentNumber.replace(/\s+/g, '').replace(/:/g, '-')
}

/** Build reader-compatible anchor ID for a paragraf chunk */
function buildAnchorId(
  documentNumber: string | null,
  chapterNumber: string | null,
  paragrafNumber: string
): string | null {
  if (!documentNumber) return null
  const docId = toDocId(documentNumber)
  if (chapterNumber && chapterNumber !== '0') {
    return `${docId}_K${chapterNumber}_P${paragrafNumber}`
  }
  return `${docId}_P${paragrafNumber}`
}

/**
 * Derive chunks from a legal document.
 * Returns an array of ChunkInput ready for Prisma createMany.
 */
export function chunkDocument(input: ChunkDocumentInput): ChunkInput[] {
  const {
    documentId,
    title,
    documentNumber,
    contentType,
    slug,
    jsonContent,
    markdownContent,
    htmlContent,
  } = input
  const docLabel = `${title ?? 'Untitled'} (${documentNumber ?? 'unknown'})`

  // Base metadata present on every chunk for retrieval filtering
  const baseMeta: Record<string, unknown> = {}
  if (documentNumber) baseMeta.documentNumber = documentNumber
  if (contentType) baseMeta.contentType = contentType
  if (slug) baseMeta.slug = slug

  if (!jsonContent) {
    // No JSON at all — try markdown fallback
    return chunkFromMarkdown(
      documentId,
      title,
      documentNumber,
      contentType,
      slug,
      markdownContent,
      htmlContent
    )
  }

  const chunks: ChunkInput[] = []

  // Collect all paragrafer from all chapters (including divisions)
  const allChapters = getAllChapters(jsonContent)
  let totalParagrafer = 0
  for (const chapter of allChapters) {
    totalParagrafer += chapter.paragrafer.length
  }

  // Also check non-§ content presence
  const hasTransition =
    jsonContent.transitionProvisions &&
    jsonContent.transitionProvisions.length > 0
  const hasPreamble = jsonContent.preamble && jsonContent.preamble.text?.trim()
  const hasAppendices =
    jsonContent.appendices && jsonContent.appendices.length > 0

  if (
    totalParagrafer === 0 &&
    !hasTransition &&
    !hasPreamble &&
    !hasAppendices
  ) {
    // Empty JSON — use markdown fallback
    return chunkFromMarkdown(
      documentId,
      title,
      documentNumber,
      contentType,
      slug,
      markdownContent,
      htmlContent
    )
  }

  // Tier 1: Paragraf-level chunks
  for (const chapter of allChapters) {
    for (const paragraf of chapter.paragrafer) {
      const content = paragraf.content?.trim()
      if (!content) {
        console.warn(
          `[chunk] Skipping empty paragraf ${paragraf.number} in ${docLabel}`
        )
        continue
      }

      // Build path: kap{N}.§{M}
      const chapNum = chapter.number ?? '0'
      const path = `kap${chapNum}.§${paragraf.number}`

      // Build contextual header
      const header = buildContextualHeader(
        title,
        documentNumber,
        chapter,
        paragraf
      )

      // Determine dominant content role
      const contentRole = getDominantRole(paragraf)

      // Build metadata (base + paragraf-specific)
      const metadata: Record<string, unknown> = { ...baseMeta }
      // Generate anchorId for docs that use our {DOCID}_K{n}_P{n} format.
      // AFS docs are HTML-scraped from av.se with their own slugified IDs,
      // so skip those. All other agency docs go through our normalizer.
      const isAfsScraped =
        contentType === 'AGENCY_REGULATION' &&
        documentNumber?.startsWith('AFS ')
      if (!isAfsScraped) {
        const anchorId = buildAnchorId(documentNumber, chapNum, paragraf.number)
        if (anchorId) metadata.anchorId = anchorId
      }
      if (paragraf.amendedBy) {
        metadata.amendedBy = paragraf.amendedBy
      }
      if (paragraf.heading) {
        metadata.heading = paragraf.heading
      }

      const chunkContent = paragraf.heading
        ? `${paragraf.heading}\n${content}`
        : content

      chunks.push({
        source_type: 'LEGAL_DOCUMENT',
        source_id: documentId,
        workspace_id: null,
        path,
        contextual_header: header,
        content: chunkContent,
        content_role: contentRole,
        token_count: estimateTokenCount(chunkContent),
        metadata,
      })
    }
  }

  // Tier 2: Non-§ content (with splitting for oversized chunks)
  // Transition provisions — split at SFS-number boundaries when oversized
  if (
    jsonContent.transitionProvisions &&
    jsonContent.transitionProvisions.length > 0
  ) {
    const text = jsonContent.transitionProvisions.map((s) => s.text).join('\n')
    if (text.trim().length >= MIN_CHUNK_CHARS) {
      const baseHeader = `${title ?? ''} (${documentNumber ?? ''}) > Övergångsbestämmelser`
      const trimmed = text.trim()

      if (estimateTokenCount(trimmed) <= NON_PARA_CAP_TOKENS) {
        // Small enough — single chunk
        chunks.push({
          source_type: 'LEGAL_DOCUMENT',
          source_id: documentId,
          workspace_id: null,
          path: 'overgangsbest',
          contextual_header: baseHeader,
          content: trimmed,
          content_role: 'TRANSITION_PROVISION',
          token_count: estimateTokenCount(trimmed),
          metadata: { ...baseMeta },
        })
      } else {
        // Oversized — split at SFS-number boundaries
        const subChunks = splitTransitionProvisions(trimmed)
        for (let i = 0; i < subChunks.length; i++) {
          const sub = subChunks[i]!
          if (sub.content.length < MIN_CHUNK_CHARS) continue
          chunks.push({
            source_type: 'LEGAL_DOCUMENT',
            source_id: documentId,
            workspace_id: null,
            path:
              subChunks.length === 1
                ? 'overgangsbest'
                : `overgangsbest.${i + 1}`,
            contextual_header: sub.sfsNumber
              ? `${baseHeader} > ${sub.sfsNumber}`
              : baseHeader,
            content: sub.content,
            content_role: 'TRANSITION_PROVISION',
            token_count: estimateTokenCount(sub.content),
            metadata: sub.sfsNumber
              ? { ...baseMeta, sfsNumber: sub.sfsNumber }
              : { ...baseMeta },
          })
        }
      }
    }
  }

  // Preamble — split with paragraph-merge when oversized
  if (jsonContent.preamble && jsonContent.preamble.text?.trim()) {
    const text = jsonContent.preamble.text.trim()
    if (text.length >= MIN_CHUNK_CHARS) {
      const baseHeader = `${title ?? ''} (${documentNumber ?? ''}) > Inledning`

      if (estimateTokenCount(text) <= NON_PARA_CAP_TOKENS) {
        chunks.push({
          source_type: 'LEGAL_DOCUMENT',
          source_id: documentId,
          workspace_id: null,
          path: 'preamble',
          contextual_header: baseHeader,
          content: text,
          content_role: 'STYCKE',
          token_count: estimateTokenCount(text),
          metadata: { ...baseMeta },
        })
      } else {
        const subChunks = splitNonParaContent(text)
        for (let i = 0; i < subChunks.length; i++) {
          const sub = subChunks[i]!.trim()
          if (sub.length < MIN_CHUNK_CHARS) continue
          chunks.push({
            source_type: 'LEGAL_DOCUMENT',
            source_id: documentId,
            workspace_id: null,
            path: subChunks.length === 1 ? 'preamble' : `preamble.${i + 1}`,
            contextual_header: baseHeader,
            content: sub,
            content_role: 'STYCKE',
            token_count: estimateTokenCount(sub),
            metadata: { ...baseMeta },
          })
        }
      }
    }
  }

  // Appendices — split with paragraph-merge when oversized
  if (jsonContent.appendices) {
    for (let i = 0; i < jsonContent.appendices.length; i++) {
      const appendix = jsonContent.appendices[i]!
      const text = appendix.text?.trim()
      if (!text || text.length < MIN_CHUNK_CHARS) continue
      const n = i + 1
      const baseHeader = `${title ?? ''} (${documentNumber ?? ''}) > Bilaga ${n}`
      const appendixMeta = appendix.title
        ? { ...baseMeta, appendixTitle: appendix.title }
        : { ...baseMeta }

      if (estimateTokenCount(text) <= NON_PARA_CAP_TOKENS) {
        chunks.push({
          source_type: 'LEGAL_DOCUMENT',
          source_id: documentId,
          workspace_id: null,
          path: `bilaga.${n}`,
          contextual_header: baseHeader,
          content: text,
          content_role: 'STYCKE',
          token_count: estimateTokenCount(text),
          metadata: appendixMeta,
        })
      } else {
        const subChunks = splitNonParaContent(text)
        for (let j = 0; j < subChunks.length; j++) {
          const sub = subChunks[j]!.trim()
          if (sub.length < MIN_CHUNK_CHARS) continue
          chunks.push({
            source_type: 'LEGAL_DOCUMENT',
            source_id: documentId,
            workspace_id: null,
            path:
              subChunks.length === 1 ? `bilaga.${n}` : `bilaga.${n}.${j + 1}`,
            contextual_header: baseHeader,
            content: sub,
            content_role: 'STYCKE',
            token_count: estimateTokenCount(sub),
            metadata: appendixMeta,
          })
        }
      }
    }
  }

  // Fix 2: Deduplicate paths — append .v2, .v3 for duplicates
  deduplicatePaths(chunks)

  return chunks
}

// ============================================================================
// Helpers
// ============================================================================

/** Flatten chapters from both top-level and division-nested chapters */
function getAllChapters(json: CanonicalDocumentJson): CanonicalChapter[] {
  if (json.divisions && json.divisions.length > 0) {
    return json.divisions.flatMap((d) => d.chapters ?? [])
  }
  return json.chapters ?? []
}

/** Build contextual header for a paragraf chunk */
function buildContextualHeader(
  title: string | null,
  documentNumber: string | null,
  chapter: CanonicalChapter,
  paragraf: CanonicalParagraf
): string {
  const docPart = `${title ?? ''} (${documentNumber ?? ''})`

  if (chapter.number === null || chapter.number === '0') {
    // Flat doc — no chapter in header
    return `${docPart} > ${paragraf.number} §`
  }

  const chapterPart = chapter.title
    ? `Kap ${chapter.number}: ${chapter.title}`
    : `Kap ${chapter.number}`

  return `${docPart} > ${chapterPart} > ${paragraf.number} §`
}

/** Determine the dominant ContentRole from a paragraf's stycken */
function getDominantRole(paragraf: CanonicalParagraf): ChunkContentRole {
  const stycken = paragraf.stycken
  if (!stycken || stycken.length === 0) return 'STYCKE'

  // Check if all stycken share the same role
  const roles = new Set(stycken.map((s) => s.role))
  if (roles.size === 1) {
    return mapTSRoleToPrisma(stycken[0]!.role)
  }

  // Mixed roles — default to STYCKE
  return 'STYCKE'
}

/** Map TS ContentRole to Prisma ContentRole enum (handles missing values) */
function mapTSRoleToPrisma(role: TSContentRole): ChunkContentRole {
  switch (role) {
    case 'STYCKE':
    case 'ALLMANT_RAD':
    case 'TABLE':
    case 'HEADING':
    case 'TRANSITION_PROVISION':
    case 'FOOTNOTE':
      return role
    case 'LIST_ITEM':
    case 'PREAMBLE':
      return 'STYCKE' // absorbed into chunk content
    default:
      return 'STYCKE'
  }
}

// ============================================================================
// Non-§ content splitting
// ============================================================================

interface TransitionChunk {
  sfsNumber: string | null
  content: string
}

/**
 * Split transition provisions at SFS-number boundaries (e.g. "2011:1082\n...").
 * Each amendment's transition clause becomes its own chunk.
 * Adjacent small entries are merged up to the cap threshold.
 */
function splitTransitionProvisions(text: string): TransitionChunk[] {
  // Split at lines starting with "YYYY:NNN"
  const entries: TransitionChunk[] = []
  const lines = text.split('\n')
  let currentSfs: string | null = null
  let currentLines: string[] = []

  for (const line of lines) {
    const match = SFS_TRANSITION_BOUNDARY.exec(line)
    if (match) {
      // Flush previous entry
      if (currentLines.length > 0) {
        const content = currentLines.join('\n').trim()
        if (content) entries.push({ sfsNumber: currentSfs, content })
      }
      currentSfs = match[1]!
      currentLines = [line]
    } else {
      currentLines.push(line)
    }
  }
  // Flush last entry
  if (currentLines.length > 0) {
    const content = currentLines.join('\n').trim()
    if (content) entries.push({ sfsNumber: currentSfs, content })
  }

  // If no SFS boundaries found, fall back to paragraph-merge
  if (entries.length <= 1) {
    const subBlocks = splitNonParaContent(text)
    return subBlocks.map((block) => ({
      sfsNumber: null,
      content: block.trim(),
    }))
  }

  // Merge adjacent small entries up to the cap threshold
  const merged: TransitionChunk[] = []
  let buffer: TransitionChunk | null = null

  for (const entry of entries) {
    if (!buffer) {
      buffer = { ...entry }
    } else {
      const combined = `${buffer.content}\n${entry.content}`
      if (estimateTokenCount(combined) <= NON_PARA_CAP_TOKENS) {
        buffer.content = combined
        // Keep the first SFS number as the label
      } else {
        merged.push(buffer)
        buffer = { ...entry }
      }
    }
  }
  if (buffer) merged.push(buffer)

  return merged
}

/**
 * Split oversized non-§ content (preamble/appendix) using paragraph-merge.
 * Higher merge target than markdown fallback since legal content is denser.
 */
function splitNonParaContent(text: string): string[] {
  const rawParagraphs = text.split(/\n\n+/)
  const merged = mergeNonParaParagraphs(rawParagraphs)

  const result: string[] = []
  for (const block of merged) {
    const trimmed = block.trim()
    if (!trimmed) continue
    if (estimateTokenCount(trimmed) > NON_PARA_CAP_TOKENS) {
      // Further split oversized blocks at sentence boundaries
      result.push(...splitOversized(trimmed))
    } else {
      result.push(trimmed)
    }
  }
  return result
}

/** Merge paragraphs with non-§ merge target (~800 tokens) */
function mergeNonParaParagraphs(paragraphs: string[]): string[] {
  const result: string[] = []
  let buffer = ''

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    const isHeading = /^#{1,6}\s/.test(trimmed)

    if (isHeading && buffer) {
      result.push(buffer)
      buffer = ''
    }

    if (!buffer) {
      buffer = trimmed
    } else {
      const combined = `${buffer}\n\n${trimmed}`
      if (
        estimateTokenCount(combined) <= NON_PARA_MERGE_TARGET_TOKENS &&
        !isHeading
      ) {
        buffer = combined
      } else {
        result.push(buffer)
        buffer = trimmed
      }
    }
  }

  if (buffer) result.push(buffer)
  return result
}

/** Deduplicate paths within a chunk array — append .v2, .v3 for duplicates */
function deduplicatePaths(chunks: ChunkInput[]): void {
  const seen = new Map<string, number>()
  for (const chunk of chunks) {
    const count = seen.get(chunk.path) ?? 0
    if (count > 0) {
      chunk.path = `${chunk.path}.v${count + 1}`
    }
    seen.set(chunk.path.replace(/\.v\d+$/, ''), count + 1)
  }
}

// ============================================================================
// Tier 3: Markdown Fallback (Paragraph-Merge)
// ============================================================================

/**
 * Chunk from markdown or HTML when JSON has no paragrafer.
 * Uses paragraph-merge strategy: split → merge → cap → filter.
 */
function chunkFromMarkdown(
  documentId: string,
  title: string | null,
  documentNumber: string | null,
  contentType: string | null,
  slug: string | null,
  markdownContent: string | null,
  htmlContent: string | null
): ChunkInput[] {
  // Prefer markdown, fall back to plaintext from HTML
  let text = markdownContent?.trim() || ''
  if (!text && htmlContent) {
    text = htmlToPlainText(htmlContent).trim()
  }
  if (!text) return []

  const header = `${title ?? ''} (${documentNumber ?? ''})`
  const mdBaseMeta: Record<string, unknown> = {}
  if (documentNumber) mdBaseMeta.documentNumber = documentNumber
  if (contentType) mdBaseMeta.contentType = contentType
  if (slug) mdBaseMeta.slug = slug
  const rawParagraphs = text.split(/\n\n+/)
  const merged = mergeParagraphs(rawParagraphs)

  const chunks: ChunkInput[] = []
  let chunkIndex = 1

  for (const block of merged) {
    const trimmed = block.trim()
    if (trimmed.length < MIN_CHUNK_CHARS) continue

    const tokens = estimateTokenCount(trimmed)
    const chunkMeta =
      Object.keys(mdBaseMeta).length > 0 ? { ...mdBaseMeta } : null
    if (tokens > CAP_THRESHOLD_TOKENS) {
      // Split oversized block
      const subBlocks = splitOversized(trimmed)
      for (const sub of subBlocks) {
        const subTrimmed = sub.trim()
        if (subTrimmed.length < MIN_CHUNK_CHARS) continue
        chunks.push({
          source_type: 'LEGAL_DOCUMENT',
          source_id: documentId,
          workspace_id: null,
          path: `md.chunk${chunkIndex}`,
          contextual_header: header,
          content: subTrimmed,
          content_role: 'MARKDOWN_CHUNK',
          token_count: estimateTokenCount(subTrimmed),
          metadata: chunkMeta,
        })
        chunkIndex++
      }
    } else {
      chunks.push({
        source_type: 'LEGAL_DOCUMENT',
        source_id: documentId,
        workspace_id: null,
        path: `md.chunk${chunkIndex}`,
        contextual_header: header,
        content: trimmed,
        content_role: 'MARKDOWN_CHUNK',
        token_count: estimateTokenCount(trimmed),
        metadata: chunkMeta,
      })
      chunkIndex++
    }
  }

  return chunks
}

/** Merge small adjacent paragraphs until reaching the target token count */
function mergeParagraphs(paragraphs: string[]): string[] {
  const result: string[] = []
  let buffer = ''

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    // Never merge across headings
    const isHeading = /^#{1,6}\s/.test(trimmed)

    if (isHeading && buffer) {
      result.push(buffer)
      buffer = ''
    }

    if (!buffer) {
      buffer = trimmed
    } else {
      const combined = `${buffer}\n\n${trimmed}`
      if (estimateTokenCount(combined) <= MERGE_TARGET_TOKENS && !isHeading) {
        buffer = combined
      } else {
        result.push(buffer)
        buffer = trimmed
      }
    }
  }

  if (buffer) {
    result.push(buffer)
  }

  return result
}

/** Split an oversized block at sentence boundaries or newlines */
function splitOversized(text: string): string[] {
  // Try sentence boundaries first: ". " followed by uppercase
  const sentenceParts = text.split(/(?<=\.\s)(?=[A-ZÅÄÖ])/)
  if (sentenceParts.length > 1) {
    return remergeToTarget(sentenceParts)
  }

  // Fall back to single newlines
  const lineParts = text.split(/\n/)
  if (lineParts.length > 1) {
    return remergeToTarget(lineParts)
  }

  // Cannot split further — return as-is
  return [text]
}

/** Re-merge split parts back up to the cap threshold */
function remergeToTarget(parts: string[]): string[] {
  const result: string[] = []
  let buffer = ''

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    if (!buffer) {
      buffer = trimmed
    } else {
      const combined = `${buffer} ${trimmed}`
      if (estimateTokenCount(combined) <= CAP_THRESHOLD_TOKENS) {
        buffer = combined
      } else {
        result.push(buffer)
        buffer = trimmed
      }
    }
  }

  if (buffer) result.push(buffer)
  return result
}
