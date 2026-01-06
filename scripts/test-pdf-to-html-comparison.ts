/**
 * Test PDF to HTML conversion: Opus vs Sonnet comparison
 *
 * Runs the same 10 PDFs through both models and saves results for comparison.
 */

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

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

interface ConversionResult {
  model: string
  sfsNumber: string
  inputTokens: number
  outputTokens: number
  durationMs: number
  htmlLength: number
  success: boolean
  error?: string
}

async function convertPdf(
  pdfPath: string,
  model: 'claude-opus-4-20250514' | 'claude-sonnet-4-20250514'
): Promise<{ html: string; result: ConversionResult }> {
  const sfsNumber = path.basename(pdfPath, '.pdf')
  const startTime = Date.now()

  try {
    const pdfBuffer = fs.readFileSync(pdfPath)
    const pdfBase64 = pdfBuffer.toString('base64')

    // Use streaming to avoid timeout errors
    const stream = await anthropic.messages.stream({
      model,
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
    })

    // Collect streamed response
    let html = ''
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        html += event.delta.text
        process.stdout.write('.') // Progress indicator
      }
    }

    const response = await stream.finalMessage()
    const durationMs = Date.now() - startTime

    // Clean markdown fences if present
    let cleanHtml = html
    if (cleanHtml.startsWith('```html')) cleanHtml = cleanHtml.slice(7)
    else if (cleanHtml.startsWith('```')) cleanHtml = cleanHtml.slice(3)
    if (cleanHtml.endsWith('```')) cleanHtml = cleanHtml.slice(0, -3)
    cleanHtml = cleanHtml.trim()

    return {
      html: cleanHtml,
      result: {
        model: model.includes('opus') ? 'opus' : 'sonnet',
        sfsNumber,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        durationMs,
        htmlLength: cleanHtml.length,
        success: true,
      },
    }
  } catch (error) {
    return {
      html: '',
      result: {
        model: model.includes('opus') ? 'opus' : 'sonnet',
        sfsNumber,
        inputTokens: 0,
        outputTokens: 0,
        durationMs: Date.now() - startTime,
        htmlLength: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

async function main() {
  const pdfDir = path.join(__dirname, '../tests/fixtures/amendment-pdfs')
  const outputDir = path.join(__dirname, '../test-results/pdf-comparison')

  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true })

  // Get test PDFs (mix of simple and complex)
  const testPdfs = [
    'SFS2024-804.pdf',      // Simple 1-page repeal
    'SFS2023-349.pdf',      // 1-page with section content
    'SFS2020-449.pdf',      // Medium complexity
    'SFS2019-614.pdf',      // Medium complexity
    'SFS2022-1109.pdf',     // Medium complexity
    'SFS2025-1458.pdf',     // Recent, likely complex
    'SFS2025-1461.pdf',     // Complex 14-page
    'SFS2010-1225-rkrattsdb.pdf',  // Older format
    'SFS2008-934-rkrattsdb.pdf',   // Older format
    'SFS2003-365-rkrattsdb.pdf',   // Older format
  ]

  const results: ConversionResult[] = []

  console.log('=== PDF to HTML Comparison Test ===\n')
  console.log(`Testing ${testPdfs.length} PDFs with Opus and Sonnet\n`)

  for (const pdfFile of testPdfs) {
    const pdfPath = path.join(pdfDir, pdfFile)

    if (!fs.existsSync(pdfPath)) {
      console.log(`Skipping ${pdfFile} - not found`)
      continue
    }

    const sfsNumber = pdfFile.replace('.pdf', '')
    console.log(`\nProcessing: ${sfsNumber}`)

    // Run Opus
    console.log('  Opus...')
    const opusResult = await convertPdf(pdfPath, 'claude-opus-4-20250514')
    results.push(opusResult.result)
    if (opusResult.result.success) {
      fs.writeFileSync(
        path.join(outputDir, `${sfsNumber}-opus.html`),
        opusResult.html
      )
      console.log(`    ✓ ${opusResult.result.inputTokens} in / ${opusResult.result.outputTokens} out (${opusResult.result.durationMs}ms)`)
    } else {
      console.log(`    ✗ Error: ${opusResult.result.error}`)
    }

    // Run Sonnet
    console.log('  Sonnet...')
    const sonnetResult = await convertPdf(pdfPath, 'claude-sonnet-4-20250514')
    results.push(sonnetResult.result)
    if (sonnetResult.result.success) {
      fs.writeFileSync(
        path.join(outputDir, `${sfsNumber}-sonnet.html`),
        sonnetResult.html
      )
      console.log(`    ✓ ${sonnetResult.result.inputTokens} in / ${sonnetResult.result.outputTokens} out (${sonnetResult.result.durationMs}ms)`)
    } else {
      console.log(`    ✗ Error: ${sonnetResult.result.error}`)
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 1000))
  }

  // Generate summary report
  console.log('\n\n=== SUMMARY ===\n')

  const opusResults = results.filter(r => r.model === 'opus' && r.success)
  const sonnetResults = results.filter(r => r.model === 'sonnet' && r.success)

  const opusTotals = {
    inputTokens: opusResults.reduce((sum, r) => sum + r.inputTokens, 0),
    outputTokens: opusResults.reduce((sum, r) => sum + r.outputTokens, 0),
    duration: opusResults.reduce((sum, r) => sum + r.durationMs, 0),
  }

  const sonnetTotals = {
    inputTokens: sonnetResults.reduce((sum, r) => sum + r.inputTokens, 0),
    outputTokens: sonnetResults.reduce((sum, r) => sum + r.outputTokens, 0),
    duration: sonnetResults.reduce((sum, r) => sum + r.durationMs, 0),
  }

  // Calculate costs (standard API pricing)
  const opusCost = (opusTotals.inputTokens * 15 + opusTotals.outputTokens * 75) / 1_000_000
  const sonnetCost = (sonnetTotals.inputTokens * 3 + sonnetTotals.outputTokens * 15) / 1_000_000

  console.log('Model     | Input Tok | Output Tok | Duration | Est. Cost')
  console.log('----------|-----------|------------|----------|----------')
  console.log(`Opus      | ${opusTotals.inputTokens.toLocaleString().padStart(9)} | ${opusTotals.outputTokens.toLocaleString().padStart(10)} | ${(opusTotals.duration/1000).toFixed(1).padStart(6)}s | $${opusCost.toFixed(2)}`)
  console.log(`Sonnet    | ${sonnetTotals.inputTokens.toLocaleString().padStart(9)} | ${sonnetTotals.outputTokens.toLocaleString().padStart(10)} | ${(sonnetTotals.duration/1000).toFixed(1).padStart(6)}s | $${sonnetCost.toFixed(2)}`)

  // Save results JSON
  fs.writeFileSync(
    path.join(outputDir, 'results.json'),
    JSON.stringify({ results, opusTotals, sonnetTotals, opusCost, sonnetCost }, null, 2)
  )

  console.log(`\nResults saved to: ${outputDir}`)
  console.log('\nNext: Manually compare HTML output quality for accuracy')
}

main().catch(console.error)
