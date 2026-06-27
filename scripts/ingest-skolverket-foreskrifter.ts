/* eslint-disable no-console */
/**
 * Story 9.7 — Task 3: registry-driven Skolverket (SKOLFS) föreskrift ingester.
 *
 * Reads data/skolverket-foreskrifter-registry.json (from the enumerator) and runs
 * each PDF through the proven agency pipeline — PDF intake (front half modeled on
 * scripts/ingest-agency-pdfs.ts) + the chunk/embed/FTS tail from the 9.5 ingester:
 *   download PDF → Claude (base64 document) normalize → validateLlmOutput
 *   → md/plaintext/json → linkify → upsert (AGENCY_REGULATION, +regulatory_body
 *   from per-doc issuedBy / agency_prefix='SKOLFS') → syncDocumentChunks
 *   (chunk+prefix+embed) → search_vector.
 *
 * Captures the AC-9 baseline snapshot in metadata (contentHash + skolfs.* +
 * dates + amendment chain + upcoming) — the diff baseline Story 9.8 monitors.
 *
 * FAIL-SOFT (AC 6): a doc that truncates (max_tokens) or fails validation is
 * recorded to data/skolverket-ingest-failures.json; the batch continues.
 * Large-doc remediation (PDF chunked normalization / stub) is deferred to a
 * post-run pass only if the manifest is non-empty (mirrors 9.5 AC 4a).
 *
 * Usage:
 *   pnpm tsx scripts/ingest-skolverket-foreskrifter.ts --dry-run
 *   pnpm tsx scripts/ingest-skolverket-foreskrifter.ts --limit 5
 *   pnpm tsx scripts/ingest-skolverket-foreskrifter.ts --filter "SKOLFS 2011:144"
 *   pnpm tsx scripts/ingest-skolverket-foreskrifter.ts --skip-existing   # full run
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })
/* eslint-disable import/first */
import Anthropic from '@anthropic-ai/sdk'
import WordExtractor from 'word-extractor'
import { extractText as extractPdfText } from 'unpdf'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { ContentType, DocumentStatus, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import {
  AGENCY_REGULATION_SYSTEM_PROMPT,
  getAgencyPdfUserPrompt,
  AGENCY_MAX_TOKENS,
  AGENCY_DEFAULT_MODEL,
} from '../lib/agency/agency-regulation-prompt'
import {
  validateLlmOutput,
  needsManualReview,
} from '../lib/sfs/llm-output-validator'
import {
  htmlToMarkdown,
  htmlToPlainText,
} from '../lib/transforms/html-to-markdown'
import { parseCanonicalHtml } from '../lib/transforms/canonical-html-parser'
import {
  generateAgencySlug,
  computeContentHash,
} from '../lib/agency/agency-pdf-registry'
import { resolveRegulatoryBody } from '../lib/agency/regulatory-bodies'
import { syncDocumentChunks } from '../lib/chunks/sync-document-chunks'
import { linkifyHtmlContent, buildSlugMap, type SlugMap } from '../lib/linkify'
/* eslint-enable import/first */

const REGISTRY = resolve(
  process.cwd(),
  'data/skolverket-foreskrifter-registry.json'
)
const FAILURES = resolve(process.cwd(), 'data/skolverket-ingest-failures.json')
const PDF_DIR = resolve(process.cwd(), 'data/skolfs-pdfs')
const USER_AGENT = 'Mozilla/5.0 (compatible; LagligBot/1.0; +https://laglig.se)'

// ── Batch mode (Anthropic Message Batches API — 50% cost, async) ──
const BATCH_STATE = resolve(process.cwd(), 'data/skolverket-batch-state.json')
const MAX_BATCH_BYTES = 180 * 1024 * 1024 // safety margin under the 256 MB cap
const MAX_BATCH_REQUESTS = 90_000 // safety margin under the 100k cap
const POLL_INTERVAL_MS = 30_000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// PDFs above this size reliably exceed the 64K single-pass output ceiling
// (verified: 2011:144 @259KB fits, 2010:37 @1MB truncates) — route them
// straight to split-and-stitch and skip the doomed single-pass attempt
// (saves a wasted ~64K-token generation per giant in the batch). [Story 9.7]
const LARGE_PDF_BYTES = 500_000

interface AmendmentChainEntry {
  skolfsNumber: string
  validity: string
  effectiveDate: string | null
  change: string | null
}
interface RegistryEntry {
  documentNumber: string
  title: string
  documentType: string
  validity: string
  isConsolidated: boolean
  baseSkolfsNumber: string
  pdfType: string
  pdfUrl: string
  sourceUrl: string
  issuedBy: string | null
  regulatoryBody: string | null
  agencyPrefix: string
  decisionDate: string | null
  effectiveDate: string | null
  promulgationDate: string | null
  latestChange: string | null
  latestChangeBySkolfsNo: string | null
  amendmentChain: AmendmentChainEntry[]
  upcoming: AmendmentChainEntry[]
}
interface Failure {
  documentNumber: string
  reason: string
}

const wordExtractor = new WordExtractor()

type DocFormat = 'pdf' | 'doc'

/** Detect the real content format from magic bytes (the /pdf endpoint lies for
 *  pre-2011 docs, serving legacy .doc / OOXML). */
function detectFormat(buf: Buffer): DocFormat | 'unknown' {
  if (buf.length < 4) return 'unknown'
  if (buf.toString('latin1', 0, 4) === '%PDF') return 'pdf'
  // OLE2 compound file (legacy .doc): D0 CF 11 E0
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0)
    return 'doc'
  // OOXML zip (.docx): PK\x03\x04 — word-extractor handles it too
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04)
    return 'doc'
  return 'unknown'
}

