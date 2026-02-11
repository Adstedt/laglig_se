#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * E2E Test: Content Generation Pipeline — 5 Notisum Documents
 *
 * Runs the content generation pipeline for 5 well-known documents that exist
 * in both the database and Notisum's law lists, then outputs a comparison
 * report so you can validate the AI output against the Notisum reference.
 *
 * Usage:
 *   npx tsx scripts/test-content-generation.ts              # Full run (calls API)
 *   npx tsx scripts/test-content-generation.ts --dry-run     # Show what would be sent (no API calls)
 *
 * The 5 test documents:
 *   1. SFS 1977:1160  Arbetsmiljölag        (Arbetsmiljö — core law)
 *   2. SFS 1998:808   Miljöbalk             (Miljö — large, complex law)
 *   3. SFS 2008:567   Diskrimineringslag    (HR — different domain)
 *   4. SFS 2010:1011  Brandfarliga varor    (Safety — medium size)
 *   5. SFS 1995:1554  Årsredovisningslag    (Financial — different domain)
 *
 * After running, compare:
 *   - AI Summering  vs  Notisum notisumComment  (should both be neutral/descriptive)
 *   - AI Kommentar  vs  Notisum summaryText     (should both be "Vi ska..." voice)
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import fs from 'fs'
import { PrismaClient } from '@prisma/client'
import Anthropic from '@anthropic-ai/sdk'
import {
  buildSystemPrompt,
  buildDocumentContext,
  getSourceText,
  type DocumentContext,
} from '../lib/ai/prompts/document-content'

const prisma = new PrismaClient()

const ALL_TEST_DOCUMENTS = [
  'SFS 1977:1160',
  'SFS 1998:808',
  'SFS 2008:567',
  'SFS 2010:1011',
  'SFS 1995:1554',
]

// Support --only SFS 1977:1160 to run for a single document
const onlyIdx = process.argv.indexOf('--only')
const TEST_DOCUMENTS =
  onlyIdx !== -1 && process.argv[onlyIdx + 1]
    ? [process.argv[onlyIdx + 1]!]
    : ALL_TEST_DOCUMENTS

const MODEL = process.env.CONTENT_GENERATION_MODEL || 'claude-opus-4-6'
const MAX_TOKENS = 2048
const DRY_RUN = process.argv.includes('--dry-run')

// ============================================================================
// Load Notisum reference data
// ============================================================================

interface NotisumDoc {
  sfsNumber: string
  documentName: string
  notisumComment: string
  summaryText: string
}

