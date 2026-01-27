/**
 * Test improved prompt for Sonnet to preserve definition formatting
 */

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Improved prompt with specific formatting instructions
const SYSTEM_PROMPT = `You are converting Swedish legal amendment PDFs (SFS - Svensk författningssamling) to minimal semantic HTML.

CRITICAL FORMATTING RULES:
1. Output ONLY valid HTML starting with <!DOCTYPE html>
2. Preserve ALL text EXACTLY as it appears - never summarize or skip content
3. Use semantic elements: article, section, header, footer, aside, h1-h4, p, ol, ul
4. No CSS styling

DEFINITION LISTS - IMPORTANT:
- Swedish legal definitions appear as "term i X §" (e.g., "balansvärde i 5 kap. 5 §")
- Keep each definition on a SINGLE LINE - do NOT split "term" and "i X §"
- Use <ul> with <li> for definition lists, NOT <dl>/<dt>/<dd>
- Example: <li>balansvärde i 5 kap. 5 §</li>

PRESERVE ORIGINAL FORMAT:
- Keep text exactly as shown in the PDF
- Do not restructure or reformat content
- Maintain the same line groupings as the original`

const USER_PROMPT = `Convert this Swedish legal amendment PDF to minimal semantic HTML.

IMPORTANT: For definition lists (like in 2 kap. 1 §), keep each "term i X §" as a single line item. Do NOT split them into separate elements.`

async function testImprovedPrompt() {
  const pdfPath = path.join(
    __dirname,
    '../tests/fixtures/amendment-pdfs/SFS2025-1461.pdf'
  )
  const outputPath = path.join(
    __dirname,
    '../test-results/pdf-batch-comparison/SFS2025-1461-sonnet-v2.html'
  )

  console.log('Testing improved Sonnet prompt on SFS2025-1461...')

  const pdfBuffer = fs.readFileSync(pdfPath)
  const pdfBase64 = pdfBuffer.toString('base64')

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
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

  let html = ''
  let chunks = 0
  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      html += event.delta.text
      chunks++
      if (chunks % 500 === 0) process.stdout.write('.')
    }
  }
  console.log(` (${chunks} chunks)`)

  const response = await stream.finalMessage()

  // Clean markdown fences
  let cleanHtml = html
  if (cleanHtml.startsWith('```html')) cleanHtml = cleanHtml.slice(7)
  else if (cleanHtml.startsWith('```')) cleanHtml = cleanHtml.slice(3)
  if (cleanHtml.endsWith('```')) cleanHtml = cleanHtml.slice(0, -3)
  cleanHtml = cleanHtml.trim()

  fs.writeFileSync(outputPath, cleanHtml)

  console.log(
    `Tokens: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`
  )
  console.log(`Saved to: ${outputPath}`)

  // Quick check - look for definition format
  const hasCorrectFormat =
    cleanHtml.includes('balansvärde i 5 kap. 5 §') ||
    cleanHtml.includes('>balansvärde i 5 kap. 5 §<')
  const hasSplitFormat =
    cleanHtml.includes('>balansvärde</') && cleanHtml.includes('>i 5 kap. 5 §<')

  console.log('\n=== FORMAT CHECK ===')
  console.log(`Single-line definitions: ${hasCorrectFormat ? '✓ YES' : '✗ NO'}`)
  console.log(
    `Split definitions: ${hasSplitFormat ? '✗ YES (bad)' : '✓ NO (good)'}`
  )
}

testImprovedPrompt().catch(console.error)
