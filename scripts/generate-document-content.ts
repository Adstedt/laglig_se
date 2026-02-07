#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Document Content Generation Pipeline
 *
 * Story 12.3: Generates Summering (neutral summary) and Kommentar (compliance
 * commentary) for LegalDocuments using the Anthropic Message Batches API.
 *
 * Usage:
 *   npx tsx scripts/generate-document-content.ts                          # Default: template-docs scope
 *   npx tsx scripts/generate-document-content.ts --scope all              # All documents with source text
 *   npx tsx scripts/generate-document-content.ts --force                  # Regenerate even if content exists
 *   npx tsx scripts/generate-document-content.ts --limit 10               # Process only 10 documents
 *   npx tsx scripts/generate-document-content.ts --batch-id msgbatch_xxx  # Resume polling for existing batch
 *   npx tsx scripts/generate-document-content.ts --dry-run                # Log what would be submitted
 */

import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'
import Anthropic from '@anthropic-ai/sdk'
import {
  buildSystemPrompt,
  buildDocumentContext,
  getSourceText,
  buildHallucinationCheckPrompt,
  buildHallucinationCheckUserMessage,
  type DocumentContext,
} from '../lib/ai/prompts/document-content'

const prisma = new PrismaClient()

// ============================================================================
// Configuration
// ============================================================================

const GENERATION_MODEL =
  process.env.CONTENT_GENERATION_MODEL || 'claude-opus-4-6'
const VALIDATION_MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 2048
const POLL_INTERVAL_MS = 30_000

// Batch API pricing (50% of standard rates)
// Opus 4.6 Batch: $7.50/MTok input, $37.50/MTok output
// Haiku 4.5 Batch: $0.40/MTok input, $2.00/MTok output
const PRICING = {
  generation: { input: 7.5 / 1_000_000, output: 37.5 / 1_000_000 },
  validation: { input: 0.4 / 1_000_000, output: 2.0 / 1_000_000 },
}

export interface Config {
  scope: 'template-docs' | 'all'
  force: boolean
  limit: number
  batchId: string | null
  dryRun: boolean
}

export function parseArgs(argv: string[] = process.argv.slice(2)): Config {
  const config: Config = {
    scope: 'template-docs',
    force: false,
    limit: 0,
    batchId: null,
    dryRun: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--scope' && argv[i + 1]) {
      const scopeVal = argv[i + 1]
      if (scopeVal === 'template-docs' || scopeVal === 'all') {
        config.scope = scopeVal
      }
      i++
    } else if (arg === '--force') {
      config.force = true
    } else if (arg === '--limit' && argv[i + 1]) {
      config.limit = parseInt(argv[i + 1] ?? '0', 10)
      i++
    } else if (arg === '--batch-id' && argv[i + 1]) {
      config.batchId = argv[i + 1] ?? null
      i++
    } else if (arg === '--dry-run') {
      config.dryRun = true
    }
  }

  return config
}

// ============================================================================
// Cost Tracking
// ============================================================================

export interface CostTracker {
  generation: { inputTokens: number; outputTokens: number }
  validation: { inputTokens: number; outputTokens: number }
}

export function createCostTracker(): CostTracker {
  return {
    generation: { inputTokens: 0, outputTokens: 0 },
    validation: { inputTokens: 0, outputTokens: 0 },
  }
}

export function addGenerationTokens(
  tracker: CostTracker,
  inputTokens: number,
  outputTokens: number
): void {
  tracker.generation.inputTokens += inputTokens
  tracker.generation.outputTokens += outputTokens
}

export function addValidationTokens(
  tracker: CostTracker,
  inputTokens: number,
  outputTokens: number
): void {
  tracker.validation.inputTokens += inputTokens
  tracker.validation.outputTokens += outputTokens
}

export function calculateCost(tracker: CostTracker): {
  generationCost: number
  validationCost: number
  totalCost: number
} {
  const generationCost =
    tracker.generation.inputTokens * PRICING.generation.input +
    tracker.generation.outputTokens * PRICING.generation.output
  const validationCost =
    tracker.validation.inputTokens * PRICING.validation.input +
    tracker.validation.outputTokens * PRICING.validation.output
  return {
    generationCost,
    validationCost,
    totalCost: generationCost + validationCost,
  }
}

