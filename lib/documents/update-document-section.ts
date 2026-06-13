/**
 * Story 17.11: Section-replacement utility for the `update_document` agent tool.
 *
 * Pure functions on Tiptap JSON. Used by:
 *  - `lib/agent/tools/update-document.ts` at propose time to capture
 *    `params.oldSectionContentJson` (the current section body) so the renderer
 *    can show a diff without re-fetching the document.
 *  - `app/actions/pending-agent-actions.ts` at approval-dispatch time to
 *    produce the full updated `contentJson` for `saveDocumentVersion`.
 *
 * Section model (AC 9): a "section" is bounded by a heading node and runs
 * until the next heading of the **same-or-higher level** (lower `level`
 * number) — or the end of the document. The heading itself is preserved;
 * only the body is replaced.
 *
 * Heading matching is case-insensitive (per AC 9). The first match wins
 * when multiple headings share the same text.
 */

export interface TiptapMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface TiptapNode {
  type: string
  attrs?: Record<string, unknown> | undefined
  content?: TiptapNode[] | undefined
  marks?: TiptapMark[] | undefined
  text?: string | undefined
}

export interface TiptapDocumentJSON {
  type: 'doc'
  content: TiptapNode[]
}

/**
 * Story 19.8 (QA): strip ProseMirror-invalid empty text nodes from agent-authored
 * Tiptap JSON before it is persisted. Models routinely emit `{ type: 'text',
 * text: '' }` for blank table cells / placeholder paragraphs, but ProseMirror's
 * schema forbids empty text nodes — `nodeFromJSON` then THROWS on editor mount and
 * the WHOLE document renders blank (not just the bad cell). One empty text node
 * anywhere silently destroys the document's visibility.
 *
 * Recursively drops child nodes that are text nodes with an empty / non-string
 * `text`, and recurses into the rest. Returns a new tree (no mutation). An empty
 * paragraph (its `content` now an empty array) is VALID and kept — that is the
 * correct representation of a blank table cell.
 */
export function stripEmptyTextNodes(node: TiptapNode): TiptapNode {
  if (!Array.isArray(node.content)) return node
  const cleaned = node.content
    .filter(
      (c) =>
        !(
          c.type === 'text' &&
          (typeof c.text !== 'string' || c.text.length === 0)
        )
    )
    .map(stripEmptyTextNodes)
  return { ...node, content: cleaned }
}

/** Array form of {@link stripEmptyTextNodes} for body-node lists. */
export function stripEmptyTextNodesFromList(nodes: TiptapNode[]): TiptapNode[] {
  return nodes.map(stripEmptyTextNodes)
}

export class SectionNotFoundError extends Error {
  constructor(headingText: string) {
    super(
      `Heading "${headingText}" not found in document (case-insensitive match).`
    )
    this.name = 'SectionNotFoundError'
  }
}

/**
 * Story 17.11b: thrown by `addSection` when the new heading text already
 * exists in the document (case-insensitive). Same shape as
 * `SectionNotFoundError`. Dispatch + tool both translate this into a
 * Swedish-language error and leave the document untouched.
 */
export class SectionAlreadyExistsError extends Error {
  constructor(headingText: string) {
    super(
      `Heading "${headingText}" already exists in document (case-insensitive match).`
    )
    this.name = 'SectionAlreadyExistsError'
  }
}

/**
 * Story 17.11b: discriminated union for `addSection`'s position parameter.
 * `start` / `end` ignore any heading text; `after` / `before` require a
 * heading reference and match it case-insensitively via `findSectionBounds`.
 */
export type InsertPosition =
  | { at: 'start' }
  | { at: 'end' }
  | { at: 'after'; heading: string }
  | { at: 'before'; heading: string }

function getHeadingText(node: TiptapNode): string {
  if (node.type !== 'heading' || !Array.isArray(node.content)) return ''
  return node.content
    .map((child) => (typeof child.text === 'string' ? child.text : ''))
    .join('')
    .trim()
}

function getHeadingLevel(node: TiptapNode): number | null {
  if (node.type !== 'heading') return null
  const level = node.attrs?.level
  return typeof level === 'number' ? level : null
}

function findSectionBounds(
  nodes: TiptapNode[],
  headingText: string
): { startIdx: number; endIdx: number; level: number } | null {
  const target = headingText.trim().toLowerCase()
  if (!target) return null

  let startIdx = -1
  let level = 0

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!
    const nodeLevel = getHeadingLevel(node)
    if (nodeLevel !== null && getHeadingText(node).toLowerCase() === target) {
      startIdx = i
      level = nodeLevel
      break
    }
  }

  if (startIdx === -1) return null

  // End = first heading at same-or-higher level (lower `level` number) AFTER
  // the start heading, or end of doc.
  let endIdx = nodes.length
  for (let i = startIdx + 1; i < nodes.length; i++) {
    const candidateLevel = getHeadingLevel(nodes[i]!)
    if (candidateLevel !== null && candidateLevel <= level) {
      endIdx = i
      break
    }
  }

  return { startIdx, endIdx, level }
}

