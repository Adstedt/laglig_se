/**
 * Test PDF to HTML conversion using Batch API: Opus vs Sonnet
 *
 * Usage:
 *   pnpm tsx scripts/test-pdf-batch-comparison.ts submit   # Submit batch jobs
 *   pnpm tsx scripts/test-pdf-batch-comparison.ts status   # Check status
 *   pnpm tsx scripts/test-pdf-batch-comparison.ts results  # Download results
 */

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const OUTPUT_DIR = path.join(__dirname, '../test-results/pdf-batch-comparison')
const BATCH_IDS_FILE = path.join(OUTPUT_DIR, 'batch-ids.json')

const SYSTEM_PROMPT = `You are converting Swedish legal amendment PDFs (SFS - Svensk författningssamling) to minimal semantic HTML.

Rules:
1. Output ONLY valid HTML starting with <!DOCTYPE html>
2. Preserve ALL text exactly - never summarize or skip content
3. Use semantic elements: article, section, header, footer, aside, h1-h4, p, ol, ul, dl
4. Add data-sfs and data-section attributes for metadata
5. No CSS styling
6. Include all footnotes in an <aside> section`

const USER_PROMPT = `Convert this Swedish legal amendment PDF to minimal semantic HTML.
Include ALL text exactly as shown. Do not skip any sections, definitions, or footnotes.`

const TEST_PDFS = [
  'SFS2024-804.pdf',
  'SFS2023-349.pdf',
  'SFS2020-449.pdf',
  'SFS2019-614.pdf',
  'SFS2022-1109.pdf',
  'SFS2025-1458.pdf',
  'SFS2025-1461.pdf',
  'SFS2010-1225-rkrattsdb.pdf',
  'SFS2008-934-rkrattsdb.pdf',
  'SFS2003-365-rkrattsdb.pdf',
]

async function submitBatches() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const pdfDir = path.join(__dirname, '../tests/fixtures/amendment-pdfs')

  // Build requests for both models
  const opusRequests: Anthropic.Messages.BatchCreateParams.Request[] = []
  const sonnetRequests: Anthropic.Messages.BatchCreateParams.Request[] = []

  for (const pdfFile of TEST_PDFS) {
    const pdfPath = path.join(pdfDir, pdfFile)
    if (!fs.existsSync(pdfPath)) {
      console.log(`Skipping ${pdfFile} - not found`)
      continue
    }

    const sfsNumber = pdfFile.replace('.pdf', '')
    const pdfBuffer = fs.readFileSync(pdfPath)
    const pdfBase64 = pdfBuffer.toString('base64')
    console.log(
      `Prepared: ${sfsNumber} (${(pdfBuffer.length / 1024).toFixed(0)} KB)`
    )

    const messageParams: Anthropic.Messages.MessageCreateParamsNonStreaming = {
      model: 'claude-opus-4-20250514', // Will be overridden per batch
      max_tokens: 32000,
      system: SYSTEM_PROMPT,
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
              text: USER_PROMPT,
            },
          ],
        },
      ],
    }

    opusRequests.push({
      custom_id: `opus-${sfsNumber}`,
      params: { ...messageParams, model: 'claude-opus-4-20250514' },
    })

    sonnetRequests.push({
      custom_id: `sonnet-${sfsNumber}`,
      params: { ...messageParams, model: 'claude-sonnet-4-20250514' },
    })
  }

  console.log(`\nSubmitting ${opusRequests.length} Opus requests...`)
  const opusBatch = await anthropic.messages.batches.create({
    requests: opusRequests,
  })
  console.log(`Opus batch ID: ${opusBatch.id}`)

  console.log(`\nSubmitting ${sonnetRequests.length} Sonnet requests...`)
  const sonnetBatch = await anthropic.messages.batches.create({
    requests: sonnetRequests,
  })
  console.log(`Sonnet batch ID: ${sonnetBatch.id}`)

  // Save batch IDs for later
  const batchIds = {
    opus: opusBatch.id,
    sonnet: sonnetBatch.id,
    submittedAt: new Date().toISOString(),
    documentCount: opusRequests.length,
  }
  fs.writeFileSync(BATCH_IDS_FILE, JSON.stringify(batchIds, null, 2))
  console.log(`\nBatch IDs saved to: ${BATCH_IDS_FILE}`)
  console.log(
    '\nRun "pnpm tsx scripts/test-pdf-batch-comparison.ts status" to check progress'
  )
}