/** Download the source (cached, format-agnostic) and report its true format. */
async function fetchContent(
  entry: RegistryEntry
): Promise<{ format: DocFormat; path: string; buf: Buffer }> {
  const cachePath = resolve(
    PDF_DIR,
    generateAgencySlug(entry.documentNumber) + '.bin'
  )
  let buf: Buffer
  if (existsSync(cachePath)) {
    buf = readFileSync(cachePath)
  } else {
    const res = await fetch(entry.pdfUrl, {
      headers: { 'User-Agent': USER_AGENT },
    })
    if (!res.ok) throw new Error(`fetch HTTP ${res.status}`)
    buf = Buffer.from(await res.arrayBuffer())
    mkdirSync(PDF_DIR, { recursive: true })
    writeFileSync(cachePath, buf)
  }
  const format = detectFormat(buf)
  if (format === 'unknown')
    throw new Error(`unrecognized format (magic ${buf.toString('hex', 0, 4)})`)
  return { format, path: cachePath, buf }
}

/** Legacy .doc (backfill only — current SKOLFS docs are PDF): extract plain
 *  text and let Claude reconstruct the same canonical HTML it builds from PDFs. */
async function normalizeDoc(
  path: string,
  entry: RegistryEntry,
  anthropic: Anthropic
): Promise<string> {
  const extracted = await wordExtractor.extract(path)
  const text = extracted.getBody().replace(/\r\n/g, '\n').trim()
  if (text.length < 200)
    throw new Error(`.doc extraction too small (${text.length} chars)`)
  const userPrompt = buildDocUserPrompt(entry, text)
  const stream = anthropic.messages.stream({
    model: AGENCY_DEFAULT_MODEL,
    max_tokens: AGENCY_MAX_TOKENS.standard,
    system: AGENCY_REGULATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: [{ type: 'text', text: userPrompt }] }],
  })
  const r = await stream.finalMessage()
  if (r.stop_reason === 'max_tokens') throw new Error('max_tokens truncation')
  return r.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .replace(/^```html\n?|\n?```$/g, '')
    .trim()
}

/** Shared `.doc`/text-intake user prompt (sync + batch). */
function buildDocUserPrompt(entry: RegistryEntry, text: string): string {
  return `Convert this Swedish regulation (${entry.documentNumber}) into semantic HTML.

The source below is the PLAIN TEXT extracted from the official Skolverket .doc file for this föreskrift. Reconstruct the regulation faithfully — do NOT summarize, drop, or reword any normative text. Preserve chapter (kap.) and paragraph (§) structure, allmänna råd, bilagor, and ikraftträdande-/övergångsbestämmelser. Remove pure layout artifacts (page numbers, repeated running headers).

Document metadata:
- Document Number: ${entry.documentNumber}
- Title: ${entry.title}
- Publisher: ${entry.issuedBy ?? entry.regulatoryBody ?? 'Skolverket'}

Use the document number (lowercased, non-alphanumerics → "_") as the id of the root <article class="legal-document">, and "{id}_P{N}" (or "{id}_K{CH}_P{N}" with chapters) for paragraph anchors. Output ONLY the HTML — no markdown fences.

--- SOURCE TEXT ---
${text}`
}

/** Single-pass PDF → semantic HTML via Claude. Throws on max_tokens truncation. */
async function normalizePdf(
  pdfBase64: string,
  entry: RegistryEntry,
  anthropic: Anthropic
): Promise<string> {
  const userPrompt = getAgencyPdfUserPrompt(
    entry.documentNumber,
    entry.title,
    entry.issuedBy ?? entry.agencyPrefix
  )
  const stream = anthropic.messages.stream({
    model: AGENCY_DEFAULT_MODEL,
    max_tokens: AGENCY_MAX_TOKENS.standard,
    system: AGENCY_REGULATION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          { type: 'text', text: userPrompt },
        ],
      },
    ],
  })
  const r = await stream.finalMessage()
  if (r.stop_reason === 'max_tokens') throw new Error('max_tokens truncation')
  return r.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .replace(/^```html\n?|\n?```$/g, '')
    .trim()
}

