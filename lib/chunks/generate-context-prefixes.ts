/**
 * LLM Contextual Retrieval — generate semantic context prefixes for chunks
 * Story 14.3, Task 2 (AC: 1-3, 5)
 *
 * Based on Anthropic's contextual retrieval research:
 * https://www.anthropic.com/news/contextual-retrieval
 *
 * One API call per document — all chunks contextualized at once.
 * For >200K-token documents, split at division/chapter level.
 */

import Anthropic from '@anthropic-ai/sdk'
import { estimateTokenCount } from './token-count'

// Haiku's context is 200K tokens. We set a safe limit that leaves room for output tokens.
const MAX_PROMPT_TOKENS = 190_000
// For markdown-only checks (before we know chunk count), use a conservative limit
const MAX_CONTEXT_TOKENS = 180_000
const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * 3 // ~3 chars/token for Swedish text
// Overhead per chunk in the prompt: <chunk id="path">\n{500 chars}\n</chunk> ≈ 200 tokens
const TOKENS_PER_CHUNK = 200
// Fixed overhead: system prompt template, instructions, example ≈ 1500 tokens
const PROMPT_OVERHEAD_TOKENS = 1500

export const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

/**
 * Estimate total prompt tokens for a given markdown + chunk set.
 * Accounts for markdown, chunk list (each ~200 tokens), and prompt template overhead.
 */
function estimatePromptTokens(markdown: string, chunkCount: number): number {
  return (
    estimateTokenCount(markdown) +
    chunkCount * TOKENS_PER_CHUNK +
    PROMPT_OVERHEAD_TOKENS
  )
}

export interface ChunkForContext {
  path: string
  content: string
}

export interface DocumentForContext {
  markdown: string
  title: string
  documentNumber: string
}

export interface DivisionInfo {
  number: string
  title: string | null
  markdown: string
  chapterNumbers: string[]
}

export interface BatchPrefixRequest {
  customId: string // document ID (or docId__split_N for large doc splits)
  prompt: string // Full user message
  chunkPaths: string[] // Paths of chunks included (for result mapping)
}

let anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY not set. Provide via environment variable.'
      )
    }
    anthropicClient = new Anthropic({ apiKey })
  }
  return anthropicClient
}

/** Exported for testing — allows injecting a mock client */
export function setAnthropicClient(client: Anthropic | null): void {
  anthropicClient = client
}

/**
 * Generate context prefixes for all chunks of a document.
 * Returns a Map of chunk path → context prefix string.
 */
export async function generateContextPrefixes(
  document: DocumentForContext,
  chunks: ChunkForContext[]
): Promise<Map<string, string>> {
  if (chunks.length === 0) return new Map()

  const totalTokens = estimatePromptTokens(document.markdown, chunks.length)

  if (totalTokens <= MAX_PROMPT_TOKENS) {
    return callHaikuForPrefixes(document.markdown, document, chunks)
  }

  // Large document — need to split
  return generatePrefixesForLargeDocument(document, chunks)
}

/**
 * Build the prompt string for a set of chunks within a context window.
 * Extracted so the batch orchestrator can build requests without calling the API.
 */