export function printCostSummary(
  tracker: CostTracker,
  documentCount: number
): void {
  const costs = calculateCost(tracker)
  console.log('\n=== Cost Summary ===')
  console.log(
    `Generation batch: ${tracker.generation.inputTokens.toLocaleString()} input + ${tracker.generation.outputTokens.toLocaleString()} output tokens = $${costs.generationCost.toFixed(4)}`
  )
  console.log(
    `Validation batch: ${tracker.validation.inputTokens.toLocaleString()} input + ${tracker.validation.outputTokens.toLocaleString()} output tokens = $${costs.validationCost.toFixed(4)}`
  )
  console.log(`Total cost: $${costs.totalCost.toFixed(4)}`)
  if (documentCount > 0) {
    console.log(
      `Average cost per document: $${(costs.totalCost / documentCount).toFixed(4)}`
    )
  }
}

// ============================================================================
// Quality Validation
// ============================================================================

export interface ValidationWarning {
  documentId: string
  documentNumber: string
  field: 'summering' | 'kommentar' | 'hallucination'
  message: string
}

export function validateSummering(
  text: string,
  documentId: string,
  documentNumber: string
): ValidationWarning[] {
  const warnings: ValidationWarning[] = []

  // Check for wrong voice (obligation language in Summering)
  const obligationPatterns = [
    /\bVi ska\b/i,
    /\bVi behöver\b/i,
    /\bVi är skyldiga\b/i,
    /\bVi måste\b/i,
  ]
  for (const pattern of obligationPatterns) {
    if (pattern.test(text)) {
      warnings.push({
        documentId,
        documentNumber,
        field: 'summering',
        message: `Contains obligation language "${text.match(pattern)?.[0]}" — Summering should be neutral/descriptive`,
      })
    }
  }

  // Check length (soft cap)
  if (text.length === 0) {
    warnings.push({
      documentId,
      documentNumber,
      field: 'summering',
      message: 'Empty Summering text',
    })
  }
  if (text.length > 2000) {
    warnings.push({
      documentId,
      documentNumber,
      field: 'summering',
      message: `Summering text unusually long (${text.length} chars)`,
    })
  }

  return warnings
}

export function validateKommentar(
  text: string,
  documentId: string,
  documentNumber: string
): ValidationWarning[] {
  const warnings: ValidationWarning[] = []

  // Check that it starts with obligation-focused phrasing
  const startsWithObligation =
    /^(Vi ska|Vi behöver|Vi är skyldiga|Vi måste|Vi får inte|Organisationen|Vi ska säkerställa|Om vi)/i.test(
      text
    )
  if (!startsWithObligation && text.length > 0) {
    warnings.push({
      documentId,
      documentNumber,
      field: 'kommentar',
      message:
        'Kommentar does not start with obligation-focused phrasing ("Vi ska...", "Vi behöver...", etc.)',
    })
  }

  // Check length
  if (text.length === 0) {
    warnings.push({
      documentId,
      documentNumber,
      field: 'kommentar',
      message: 'Empty Kommentar text',
    })
  }
  if (text.length > 2000) {
    warnings.push({
      documentId,
      documentNumber,
      field: 'kommentar',
      message: `Kommentar text unusually long (${text.length} chars)`,
    })
  }

  return warnings
}

// ============================================================================
// Scope Queries
// ============================================================================

type DocumentWithAmendments = Awaited<ReturnType<typeof fetchDocuments>>[number]

async function fetchDocuments(config: Config) {
  const where: Record<string, unknown> = {}

  if (config.scope === 'template-docs') {
    where.template_items = { some: {} }
  }

  // Skip documents where both summary and kommentar already exist (unless --force)
  if (!config.force) {
    where.NOT = {
      AND: [{ summary: { not: null } }, { kommentar: { not: null } }],
    }
  }

  const documents = await prisma.legalDocument.findMany({
    where,
    include: {
      base_amendments: {
        select: {
          amending_law_title: true,
          effective_date: true,
          affected_sections_raw: true,
          summary: true,
        },
        orderBy: { effective_date: 'desc' },
        take: 10,
      },
    },
    ...(config.limit > 0 ? { take: config.limit } : {}),
  })

  return documents
}