/** Extract plain text from either source format (for the split-and-stitch path). */
async function extractDocText(content: {
  format: DocFormat
  path: string
  buf: Buffer
}): Promise<string> {
  if (content.format === 'doc') {
    const ex = await wordExtractor.extract(content.path)
    return ex.getBody().replace(/\r\n/g, '\n').trim()
  }
  const { text } = await extractPdfText(new Uint8Array(content.buf), {
    mergePages: true,
  })
  return (Array.isArray(text) ? text.join('\n\n') : text)
    .replace(/\r\n/g, '\n')
    .trim()
}

// Split-and-stitch: char budget per segment. Sized for BOTH the 64K output
// ceiling AND generation latency — a segment's HTML generates at ~60 tok/s, so
// smaller segments finish well inside the request timeout. ~40K chars ≈ ~11K
// input tokens → ~15K output HTML → ~4 min/segment (all run in parallel). [9.7]
const SEGMENT_CHAR_BUDGET = 40_000

/** Hard-split an oversize block at the nearest newline/space before each window
 *  — guarantees no piece exceeds `max`, even when the source has no paragraph
 *  breaks (unpdf-extracted text often lacks reliable \n\n). */
function hardSplit(s: string, max: number): string[] {
  const out: string[] = []
  let i = 0
  while (i < s.length) {
    let end = Math.min(i + max, s.length)
    if (end < s.length) {
      const slice = s.slice(i, end)
      const cut = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf(' '))
      if (cut > max * 0.5) end = i + cut + 1
    }
    out.push(s.slice(i, end))
    i = end
  }
  return out
}

function segmentText(text: string): string[] {
  // Build paragraph-ish units, hard-splitting any unit over budget, then pack.
  const units: string[] = []
  for (const para of text.split(/\n\n+/)) {
    if (para.length > SEGMENT_CHAR_BUDGET)
      units.push(...hardSplit(para, SEGMENT_CHAR_BUDGET))
    else units.push(para)
  }
  const segs: string[] = []
  let buf = ''
  for (const u of units) {
    const cand = buf ? `${buf}\n\n${u}` : u
    if (cand.length > SEGMENT_CHAR_BUDGET && buf) {
      segs.push(buf)
      buf = u
    } else {
      buf = cand
    }
  }
  if (buf.trim()) segs.push(buf)
  return segs
}

async function callClaudeText(
  systemExtra: string,
  userText: string,
  anthropic: Anthropic
): Promise<string> {
  const stream = anthropic.messages.stream({
    model: AGENCY_DEFAULT_MODEL,
    max_tokens: AGENCY_MAX_TOKENS.standard,
    system: `${AGENCY_REGULATION_SYSTEM_PROMPT}\n\n${systemExtra}`,
    messages: [{ role: 'user', content: [{ type: 'text', text: userText }] }],
  })
  const r = await stream.finalMessage()
  if (r.stop_reason === 'max_tokens')
    throw new Error('max_tokens truncation (segment still too large)')
  return r.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .replace(/^```html\n?|\n?```$/g, '')
    .trim()
}

/** Oversized docs (>64K output single-pass): extract text → normalize each
 *  segment to a body fragment → stitch into ONE <article>. Model-agnostic. */
async function normalizeChunked(
  text: string,
  entry: RegistryEntry,
  anthropic: Anthropic
): Promise<string> {
  const segs = segmentText(text)
  const id = generateAgencySlug(entry.documentNumber).replace(/-/g, '_')
  console.log(
    `    [chunked] ${entry.documentNumber}: ${(text.length / 1000).toFixed(0)}K chars → ${segs.length} segments (parallel)`
  )
  // Segments are independent — normalize concurrently (turns N sequential
  // multi-minute calls into ~one). Promise.all preserves order. [Story 9.7]
  const frags = await Promise.all(
    segs.map((seg, i) =>
      callClaudeText(
        `CHUNKED MODE (part ${i + 1}/${segs.length}): output ONLY the body-fragment HTML for THIS portion of ${entry.documentNumber} — use <h2>/<h3 id>/<h4 id>, <p class="text">, <section>, lists and tables as appropriate. Do NOT emit <article>, <html>, <h1>, the lovhead block, or markdown fences. Preserve all text faithfully; remove only page-number/running-header artifacts.`,
        `Regulation ${entry.documentNumber} ("${entry.title}"), portion ${i + 1} of ${segs.length}. Reconstruct this portion faithfully — no summarizing or dropping.\n\n--- SOURCE TEXT ---\n${seg}`,
        anthropic
      )
    )
  )
  return `<article class="legal-document" id="${id}">
  <div class="lovhead"><h1><p class="text">${entry.documentNumber}</p><p class="text">${entry.title}</p></h1></div>
  <div class="body">
${frags.join('\n')}
  </div>
</article>`
}

