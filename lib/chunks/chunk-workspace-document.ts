/**
 * Workspace-document chunking (Story 17.9)
 *
 * Forks the legal markdown paragraph-merge algorithm from
 * `lib/chunks/chunk-document.ts` (the private `chunkFromMarkdown` + `mergeParagraphs`
 * + `splitOversized`). That code hardcodes `source_type:'LEGAL_DOCUMENT'` /
 * `workspace_id:null` (both on `ChunkInput` and inside the function), so it cannot be
 * reused directly — we parameterise `source_type` + `workspace_id` here instead.
 *
 * In-scope export: `chunkUserFile` (`USER_FILE`). Story 17.9b extends this module for
 * authored styrdokument (`WORKSPACE_DOCUMENT`) — hence the generic naming.
 *
 * Write-side isolation invariant (AC 2): every emitted chunk carries a non-null
 * `workspace_id`. The DB column is nullable (shared with the global legal corpus), so
 * nothing enforces this at the schema level — a `USER_FILE` chunk written with
 * `workspace_id = null` would leak across tenants. We assert it here.
 */

import { estimateTokenCount } from './token-count'

// Markdown paragraph-merge tuning — mirrors the legal markdown fallback.
const MERGE_TARGET_TOKENS = 400
const CAP_THRESHOLD_TOKENS = 1000
const MIN_CHUNK_CHARS = 20

/** Workspace-scoped source types that flow through this module. */
export type WorkspaceSourceType =
  | 'USER_FILE'
  | 'WORKSPACE_DOCUMENT'
  | 'COLLECTIVE_AGREEMENT'

/**
 * content_role for workspace chunks. The Prisma `ContentRole` enum has **no
 * `PARAGRAPH`** value (Story 17.9 AC 5 names it loosely), and Story 17.9 forbids a
 * schema migration — so paragraph-shaped content maps to `MARKDOWN_CHUNK` (the
 * established markdown-derived role used by the legal fallback), with `HEADING` /
 * `TABLE` detected from the block.
 */
export type WorkspaceContentRole = 'MARKDOWN_CHUNK' | 'HEADING' | 'TABLE'

/**
 * Shape of a workspace chunk ready for DB insertion (minus id, embedding, timestamps).
 * Parallels the legal `ChunkInput` but parameterises `source_type` and requires a
 * non-null `workspace_id`.
 */
export interface WorkspaceChunkInput {
  source_type: WorkspaceSourceType
  source_id: string
  workspace_id: string
  path: string
  contextual_header: string
  content: string
  content_role: WorkspaceContentRole
  token_count: number
  metadata: Record<string, unknown> | null
}

/** Input for chunking a single uploaded file's extracted markdown. */
export interface ChunkUserFileInput {
  fileId: string
  workspaceId: string
  filename: string
  /** `FileCategory` value (e.g. BEVIS, POLICY, AVTAL, CERTIFIKAT, OVRIGT). */
  category: string
  /** Structure-preserving markdown from Story 17.8's extraction. */
  markdown: string
  /** sha256 of the file bytes (Story 17.8) — stored in chunk metadata for dedupe. */
  contentHash?: string | null
}

/** `contextual_header` for a file chunk: filename + category (AC 3). */
export function buildFileHeader(filename: string, category: string): string {
  return `${filename} (${category})`
}

/**
 * Chunk an uploaded file's extracted markdown into workspace-scoped `USER_FILE`
 * chunks. Reuses the legal paragraph-merge algorithm (forked below).
 */
export function chunkUserFile(file: ChunkUserFileInput): WorkspaceChunkInput[] {
  const metadata: Record<string, unknown> = {
    filename: file.filename,
    category: file.category,
  }
  if (file.contentHash) metadata.content_hash = file.contentHash

  return chunkWorkspaceMarkdown({
    sourceType: 'USER_FILE',
    sourceId: file.fileId,
    workspaceId: file.workspaceId,
    contextualHeader: buildFileHeader(file.filename, file.category),
    markdown: file.markdown,
    metadata,
  })
}

/** `contextual_header` for a styrdokument chunk: title + document type (AC 8). */
export function buildDocumentHeader(
  title: string,
  documentType: string
): string {
  return `${title} (${documentType})`
}

