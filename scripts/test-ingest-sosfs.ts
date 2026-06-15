/* eslint-disable no-console */
/**
 * TEST-INGEST: one Socialstyrelsen consolidated föreskrift (SOSFS 2011:9)
 * through the existing agency pipeline, adapted for HTML intake.
 *
 * Flow (reuses production helpers):
 *   fetch page → cheerio-extract #main-content + amendment cards + PDF links
 *   → Claude normalize (extracted HTML → canonical <article class="legal-document">)
 *   → validateLlmOutput → htmlToMarkdown / htmlToPlainText / parseCanonicalHtml
 *   → upsert LegalDocument (AGENCY_REGULATION, ACTIVE)
 *   → syncDocumentChunks (chunk + Haiku context prefixes + OpenAI embeddings)
 *   → search_vector raw SQL
 *   → verify
 *
 * Throwaway investigation script. Usage: pnpm tsx scripts/test-ingest-sosfs.ts
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })

/* eslint-disable import/first */
import Anthropic from '@anthropic-ai/sdk'
import * as cheerio from 'cheerio'
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
import { syncDocumentChunks } from '../lib/chunks/sync-document-chunks'
/* eslint-enable import/first */

const DOC_NUMBER = 'SOSFS 2011:9'
const TITLE =
  'Socialstyrelsens föreskrifter och allmänna råd om ledningssystem för systematiskt kvalitetsarbete'
const SOURCE_URL =
  'https://www.socialstyrelsen.se/kunskapsstod-och-regler/regler-och-riktlinjer/foreskrifter-och-allmanna-rad/konsoliderade-foreskrifter/20119-om-ledningssystem-for-systematiskt-kvalitetsarbete/'
const ARTICLE_ID = 'sosfs_2011_9'

function step(s: string) {
  console.log(`\n\x1b[36m▶ ${s}\x1b[0m`)
}

