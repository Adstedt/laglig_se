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
  jsonContent: CanonicalDocumentJson | null
  markdownContent: string | null
  htmlContent: string | null
}

// Markdown fallback tuning parameters
const MERGE_TARGET_TOKENS = 400
const CAP_THRESHOLD_TOKENS = 1000
const MIN_CHUNK_CHARS = 20

/**
 * Derive chunks from a legal document.
 * Returns an array of ChunkInput ready for Prisma createMany.
 */
export function chunkDocument(input: ChunkDocumentInput): ChunkInput[] {
  const {
    documentId,
    title,
    documentNumber,
    jsonContent,
    markdownContent,
    htmlContent,
  } = input
  const docLabel = `${title ?? 'Untitled'} (${documentNumber ?? 'unknown'})`

  if (!jsonContent) {
    // No JSON at all — try markdown fallback
    return chunkFromMarkdown(
      documentId,
      title,
      documentNumber,
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

      // Build metadata
      const metadata: Record<string, unknown> = {}
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
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      })
    }
  }

  // Tier 2: Non-§ content
  // Transition provisions
  if (
    jsonContent.transitionProvisions &&
    jsonContent.transitionProvisions.length > 0
  ) {
    const text = jsonContent.transitionProvisions.map((s) => s.text).join('\n')
    if (text.trim().length >= MIN_CHUNK_CHARS) {
      chunks.push({
        source_type: 'LEGAL_DOCUMENT',
        source_id: documentId,
        workspace_id: null,
        path: 'overgangsbest',
        contextual_header: `${title ?? ''} (${documentNumber ?? ''}) > Övergångsbestämmelser`,
        content: text.trim(),
        content_role: 'TRANSITION_PROVISION',
        token_count: estimateTokenCount(text),
        metadata: null,
      })
    }
  }

  // Preamble
  if (jsonContent.preamble && jsonContent.preamble.text?.trim()) {
    const text = jsonContent.preamble.text.trim()
    if (text.length >= MIN_CHUNK_CHARS) {
      chunks.push({
        source_type: 'LEGAL_DOCUMENT',
        source_id: documentId,
        workspace_id: null,
        path: 'preamble',
        contextual_header: `${title ?? ''} (${documentNumber ?? ''}) > Inledning`,
        content: text,
        content_role: 'STYCKE',
        token_count: estimateTokenCount(text),
        metadata: null,
      })
    }
  }

  // Appendices
  if (jsonContent.appendices) {
    for (let i = 0; i < jsonContent.appendices.length; i++) {
      const appendix = jsonContent.appendices[i]!
      const text = appendix.text?.trim()
      if (!text || text.length < MIN_CHUNK_CHARS) continue
      const n = i + 1
      chunks.push({
        source_type: 'LEGAL_DOCUMENT',
        source_id: documentId,
        workspace_id: null,
        path: `bilaga.${n}`,
        contextual_header: `${title ?? ''} (${documentNumber ?? ''}) > Bilaga ${n}`,
        content: text,
        content_role: 'STYCKE',
        token_count: estimateTokenCount(text),
        metadata: appendix.title ? { appendixTitle: appendix.title } : null,
      })
    }
  }

  return chunks
}

// ============================================================================
// Helpers
// ============================================================================

/** Flatten chapters from both top-level and division-nested chapters */
function getAllChapters(json: CanonicalDocumentJson): CanonicalChapter[] {
  if (json.divisions && json.divisions.length > 0) {
    return json.divisions.flatMap((d) => d.chapters)
  }
  return json.chapters
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
  const rawParagraphs = text.split(/\n\n+/)
  const merged = mergeParagraphs(rawParagraphs)

  const chunks: ChunkInput[] = []
  let chunkIndex = 1

  for (const block of merged) {
    const trimmed = block.trim()
    if (trimmed.length < MIN_CHUNK_CHARS) continue

    const tokens = estimateTokenCount(trimmed)
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
          metadata: null,
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
        metadata: null,
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