export function buildPrefixPrompt(
  contextMarkdown: string,
  document: DocumentForContext,
  chunks: ChunkForContext[]
): string {
  const chunkList = chunks
    .map(
      (c) => `<chunk id="${c.path}">\n${c.content.substring(0, 500)}\n</chunk>`
    )
    .join('\n')

  return `<document>
${contextMarkdown}
</document>

Here are ${chunks.length} chunks extracted from the Swedish legal document "${document.title}" (${document.documentNumber}). Please give a short succinct context for each chunk to situate it within the overall document for the purposes of improving search retrieval of the chunk.

${chunkList}

For each chunk, write a context (1-2 sentences, in Swedish) that makes the chunk SELF-CONTAINED — someone reading only the context + chunk should fully understand it without access to the rest of the document.

Specifically:
- State which law (full name + SFS number) and which chapter/topic area the chunk belongs to
- Resolve cross-references: replace "denna lag", "denna förordning", "enligt 14 §", "ovan nämnda paragraf" with what they actually refer to
- Resolve pronouns: replace "den som", "dessa", "sådan" with the actual subjects they refer to
- Add surrounding context: what do the neighboring sections deal with? What broader topic does this chunk fall under?

DO NOT summarize the chunk — the chunk text is already indexed. Only add information that is MISSING from the chunk.

<example>
CHUNK: "Den som uppsåtligen eller av grov oaktsamhet bryter mot 29 § döms till böter eller fängelse i högst ett år."
BAD — paraphrases: "Bestämmelsen anger straff för den som bryter mot 29 §."
GOOD — contextualizes: "Straffbestämmelse i 8 kap. Arbetsmiljölagen (1977:1160) om sanktioner. 29 § avser arbetsgivarens skyldighet att anmäla allvarliga olyckor till Arbetsmiljöverket. 'Den som' syftar på arbetsgivaren eller den som hyr in arbetskraft."
</example>

Respond ONLY with valid JSON: { "prefixes": { "<chunk id>": "<context>", ... } }`
}

/**
 * Build batch API requests for a document's context prefixes.
 * Returns 1 request for normal docs, multiple for large docs (split at division/chapter).
 * Uses total prompt token estimation (markdown + chunk list + overhead) to decide splitting.
 */
export function buildBatchPrefixRequests(
  docId: string,
  document: DocumentForContext,
  chunks: ChunkForContext[]
): BatchPrefixRequest[] {
  if (chunks.length === 0) return []

  const totalTokens = estimatePromptTokens(document.markdown, chunks.length)

  if (totalTokens <= MAX_PROMPT_TOKENS) {
    return [
      {
        customId: docId,
        prompt: buildPrefixPrompt(document.markdown, document, chunks),
        chunkPaths: chunks.map((c) => c.path),
      },
    ]
  }

  // Large document — split at division/chapter level
  return buildBatchRequestsForLargeDoc(docId, document, chunks)
}

/**
 * Build batch requests for a large document by splitting at division/chapter boundaries.
 */
function buildBatchRequestsForLargeDoc(
  docId: string,
  document: DocumentForContext,
  chunks: ChunkForContext[]
): BatchPrefixRequest[] {
  const requests: BatchPrefixRequest[] = []
  let splitIndex = 0

  const divisionSections = splitMarkdownByDivisions(document.markdown)

  if (divisionSections.length > 1) {
    for (const section of divisionSections) {
      const sectionChunks = chunks.filter((c) => {
        const chapMatch = c.path.match(/^kap(\d+)\./)
        if (!chapMatch) return false
        return section.chapterNumbers.includes(chapMatch[1]!)
      })

      if (section === divisionSections[0]) {
        const nonChapterChunks = chunks.filter(
          (c) => !c.path.match(/^kap\d+\./)
        )
        sectionChunks.push(
          ...nonChapterChunks.filter((nc) => !sectionChunks.includes(nc))
        )
      }

      if (sectionChunks.length === 0) continue

      const sectionPromptTokens = estimatePromptTokens(
        section.markdown,
        sectionChunks.length
      )

      if (sectionPromptTokens <= MAX_PROMPT_TOKENS) {
        requests.push({
          customId: `${docId}__split_${splitIndex++}`,
          prompt: buildPrefixPrompt(section.markdown, document, sectionChunks),
          chunkPaths: sectionChunks.map((c) => c.path),
        })
      } else {
        // Division too large — split by chapter
        const chapterRequests = buildChapterBatchRequests(
          docId,
          section.markdown,
          document,
          sectionChunks,
          splitIndex
        )
        splitIndex += chapterRequests.length
        requests.push(...chapterRequests)
      }
    }
  } else {
    // No division structure — split by chapter
    const chapterRequests = buildChapterBatchRequests(
      docId,
      document.markdown,
      document,
      chunks,
      splitIndex
    )
    requests.push(...chapterRequests)
  }

  return requests
}