function loadNotisumReference(): Map<string, NotisumDoc> {
  const data = JSON.parse(
    fs.readFileSync('data/notisum-amnesfokus/notisum-full-data.json', 'utf-8')
  )

  const map = new Map<string, NotisumDoc>()

  for (const list of data.laglistor) {
    for (const sec of list.sections) {
      for (const doc of sec.documents) {
        if (
          ALL_TEST_DOCUMENTS.includes(doc.sfsNumber) &&
          !map.has(doc.sfsNumber)
        ) {
          map.set(doc.sfsNumber, {
            sfsNumber: doc.sfsNumber,
            documentName: doc.documentName,
            notisumComment: doc.notisumComment || '',
            summaryText: doc.summaryText || '',
          })
        }
      }
    }
  }

  return map
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('=== Content Generation Pipeline — E2E Test (5 documents) ===')
  console.log(`Model: ${MODEL}`)
  console.log(`Dry run: ${DRY_RUN}`)
  console.log('')

  // 1. Load Notisum reference
  const notisumRef = loadNotisumReference()
  console.log(`Loaded ${notisumRef.size} Notisum references`)

  // 2. Fetch test documents from DB
  const documents = await prisma.legalDocument.findMany({
    where: { document_number: { in: TEST_DOCUMENTS } },
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
  })

  console.log(
    `Found ${documents.length}/${TEST_DOCUMENTS.length} documents in database`
  )

  for (const num of TEST_DOCUMENTS) {
    const found = documents.find((d) => d.document_number === num)
    if (!found) {
      console.log(`  ✗ ${num} — NOT IN DATABASE`)
    } else {
      const src = getSourceText(found)
      console.log(
        `  ✓ ${num} — ${found.title.substring(0, 40)} | source: ${src ? `${src.length} chars` : 'NONE'} | amendments: ${found.base_amendments.length}`
      )
    }
  }

  const docsWithSource = documents.filter((d) => getSourceText(d) !== null)
  if (docsWithSource.length === 0) {
    console.log('\n✗ No documents with source text found. Cannot proceed.')
    await prisma.$disconnect()
    return
  }

  // 3. Build contexts (show what will be sent to the LLM)
  const systemPrompt = buildSystemPrompt()
  console.log(`\nSystem prompt length: ${systemPrompt.length} chars`)

  const contexts: Array<{
    docNumber: string
    docId: string
    title: string
    context: string
    sourceLength: number
  }> = []

  for (const doc of docsWithSource) {
    const sourceText = getSourceText(doc)!
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

    const userMessage = buildDocumentContext(ctx)
    contexts.push({
      docNumber: doc.document_number,
      docId: doc.id,
      title: doc.title,
      context: userMessage,
      sourceLength: sourceText.length,
    })

    console.log(
      `\n[${doc.document_number}] Context: ${userMessage.length} chars (source: ${sourceText.length} chars, amendments: ${ctx.amendments.length})`
    )
  }

  if (DRY_RUN) {
    console.log('\n=== DRY RUN — Stopping before API calls ===')
    console.log(
      `Would send ${contexts.length} requests to ${MODEL} (max_tokens: ${MAX_TOKENS})`
    )
    const totalInput = contexts.reduce((s, c) => s + c.context.length, 0)
    console.log(
      `Estimated total input: ~${Math.round(totalInput / 4)} tokens (${totalInput} chars)`
    )
    await prisma.$disconnect()
    return
  }

  // 4. Call the API (direct Messages, not Batch — for immediate results)
  const anthropic = new Anthropic()
  const results: Array<{
    docNumber: string
    docId: string
    title: string
    summering: string
    kommentar: string
    inputTokens: number
    outputTokens: number
  }> = []

  console.log('\n=== Generating content (direct API, not batch) ===')

  for (const ctx of contexts) {
    console.log(`\nGenerating for ${ctx.docNumber}...`)
    const startTime = Date.now()

    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: ctx.context }],
      })

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        console.log(`  ✗ No text response (${elapsed}s)`)
        continue
      }

      // Parse JSON response
      let parsed: { summering: string; kommentar: string }
      try {
        let jsonText = textBlock.text.trim()
        if (jsonText.startsWith('```')) {
          jsonText = jsonText
            .replace(/^```(?:json)?\n?/, '')
            .replace(/\n?```$/, '')
        }
        parsed = JSON.parse(jsonText)
      } catch {
        console.log(`  ✗ JSON parse failed (${elapsed}s)`)
        console.log(`  Raw: ${textBlock.text.substring(0, 200)}...`)
        continue
      }

      console.log(
        `  ✓ Generated in ${elapsed}s (${response.usage.input_tokens} in / ${response.usage.output_tokens} out)`
      )

      results.push({
        docNumber: ctx.docNumber,
        docId: ctx.docId,
        title: ctx.title,
        summering: parsed.summering,
        kommentar: parsed.kommentar,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      })
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(
        `  ✗ API error (${elapsed}s): ${error instanceof Error ? error.message : error}`
      )
    }
  }

  // 5. Comparison report
  console.log('\n' + '='.repeat(80))
  console.log('COMPARISON REPORT: AI Generated vs Notisum Reference')
  console.log('='.repeat(80))

  let totalInputTokens = 0
  let totalOutputTokens = 0

  for (const result of results) {
    const ref = notisumRef.get(result.docNumber)

    console.log(`\n${'─'.repeat(80)}`)
    console.log(`📄 ${result.docNumber} — ${result.title}`)
    console.log(`${'─'.repeat(80)}`)

    // Summering comparison
    console.log('\n  ┌─ AI SUMMERING (generated)')
    console.log(`  │ ${result.summering}`)
    console.log('  │')
    if (ref) {
      console.log('  ├─ NOTISUM notisumComment (reference)')
      console.log(`  │ ${ref.notisumComment}`)
    }
    console.log('  └─')

    // Kommentar comparison
    console.log('\n  ┌─ AI KOMMENTAR (generated)')
    console.log(`  │ ${result.kommentar}`)
    console.log('  │')
    if (ref) {
      console.log('  ├─ NOTISUM summaryText (reference)')
      console.log(`  │ ${ref.summaryText}`)
    }
    console.log('  └─')

    // Quick quality check
    const issues: string[] = []
    if (/\bVi ska\b/i.test(result.summering)) {
      issues.push('Summering contains "Vi ska" (should be neutral)')
    }
    if (
      !/^(Vi ska|Vi behöver|Vi är skyldiga|Vi måste|Vi får inte|Organisationen|Om vi)/i.test(
        result.kommentar
      )
    ) {
      issues.push('Kommentar does not start with obligation phrasing')
    }
    if (result.summering.length === 0) issues.push('Empty Summering')
    if (result.kommentar.length === 0) issues.push('Empty Kommentar')

    if (issues.length > 0) {
      console.log(`\n  ⚠ Quality issues: ${issues.join(', ')}`)
    } else {
      console.log('\n  ✓ Quality checks passed')
    }

    totalInputTokens += result.inputTokens
    totalOutputTokens += result.outputTokens
  }

  // 6. Cost summary
  const inputCost = totalInputTokens * (15.0 / 1_000_000) // Standard Opus 4.6 rate (not batch)
  const outputCost = totalOutputTokens * (75.0 / 1_000_000)
  const totalCost = inputCost + outputCost

  console.log(`\n${'='.repeat(80)}`)
  console.log('COST SUMMARY (standard API rates, not batch)')
  console.log(`${'='.repeat(80)}`)
  console.log(
    `Input:  ${totalInputTokens.toLocaleString()} tokens = $${inputCost.toFixed(4)}`
  )
  console.log(
    `Output: ${totalOutputTokens.toLocaleString()} tokens = $${outputCost.toFixed(4)}`
  )
  console.log(`Total:  $${totalCost.toFixed(4)}`)
  console.log(
    `Average per document: $${(totalCost / results.length).toFixed(4)}`
  )
  console.log(
    `\nNote: Batch API would be 50% cheaper ($${(totalCost / 2).toFixed(4)} total)`
  )

  // 7. Optionally save to DB
  if (results.length > 0) {
    console.log(`\n💾 Saving ${results.length} results to database...`)
    for (const result of results) {
      await prisma.legalDocument.update({
        where: { id: result.docId },
        data: {
          summary: result.summering,
          kommentar: result.kommentar,
          summering_generated_by: MODEL,
          kommentar_generated_by: MODEL,
        },
      })
      console.log(`  ✓ ${result.docNumber} saved`)
    }
  }

  console.log('\n✓ Done.')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