/**
 * Extract the body of a section (everything after the heading, up to the next
 * same-or-higher-level heading). Returns a fresh array — does not mutate the
 * input. The heading itself is NOT included in the returned nodes.
 *
 * Use this at propose time to capture `oldSectionContentJson` (AC 2).
 *
 * @throws SectionNotFoundError when the heading is not found (case-insensitive).
 */
export function extractSection(
  contentJson: TiptapDocumentJSON,
  sectionHeading: string
): TiptapNode[] {
  const bounds = findSectionBounds(contentJson.content, sectionHeading)
  if (!bounds) throw new SectionNotFoundError(sectionHeading)
  return contentJson.content.slice(bounds.startIdx + 1, bounds.endIdx)
}

/**
 * Returns true iff the document contains a heading whose trimmed text matches
 * `sectionHeading` case-insensitively. Used by tool-time guards (AC 4).
 */
export function hasSection(
  contentJson: TiptapDocumentJSON,
  sectionHeading: string
): boolean {
  return findSectionBounds(contentJson.content, sectionHeading) !== null
}

/**
 * Replace the body of `sectionHeading` with `newContentNodes` and return the
 * full updated document. The heading itself is preserved (per AC 9). Does
 * not mutate the input.
 *
 * @throws SectionNotFoundError when the heading is not found.
 */
export function updateSection(
  contentJson: TiptapDocumentJSON,
  sectionHeading: string,
  newContentNodes: TiptapNode[]
): TiptapDocumentJSON {
  const bounds = findSectionBounds(contentJson.content, sectionHeading)
  if (!bounds) throw new SectionNotFoundError(sectionHeading)

  const before = contentJson.content.slice(0, bounds.startIdx + 1)
  const after = contentJson.content.slice(bounds.endIdx)
  return {
    type: 'doc',
    content: [...before, ...newContentNodes, ...after],
  }
}

/**
 * Story 17.11b: insert a NEW section (heading + body nodes) into the document
 * at the requested position. Returns the full updated doc; does not mutate
 * the input.
 *
 * Position resolution:
 *  - `{ at: 'start' }`             → insert at index 0
 *  - `{ at: 'end' }`               → append at end
 *  - `{ at: 'after', heading }`    → insert after the located section AND its
 *    subsections (i.e. at `findSectionBounds(...).endIdx`)
 *  - `{ at: 'before', heading }`   → insert directly before the located
 *    section's heading (i.e. at `findSectionBounds(...).startIdx`)
 *
 * @throws SectionAlreadyExistsError if `headingText` (case-insensitive,
 *   whitespace-trimmed) already exists anywhere in the document.
 * @throws SectionNotFoundError if `position.heading` is required (`after`/
 *   `before`) but not found in the document.
 */
export function addSection(
  contentJson: TiptapDocumentJSON,
  headingText: string,
  level: 1 | 2 | 3 | 4 | 5 | 6,
  contentNodes: TiptapNode[],
  position: InsertPosition
): TiptapDocumentJSON {
  // Duplicate-heading guard. `findSectionBounds` already trims +
  // case-insensitive-matches, so we reuse it directly rather than
  // re-implementing the lookup.
  if (findSectionBounds(contentJson.content, headingText) !== null) {
    throw new SectionAlreadyExistsError(headingText)
  }

  const trimmedHeading = headingText.trim()
  const headingNode: TiptapNode = {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text: trimmedHeading }],
  }
  const newNodes = [headingNode, ...contentNodes]

  let insertIdx: number
  switch (position.at) {
    case 'start':
      insertIdx = 0
      break
    case 'end':
      insertIdx = contentJson.content.length
      break
    case 'after': {
      const bounds = findSectionBounds(contentJson.content, position.heading)
      if (!bounds) throw new SectionNotFoundError(position.heading)
      insertIdx = bounds.endIdx
      break
    }
    case 'before': {
      const bounds = findSectionBounds(contentJson.content, position.heading)
      if (!bounds) throw new SectionNotFoundError(position.heading)
      insertIdx = bounds.startIdx
      break
    }
  }

  const before = contentJson.content.slice(0, insertIdx)
  const after = contentJson.content.slice(insertIdx)
  return {
    type: 'doc',
    content: [...before, ...newNodes, ...after],
  }
}