// ============================================================================
// Batch Request Building
// ============================================================================

export function buildBatchRequests(
  documents: DocumentWithAmendments[],
  systemPrompt: string
): {
  requests: Array<{
    custom_id: string
    params: {
      model: string
      max_tokens: number
      system: string
      messages: Array<{ role: 'user'; content: string }>
    }
  }>
  skippedNoSource: string[]
} {
  const requests: Array<{
    custom_id: string
    params: {
      model: string
      max_tokens: number
      system: string
      messages: Array<{ role: 'user'; content: string }>
    }
  }> = []
  const skippedNoSource: string[] = []

  for (const doc of documents) {
    const sourceText = getSourceText(doc)
    if (!sourceText) {
      console.warn(
        `⚠ Skipping ${doc.document_number} — no source text (html_content, markdown_content, full_text all null)`
      )
      skippedNoSource.push(doc.document_number)
      continue
    }

    const ctx: DocumentContext = {
      document_number: doc.document_number,
      title: doc.title,
      content_type: doc.content_type,
      effective_date: doc.effective_date?.toISOString().split('T')[0] ?? null,
      publication_date:
        doc.publication_date?.toISOString().split('T')[0] ?? null,
      status: doc.status,
      source_text: sourceText,
      metadata: doc.metadata as Record<string, unknown> | null,
      amendments: doc.base_amendments.map((a) => ({
        amending_law_title: a.amending_law_title,
        effective_date: a.effective_date?.toISOString().split('T')[0] ?? null,
        affected_sections_raw: a.affected_sections_raw,
        summary: a.summary,
      })),
    }

    requests.push({
      custom_id: doc.id,
      params: {
        model: GENERATION_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: buildDocumentContext(ctx) }],
      },
    })
  }

  return { requests, skippedNoSource }
}

// ============================================================================
// JSON Response Parsing
// ============================================================================

/**
 * Strip markdown code block fences from LLM response text.
 * Shared by generation and validation JSON parsing.
 */
export function stripMarkdownCodeBlock(text: string): string {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }
  return cleaned
}

export interface ParsedContent {
  summering: string
  kommentar: string
}

export function parseGeneratedContent(text: string): ParsedContent | null {
  try {
    const jsonText = stripMarkdownCodeBlock(text)
    const parsed = JSON.parse(jsonText) as Record<string, unknown>

    if (
      typeof parsed.summering !== 'string' ||
      typeof parsed.kommentar !== 'string'
    ) {
      return null
    }

    return {
      summering: parsed.summering,
      kommentar: parsed.kommentar,
    }
  } catch {
    return null
  }
}

// ============================================================================
// Batch Orchestration
// ============================================================================

async function submitBatch(
  anthropic: Anthropic,
  requests: Array<{
    custom_id: string
    params: {
      model: string
      max_tokens: number
      system: string
      messages: Array<{ role: 'user'; content: string }>
    }
  }>
): Promise<string> {
  console.log(`Submitting batch: ${requests.length} documents...`)

  const batch = await anthropic.messages.batches.create({
    requests: requests.map((r) => ({
      custom_id: r.custom_id,
      params: {
        model: r.params.model,
        max_tokens: r.params.max_tokens,
        system: r.params.system,
        messages: r.params.messages,
      },
    })),
  })

  console.log(`Batch submitted: ${batch.id}`)
  return batch.id
}

async function pollBatch(anthropic: Anthropic, batchId: string): Promise<void> {
  let status = await anthropic.messages.batches.retrieve(batchId)

  while (status.processing_status === 'in_progress') {
    const counts = status.request_counts
    console.log(
      `Batch ${batchId}: ${counts.succeeded + counts.errored + counts.canceled + counts.expired}/${counts.processing + counts.succeeded + counts.errored + counts.canceled + counts.expired} complete (${counts.processing} processing)`
    )
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    status = await anthropic.messages.batches.retrieve(batchId)
  }

  const counts = status.request_counts
  console.log(
    `Batch ${batchId} ended: ${counts.succeeded} succeeded, ${counts.errored} errored, ${counts.canceled} canceled, ${counts.expired} expired`
  )
}

