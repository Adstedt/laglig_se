/**
 * PDF to Semantic HTML using Claude Vision
 *
 * Converts Swedish legal amendment PDFs directly to semantic HTML
 * by leveraging Claude's vision capabilities to understand document structure.
 */

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are an expert at converting Swedish legal documents (SFS - Svensk författningssamling) from PDF to semantic HTML.

Your task is to convert the provided PDF pages into clean, semantic HTML that accurately represents the document structure.

## Document Structure Rules

Swedish legal amendments (ändringsförfattningar) follow a strict structure:

1. **Document Header**
   - Title: "Lag om ändring i [law name] ([base SFS number])"
   - SFS number (e.g., "2025:1461")
   - Publication date
   - Introductory text listing what sections are changed

2. **Chapters (Kapitel)**
   - Marked as "X kap." (e.g., "2 kap.", "7 kap.")
   - Use <h2> for chapter headers

3. **Sections (Paragrafer)**
   - Marked as "X §" (e.g., "1 §", "36 §", "27 a §")
   - May have footnote superscripts (e.g., "1 §³")
   - Use <h3> for section headers

4. **Group Headers (Rubrikeringar)**
   - Italic text introducing a group of related content
   - Examples: "Hybridenhet", "Värdet beträffande tilläggsskatt"
   - Use <h4 class="group-header"> with <em>

5. **Definition Lists**
   - Term followed by reference: "term i X §" or "term i X kap. Y §"
   - One definition per line
   - Use <ul class="definition-list"> with no bullets

6. **Numbered Lists**
   - Items starting with "1.", "2.", etc.
   - May have sub-items with "a)", "b)", etc.
   - Use <ol> and nested <ol type="a"> for sub-items

7. **Transition Provisions (Övergångsbestämmelser)**
   - At document end, starting with "1. Denna lag träder i kraft..."
   - Use <footer class="transition-provisions">

8. **Footnotes**
   - Appear at page bottom in PDF
   - Reference legislative history (Prop., Senaste lydelse, etc.)
   - Use <aside class="footnotes"> with <dl>

## HTML Output Requirements

1. **Preserve ALL text exactly** - Never modify, summarize, or omit any legal text
2. **Use semantic elements** - article, section, header, footer, aside, h1-h4, p, ol, ul, dl
3. **Add meaningful classes** for styling hooks
4. **Include data attributes** for metadata (sfs number, section refs)
5. **Separate footnotes** from main content
6. **Handle cross-references** - Mark internal references like "35 § första stycket"

## Output Format

Return ONLY the HTML document, no explanations. Start with <!DOCTYPE html>.`

const USER_PROMPT = `Convert this Swedish legal amendment PDF to semantic HTML.

Important:
- Preserve ALL text exactly as written in the PDF
- Identify and properly structure: chapters, sections, group headers, lists, footnotes
- The definition list in section 1 § has approximately 74 terms - include ALL of them
- Footnotes appear at the bottom of PDF pages - move them to a footnotes section
- Transition provisions at the end should be in a footer section

Output clean, semantic HTML that a legal professional would find readable and navigable.`

async function convertPdfToHtml(pdfPath: string): Promise<string> {
  console.log(`Reading PDF: ${pdfPath}`)

  const pdfBuffer = fs.readFileSync(pdfPath)
  const pdfBase64 = pdfBuffer.toString('base64')

  console.log(`PDF size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`)
  console.log('Sending to Claude Vision...')

  const startTime = Date.now()

  // Use streaming for long operations
  const stream = await anthropic.messages.stream({
    model: 'claude-opus-4-20250514',
    max_tokens: 16000,
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
  let fullText = ''
  let chunkCount = 0

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text
      chunkCount++
      if (chunkCount % 50 === 0) {
        process.stdout.write('.')
      }
    }
  }
  console.log('') // newline after dots

  const finalMessage = await stream.finalMessage()

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`Response received in ${duration}s`)

  // Log token usage
  console.log(`Input tokens: ${finalMessage.usage.input_tokens}`)
  console.log(`Output tokens: ${finalMessage.usage.output_tokens}`)

  return fullText
}

async function main() {
  const pdfPath = path.join(__dirname, '../test-results/SFS2025-1461.pdf')
  const outputPath = path.join(__dirname, '../test-results/SFS2025-1461-vision.html')
  const promptPath = path.join(__dirname, '../test-results/pdf-to-html-prompt.md')

  // Save the prompt for review
  const fullPrompt = `# PDF to HTML Vision Prompt

## System Prompt

\`\`\`
${SYSTEM_PROMPT}
\`\`\`

## User Prompt

\`\`\`
${USER_PROMPT}
\`\`\`
`

  fs.writeFileSync(promptPath, fullPrompt)
  console.log(`Prompt saved to: ${promptPath}`)

  try {
    const html = await convertPdfToHtml(pdfPath)

    // Clean up the response (remove markdown code fences if present)
    let cleanHtml = html
    if (html.startsWith('```html')) {
      cleanHtml = html.slice(7)
    } else if (html.startsWith('```')) {
      cleanHtml = html.slice(3)
    }
    if (cleanHtml.endsWith('```')) {
      cleanHtml = cleanHtml.slice(0, -3)
    }
    cleanHtml = cleanHtml.trim()

    fs.writeFileSync(outputPath, cleanHtml)
    console.log(`HTML saved to: ${outputPath}`)

    // Basic validation
    const sectionCount = (cleanHtml.match(/<h3/g) || []).length
    const listItemCount = (cleanHtml.match(/<li/g) || []).length
    console.log(`\nValidation:`)
    console.log(`  - Section headers (<h3>): ${sectionCount}`)
    console.log(`  - List items (<li>): ${listItemCount}`)
    console.log(`  - HTML length: ${cleanHtml.length} chars`)

  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