async function ingestOne(
  entry: RegistryEntry,
  anthropic: Anthropic,
  slugMap: SlugMap
): Promise<{ ok: true; chunks: number } | { ok: false; reason: string }> {
  let content: { format: DocFormat; path: string; buf: Buffer }
  try {
    content = await fetchContent(entry)
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) }
  }

  let rawOutput: string
  let normalizedVia: 'pdf-document' | 'doc-text-extract' | 'chunked' =
    content.format === 'pdf' ? 'pdf-document' : 'doc-text-extract'

  // Known giant → skip the doomed single-pass, go straight to split-and-stitch.
  if (content.format === 'pdf' && content.buf.length > LARGE_PDF_BYTES) {
    try {
      const text = await extractDocText(content)
      rawOutput = await normalizeChunked(text, entry, anthropic)
      normalizedVia = 'chunked'
      return finalizeDoc(
        entry,
        rawOutput,
        normalizedVia,
        content.format,
        slugMap
      )
    } catch (e) {
      return {
        ok: false,
        reason: `chunked (large-pdf) failed: ${e instanceof Error ? e.message : String(e)}`,
      }
    }
  }

  try {
    rawOutput =
      content.format === 'pdf'
        ? await normalizePdf(content.buf.toString('base64'), entry, anthropic)
        : await normalizeDoc(content.path, entry, anthropic)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Oversized doc (>64K single-pass output) → split-and-stitch fallback.
    if (/max_tokens/i.test(msg)) {
      try {
        const text = await extractDocText(content)
        rawOutput = await normalizeChunked(text, entry, anthropic)
        normalizedVia = 'chunked'
      } catch (e2) {
        return {
          ok: false,
          reason: `chunked fallback failed: ${e2 instanceof Error ? e2.message : String(e2)}`,
        }
      }
    } else {
      return { ok: false, reason: `Claude error: ${msg}` }
    }
  }

  return finalizeDoc(entry, rawOutput, normalizedVia, content.format, slugMap)
}

/** Shared tail: validate LLM HTML → derive → linkify → upsert → chunk/embed →
 *  search_vector. Used by both the sync ingester and the batch result handler. */
async function finalizeDoc(
  entry: RegistryEntry,
  rawOutput: string,
  normalizedVia: 'pdf-document' | 'doc-text-extract' | 'chunked',
  sourceFormat: DocFormat,
  slugMap: SlugMap
): Promise<{ ok: true; chunks: number } | { ok: false; reason: string }> {
  const { documentNumber, title, sourceUrl } = entry

  const v = validateLlmOutput(rawOutput, documentNumber)
  if (!v.valid || !v.cleanedHtml) {
    return {
      ok: false,
      reason: `validation failed: ${v.errors.map((e) => e.code).join(',')}`,
    }
  }
  const html = v.cleanedHtml
  const markdown_content = htmlToMarkdown(html)
  const full_text = htmlToPlainText(html)
  const jsonContent = parseCanonicalHtml(html, {
    documentType: 'AGENCY_REGULATION',
  })
  const linkified = linkifyHtmlContent(html, slugMap, documentNumber).html

  // Per-document issuer (SKOLFS is a joint samling — issuer = API issuedBy,
  // with the enumerator's title-based fallback for issuedBy-less råd).
  const regulatoryBody = resolveRegulatoryBody(
    documentNumber,
    entry.issuedBy ?? entry.regulatoryBody
  )

  // AC-9 baseline snapshot — the diff baseline Story 9.8 monitors.
  const metadata = {
    source: 'skolfs.skolverket.se',
    issuedBy: entry.issuedBy,
    pdfUrl: entry.pdfUrl,
    pdfType: entry.pdfType,
    decisionDate: entry.decisionDate,
    effectiveDate: entry.effectiveDate,
    promulgationDate: entry.promulgationDate,
    contentHash: computeContentHash(html),
    skolfs: {
      validity: entry.validity,
      isConsolidated: entry.isConsolidated,
      latestChange: entry.latestChange,
      latestChangeBySkolfsNo: entry.latestChangeBySkolfsNo,
      amendmentChain: entry.amendmentChain,
      upcoming: entry.upcoming,
    },
    ingested_by: 'ingest-skolverket-foreskrifter',
    needs_review: needsManualReview(v) || undefined,
    sourceFormat, // 'pdf' (native document block) | 'doc' (text-extract, backfill)
    normalized_via: normalizedVia, // pdf-document | doc-text-extract | chunked
  }

  const slug = generateAgencySlug(documentNumber)
  const jsonMetadata = JSON.parse(
    JSON.stringify(metadata)
  ) as Prisma.InputJsonValue
  const jsonContentValue = JSON.parse(
    JSON.stringify(jsonContent)
  ) as Prisma.InputJsonValue
  const common = {
    title,
    slug,
    html_content: linkified,
    markdown_content,
    full_text,
    json_content: jsonContentValue,
    source_url: sourceUrl,
    status: DocumentStatus.ACTIVE,
    regulatory_body: regulatoryBody,
    agency_prefix: 'SKOLFS',
    metadata: jsonMetadata,
  }
  const doc = await prisma.legalDocument.upsert({
    where: { document_number: documentNumber },
    update: { ...common, updated_at: new Date() },
    create: {
      document_number: documentNumber,
      content_type: ContentType.AGENCY_REGULATION,
      ...common,
    },
    select: { id: true },
  })

  const sync = await syncDocumentChunks(doc.id)
  await prisma.$executeRaw`
    UPDATE legal_documents SET search_vector =
      setweight(to_tsvector('pg_catalog.swedish', coalesce(title,'')),'A') ||
      setweight(to_tsvector('pg_catalog.swedish', coalesce(document_number,'')),'A') ||
      setweight(to_tsvector('pg_catalog.swedish', coalesce(summary,'')),'B')
    WHERE id = ${doc.id}`

  return { ok: true, chunks: sync.chunksCreated }
}