/**
 * Build batch requests split at chapter level.
 * If a single chapter still exceeds the token limit, splits its chunks into sub-batches.
 */
function buildChapterBatchRequests(
  docId: string,
  markdown: string,
  document: DocumentForContext,
  chunks: ChunkForContext[],
  startIndex: number
): BatchPrefixRequest[] {
  const requests: BatchPrefixRequest[] = []
  let splitIndex = startIndex

  const chapterGroups = new Map<string, ChunkForContext[]>()
  for (const chunk of chunks) {
    const chapMatch = chunk.path.match(/^kap(\d+)\./)
    const chapKey = chapMatch ? chapMatch[1]! : 'other'
    const group = chapterGroups.get(chapKey) ?? []
    group.push(chunk)
    chapterGroups.set(chapKey, group)
  }

  const chapterSections = splitMarkdownByChapters(markdown)

  for (const [chapKey, chapChunks] of chapterGroups) {
    const chapterMarkdown =
      chapterSections.get(chapKey) ?? markdown.substring(0, MAX_CONTEXT_CHARS)
    const truncatedMarkdown = chapterMarkdown.substring(0, MAX_CONTEXT_CHARS)
    const markdownTokens = estimateTokenCount(truncatedMarkdown)

    const totalPromptTokens =
      markdownTokens +
      chapChunks.length * TOKENS_PER_CHUNK +
      PROMPT_OVERHEAD_TOKENS

    if (totalPromptTokens <= MAX_PROMPT_TOKENS) {
      // Fits in one request
      requests.push({
        customId: `${docId}__split_${splitIndex++}`,
        prompt: buildPrefixPrompt(truncatedMarkdown, document, chapChunks),
        chunkPaths: chapChunks.map((c) => c.path),
      })
    } else {
      // Split chunks into sub-batches that fit within token limit
      // Calculate how many chunks we can fit given the markdown size
      const availableForChunks =
        MAX_PROMPT_TOKENS - markdownTokens - PROMPT_OVERHEAD_TOKENS
      const chunksPerBatch = Math.max(
        1,
        Math.floor(availableForChunks / TOKENS_PER_CHUNK)
      )

      for (let i = 0; i < chapChunks.length; i += chunksPerBatch) {
        const subChunks = chapChunks.slice(i, i + chunksPerBatch)
        requests.push({
          customId: `${docId}__split_${splitIndex++}`,
          prompt: buildPrefixPrompt(truncatedMarkdown, document, subChunks),
          chunkPaths: subChunks.map((c) => c.path),
        })
      }
    }
  }

  return requests
}

/**
 * Build the prompt and call Haiku for a set of chunks within a context window.
 */
async function callHaikuForPrefixes(
  contextMarkdown: string,
  document: DocumentForContext,
  chunks: ChunkForContext[]
): Promise<Map<string, string>> {
  const client = getAnthropicClient()
  const prompt = buildPrefixPrompt(contextMarkdown, document, chunks)
  const response = await callWithRetry(client, prompt)
  return parsePrefixResponse(response, chunks)
}

/**
 * For documents >200K tokens: split at division level first, then chapter if needed.
 */