/** Input for chunking an authored styrdokument's markdown (Story 17.9b). */
export interface ChunkWorkspaceDocumentInput {
  documentId: string
  workspaceId: string
  title: string
  /** `WorkspaceDocumentType` value. */
  documentType: string
  /**
   * `WorkspaceDocumentStatus` value. Story 17.9b indexed APPROVED-only; Story
   * 17.10b widens to DRAFT/IN_REVIEW/APPROVED and uses this in the chunk metadata
   * so the citation layer can render `[Källa:]` vs `[Utkast:]` (DEC-3).
   */
  status: string
  /**
   * Current version_number at index time (17.10b). Recorded in chunk metadata
   * so citations can render `[Källa: X v3]` if precision is wanted; not
   * required by any 17.10b AC but cheap to carry forward (DEC-1 compromise).
   */
  versionNumber?: number
  /** Markdown derived from `content_html` (the trigger runs `htmlToMarkdown` first). */
  markdown: string
  /** sha256 of `content_html` — stored in chunk metadata for dedupe (AC 7). */
  contentHash?: string | null
  /**
   * **Story 17.18 AC 2:** dual-tier discriminator. `'APPROVED'` chunks come from
   * `current_approved_version` (canonical, citation grounds `[Källa:]`). `'DRAFT'`
   * chunks come from `current_draft_version` (in-progress, citation grounds
   * `[Utkast:]`). Undefined → legacy single-tier call (pre-17.18); the chunk
   * carries no `tier` metadata and is treated as APPROVED-tier by the tier-scoped
   * delete path's `OR metadata->>'tier' IS NULL` clause. Self-healing migration.
   */
  tier?: 'APPROVED' | 'DRAFT'
}

/**
 * Chunk an authored styrdokument's markdown into workspace-scoped
 * `WORKSPACE_DOCUMENT` chunks (Story 17.9b). Thin wrapper over the shared
 * paragraph-merge core — uniform with `chunkUserFile`, which also receives
 * already-converted markdown (the trigger owns the `content_html → markdown` step).
 */
export function chunkWorkspaceDocument(
  doc: ChunkWorkspaceDocumentInput
): WorkspaceChunkInput[] {
  const metadata: Record<string, unknown> = {
    title: doc.title,
    document_type: doc.documentType,
    status: doc.status,
  }
  if (typeof doc.versionNumber === 'number') {
    metadata.version_number = doc.versionNumber
  }
  if (doc.contentHash) metadata.content_hash = doc.contentHash
  // Story 17.18 AC 2: tier discriminator on every chunk for dual-tier search
  // routing. Omitted on legacy single-tier calls (pre-17.18); the tier-scoped
  // delete path handles untagged chunks via `OR metadata->>'tier' IS NULL`.
  if (doc.tier) {
    metadata.tier = doc.tier
  }

  return chunkWorkspaceMarkdown({
    sourceType: 'WORKSPACE_DOCUMENT',
    sourceId: doc.documentId,
    workspaceId: doc.workspaceId,
    contextualHeader: buildDocumentHeader(doc.title, doc.documentType),
    markdown: doc.markdown,
    metadata,
  })
}

/**
 * `contextual_header` for a kollektivavtal chunk (Story 7.5, AC 5): agreement
 * name + nearest markdown section — citations must identify the agreement AND
 * where in it the text lives, not just the source filename.
 */
export function buildAgreementHeader(
  agreementName: string,
  section: string | null
): string {
  const base = `${agreementName} (Kollektivavtal)`
  return section ? `${base} > ${section}` : base
}

/** Input for chunking an uploaded kollektivavtal's extracted markdown (Story 7.5). */
export interface ChunkCollectiveAgreementInput {
  /** `CollectiveAgreement.id` — the chunk's source_id (NOT the WorkspaceFile id). */
  agreementId: string
  workspaceId: string
  /** Agreement display name, e.g. "Byggnads Kollektivavtal 2024". */
  agreementName: string
  /** Original filename of the uploaded PDF (metadata only). */
  filename: string
  /** `PersonelType` value (ARB/TJM) or null (Övrigt). */
  personelType?: string | null
  /** Backing `WorkspaceFile.id` (metadata only — traceability to the PDF). */
  workspaceFileId?: string | null
  /** Structure-preserving markdown from Story 17.8's extraction. */
  markdown: string
  /** sha256 of the file bytes — stored in chunk metadata for dedupe. */
  contentHash?: string | null
}

/**
 * Chunk an uploaded kollektivavtal's extracted markdown into workspace-scoped
 * `COLLECTIVE_AGREEMENT` chunks (Story 7.5). Same paragraph-merge core as the
 * other workspace sources, but with a **section-aware** contextual header:
 * `mergeParagraphs` never merges across markdown headings, so each merged
 * block deterministically belongs to the nearest preceding section title.
 */
export function chunkCollectiveAgreement(
  agreement: ChunkCollectiveAgreementInput
): WorkspaceChunkInput[] {
  const metadata: Record<string, unknown> = {
    agreement_name: agreement.agreementName,
    filename: agreement.filename,
  }
  if (agreement.personelType) metadata.personel_type = agreement.personelType
  if (agreement.workspaceFileId)
    metadata.workspace_file_id = agreement.workspaceFileId
  if (agreement.contentHash) metadata.content_hash = agreement.contentHash

  return chunkWorkspaceMarkdown({
    sourceType: 'COLLECTIVE_AGREEMENT',
    sourceId: agreement.agreementId,
    workspaceId: agreement.workspaceId,
    contextualHeader: buildAgreementHeader(agreement.agreementName, null),
    headerForSection: (section) =>
      buildAgreementHeader(agreement.agreementName, section),
    markdown: agreement.markdown,
    metadata,
  })
}