async function main() {
  // 1. Fetch ---------------------------------------------------------------
  step('1/7 Fetch consolidated page')
  const res = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LagligBot/1.0)' },
  })
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`)
  const pageHtml = await res.text()
  console.log(`  ${(pageHtml.length / 1024).toFixed(0)} KB`)

  // 2. Extract -------------------------------------------------------------
  step('2/7 Extract main content + amendment cards + PDF links')
  const $ = cheerio.load(pageHtml)
  const $main = $('#main-content')
  if ($main.length === 0) throw new Error('No #main-content found')

  // Capture provenance BEFORE stripping
  const pdfLinks = Array.from(
    new Set(
      $main
        .find(
          'a[href*="/contentassets/"], a[href*="/globalassets/"], a[href$=".pdf"]'
        )
        .map((_, a) => $(a).attr('href'))
        .get()
        .filter(Boolean)
        .map((h) =>
          h!.startsWith('http') ? h! : `https://www.socialstyrelsen.se${h}`
        )
    )
  )
  const amendmentRefs = Array.from(
    new Set($main.text().match(/(SOSFS|HSLF-FS)\s+\d{4}:\d+/g) ?? [])
  ).filter((n) => n !== DOC_NUMBER)
  const consolidatedThrough =
    $main
      .text()
      .match(/[ÄA]ndrad[^]{0,40}?((SOSFS|HSLF-FS)\s+\d{4}:\d+)/)?.[1] ??
    (amendmentRefs.length ? amendmentRefs[amendmentRefs.length - 1] : null)

  console.log(`  PDF/provenance links: ${pdfLinks.length}`)
  console.log(`  amendment refs found: ${amendmentRefs.join(', ') || '(none)'}`)
  console.log(`  consolidated through: ${consolidatedThrough ?? '(unknown)'}`)

  // Strip chrome/navigation so the LLM sees only the regulation
  $main
    .find(
      'nav, script, style, button, form, .anchor-nav, .share, .breadcrumb, [class*="menu"]'
    )
    .remove()
  const contentHtml = ($main.html() ?? '').trim()
  console.log(
    `  extracted content: ${(contentHtml.length / 1024).toFixed(1)} KB`
  )
  if (contentHtml.length < 500)
    throw new Error('Extracted content suspiciously small')

  // 3. Claude normalize: extracted HTML → canonical semantic HTML ----------
  step('3/7 Claude normalize → canonical <article class="legal-document">')
  const anthropic = new Anthropic()
  const userPrompt = `Convert this Swedish regulation (${DOC_NUMBER}) into semantic HTML.

The source below is the CONSOLIDATED HTML extracted from the official Socialstyrelsen web page (Episerver CMS markup). Reconstruct the regulation faithfully — do NOT summarize, drop, or reword any normative text. Preserve chapter (kap.) and paragraph (§) structure, allmänna råd, and inline amendment attributions like "(HSLF-FS 2025:21)".

Document metadata:
- Document Number: ${DOC_NUMBER}
- Article ID: ${ARTICLE_ID}
- Title: ${TITLE}
- Publisher: Socialstyrelsen

Use "${ARTICLE_ID}" as the id of the root <article class="legal-document"> element, and "${ARTICLE_ID}_P{N}" (or "${ARTICLE_ID}_K{CH}_P{N}" with chapters) for paragraph anchors.

Output ONLY the HTML, no markdown fences or commentary.

--- SOURCE HTML ---
${contentHtml}`

  const start = Date.now()
  const stream = anthropic.messages.stream({
    model: AGENCY_DEFAULT_MODEL,
    max_tokens: AGENCY_MAX_TOKENS.standard,
    system: AGENCY_REGULATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: [{ type: 'text', text: userPrompt }] }],
  })
  const response = await stream.finalMessage()
  const rawOutput = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
  console.log(
    `  ${((Date.now() - start) / 1000).toFixed(1)}s · ${response.usage.input_tokens} in / ${response.usage.output_tokens} out${response.stop_reason === 'max_tokens' ? ' · [WARN truncated]' : ''}`
  )

  // 4. Validate + derive formats ------------------------------------------
  step('4/7 Validate + derive markdown/plaintext/json')
  const v = validateLlmOutput(rawOutput, DOC_NUMBER)
  if (!v.valid || !v.cleanedHtml) {
    throw new Error(
      `Validation failed: ${v.errors.map((e) => e.message).join('; ')}`
    )
  }
  if (v.warnings.length)
    console.log(`  warnings: ${v.warnings.map((w) => w.code).join(', ')}`)
  if (needsManualReview(v)) console.log('  [REVIEW] flagged for manual review')
  console.log(
    `  metrics: ${v.metrics.charCount} chars, ${v.metrics.sectionCount} sections, ${v.metrics.paragraphCount} paragraphs`
  )
  const html = v.cleanedHtml
  const markdown_content = htmlToMarkdown(html)
  const full_text = htmlToPlainText(html)
  const jsonContent = parseCanonicalHtml(html, {
    documentType: 'AGENCY_REGULATION',
  })

  const metadata = {
    source: 'socialstyrelsen.se',
    authority: 'Socialstyrelsen',
    agency_prefix: 'SOSFS',
    consolidated_through: consolidatedThrough,
    amendments: amendmentRefs,
    authoritative_pdfs: pdfLinks,
    authoritative_note:
      'Den tryckta versionen (grund- och ändringsförfattningar) är den som gäller. HTML är konsoliderad konveniensversion.',
    ingested_by: 'test-ingest-sosfs',
    tokens: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
  }

  // 5. Upsert --------------------------------------------------------------
  step('5/7 Upsert LegalDocument')
  const slug = generateAgencySlug(DOC_NUMBER)
  const jsonMetadata = JSON.parse(
    JSON.stringify(metadata)
  ) as Prisma.InputJsonValue
  const jsonContentValue = JSON.parse(
    JSON.stringify(jsonContent)
  ) as Prisma.InputJsonValue
  const doc = await prisma.legalDocument.upsert({
    where: { document_number: DOC_NUMBER },
    update: {
      title: TITLE,
      slug,
      html_content: html,
      markdown_content,
      full_text,
      json_content: jsonContentValue,
      source_url: SOURCE_URL,
      status: DocumentStatus.ACTIVE,
      metadata: jsonMetadata,
      updated_at: new Date(),
    },
    create: {
      document_number: DOC_NUMBER,
      title: TITLE,
      slug,
      content_type: ContentType.AGENCY_REGULATION,
      html_content: html,
      markdown_content,
      full_text,
      json_content: jsonContentValue,
      source_url: SOURCE_URL,
      status: DocumentStatus.ACTIVE,
      metadata: jsonMetadata,
    },
    select: { id: true, slug: true },
  })
  console.log(`  [OK] ${DOC_NUMBER} → id ${doc.id} · /foreskrifter/${doc.slug}`)

  // 6. Chunk + embed -------------------------------------------------------
  step('6/7 syncDocumentChunks (chunk + context prefixes + embeddings)')
  const sync = await syncDocumentChunks(doc.id)
  console.log(
    `  deleted ${sync.chunksDeleted} · created ${sync.chunksCreated} · embedded ${sync.chunksEmbedded} · ${(sync.duration / 1000).toFixed(1)}s`
  )

  // 7. FTS + verify --------------------------------------------------------
  step('7/7 search_vector + verify')
  await prisma.$executeRaw`
    UPDATE legal_documents SET search_vector =
      setweight(to_tsvector('pg_catalog.swedish', coalesce(title,'')),'A') ||
      setweight(to_tsvector('pg_catalog.swedish', coalesce(document_number,'')),'A') ||
      setweight(to_tsvector('pg_catalog.swedish', coalesce(summary,'')),'B')
    WHERE id = ${doc.id}`

  const chunkCount = await prisma.contentChunk.count({
    where: { source_type: 'LEGAL_DOCUMENT', source_id: doc.id },
  })
  const embeddedCount = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT count(*)::int AS c FROM content_chunks
    WHERE source_type = 'LEGAL_DOCUMENT' AND source_id = ${doc.id} AND embedding IS NOT NULL`
  const prefixedCount = await prisma.contentChunk.count({
    where: {
      source_type: 'LEGAL_DOCUMENT',
      source_id: doc.id,
      context_prefix: { not: null },
    },
  })
  const ftsHit = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT count(*)::int AS c FROM legal_documents
    WHERE id = ${doc.id} AND search_vector @@ plainto_tsquery('pg_catalog.swedish', 'ledningssystem kvalitetsarbete')`
  const sample = await prisma.contentChunk.findFirst({
    where: { source_type: 'LEGAL_DOCUMENT', source_id: doc.id },
    select: { path: true, contextual_header: true, token_count: true },
    orderBy: { path: 'asc' },
  })

  console.log(`  chunks in DB:        ${chunkCount}`)
  console.log(`  chunks w/ ctx prefix: ${prefixedCount}`)
  console.log(`  chunks w/ embedding: ${Number(embeddedCount[0]?.c ?? 0)}`)
  console.log(
    `  FTS matches query:   ${Number(ftsHit[0]?.c ?? 0) > 0 ? 'YES' : 'no'}`
  )
  if (sample)
    console.log(
      `  sample chunk:        [${sample.path}] "${sample.contextual_header}" (${sample.token_count} tok)`
    )

  console.log('\n\x1b[32m✓ Test-ingest complete.\x1b[0m')
  console.log(`  Review: /foreskrifter/${doc.slug}`)
  console.log(
    `  Revert: DELETE the row + chunks for document_number='${DOC_NUMBER}' (id ${doc.id})`
  )
}

main()
  .catch((e) => {
    console.error('\n\x1b[31m✗ FAILED:\x1b[0m', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