async function checkStatus() {
  if (!fs.existsSync(BATCH_IDS_FILE)) {
    console.log('No batch IDs found. Run "submit" first.')
    return
  }

  const batchIds = JSON.parse(fs.readFileSync(BATCH_IDS_FILE, 'utf-8'))

  console.log('=== Batch Status ===\n')

  for (const [model, batchId] of Object.entries({
    opus: batchIds.opus,
    sonnet: batchIds.sonnet,
  })) {
    const batch = await anthropic.messages.batches.retrieve(batchId as string)
    console.log(`${model.toUpperCase()}:`)
    console.log(`  ID: ${batch.id}`)
    console.log(`  Status: ${batch.processing_status}`)
    console.log(`  Counts: ${JSON.stringify(batch.request_counts)}`)
    if (batch.ended_at) {
      console.log(`  Ended: ${batch.ended_at}`)
    }
    console.log('')
  }
}

async function downloadResults() {
  if (!fs.existsSync(BATCH_IDS_FILE)) {
    console.log('No batch IDs found. Run "submit" first.')
    return
  }

  const batchIds = JSON.parse(fs.readFileSync(BATCH_IDS_FILE, 'utf-8'))
  const results: Record<string, any> = { opus: {}, sonnet: {} }

  for (const [model, batchId] of Object.entries({
    opus: batchIds.opus,
    sonnet: batchIds.sonnet,
  })) {
    console.log(`\nDownloading ${model} results...`)
    const batch = await anthropic.messages.batches.retrieve(batchId as string)

    if (batch.processing_status !== 'ended') {
      console.log(
        `  Batch not finished yet. Status: ${batch.processing_status}`
      )
      continue
    }

    // Get results URL and fetch
    if (!batch.results_url) {
      console.log(`  No results URL available`)
      continue
    }

    // Fetch JSONL results from URL (needs auth header)
    const response = await fetch(batch.results_url, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
    })
    const text = await response.text()
    const lines = text.trim().split('\n')

    let totalInput = 0
    let totalOutput = 0

    for (const line of lines) {
      if (!line.trim()) continue
      const result = JSON.parse(line)
      const customId = result.custom_id
      if (!customId) {
        console.log(
          '  Skipping result without custom_id:',
          JSON.stringify(result).slice(0, 100)
        )
        continue
      }
      const sfsNumber = customId.replace(`${model}-`, '')

      if (result.result.type === 'succeeded') {
        const message = result.result.message
        const html =
          message.content[0].type === 'text' ? message.content[0].text : ''

        // Clean markdown fences
        let cleanHtml = html
        if (cleanHtml.startsWith('```html')) cleanHtml = cleanHtml.slice(7)
        else if (cleanHtml.startsWith('```')) cleanHtml = cleanHtml.slice(3)
        if (cleanHtml.endsWith('```')) cleanHtml = cleanHtml.slice(0, -3)
        cleanHtml = cleanHtml.trim()

        // Save HTML file
        fs.writeFileSync(
          path.join(OUTPUT_DIR, `${sfsNumber}-${model}.html`),
          cleanHtml
        )

        totalInput += message.usage.input_tokens
        totalOutput += message.usage.output_tokens

        results[model][sfsNumber] = {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          htmlLength: cleanHtml.length,
        }

        console.log(
          `  ✓ ${sfsNumber}: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`
        )
      } else {
        console.log(`  ✗ ${sfsNumber}: ${result.result.type}`)
        if (result.result.type === 'errored') {
          console.log(`    Error: ${result.result.error.message}`)
        }
      }
    }

    // Calculate cost (with 50% batch discount)
    const costPerMTokIn = model === 'opus' ? 7.5 : 1.5
    const costPerMTokOut = model === 'opus' ? 37.5 : 7.5
    const cost =
      (totalInput * costPerMTokIn + totalOutput * costPerMTokOut) / 1_000_000

    results[model].totals = {
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cost: cost.toFixed(4),
    }
  }

  // Save summary
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'results.json'),
    JSON.stringify(results, null, 2)
  )

  // Print summary
  console.log('\n=== SUMMARY ===\n')
  console.log('Model   | Input Tok | Output Tok | Cost (batch)')
  console.log('--------|-----------|------------|-------------')
  if (results.opus.totals) {
    console.log(
      `Opus    | ${results.opus.totals.inputTokens.toLocaleString().padStart(9)} | ${results.opus.totals.outputTokens.toLocaleString().padStart(10)} | $${results.opus.totals.cost}`
    )
  }
  if (results.sonnet.totals) {
    console.log(
      `Sonnet  | ${results.sonnet.totals.inputTokens.toLocaleString().padStart(9)} | ${results.sonnet.totals.outputTokens.toLocaleString().padStart(10)} | $${results.sonnet.totals.cost}`
    )
  }

  console.log(`\nHTML files saved to: ${OUTPUT_DIR}`)
}

// Main
const command = process.argv[2] || 'submit'

switch (command) {
  case 'submit':
    submitBatches().catch(console.error)
    break
  case 'status':
    checkStatus().catch(console.error)
    break
  case 'results':
    downloadResults().catch(console.error)
    break
  default:
    console.log(
      'Usage: pnpm tsx scripts/test-pdf-batch-comparison.ts [submit|status|results]'
    )
}