async function generatePrefixesForLargeDocument(
  document: DocumentForContext,
  chunks: ChunkForContext[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  // Try to split markdown at division boundaries
  // Divisions in Swedish law are marked as "# Avd. N" or "Avdelning N" headings
  const divisionSections = splitMarkdownByDivisions(document.markdown)

  if (divisionSections.length > 1) {
    for (const section of divisionSections) {
      // Find chunks that belong to this division (by chapter number matching)
      const sectionChunks = chunks.filter((c) => {
        const chapMatch = c.path.match(/^kap(\d+)\./)
        if (!chapMatch) return false
        return section.chapterNumbers.includes(chapMatch[1]!)
      })

      // Also include non-chapter chunks in the first division
      if (section === divisionSections[0]) {
        const nonChapterChunks = chunks.filter(
          (c) => !c.path.match(/^kap\d+\./)
        )
        sectionChunks.push(
          ...nonChapterChunks.filter((nc) => !sectionChunks.includes(nc))
        )
      }

      if (sectionChunks.length === 0) continue

      const sectionPromptTokens = estimatePromptTokens(
        section.markdown,
        sectionChunks.length
      )

      if (sectionPromptTokens <= MAX_PROMPT_TOKENS) {
        const prefixes = await callHaikuForPrefixes(
          section.markdown,
          document,
          sectionChunks
        )
        for (const [path, prefix] of prefixes) {
          result.set(path, prefix)
        }
      } else {
        // Division still too large — fall back to chapter-level
        const chapterPrefixes = await generatePrefixesByChapter(
          section.markdown,
          document,
          sectionChunks
        )
        for (const [path, prefix] of chapterPrefixes) {
          result.set(path, prefix)
        }
      }
    }
  } else {
    // No division structure — go straight to chapter-level splitting
    const chapterPrefixes = await generatePrefixesByChapter(
      document.markdown,
      document,
      chunks
    )
    for (const [path, prefix] of chapterPrefixes) {
      result.set(path, prefix)
    }
  }

  return result
}

/**
 * Fall back to chapter-level splitting when divisions are too large.
 */
async function generatePrefixesByChapter(
  markdown: string,
  document: DocumentForContext,
  chunks: ChunkForContext[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  // Group chunks by chapter
  const chapterGroups = new Map<string, ChunkForContext[]>()
  for (const chunk of chunks) {
    const chapMatch = chunk.path.match(/^kap(\d+)\./)
    const chapKey = chapMatch ? chapMatch[1]! : 'other'
    const group = chapterGroups.get(chapKey) ?? []
    group.push(chunk)
    chapterGroups.set(chapKey, group)
  }

  // Split markdown by chapters
  const chapterSections = splitMarkdownByChapters(markdown)

  for (const [chapKey, chapChunks] of chapterGroups) {
    const chapterMarkdown =
      chapterSections.get(chapKey) ?? markdown.substring(0, MAX_CONTEXT_CHARS)
    const truncatedMarkdown = chapterMarkdown.substring(0, MAX_CONTEXT_CHARS)
    const markdownTokens = estimateTokenCount(truncatedMarkdown)
    const totalPromptTokens =
      markdownTokens +
      chapChunks.length * TOKENS_PER_CHUNK +
      PROMPT_OVERHEAD_TOKENS

    if (totalPromptTokens <= MAX_PROMPT_TOKENS) {
      const prefixes = await callHaikuForPrefixes(
        truncatedMarkdown,
        document,
        chapChunks
      )
      for (const [path, prefix] of prefixes) {
        result.set(path, prefix)
      }
    } else {
      // Chapter too large — split chunks into sub-batches
      const availableForChunks =
        MAX_PROMPT_TOKENS - markdownTokens - PROMPT_OVERHEAD_TOKENS
      const chunksPerBatch = Math.max(
        1,
        Math.floor(availableForChunks / TOKENS_PER_CHUNK)
      )

      for (let i = 0; i < chapChunks.length; i += chunksPerBatch) {
        const subChunks = chapChunks.slice(i, i + chunksPerBatch)
        const prefixes = await callHaikuForPrefixes(
          truncatedMarkdown,
          document,
          subChunks
        )
        for (const [path, prefix] of prefixes) {
          result.set(path, prefix)
        }
      }
    }
  }

  return result
}

/**
 * Split markdown at division (avdelning) boundaries.
 */
function splitMarkdownByDivisions(markdown: string): DivisionInfo[] {
  // Match division headings: "# Avdelning N" or "## AVD. N" etc.
  const divisionPattern =
    /^#{1,3}\s+(?:Avdelning|AVD\.?)\s+(\d+|[IVXLC]+)[.:]*\s*(.*?)$/gim
  const matches: Array<{ index: number; number: string; title: string }> = []

  let match: RegExpExecArray | null
  while ((match = divisionPattern.exec(markdown)) !== null) {
    matches.push({
      index: match.index,
      number: match[1]!,
      title: match[2]?.trim() ?? '',
    })
  }

  if (matches.length <= 1) return []

  const sections: DivisionInfo[] = []
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.index
    const end = i + 1 < matches.length ? matches[i + 1]!.index : markdown.length
    const sectionMarkdown = markdown.substring(start, end)

    // Extract chapter numbers from this section
    const chapterNumbers: string[] = []
    const chapterPattern =
      /^#{1,4}\s+(?:Kap(?:itel)?\.?\s*|)(\d+)\s*(?:kap\.?)?/gim
    let chapMatch: RegExpExecArray | null
    while ((chapMatch = chapterPattern.exec(sectionMarkdown)) !== null) {
      chapterNumbers.push(chapMatch[1]!)
    }

    sections.push({
      number: matches[i]!.number,
      title: matches[i]!.title,
      markdown: sectionMarkdown,
      chapterNumbers,
    })
  }

  return sections
}

/**
 * Split markdown at chapter boundaries. Returns map of chapter number → markdown.
 */
function splitMarkdownByChapters(markdown: string): Map<string, string> {
  const chapterPattern =
    /^#{1,4}\s+(?:Kap(?:itel)?\.?\s*|)(\d+)\s*(?:kap\.?)?/gim
  const matches: Array<{ index: number; number: string }> = []

  let match: RegExpExecArray | null
  while ((match = chapterPattern.exec(markdown)) !== null) {
    matches.push({ index: match.index, number: match[1]! })
  }

  const result = new Map<string, string>()

  if (matches.length === 0) {
    result.set('other', markdown)
    return result
  }

  // Content before first chapter
  if (matches[0]!.index > 0) {
    result.set('other', markdown.substring(0, matches[0]!.index))
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.index
    const end = i + 1 < matches.length ? matches[i + 1]!.index : markdown.length
    result.set(matches[i]!.number, markdown.substring(start, end))
  }

  return result
}

/**
 * Call Haiku with retry (once on transient failure).
 */
async function callWithRetry(
  client: Anthropic,
  prompt: string,
  maxRetries = 2
): Promise<string> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      })

      const textBlock = response.content.find((block) => block.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text response from Haiku')
      }
      return textBlock.text
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < maxRetries) {
        // Wait 2s before retry
        await new Promise((r) => setTimeout(r, 2000))
      }
    }
  }

  throw lastError ?? new Error('Failed to call Haiku after retries')
}

