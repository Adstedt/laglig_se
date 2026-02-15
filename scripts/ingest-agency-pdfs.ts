#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Story 9.2 — Generic Agency PDF→Claude→DB Ingestion Pipeline
 *
 * Sends agency regulation PDFs to Claude for HTML conversion, validates output,
 * derives markdown/plaintext/JSON, and upserts to the database.
 *
 * Usage:
 *   npx tsx scripts/ingest-agency-pdfs.ts --authority msbfs
 *   npx tsx scripts/ingest-agency-pdfs.ts --authority nfs
 *   npx tsx scripts/ingest-agency-pdfs.ts --authority msbfs --dry-run
 *   npx tsx scripts/ingest-agency-pdfs.ts --authority msbfs --limit 3
 *   npx tsx scripts/ingest-agency-pdfs.ts --authority msbfs --force
 *   npx tsx scripts/ingest-agency-pdfs.ts --authority msbfs --skip-existing
 *   npx tsx scripts/ingest-agency-pdfs.ts --authority msbfs --filter 2024:10
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'node:url'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import * as fs from 'fs'
import * as path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { PrismaClient, ContentType, DocumentStatus } from '@prisma/client'
import {
  type AgencyAuthority,
  type AgencyPdfDocument,
  SUPPORTED_AUTHORITIES,
  getRegistryByAuthority,
  generateAgencySlug,
  getPdfFileName,
  buildAgencyMetadata,
} from '../lib/agency/agency-pdf-registry'
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
import { htmlToJson } from '../lib/transforms/html-to-json'
import { linkifyHtmlContent, buildSlugMap, type SlugMap } from '../lib/linkify'
import type { Prisma } from '@prisma/client'

const prisma = new PrismaClient()

// ============================================================================
// Cost Estimation Constants (Sonnet 4.5 pricing)
// ============================================================================

const COST_PER_INPUT_TOKEN = 3 / 1_000_000 // $3/M input tokens
const COST_PER_OUTPUT_TOKEN = 15 / 1_000_000 // $15/M output tokens
const BUDGET_CEILING_USD = 15

// ============================================================================
// CLI Configuration
// ============================================================================

interface PipelineConfig {
  authority: AgencyAuthority
  dryRun: boolean
  force: boolean
  skipExisting: boolean
  limit: number
  filter: string | null
}

function parseArgs(): PipelineConfig {
  const cfg: PipelineConfig = {
    authority: 'msbfs',
    dryRun: false,
    force: false,
    skipExisting: false,
    limit: 0,
    filter: null,
  }

  const argv = process.argv.slice(2)
  let hasAuthority = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--authority' && argv[i + 1]) {
      const value = argv[i + 1]!.toLowerCase()
      if (!SUPPORTED_AUTHORITIES.includes(value as AgencyAuthority)) {
        console.error(
          `Unknown authority: ${value}. Supported: ${SUPPORTED_AUTHORITIES.join(', ')}`
        )
        process.exit(1)
      }
      cfg.authority = value as AgencyAuthority
      hasAuthority = true
      i++
    } else if (arg === '--dry-run') cfg.dryRun = true
    else if (arg === '--force') cfg.force = true
    else if (arg === '--skip-existing') cfg.skipExisting = true
    else if (arg === '--limit' && argv[i + 1]) {
      cfg.limit = parseInt(argv[i + 1]!, 10)
      i++
    } else if (arg === '--filter' && argv[i + 1]) {
      cfg.filter = argv[i + 1]!
      i++
    }
  }

  if (!hasAuthority) {
    console.error('Required: --authority msbfs|nfs')
    process.exit(1)
  }

  return cfg
}

// ============================================================================
// PDF Processing
// ============================================================================

interface ProcessingResult {
  success: boolean
  inputTokens: number
  outputTokens: number
  cost: number
  error?: string
}