// ── Batch mode helpers ──
interface PreparedDoc {
  entry: RegistryEntry
  format: DocFormat
  request: {
    custom_id: string
    params: Anthropic.Messages.MessageCreateParamsNonStreaming
  }
  bytes: number
}

/** Build a Message Batches request for one doc (PDF document block or .doc text block). */
async function prepareBatchRequest(
  entry: RegistryEntry
): Promise<PreparedDoc | { error: string } | { oversized: true }> {
  let content: { format: DocFormat; path: string; buf: Buffer }
  try {
    content = await fetchContent(entry)
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
  // Known giant → don't batch a doomed single-pass; split-and-stitch after.
  if (content.format === 'pdf' && content.buf.length > LARGE_PDF_BYTES) {
    return { oversized: true }
  }
  const custom_id = generateAgencySlug(entry.documentNumber)
  let messages: Anthropic.Messages.MessageParam[]
  if (content.format === 'pdf') {
    messages = [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: content.buf.toString('base64'),
            },
          },
          {
            type: 'text',
            text: getAgencyPdfUserPrompt(
              entry.documentNumber,
              entry.title,
              entry.issuedBy ?? entry.agencyPrefix
            ),
          },
        ],
      },
    ]
  } else {
    let text: string
    try {
      text = await extractDocText(content)
    } catch (e) {
      return {
        error: `.doc extract: ${e instanceof Error ? e.message : String(e)}`,
      }
    }
    if (text.length < 200) return { error: '.doc extraction too small' }
    messages = [
      {
        role: 'user',
        content: [{ type: 'text', text: buildDocUserPrompt(entry, text) }],
      },
    ]
  }
  const request = {
    custom_id,
    params: {
      model: AGENCY_DEFAULT_MODEL,
      max_tokens: AGENCY_MAX_TOKENS.standard,
      system: AGENCY_REGULATION_SYSTEM_PROMPT,
      messages,
    } satisfies Anthropic.Messages.MessageCreateParamsNonStreaming,
  }
  return {
    entry,
    format: content.format,
    request,
    bytes: Buffer.byteLength(JSON.stringify(request)),
  }
}

/** Pack prepared requests into sub-batches under the 256 MB / 100k-request caps. */
function splitBySize(items: PreparedDoc[]): PreparedDoc[][] {
  const out: PreparedDoc[][] = []
  let cur: PreparedDoc[] = []
  let sz = 0
  for (const it of items) {
    if (
      cur.length > 0 &&
      (sz + it.bytes > MAX_BATCH_BYTES || cur.length >= MAX_BATCH_REQUESTS)
    ) {
      out.push(cur)
      cur = []
      sz = 0
    }
    cur.push(it)
    sz += it.bytes
  }
  if (cur.length) out.push(cur)
  return out
}

const stripFences = (msg: Anthropic.Message): string =>
  msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .replace(/^```html\n?|\n?```$/g, '')
    .trim()