interface ChunkWorkspaceMarkdownArgs {
  sourceType: WorkspaceSourceType
  sourceId: string
  workspaceId: string
  contextualHeader: string
  /**
   * Story 7.5 (AC 5): when set, each chunk's `contextual_header` is derived
   * from the nearest preceding markdown section title (`null` before the
   * first heading). When omitted, every chunk carries the fixed
   * `contextualHeader` (USER_FILE / WORKSPACE_DOCUMENT behavior, unchanged).
   */
  headerForSection?: (_section: string | null) => string
  markdown: string
  metadata: Record<string, unknown> | null
}

/**
 * Core paragraph-merge chunker (forked from the legal `chunkFromMarkdown`).
 * split → merge → cap → filter, then map each block to a workspace chunk.
 */
function chunkWorkspaceMarkdown(
  args: ChunkWorkspaceMarkdownArgs
): WorkspaceChunkInput[] {
  // Write-side isolation invariant (AC 2): refuse to emit a cross-tenant chunk.
  if (!args.workspaceId) {
    throw new Error(
      `[chunk-workspace] workspace_id is required for ${args.sourceType} ${args.sourceId} — refusing to emit a chunk with a null workspace (cross-tenant leak risk)`
    )
  }

  const text = args.markdown?.trim() ?? ''
  if (!text) return []

  const merged = mergeParagraphs(text.split(/\n\n+/))

  const chunks: WorkspaceChunkInput[] = []
  let chunkIndex = 1
  // Story 7.5 (AC 5): nearest preceding markdown section title. Updated as the
  // merged blocks stream past; `mergeParagraphs` never merges across headings,
  // so a block's section is fully determined by its own first line or the last
  // heading seen before it.
  let currentSection: string | null = null

  for (const block of merged) {
    const trimmed = block.trim()

    if (args.headerForSection) {
      const heading = extractLeadingHeading(trimmed)
      if (heading) currentSection = heading
    }

    if (trimmed.length < MIN_CHUNK_CHARS) continue

    const contextualHeader = args.headerForSection
      ? args.headerForSection(currentSection)
      : args.contextualHeader

    const subBlocks =
      estimateTokenCount(trimmed) > CAP_THRESHOLD_TOKENS
        ? splitOversized(trimmed)
        : [trimmed]

    for (const sub of subBlocks) {
      const subTrimmed = sub.trim()
      if (subTrimmed.length < MIN_CHUNK_CHARS) continue
      chunks.push({
        source_type: args.sourceType,
        source_id: args.sourceId,
        workspace_id: args.workspaceId,
        path: `file.chunk${chunkIndex}`,
        contextual_header: contextualHeader,
        content: subTrimmed,
        content_role: detectContentRole(subTrimmed),
        token_count: estimateTokenCount(subTrimmed),
        metadata: args.metadata,
      })
      chunkIndex++
    }
  }

  return chunks
}

/**
 * Section title from a block's first line when it is a markdown heading
 * (`# …` – `###### …`), stripped of the `#` markers and any trailing closing
 * hashes; null otherwise. Used by the section-aware header path (Story 7.5).
 */
function extractLeadingHeading(block: string): string | null {
  const firstLine = block.split('\n', 1)[0]?.trim() ?? ''
  const match = firstLine.match(/^#{1,6}\s+(.+?)\s*#*\s*$/)
  return match?.[1]?.trim() || null
}

/**
 * Classify a markdown block. Tables (from 17.8's xlsx/csv converters) are mostly
 * pipe-delimited lines; a standalone single-line heading is HEADING; everything else
 * is paragraph content (`MARKDOWN_CHUNK`).
 */
function detectContentRole(text: string): WorkspaceContentRole {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length > 0) {
    const pipeLines = lines.filter((l) => l.trim().startsWith('|')).length
    if (pipeLines >= 2 && pipeLines >= lines.length * 0.5) return 'TABLE'
  }
  if (lines.length === 1 && /^#{1,6}\s/.test(lines[0]!.trim())) return 'HEADING'
  return 'MARKDOWN_CHUNK'
}

// ---------------------------------------------------------------------------
// Paragraph-merge primitives (forked verbatim from chunk-document.ts so the
// legal-hardcoded ChunkInput shape doesn't leak in)
// ---------------------------------------------------------------------------

/** Merge small adjacent paragraphs until reaching the target token count. */
function mergeParagraphs(paragraphs: string[]): string[] {
  const result: string[] = []
  let buffer = ''

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    // Never merge across headings.
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

  if (buffer) result.push(buffer)
  return result
}

/** Split an oversized block at sentence boundaries or newlines. */
function splitOversized(text: string): string[] {
  // Try sentence boundaries first: ". " followed by uppercase.
  const sentenceParts = text.split(/(?<=\.\s)(?=[A-ZÅÄÖ])/)
  if (sentenceParts.length > 1) {
    return remergeToTarget(sentenceParts)
  }

  // Fall back to single newlines.
  const lineParts = text.split(/\n/)
  if (lineParts.length > 1) {
    return remergeToTarget(lineParts)
  }

  // Cannot split further — return as-is.
  return [text]
}

/** Re-merge split parts back up to the cap threshold. */
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