async function processDocument(
  doc: AgencyPdfDocument,
  anthropic: Anthropic,
  cfg: PipelineConfig,
  pdfDir: string,
  reviewDir: string,
  slugMap: SlugMap
): Promise<ProcessingResult> {
  const fileName = getPdfFileName(doc.documentNumber)
  const pdfPath = path.join(pdfDir, fileName)

  // Check PDF exists
  if (!fs.existsSync(pdfPath)) {
    return {
      success: false,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      error: `PDF not found: ${pdfPath}`,
    }
  }

  const pdfStats = fs.statSync(pdfPath)
  const pdfSizeMB = pdfStats.size / (1024 * 1024)
  console.log(`  PDF: ${fileName} (${pdfSizeMB.toFixed(1)} MB)`)

  // Check if ADR-S-sized document (>10MB) — flag for manual handling
  if (pdfSizeMB > 10) {
    console.log(
      `  [WARN] Large PDF (${pdfSizeMB.toFixed(1)} MB) — may exceed context window`
    )
  }

  // Read PDF
  const pdfBuffer = fs.readFileSync(pdfPath)
  const pdfBase64 = pdfBuffer.toString('base64')

  // Build prompt
  const userPrompt = getAgencyPdfUserPrompt(
    doc.documentNumber,
    doc.title,
    doc.authority
  )

  if (cfg.dryRun) {
    console.log(
      `  [DRY RUN] Would send ${pdfSizeMB.toFixed(1)} MB PDF to Claude`
    )
    console.log(`  [DRY RUN] Model: ${AGENCY_DEFAULT_MODEL}`)
    console.log(`  [DRY RUN] Max tokens: ${AGENCY_MAX_TOKENS.standard}`)
    return { success: true, inputTokens: 0, outputTokens: 0, cost: 0 }
  }

  // Send to Claude (streaming required for long-running PDF processing)
  const startTime = Date.now()
  let response: Anthropic.Message

  try {
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
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    })
    response = await stream.finalMessage()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      error: `Claude API error: ${message}`,
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  const cost =
    inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN

  console.log(
    `  Claude: ${elapsed}s, ${inputTokens} input + ${outputTokens} output tokens, ~$${cost.toFixed(3)}`
  )

  if (response.stop_reason === 'max_tokens') {
    console.log(
      `  [WARN] Response truncated (hit max_tokens). Output may be incomplete.`
    )
  }

  // Extract text from response
  const rawOutput = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')

  if (!rawOutput.trim()) {
    return {
      success: false,
      inputTokens,
      outputTokens,
      cost,
      error: 'Empty response from Claude',
    }
  }

  // Validate LLM output
  const validation = validateLlmOutput(rawOutput, doc.documentNumber)

  if (!validation.valid || !validation.cleanedHtml) {
    const errorMessages = validation.errors.map((e) => e.message).join('; ')
    return {
      success: false,
      inputTokens,
      outputTokens,
      cost,
      error: `Validation failed: ${errorMessages}`,
    }
  }

  if (validation.warnings.length > 0) {
    console.log(
      `  Warnings: ${validation.warnings.map((w) => w.code).join(', ')}`
    )
  }
  if (needsManualReview(validation)) {
    console.log(`  [REVIEW] Flagged for manual review`)
  }

  console.log(
    `  Metrics: ${validation.metrics.charCount} chars, ${validation.metrics.sectionCount} sections, ${validation.metrics.paragraphCount} paragraphs`
  )

  const html = validation.cleanedHtml

  // Derive content formats from unlinkified HTML
  const markdownContent = htmlToMarkdown(html)
  const fullText = htmlToPlainText(html)
  const jsonContent = htmlToJson(html, { documentType: 'regulation' })
  // Story 2.29: Linkify after derived fields
  const linkifiedHtml = linkifyHtmlContent(
    html,
    slugMap,
    doc.documentNumber
  ).html

  // Write review HTML
  writeReviewFile(reviewDir, doc.documentNumber, html)

  // Build metadata
  const metadata = buildAgencyMetadata(
    doc,
    { input: inputTokens, output: outputTokens },
    cost
  )

  // Upsert to database
  const jsonMetadata = JSON.parse(
    JSON.stringify(metadata)
  ) as Prisma.InputJsonValue
  const jsonContentValue = JSON.parse(
    JSON.stringify(jsonContent)
  ) as Prisma.InputJsonValue

  await prisma.legalDocument.upsert({
    where: { document_number: doc.documentNumber },
    update: {
      title: doc.title,
      slug: generateAgencySlug(doc.documentNumber),
      html_content: linkifiedHtml,
      markdown_content: markdownContent,
      full_text: fullText,
      json_content: jsonContentValue,
      source_url: doc.sourceUrl,
      status: DocumentStatus.ACTIVE,
      metadata: jsonMetadata,
      updated_at: new Date(),
    },
    create: {
      document_number: doc.documentNumber,
      title: doc.title,
      slug: generateAgencySlug(doc.documentNumber),
      content_type: ContentType.AGENCY_REGULATION,
      html_content: linkifiedHtml,
      markdown_content: markdownContent,
      full_text: fullText,
      json_content: jsonContentValue,
      source_url: doc.sourceUrl,
      status: DocumentStatus.ACTIVE,
      metadata: jsonMetadata,
    },
  })

  console.log(`  [OK] Upserted: ${doc.documentNumber}`)

  return { success: true, inputTokens, outputTokens, cost }
}