async function runBatchMode(
  registry: RegistryEntry[],
  anthropic: Anthropic,
  slugMap: SlugMap
): Promise<void> {
  console.log(`Preparing ${registry.length} batch requests…`)
  const prepared: PreparedDoc[] = []
  const failures: Failure[] = []
  const oversized: RegistryEntry[] = [] // giants → split-and-stitch (not batched)
  for (const entry of registry) {
    const p = await prepareBatchRequest(entry)
    if ('error' in p)
      failures.push({ documentNumber: entry.documentNumber, reason: p.error })
    else if ('oversized' in p) oversized.push(entry)
    else prepared.push(p)
  }
  if (oversized.length)
    console.log(
      `  ${oversized.length} giant PDF(s) routed to split-and-stitch (not batched)`
    )
  const byId = new Map(prepared.map((p) => [p.request.custom_id, p]))
  const subBatches = splitBySize(prepared)
  console.log(
    `Prepared ${prepared.length} reqs → ${subBatches.length} sub-batch(es); ${failures.length} prep failures`
  )

  // Submit
  const batchIds: string[] = []
  for (let i = 0; i < subBatches.length; i++) {
    const reqs = subBatches[i]!.map((p) => p.request)
    const mb = (subBatches[i]!.reduce((s, p) => s + p.bytes, 0) / 1e6).toFixed(
      0
    )
    const batch = await anthropic.messages.batches.create({ requests: reqs })
    batchIds.push(batch.id)
    console.log(
      `  submitted ${i + 1}/${subBatches.length}: ${batch.id} (${reqs.length} reqs, ~${mb} MB)`
    )
  }
  writeFileSync(
    BATCH_STATE,
    JSON.stringify({ batchIds, createdAt: new Date().toISOString() }, null, 2)
  )

  // Poll + process each batch (batch max_tokens results append to `oversized`)
  let ok = 0
  let totalChunks = 0
  for (const id of batchIds) {
    for (;;) {
      const b = await anthropic.messages.batches.retrieve(id)
      const c = b.request_counts
      if (b.processing_status === 'ended') break
      console.log(
        `  ${id}: ${b.processing_status} — done ${c.succeeded + c.errored + c.canceled + c.expired}, processing ${c.processing}`
      )
      await sleep(POLL_INTERVAL_MS)
    }
    for await (const r of await anthropic.messages.batches.results(id)) {
      const p = byId.get(r.custom_id)
      if (!p) continue
      if (r.result.type !== 'succeeded') {
        failures.push({
          documentNumber: p.entry.documentNumber,
          reason: `batch ${r.result.type}`,
        })
        continue
      }
      if (r.result.message.stop_reason === 'max_tokens') {
        oversized.push(p.entry) // → split-and-stitch below
        continue
      }
      const res = await finalizeDoc(
        p.entry,
        stripFences(r.result.message),
        p.format === 'pdf' ? 'pdf-document' : 'doc-text-extract',
        p.format,
        slugMap
      )
      if (res.ok) {
        ok++
        totalChunks += res.chunks
        console.log(`  ✓ ${p.entry.documentNumber} — ${res.chunks} chunks`)
      } else {
        failures.push({
          documentNumber: p.entry.documentNumber,
          reason: res.reason,
        })
        console.log(`  ✗ ${p.entry.documentNumber} — ${res.reason}`)
      }
    }
  }

  // Oversized (max_tokens) → split-and-stitch synchronously
  if (oversized.length) {
    console.log(`\nSplit-and-stitch for ${oversized.length} oversized docs…`)
    for (const entry of oversized) {
      try {
        const content = await fetchContent(entry)
        const text = await extractDocText(content)
        const html = await normalizeChunked(text, entry, anthropic)
        const res = await finalizeDoc(
          entry,
          html,
          'chunked',
          content.format,
          slugMap
        )
        if (res.ok) {
          ok++
          totalChunks += res.chunks
          console.log(
            `  ✓ ${entry.documentNumber} (chunked) — ${res.chunks} chunks`
          )
        } else
          failures.push({
            documentNumber: entry.documentNumber,
            reason: res.reason,
          })
      } catch (e) {
        failures.push({
          documentNumber: entry.documentNumber,
          reason: `chunked: ${e instanceof Error ? e.message : String(e)}`,
        })
      }
    }
  }

  writeFileSync(FAILURES, JSON.stringify(failures, null, 2) + '\n')
  console.log(`\n=== BATCH SUMMARY ===`)
  console.log(`  succeeded: ${ok}/${registry.length}`)
  console.log(`  total chunks: ${totalChunks}`)
  console.log(`  failed: ${failures.length} → ${FAILURES}`)
  for (const f of failures)
    console.log(`    - ${f.documentNumber}: ${f.reason}`)
}

/**
 * RESUME mode (--resume): drain ALREADY-SUBMITTED batches recorded in
 * data/skolverket-batch-state.json through the finalize tail, WITHOUT
 * re-submitting (and re-paying for) generation. Used when a prior --batch run's
 * Claude side completed but the local poll→finalize loop was interrupted before
 * all results were written to the DB. Results expire 24h after batch creation —
 * run before then. Idempotent: skips docs already in the DB (html_content set).
 * The custom_id is the deterministic agency slug, so the entry map rebuilds from
 * the registry with no PDF re-encode. [Story 9.7 Task 5 recovery]
 */
