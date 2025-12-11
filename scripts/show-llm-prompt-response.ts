/**
 * Show the exact prompt sent to Claude and the raw response
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import Anthropic from '@anthropic-ai/sdk'
import { parsePdfFromPath } from '../lib/external/pdf-parser'
import * as path from 'path'

const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'amendment-pdfs')

// The exact prompt we send
const AMENDMENT_PARSE_PROMPT = `You are an expert Swedish legal document parser. Analyze this amendment document (ändringsförfattning) and extract ALL structured data.

<document>
{fullText}
</document>

Extract the following and return as JSON with these EXACT field names:

{
  "baseLaw": {
    "name": "law name in Swedish (e.g., arbetsmiljölagen)",
    "sfsNumber": "YYYY:NNN format (e.g., 1977:1160)"
  },
  "title": "Full document title or null",
  "effectiveDate": "YYYY-MM-DD or null",
  "publicationDate": "YYYY-MM-DD (from 'Utfärdad den X') or null",
  "affectedSections": [
    {
      "chapter": "chapter number as string or null if no chapter",
      "section": "section number as string (e.g., '15' or '2a')",
      "changeType": "amended|repealed|new|renumbered",
      "oldNumber": "for renumbering only: the old section number",
      "description": "brief description of what changed"
    }
  ],
  "transitionalProvisions": [
    {
      "description": "description of the transitional rule",
      "effectiveUntil": "YYYY-MM-DD or null",
      "affectedSections": ["list of section references"]
    }
  ],
  "confidence": 0.95
}

CRITICAL PARSING RULES:

1. SECTION RANGES: Expand "15–20 §§" into individual entries (15, 16, 17, 18, 19, 20)

2. MULTIPLE SECTIONS: Parse "2 och 5 §§" as TWO separate entries (section 2 AND section 5)

3. CHAPTER CONTEXT: "9 kap. 2 och 5 §§" means BOTH sections are in chapter 9

4. CHANGE TYPES:
   - "ska ha följande lydelse" → "amended"
   - "upphävs" or "ska upphävas" or "upphöra att gälla" → "repealed"
   - "nya paragrafer" or "införas" or "tillkommer" → "new"
   - "X § blir Y §" → "renumbered" (include oldNumber)

5. DATES:
   - effectiveDate: from "träder i kraft den X"
   - publicationDate: from "Utfärdad den X"
   - Convert Swedish dates: "1 juli 2022" → "2022-07-01"

6. TRANSITIONAL PROVISIONS (Övergångsbestämmelser):
   - Usually at the end of the document
   - May specify when old rules still apply
   - May have time limits

7. CONFIDENCE SCORE:
   - 0.95-1.0: Clear, unambiguous document
   - 0.8-0.95: Some complexity but confident
   - 0.6-0.8: Complex patterns, may need review
   - <0.6: Very complex or unclear, needs human review

Return ONLY valid JSON. No markdown code blocks, no explanations.`

async function main() {
  const testFile = process.argv[2] || 'SFS2022-1109.pdf'
  const filePath = path.join(FIXTURES_DIR, testFile)

  // Extract text from PDF
  const pdfResult = await parsePdfFromPath(filePath)
  const fullText = pdfResult.fullText

  // Build the prompt
  const prompt = AMENDMENT_PARSE_PROMPT.replace('{fullText}', fullText)

  console.log('=' .repeat(80))
  console.log('PROMPT SENT TO CLAUDE')
  console.log('='.repeat(80))
  console.log()
  console.log(prompt.substring(0, 2000))
  console.log('\n... [document text truncated for display] ...\n')
  console.log(prompt.substring(prompt.length - 500))
  console.log()
  console.log(`Total prompt length: ${prompt.length} characters`)
  console.log()

  // Call Claude
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const client = new Anthropic({ apiKey })

  console.log('='.repeat(80))
  console.log('CALLING CLAUDE SONNET...')
  console.log('='.repeat(80))

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  // Get raw response
  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response')
  }

  console.log()
  console.log('='.repeat(80))
  console.log('RAW RESPONSE FROM CLAUDE')
  console.log('='.repeat(80))
  console.log()
  console.log(textBlock.text)
  console.log()
  console.log('='.repeat(80))
  console.log('USAGE')
  console.log('='.repeat(80))
  console.log(`Input tokens: ${response.usage.input_tokens}`)
  console.log(`Output tokens: ${response.usage.output_tokens}`)
  console.log(`Estimated cost: $${((response.usage.input_tokens * 0.003 + response.usage.output_tokens * 0.015) / 1000).toFixed(4)}`)
}

main().catch(console.error)