/**
 * Parse the JSON response from Haiku into a Map of path → prefix.
 * Exported for use by batch result collector.
 */
export function parsePrefixResponse(
  responseText: string,
  chunks: ChunkForContext[]
): Map<string, string> {
  const result = new Map<string, string>()

  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = responseText.trim()
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1]!.trim()
  }

  try {
    const parsed = JSON.parse(jsonStr) as { prefixes?: Record<string, string> }
    const prefixes = parsed.prefixes ?? parsed

    if (typeof prefixes === 'object' && prefixes !== null) {
      // Normalize keys: Haiku sometimes returns bracketed paths like "[kap1.§1]"
      const normalized: Record<string, string> = {}
      for (const [key, val] of Object.entries(
        prefixes as Record<string, string>
      )) {
        const cleanKey = key.replace(/^\[|\]$/g, '')
        normalized[cleanKey] = val
      }

      for (const chunk of chunks) {
        const prefix = normalized[chunk.path]
        if (typeof prefix === 'string' && prefix.trim()) {
          result.set(chunk.path, prefix.trim())
        }
      }
    }
  } catch {
    console.warn(
      '[context-prefix] Failed to parse Haiku JSON response, attempting line-by-line extraction'
    )
    // Best-effort: try to find path-value pairs in the text
    for (const chunk of chunks) {
      const escapedPath = chunk.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const lineMatch = responseText.match(
        new RegExp(`"${escapedPath}"\\s*:\\s*"([^"]+)"`)
      )
      if (lineMatch) {
        result.set(chunk.path, lineMatch[1]!.trim())
      }
    }
  }

  return result
}