async function runResumeMode(
  anthropic: Anthropic,
  slugMap: SlugMap
): Promise<void> {
  if (!existsSync(BATCH_STATE))
    throw new Error(`no batch state at ${BATCH_STATE} — nothing to resume`)
  const state = JSON.parse(readFileSync(BATCH_STATE, 'utf8')) as {
    batchIds: string[]
    createdAt: string
  }
  console.log(
    `Resuming ${state.batchIds.length} batch(es) submitted ${state.createdAt}`
  )

  const registry: RegistryEntry[] = JSON.parse(readFileSync(REGISTRY, 'utf8'))
  const byId = new Map(
    registry.map((e) => [generateAgencySlug(e.documentNumber), e])
  )
  // Idempotency: skip what's already ingested (the partial run's output).
  const alreadyDone = new Set(
    (
      await prisma.legalDocument.findMany({
        where: {
          document_number: { in: registry.map((e) => e.documentNumber) },
          html_content: { not: null },
        },
        select: { document_number: true },
      })
    ).map((d) => d.document_number)
  )
  console.log(`  ${alreadyDone.size} already in DB — will skip`)

  const failures: Failure[] = []
  const oversized: RegistryEntry[] = []
  let ok = 0
  let skipped = 0
  let totalChunks = 0

  for (const id of state.batchIds) {
    const b = await anthropic.messages.batches.retrieve(id)
    if (b.processing_status !== 'ended') {
      console.log(`  ${id}: ${b.processing_status} — not ended yet, polling…`)
      for (;;) {
        const cur = await anthropic.messages.batches.retrieve(id)
        if (cur.processing_status === 'ended') break
        await sleep(POLL_INTERVAL_MS)
      }
    }
    console.log(`  draining ${id}…`)
    // The results() stream is a long-lived HTTP body; it can drop mid-drain
    // (ECONNRESET). Retry the whole stream on failure — idempotency (alreadyDone)
    // makes re-streaming cheap: finished docs are skipped, only the tail re-runs.
    const STREAM_RETRIES = 5
    for (let attempt = 1; ; attempt++) {
      try {
        for await (const r of await anthropic.messages.batches.results(id)) {
          const entry = byId.get(r.custom_id)
          if (!entry) continue
          if (alreadyDone.has(entry.documentNumber)) {
            skipped++
            continue
          }
          if (r.result.type !== 'succeeded') {
            failures.push({
              documentNumber: entry.documentNumber,
              reason: `batch ${r.result.type}`,
            })
            continue
          }
          if (r.result.message.stop_reason === 'max_tokens') {
            oversized.push(entry)
            continue
          }
          // format (pdf|doc) drives the metadata labels; read it from the cached
          // source file (no network) — same detection prepareBatchRequest used.
          let format: DocFormat = 'pdf'
          try {
            format = (await fetchContent(entry)).format
          } catch {
            /* fall back to pdf label; finalize still works off the generated HTML */
          }
          const res = await finalizeDoc(
            entry,
            stripFences(r.result.message),
            format === 'pdf' ? 'pdf-document' : 'doc-text-extract',
            format,
            slugMap
          )
          if (res.ok) {
            ok++
            totalChunks += res.chunks
            alreadyDone.add(entry.documentNumber) // guard dup custom_ids across batches
            console.log(`  ✓ ${entry.documentNumber} — ${res.chunks} chunks`)
          } else {
            failures.push({
              documentNumber: entry.documentNumber,
              reason: res.reason,
            })
            console.log(`  ✗ ${entry.documentNumber} — ${res.reason}`)
          }
        }
        break // stream drained cleanly
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (attempt >= STREAM_RETRIES) {
          console.log(
            `  ⚠ ${id}: stream failed after ${attempt} attempts (${msg}) — re-run --resume to finish`
          )
          break
        }
        skipped = 0 // re-streaming from the top recounts skips
        console.log(
          `  ⚠ ${id}: stream dropped (${msg}); retry ${attempt}/${STREAM_RETRIES - 1} after backoff…`
        )
        await sleep(5_000 * attempt)
      }
    }
  }

  // Oversized (max_tokens) → split-and-stitch synchronously (same as batch tail).
  if (oversized.length) {
    console.log(`\nSplit-and-stitch for ${oversized.length} oversized docs…`)
    for (const entry of oversized) {
      try {
        const content = await fetchContent(entry)
        const text = await extractDocText(content)
        const html = await normalizeChunked(text, entry, anthropic)
        const res = await finalizeDoc(
          entry,
          html,
          'chunked',
          content.format,
          slugMap
        )
        if (res.ok) {
          ok++
          totalChunks += res.chunks
          console.log(
            `  ✓ ${entry.documentNumber} (chunked) — ${res.chunks} chunks`
          )
        } else
          failures.push({
            documentNumber: entry.documentNumber,
            reason: res.reason,
          })
      } catch (e) {
        failures.push({
          documentNumber: entry.documentNumber,
          reason: `chunked: ${e instanceof Error ? e.message : String(e)}`,
        })
      }
    }
  }

  writeFileSync(FAILURES, JSON.stringify(failures, null, 2) + '\n')
  console.log(`\n=== RESUME SUMMARY ===`)
  console.log(`  newly ingested: ${ok}`)
  console.log(`  skipped (already in DB): ${skipped}`)
  console.log(`  total new chunks: ${totalChunks}`)
  console.log(`  failed: ${failures.length} → ${FAILURES}`)
  for (const f of failures)
    console.log(`    - ${f.documentNumber}: ${f.reason}`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const batch = args.includes('--batch')
  const resume = args.includes('--resume')
  const skipExisting = args.includes('--skip-existing')

  // Resume drains already-submitted batches (its own registry/state) — no
  // registry filtering or re-submit. Handle before the normal filter pipeline.
  if (resume) {
    console.log('Building slug map…')
    const slugMap = await buildSlugMap()
    const anthropic = new Anthropic({ timeout: 15 * 60 * 1000, maxRetries: 2 })
    await runResumeMode(anthropic, slugMap)
    return
  }
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx !== -1 ? Number(args[limitIdx + 1]) : Infinity
  const filterIdx = args.indexOf('--filter')
  const filter = filterIdx !== -1 ? args[filterIdx + 1] : null
  const docsIdx = args.indexOf('--docs')
  const docList =
    docsIdx !== -1 && args[docsIdx + 1]
      ? args[docsIdx + 1]!.split(',').map((s) => s.trim())
      : null

  let registry: RegistryEntry[] = JSON.parse(readFileSync(REGISTRY, 'utf8'))
  if (docList)
    registry = registry.filter((e) => docList.includes(e.documentNumber))
  if (filter)
    registry = registry.filter(
      (e) => e.documentNumber === filter || e.documentNumber.includes(filter)
    )
  if (skipExisting) {
    const existing = new Set(
      (
        await prisma.legalDocument.findMany({
          where: {
            document_number: { in: registry.map((e) => e.documentNumber) },
            html_content: { not: null },
          },
          select: { document_number: true },
        })
      ).map((d) => d.document_number)
    )
    registry = registry.filter((e) => !existing.has(e.documentNumber))
  }
  registry = registry.slice(0, limit)

  console.log(
    `Ingesting ${registry.length} SKOLFS föreskrifter${dryRun ? ' (dry-run — no PDF/LLM/DB writes)' : ''}`
  )
  if (dryRun) {
    registry.forEach((e) =>
      console.log(
        `  ${e.documentNumber} [${e.pdfType}] ${e.issuedBy ?? '?'} — ${e.title.slice(0, 55)}`
      )
    )
    return
  }

  console.log('Building slug map…')
  const slugMap = await buildSlugMap()
  // Bound a stalled/trickling stream (otherwise .finalMessage() can hang
  // indefinitely); SDK auto-retries timeouts/5xx up to maxRetries. [Story 9.7]
  const anthropic = new Anthropic({ timeout: 15 * 60 * 1000, maxRetries: 2 })

  if (batch) {
    await runBatchMode(registry, anthropic, slugMap)
    return
  }

  const failures: Failure[] = []
  let ok = 0
  let totalChunks = 0
  for (let i = 0; i < registry.length; i++) {
    const e = registry[i]!
    const t0 = Date.now()
    try {
      const r = await ingestOne(e, anthropic, slugMap)
      if (r.ok) {
        ok++
        totalChunks += r.chunks
        console.log(
          `  [${i + 1}/${registry.length}] ✓ ${e.documentNumber} — ${r.chunks} chunks (${((Date.now() - t0) / 1000).toFixed(0)}s)`
        )
      } else {
        failures.push({ documentNumber: e.documentNumber, reason: r.reason })
        console.log(
          `  [${i + 1}/${registry.length}] ✗ ${e.documentNumber} — ${r.reason}`
        )
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      failures.push({ documentNumber: e.documentNumber, reason })
      console.log(
        `  [${i + 1}/${registry.length}] ✗ ${e.documentNumber} — ${reason}`
      )
    }
    // Be polite between Claude + API calls.
    if (i < registry.length - 1) await new Promise((r) => setTimeout(r, 1500))
  }

  writeFileSync(FAILURES, JSON.stringify(failures, null, 2) + '\n')
  console.log(`\n=== SUMMARY ===`)
  console.log(`  succeeded: ${ok}/${registry.length}`)
  console.log(`  total chunks created: ${totalChunks}`)
  console.log(`  failed: ${failures.length} → ${FAILURES}`)
  for (const f of failures)
    console.log(`    - ${f.documentNumber}: ${f.reason}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
