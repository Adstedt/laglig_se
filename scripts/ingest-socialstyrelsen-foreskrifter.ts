/* eslint-disable no-console */
/**
 * Story 9.5 — Tasks 3+4: registry-driven Socialstyrelsen föreskrift ingester.
 *
 * Reads data/socialstyrelsen-foreskrifter-registry.json (from the enumerator) and
 * runs each consolidated page through the proven HTML-intake pipeline:
 *   fetch → cheerio-extract #main-content → Claude normalize → validateLlmOutput
 *   → md/plaintext/json → linkify → upsert (AGENCY_REGULATION, +regulatory_body/
 *   agency_prefix) → syncDocumentChunks (chunk+prefix+embed) → search_vector.
 * Amendment metadata + authoritative PDF URLs captured from the whole page.
 *
 * FAIL-SOFT (AC 4/4a): a doc that truncates (max_tokens) or fails validation is
 * recorded to a failures manifest; the batch continues. Large-doc remediation is
 * a deferred follow-up, only if the manifest is non-empty.
 *
 * Usage:
 *   pnpm tsx scripts/ingest-socialstyrelsen-foreskrifter.ts --dry-run
 *   pnpm tsx scripts/ingest-socialstyrelsen-foreskrifter.ts --limit 3
 *   pnpm tsx scripts/ingest-socialstyrelsen-foreskrifter.ts --filter "SOSFS 2011:9"
 *   pnpm tsx scripts/ingest-socialstyrelsen-foreskrifter.ts --skip-existing   # full run
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })
/* eslint-disable import/first */
import Anthropic from '@anthropic-ai/sdk'
import * as cheerio from 'cheerio'
import { readFileSync, writeFileSync } from 'fs'
import { ContentType, DocumentStatus, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import {
  AGENCY_REGULATION_SYSTEM_PROMPT,
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
import { generateAgencySlug } from '../lib/agency/agency-pdf-registry'
import { deriveAgencyAttribution } from '../lib/agency/regulatory-bodies'
import { syncDocumentChunks } from '../lib/chunks/sync-document-chunks'
import { linkifyHtmlContent, buildSlugMap, type SlugMap } from '../lib/linkify'
/* eslint-enable import/first */

const REGISTRY = resolve(
  process.cwd(),
  'data/socialstyrelsen-foreskrifter-registry.json'
)
const FAILURES = resolve(
  process.cwd(),
  'data/socialstyrelsen-ingest-failures.json'
)
const BASE = 'https://www.socialstyrelsen.se'

interface RegistryEntry {
  documentNumber: string
  title: string
  sourceUrl: string
  agencyPrefix: string | null
  regulatoryBody: string | null
  sourcePrefixTypo?: string
}
interface Failure {
  documentNumber: string
  reason: string
}

const articleId = (docNum: string) =>
  docNum
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

function extractContent(pageHtml: string): {
  contentHtml: string
  amendments: string[]
  consolidatedThrough: string | null
  pdfs: string[]
} {
  const $ = cheerio.load(pageHtml)

  // Provenance from the WHOLE page (amendment cards sit outside #main-content)
  const pdfs = [
    ...new Set(
      $(
        'a[href*="/contentassets/"], a[href*="/globalassets/"], a[href$=".pdf"], a[href*="/publikationer/"]'
      )
        .map((_, a) => $(a).attr('href'))
        .get()
        .filter(Boolean)
        .map((h) => (h!.startsWith('http') ? h! : `${BASE}${h}`))
    ),
  ]
  const pageText = $.root().text()
  const amendments = [
    ...new Set(pageText.match(/(?:SOSFS|HSLF-FS)\s+\d{4}:\d+/g) ?? []),
  ]
  const consolidatedThrough =
    pageText.match(/[ÄA]ndrad[^]{0,40}?((?:SOSFS|HSLF-FS)\s+\d{4}:\d+)/)?.[1] ??
    null

  // Body for the LLM: #main-content minus chrome
  const $main = $('#main-content')
  $main
    .find(
      'nav, script, style, button, form, .anchor-nav, .share, .breadcrumb, [class*="menu"]'
    )
    .remove()
  const contentHtml = ($main.html() ?? '').trim()

  return { contentHtml, amendments, consolidatedThrough, pdfs }
}

// Docs whose extracted HTML exceeds this are normalized chapter-by-chapter
// (single-pass output would exceed the model's max_tokens / time out). Story 9.5
// QA-fix: remediates SOSFS 2009:30 etc. into ONE document, not multiple.
const LARGE_HTML_THRESHOLD = 55_000

async function callClaude(
  systemExtra: string,
  userText: string,
  anthropic: Anthropic
) {
  const stream = anthropic.messages.stream({
    model: AGENCY_DEFAULT_MODEL,
    max_tokens: AGENCY_MAX_TOKENS.standard,
    system: AGENCY_REGULATION_SYSTEM_PROMPT + systemExtra,
    messages: [{ role: 'user', content: [{ type: 'text', text: userText }] }],
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

const isChapterH2 = (el: unknown, $: cheerio.CheerioAPI) =>
  (el as { tagName?: string }).tagName === 'h2' &&
  /^\s*\d+\s*kap\./i.test($(el as never).text())

/** Split extracted content into a preamble segment + one per "N kap." chapter + trailing.
 *  Chapter <h2>s are siblings under a content wrapper (e.g. div.main-body), NOT at <body>
 *  top level — so we iterate the chapter headings' actual parent's children. */
function chapterSegments(
  contentHtml: string
): { label: string; html: string }[] {
  const $ = cheerio.load(contentHtml, { decodeEntities: false } as never)
  const firstChap = $('h2')
    .filter((_, el) => isChapterH2(el, $))
    .first()
  const container = firstChap.length
    ? firstChap.parent()
    : $('body').length
      ? $('body')
      : $.root()
  const top = container.children().toArray()
  const segs: { label: string; parts: string[] }[] = [
    { label: 'preamble', parts: [] },
  ]
  for (const el of top) {
    if (isChapterH2(el, $)) {
      segs.push({ label: $(el).text().trim(), parts: [$.html($(el)) ?? ''] })
    } else {
      segs[segs.length - 1]!.parts.push($.html($(el)) ?? '')
    }
  }
  return segs
    .map((s) => ({ label: s.label, html: s.parts.join('').trim() }))
    .filter((s) => s.html.length > 0)
}

/** Normalize a large doc chapter-by-chapter, then stitch into ONE <article>. */
async function normalizeChunked(
  contentHtml: string,
  documentNumber: string,
  title: string,
  id: string,
  anthropic: Anthropic
): Promise<string> {
  const segments = chapterSegments(contentHtml)
  const bodyParts: string[] = []
  for (const seg of segments) {
    const chMatch = seg.label.match(/^(\d+)\s*kap\./)
    const isChapter = Boolean(chMatch)
    const instr = isChapter
      ? `\n\nCHUNKED MODE: output ONLY a single <section class="kapitel" id="${id}_K${chMatch![1]}"> element for this one chapter (heading <h2 class="kapitel-rubrik">, paragraphs as <h3 class="paragraph"><a class="paragraf" id="${id}_K${chMatch![1]}_P{N}">N §</a></h3> + <p class="text">). NO <article>, <html>, lovhead, or other chapters. No markdown fences.`
      : `\n\nCHUNKED MODE: output ONLY the body fragment for this preamble/appendix content as <p class="text">/<section> elements. NO <article>, <html>, lovhead, or <h1>. No markdown fences.`
    const out = await callClaude(
      instr,
      `Regulation ${documentNumber} ("${title}"), segment "${seg.label}". Reconstruct faithfully — no summarizing/dropping.\n\n--- SOURCE ---\n${seg.html}`,
      anthropic
    )
    bodyParts.push(out)
  }
  return `<article class="legal-document" id="${id}">
  <div class="lovhead"><h1><p class="text">${documentNumber}</p><p class="text">${title}</p></h1></div>
  <div class="body">
${bodyParts.join('\n')}
  </div>
</article>`
}

async function ingestOne(
  entry: RegistryEntry,
  anthropic: Anthropic,
  slugMap: SlugMap
): Promise<{ ok: true; chunks: number } | { ok: false; reason: string }> {
  const { documentNumber, title, sourceUrl } = entry
  const id = articleId(documentNumber)

  const res = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LagligBot/1.0)' },
  })
  if (!res.ok) return { ok: false, reason: `fetch HTTP ${res.status}` }
  const { contentHtml, amendments, consolidatedThrough, pdfs } = extractContent(
    await res.text()
  )
  if (contentHtml.length < 500)
    return { ok: false, reason: 'extracted content too small' }

  const singlePassPrompt = `Convert this Swedish regulation (${documentNumber}) into semantic HTML.

The source below is the CONSOLIDATED HTML extracted from the official Socialstyrelsen web page (Episerver CMS markup). Reconstruct the regulation faithfully — do NOT summarize, drop, or reword any normative text. Preserve chapter (kap.) and paragraph (§) structure, allmänna råd, and inline amendment attributions like "(HSLF-FS 2025:21)".

Document metadata:
- Document Number: ${documentNumber}
- Article ID: ${id}
- Title: ${title}
- Publisher: Socialstyrelsen

Use "${id}" as the id of the root <article class="legal-document"> element, and "${id}_P{N}" (or "${id}_K{CH}_P{N}" with chapters) for paragraph anchors.

Output ONLY the HTML, no markdown fences or commentary.

--- SOURCE HTML ---
${contentHtml}`

  let rawOutput: string
  try {
    rawOutput =
      contentHtml.length > LARGE_HTML_THRESHOLD
        ? await normalizeChunked(
            contentHtml,
            documentNumber,
            title,
            id,
            anthropic
          )
        : await callClaude('', singlePassPrompt, anthropic)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Fallback: if a single-pass attempt truncated/terminated, retry chunked.
    if (contentHtml.length <= LARGE_HTML_THRESHOLD) {
      try {
        rawOutput = await normalizeChunked(
          contentHtml,
          documentNumber,
          title,
          id,
          anthropic
        )
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

  const { agencyPrefix, regulatoryBody } =
    deriveAgencyAttribution(documentNumber)
  const metadata = {
    source: 'socialstyrelsen.se',
    authority: 'Socialstyrelsen',
    agency_prefix: agencyPrefix,
    consolidated_through: consolidatedThrough,
    amendments: amendments.filter((a) => a !== documentNumber),
    authoritative_pdfs: pdfs,
    ingested_by: 'ingest-socialstyrelsen-foreskrifter',
    ...(entry.sourcePrefixTypo
      ? { source_prefix_typo: entry.sourcePrefixTypo }
      : {}),
    needs_review: needsManualReview(v) || undefined,
    normalized_via:
      contentHtml.length > LARGE_HTML_THRESHOLD ? 'chunked' : 'single-pass',
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
    agency_prefix: agencyPrefix,
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

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const skipExisting = args.includes('--skip-existing')
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx !== -1 ? Number(args[limitIdx + 1]) : Infinity
  const filterIdx = args.indexOf('--filter')
  const filter = filterIdx !== -1 ? args[filterIdx + 1] : null

  let registry: RegistryEntry[] = JSON.parse(readFileSync(REGISTRY, 'utf8'))
  if (filter) registry = registry.filter((e) => e.documentNumber === filter)
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
    `Ingesting ${registry.length} föreskrifter${dryRun ? ' (dry-run — no LLM/DB writes)' : ''}`
  )
  if (dryRun) {
    registry.forEach((e) =>
      console.log(`  ${e.documentNumber} — ${e.title.slice(0, 60)}`)
    )
    return
  }

  console.log('Building slug map…')
  const slugMap = await buildSlugMap()
  const anthropic = new Anthropic()

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
  .finally(() => prisma.$disconnect())