interface ProcessedResult {
  documentId: string
  summering: string
  kommentar: string
  inputTokens: number
  outputTokens: number
}

async function processResults(
  anthropic: Anthropic,
  batchId: string,
  costTracker: CostTracker
): Promise<ProcessedResult[]> {
  const results: ProcessedResult[] = []
  const decoder = await anthropic.messages.batches.results(batchId)

  for await (const item of decoder) {
    if (item.result.type === 'succeeded') {
      const textBlock = item.result.message.content.find(
        (b) => b.type === 'text'
      )
      if (!textBlock || textBlock.type !== 'text') {
        console.error(`✗ ${item.custom_id}: No text response in batch result`)
        continue
      }

      const parsed = parseGeneratedContent(textBlock.text)
      if (!parsed) {
        console.error(`✗ ${item.custom_id}: Failed to parse JSON response`)
        continue
      }

      const usage = item.result.message.usage
      addGenerationTokens(costTracker, usage.input_tokens, usage.output_tokens)

      results.push({
        documentId: item.custom_id,
        summering: parsed.summering,
        kommentar: parsed.kommentar,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
      })
    } else {
      console.error(
        `✗ ${item.custom_id}: Batch result type "${item.result.type}"`
      )
    }
  }

  return results
}

// ============================================================================
// Hallucination Validation Batch
// ============================================================================

async function runHallucinationValidation(
  anthropic: Anthropic,
  results: ProcessedResult[],
  documentMap: Map<string, DocumentWithAmendments>,
  costTracker: CostTracker
): Promise<ValidationWarning[]> {
  const warnings: ValidationWarning[] = []

  // Build validation batch requests
  const validationRequests: Array<{
    custom_id: string
    params: {
      model: string
      max_tokens: number
      system: string
      messages: Array<{ role: 'user'; content: string }>
    }
  }> = []

  for (const result of results) {
    const doc = documentMap.get(result.documentId)
    if (!doc) continue

    const sourceText = getSourceText(doc)
    if (!sourceText) continue

    validationRequests.push({
      custom_id: result.documentId,
      params: {
        model: VALIDATION_MODEL,
        max_tokens: 512,
        system: buildHallucinationCheckPrompt(),
        messages: [
          {
            role: 'user',
            content: buildHallucinationCheckUserMessage(
              result.summering,
              result.kommentar,
              sourceText
            ),
          },
        ],
      },
    })
  }

  if (validationRequests.length === 0) return warnings

  console.log(
    `\nSubmitting hallucination validation batch: ${validationRequests.length} documents...`
  )

  const batchId = await submitBatch(anthropic, validationRequests)
  await pollBatch(anthropic, batchId)

  const decoder = await anthropic.messages.batches.results(batchId)

  for await (const item of decoder) {
    if (item.result.type === 'succeeded') {
      const usage = item.result.message.usage
      addValidationTokens(costTracker, usage.input_tokens, usage.output_tokens)

      const textBlock = item.result.message.content.find(
        (b) => b.type === 'text'
      )
      if (!textBlock || textBlock.type !== 'text') continue

      try {
        const jsonText = stripMarkdownCodeBlock(textBlock.text)
        const parsed = JSON.parse(jsonText) as {
          has_unsupported_claims: boolean
          flagged_claims: string[]
        }

        if (
          parsed.has_unsupported_claims &&
          parsed.flagged_claims?.length > 0
        ) {
          const doc = documentMap.get(item.custom_id)
          warnings.push({
            documentId: item.custom_id,
            documentNumber: doc?.document_number ?? item.custom_id,
            field: 'hallucination',
            message: `Unsupported claims: ${parsed.flagged_claims.join('; ')}`,
          })
        }
      } catch {
        // Parse failure in validation is non-critical — skip
      }
    }
  }

  return warnings
}

// ============================================================================
// Database Updates
// ============================================================================