// ============================================================================
// Review File Generation
// ============================================================================

function writeReviewFile(
  reviewDir: string,
  docNumber: string,
  html: string
): void {
  fs.mkdirSync(reviewDir, { recursive: true })
  const fileName = docNumber.replace(/\s+/g, '-').replace(/:/g, '-') + '.html'
  const filePath = path.join(reviewDir, fileName)

  const reviewHtml = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <title>${docNumber}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }
    h1 { font-size: 1.5rem; border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    h2 { font-size: 1.3rem; margin-top: 2rem; color: #222; }
    h3 { font-size: 1.1rem; margin-top: 1.5rem; color: #333; }
    a.paragraf { font-weight: bold; display: block; margin-top: 1.5rem; padding-top: 0.5rem; border-top: 1px solid #e0e0e0; }
    .allmanna-rad { background: #f9f6f0; border-left: 3px solid #c9a96e; padding: 0.5rem 1rem; margin: 0.5rem 0; }
    .allmanna-rad-heading { font-weight: bold; margin: 0; }
    table.legal-table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    table.legal-table th, table.legal-table td { border: 1px solid #ccc; padding: 0.4rem 0.8rem; text-align: left; }
    table.legal-table th { background: #f5f5f5; }
    sup.footnote-ref { color: #0066cc; cursor: help; }
    footer.back { border-top: 2px solid #999; margin-top: 2rem; padding-top: 1rem; color: #666; }
    .appendices { border-top: 1px dashed #999; margin-top: 2rem; padding-top: 1rem; }
  </style>
</head>
<body>
${html}
</body>
</html>`

  fs.writeFileSync(filePath, reviewHtml)
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const cfg = parseArgs()
  const startTime = Date.now()

  const registry = getRegistryByAuthority(cfg.authority)
  const pdfDir = path.resolve(__dirname, `../data/${cfg.authority}-pdfs`)
  const reviewDir = path.resolve(__dirname, `../data/${cfg.authority}-review`)

  console.log('='.repeat(60))
  console.log(`Agency PDF Ingestion Pipeline — ${cfg.authority.toUpperCase()}`)
  console.log('='.repeat(60))
  console.log(`Authority: ${cfg.authority.toUpperCase()}`)
  console.log(`Mode: ${cfg.dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Force: ${cfg.force}`)
  console.log(`Skip existing: ${cfg.skipExisting}`)
  console.log(`Model: ${AGENCY_DEFAULT_MODEL}`)
  console.log(`PDF dir: ${pdfDir}`)
  if (cfg.filter) console.log(`Filter: ${cfg.filter}`)
  if (cfg.limit > 0) console.log(`Limit: ${cfg.limit}`)
  console.log(`Budget ceiling: $${BUDGET_CEILING_USD}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log()

  // Initialize Anthropic client
  const anthropic = new Anthropic()

  // Filter documents
  let documents = [...registry]
  if (cfg.filter) {
    const filterNormalized = cfg.filter.replace(/\s+/g, '').toUpperCase()
    documents = documents.filter((d) =>
      d.documentNumber
        .replace(/\s+/g, '')
        .toUpperCase()
        .includes(filterNormalized)
    )
  }
  if (cfg.limit > 0) {
    documents = documents.slice(0, cfg.limit)
  }

  // Skip existing check
  if (cfg.skipExisting && !cfg.force && !cfg.dryRun) {
    const filteredDocs: AgencyPdfDocument[] = []
    for (const doc of documents) {
      const existing = await prisma.legalDocument.findUnique({
        where: { document_number: doc.documentNumber },
        select: { html_content: true },
      })
      if (existing?.html_content) {
        console.log(`[SKIP] ${doc.documentNumber} — already has content`)
      } else {
        filteredDocs.push(doc)
      }
    }
    documents = filteredDocs
  }

  console.log(
    `--- Processing ${documents.length} of ${registry.length} documents ---`
  )
  console.log()

  // Story 2.29: Build slug map for linkification
  const slugMap = await buildSlugMap()

  let processed = 0
  let failed = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCost = 0

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]!

    console.log(
      `[${i + 1}/${documents.length}] ${doc.documentNumber}: ${doc.title}`
    )
    if (doc.notes) console.log(`  Note: ${doc.notes}`)

    // Handle stub-only documents (e.g. ADR-S — too large for LLM processing)
    if (doc.stubOnly) {
      console.log(`  [STUB] External PDF only — skipping LLM processing`)
      if (!cfg.dryRun) {
        await prisma.legalDocument.upsert({
          where: { document_number: doc.documentNumber },
          update: {
            title: doc.title,
            slug: generateAgencySlug(doc.documentNumber),
            source_url: doc.sourceUrl,
            status: DocumentStatus.ACTIVE,
            metadata: {
              source: doc.sourceDomain,
              method: 'stub-external-pdf' as const,
              pdfUrl: doc.pdfUrl,
              processedAt: new Date().toISOString(),
              notes:
                doc.notes ??
                'Stub record — content available as external PDF only',
              isConsolidated: doc.isConsolidated,
            } as unknown as Prisma.InputJsonValue,
            updated_at: new Date(),
          },
          create: {
            document_number: doc.documentNumber,
            title: doc.title,
            slug: generateAgencySlug(doc.documentNumber),
            content_type: ContentType.AGENCY_REGULATION,
            source_url: doc.sourceUrl,
            status: DocumentStatus.ACTIVE,
            metadata: {
              source: doc.sourceDomain,
              method: 'stub-external-pdf' as const,
              pdfUrl: doc.pdfUrl,
              processedAt: new Date().toISOString(),
              notes:
                doc.notes ??
                'Stub record — content available as external PDF only',
              isConsolidated: doc.isConsolidated,
            } as unknown as Prisma.InputJsonValue,
          },
        })
        console.log(`  [OK] Upserted stub: ${doc.documentNumber}`)
      } else {
        console.log(`  [DRY RUN] Would upsert stub for ${doc.documentNumber}`)
      }
      processed++
      continue
    }

    // Budget check
    if (totalCost > BUDGET_CEILING_USD) {
      console.log(
        `  [HALT] Budget ceiling ($${BUDGET_CEILING_USD}) exceeded at $${totalCost.toFixed(2)}. Stopping.`
      )
      break
    }

    try {
      const result = await processDocument(
        doc,
        anthropic,
        cfg,
        pdfDir,
        reviewDir,
        slugMap
      )

      if (result.success) {
        processed++
        totalInputTokens += result.inputTokens
        totalOutputTokens += result.outputTokens
        totalCost += result.cost
      } else {
        console.error(`  [FAIL] ${result.error}`)
        failed++
      }
    } catch (err) {
      console.error(`  [FAIL] ${err instanceof Error ? err.message : err}`)
      failed++
    }

    // Running total
    if (!cfg.dryRun && i < documents.length - 1) {
      console.log(
        `  Running total: $${totalCost.toFixed(3)} / $${BUDGET_CEILING_USD}`
      )
    }

    // Rate limit: 2 seconds between Claude calls
    if (!cfg.dryRun && i < documents.length - 1) {
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log()
  console.log('='.repeat(60))
  console.log('Results')
  console.log('='.repeat(60))
  console.log(`  Processed: ${processed}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Total input tokens: ${totalInputTokens.toLocaleString()}`)
  console.log(`  Total output tokens: ${totalOutputTokens.toLocaleString()}`)
  console.log(`  Total cost: $${totalCost.toFixed(3)}`)
  console.log(
    `  Budget remaining: $${(BUDGET_CEILING_USD - totalCost).toFixed(3)}`
  )
  console.log(`  Duration: ${elapsed}s`)
  console.log('='.repeat(60))

  if (failed > 0) {
    process.exit(1)
  }
}

const isDirectExecution =
  typeof process !== 'undefined' &&
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isDirectExecution) {
  main()
    .catch((e) => {
      console.error('Fatal:', e)
      process.exit(1)
    })
    .finally(() => void prisma.$disconnect())
}