async function updateDocuments(
  results: ProcessedResult[],
  model: string
): Promise<number> {
  let updated = 0

  for (const result of results) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.legalDocument.update({
          where: { id: result.documentId },
          data: {
            summary: result.summering,
            kommentar: result.kommentar,
            summering_generated_by: model,
            kommentar_generated_by: model,
          },
        })
      })
      updated++
    } catch (error) {
      console.error(
        `✗ Failed to update document ${result.documentId}:`,
        error instanceof Error ? error.message : error
      )
    }
  }

  return updated
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const config = parseArgs()

  console.log('=== Document Content Generation Pipeline ===')
  console.log(`Scope: ${config.scope}`)
  console.log(`Force: ${config.force}`)
  console.log(`Model: ${GENERATION_MODEL}`)
  if (config.limit > 0) console.log(`Limit: ${config.limit}`)
  if (config.batchId) console.log(`Resuming batch: ${config.batchId}`)
  if (config.dryRun) console.log('DRY RUN — no API calls will be made')

  const anthropic = new Anthropic()
  const costTracker = createCostTracker()
  const systemPrompt = buildSystemPrompt()

  // Phase 1: Fetch documents and submit batch (unless resuming)
  let batchId = config.batchId
  const documentMap: Map<string, DocumentWithAmendments> = new Map()

  if (!batchId) {
    console.log('\nFetching documents...')
    const documents = await fetchDocuments(config)
    console.log(`Found ${documents.length} documents to process`)

    // Build document map for later lookup
    for (const doc of documents) {
      documentMap.set(doc.id, doc)
    }

    const { requests, skippedNoSource } = buildBatchRequests(
      documents,
      systemPrompt
    )

    if (skippedNoSource.length > 0) {
      console.log(
        `\n⚠ Skipped ${skippedNoSource.length} documents with no source text`
      )
    }

    if (requests.length === 0) {
      console.log('\nNo documents to process. Done.')
      return
    }

    if (config.dryRun) {
      console.log(
        `\n[DRY RUN] Would submit batch with ${requests.length} requests`
      )
      console.log(
        `[DRY RUN] Documents: ${requests
          .map((r) => r.custom_id)
          .join(', ')
          .substring(0, 200)}...`
      )
      return
    }

    batchId = await submitBatch(anthropic, requests)
  }

  // Resume path: re-fetch documents so hallucination validation can run
  if (config.batchId && documentMap.size === 0) {
    console.log('\nFetching documents for validation (resume mode)...')
    const documents = await fetchDocuments(config)
    for (const doc of documents) {
      documentMap.set(doc.id, doc)
    }
    console.log(
      `Loaded ${documentMap.size} documents for hallucination validation`
    )
  }

  // Phase 2: Poll for completion and process results
  console.log(`\nPolling batch ${batchId}...`)
  await pollBatch(anthropic, batchId)

  console.log('\nProcessing results...')
  const results = await processResults(anthropic, batchId, costTracker)
  console.log(`Successfully parsed ${results.length} results`)

  // Run quality validation (non-blocking)
  const allWarnings: ValidationWarning[] = []

  for (const result of results) {
    const doc = documentMap.get(result.documentId)
    const docNumber = doc?.document_number ?? result.documentId

    allWarnings.push(
      ...validateSummering(result.summering, result.documentId, docNumber)
    )
    allWarnings.push(
      ...validateKommentar(result.kommentar, result.documentId, docNumber)
    )
  }

  // Hallucination check (second batch using Haiku 4.5)
  if (documentMap.size > 0) {
    const hallucinationWarnings = await runHallucinationValidation(
      anthropic,
      results,
      documentMap,
      costTracker
    )
    allWarnings.push(...hallucinationWarnings)
  }

  // Log warnings
  if (allWarnings.length > 0) {
    console.log(`\n⚠ ${allWarnings.length} validation warnings:`)
    for (const w of allWarnings) {
      console.log(`  [${w.field}] ${w.documentNumber}: ${w.message}`)
    }
  }

  // Update database
  console.log('\nUpdating database...')
  const updated = await updateDocuments(results, GENERATION_MODEL)
  console.log(`Updated ${updated}/${results.length} documents`)

  // Cost summary
  printCostSummary(costTracker, results.length)

  console.log('\n✓ Done.')
  await prisma.$disconnect()
}

// Only run main when executed directly (not when imported in tests)
const isDirectExecution =
  typeof process !== 'undefined' &&
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isDirectExecution) {
  main().catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
}
