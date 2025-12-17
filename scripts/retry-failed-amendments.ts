/* eslint-disable no-console */
/**
 * Retry Failed Amendment Parsing
 *
 * This script retries parsing for amendments that failed with:
 * 1. Missing baseLaw.sfsNumber - uses a lookup table for well-known Swedish law codes
 * 2. JSON parsing errors - uses improved prompts and JSON repair
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { prisma } from '../lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import type {
  ParsedAmendmentLLM,
  AffectedSectionLLM,
} from '../lib/external/llm-amendment-parser'

// ============================================================================
// Well-known Swedish law codes (balkar) lookup table
// ============================================================================

const WELL_KNOWN_BALKAR: Record<string, string> = {
  // Main balkar
  brottsbalken: '1962:700',
  rättegångsbalken: '1942:740',
  miljöbalken: '1998:808',
  socialförsäkringsbalken: '2010:110',
  föräldrabalken: '1949:381',
  ärvdabalken: '1958:637',
  jordabalken: '1970:994',
  handelsbalken: '1736:0123 2',
  utsökningsbalken: '1981:774',
  konkurslagen: '1987:672',
  sjölagen: '1994:1009',
  luftfartslagen: '2010:500',
  'plan- och bygglagen': '2010:900',
  'offentlighets- och sekretesslagen': '2009:400',
  skatteförfarandelagen: '2011:1244',
  inkomstskattelagen: '1999:1229',
  mervärdesskattelagen: '2023:200',
  aktiebolagslagen: '2005:551',
  'lagen om ekonomiska föreningar': '2018:672',
  utlänningslagen: '2005:716',
  patentlagen: '1967:837',
  varumärkeslagen: '2010:1877',
  upphovsrättslagen: '1960:729',
  'lagen om upphovsrätt': '1960:729',
}

function lookupBaseLawSfs(title: string): string | null {
  const lowerTitle = title.toLowerCase()

  for (const [name, sfs] of Object.entries(WELL_KNOWN_BALKAR)) {
    if (lowerTitle.includes(name.toLowerCase())) {
      return sfs
    }
  }

  // Try to extract SFS from title pattern like "(1977:1160)"
  const sfsMatch = title.match(/\((\d{4}:\d+)\)/)
  if (sfsMatch) {
    return sfsMatch[1]
  }

  return null
}

// ============================================================================
// Improved prompt with balkar hint
// ============================================================================

const IMPROVED_PARSE_PROMPT = `You are an expert Swedish legal document parser. Analyze this amendment document (ändringsförfattning) and extract ALL structured data.

<document>
{fullText}
</document>

<known_law_codes>
These are well-known Swedish law codes and their SFS numbers:
- brottsbalken: 1962:700
- rättegångsbalken: 1942:740
- miljöbalken: 1998:808
- socialförsäkringsbalken: 2010:110
- föräldrabalken: 1949:381
- ärvdabalken: 1958:637
- jordabalken: 1970:994
- utsökningsbalken: 1981:774
- plan- och bygglagen: 2010:900
- offentlighets- och sekretesslagen: 2009:400
- skatteförfarandelagen: 2011:1244
- inkomstskattelagen: 1999:1229
- aktiebolagslagen: 2005:551
- utlänningslagen: 2005:716
</known_law_codes>

Extract the following and return as JSON:

{
  "baseLaw": {
    "name": "law name in Swedish (e.g., brottsbalken)",
    "sfsNumber": "YYYY:NNN format (e.g., 1962:700) - USE THE LOOKUP TABLE ABOVE FOR WELL-KNOWN LAWS"
  },
  "title": "Full document title or null",
  "effectiveDate": "YYYY-MM-DD or null",
  "publicationDate": "YYYY-MM-DD or null",
  "affectedSections": [
    {
      "chapter": "chapter number as string or null",
      "section": "section number as string",
      "changeType": "amended|repealed|new|renumbered",
      "oldNumber": "for renumbering only",
      "description": "brief description",
      "newText": "the new text content or null"
    }
  ],
  "transitionalProvisions": [],
  "confidence": 0.9
}

CRITICAL RULES:
1. For well-known Swedish law codes (balkar), use the SFS numbers from the lookup table above
2. Expand section ranges: "15-20 §§" → individual entries for 15, 16, 17, 18, 19, 20
3. "9 kap. 2 och 5 §§" means BOTH sections 2 AND 5 are in chapter 9
4. Change types: "ska ha följande lydelse" → amended, "upphävs" → repealed, "införas" → new
5. Convert dates: "1 juli 2022" → "2022-07-01"

Return ONLY valid JSON. No markdown, no explanations, no code blocks.`

// ============================================================================
// JSON repair utilities
// ============================================================================

function repairJson(text: string): string {
  let json = text.trim()

  // Remove markdown code blocks
  if (json.startsWith('```')) {
    json = json.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  // Try to find JSON object boundaries
  const firstBrace = json.indexOf('{')
  const lastBrace = json.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    json = json.slice(firstBrace, lastBrace + 1)
  }

  // Fix common issues
  // 1. Trailing commas before closing brackets
  json = json.replace(/,\s*([}\]])/g, '$1')

  // 2. Missing closing brackets - count and add
  const openBraces = (json.match(/{/g) || []).length
  const closeBraces = (json.match(/}/g) || []).length
  const openBrackets = (json.match(/\[/g) || []).length
  const closeBrackets = (json.match(/\]/g) || []).length

  // Add missing closing brackets/braces
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    json += ']'
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    json += '}'
  }

  // 3. Unterminated strings - find and close them
  // This is tricky, but we can try to detect obvious cases
  const lines = json.split('\n')
  const repairedLines = lines.map((line) => {
    // Count quotes
    const quotes = (line.match(/"/g) || []).length
    // If odd number of quotes and line doesn't end with ", add one
    if (quotes % 2 === 1 && !line.trim().endsWith('"')) {
      // Find where string starts and close it
      const lastQuoteIndex = line.lastIndexOf('"')
      if (lastQuoteIndex !== -1) {
        // Check if this looks like an unterminated string value
        const afterQuote = line.slice(lastQuoteIndex + 1)
        if (
          !afterQuote.includes(':') &&
          !afterQuote.includes(',') &&
          !afterQuote.includes('}')
        ) {
          return line + '"'
        }
      }
    }
    return line
  })

  return repairedLines.join('\n')
}

// ============================================================================
// Parse with improved handling
// ============================================================================

async function parseWithRetry(
  fullText: string,
  title: string,
  client: Anthropic
): Promise<ParsedAmendmentLLM> {
  const prompt = IMPROVED_PARSE_PROMPT.replace('{fullText}', fullText)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000, // Very high to handle long amendments
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from LLM')
  }

  let jsonText = textBlock.text

  // Try to parse, with JSON repair on failure
  let parsed: ParsedAmendmentLLM
  try {
    jsonText = repairJson(jsonText)
    parsed = JSON.parse(jsonText)
  } catch {
    // Second attempt with more aggressive repair
    jsonText = repairJson(textBlock.text)
    try {
      parsed = JSON.parse(jsonText)
    } catch (e) {
      throw new Error(
        `JSON parse failed: ${e instanceof Error ? e.message : e}`
      )
    }
  }

  // If baseLaw.sfsNumber is missing, try lookup
  if (!parsed.baseLaw?.sfsNumber) {
    const lookedUp = lookupBaseLawSfs(title)
    if (lookedUp) {
      parsed.baseLaw = {
        name: parsed.baseLaw?.name || title,
        sfsNumber: lookedUp,
      }
    } else {
      throw new Error(`Could not determine baseLaw.sfsNumber for: ${title}`)
    }
  }

  // Validate
  if (!Array.isArray(parsed.affectedSections)) {
    parsed.affectedSections = []
  }

  // Normalize sections
  parsed.affectedSections = parsed.affectedSections.map(
    (section: AffectedSectionLLM) => ({
      chapter: section.chapter || null,
      section: String(section.section),
      changeType: section.changeType,
      oldNumber: section.oldNumber || null,
      description: section.description || '',
      newText: section.newText || null,
    })
  )

  if (typeof parsed.confidence !== 'number') {
    parsed.confidence = 0.8
  }

  return parsed
}

// ============================================================================
// Main retry logic
// ============================================================================

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const limit = process.argv.includes('--limit')
    ? parseInt(process.argv[process.argv.indexOf('--limit') + 1], 10)
    : undefined

  console.log('='.repeat(60))
  console.log('Retry Failed Amendment Parsing')
  console.log('='.repeat(60))
  console.log(`Dry run: ${dryRun}`)
  if (limit) console.log(`Limit: ${limit}`)
  console.log('')

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  // Get all failed amendments
  const failed = await prisma.amendmentDocument.findMany({
    where: { parse_status: 'FAILED' },
    select: {
      id: true,
      sfs_number: true,
      title: true,
      full_text: true,
      parse_error: true,
    },
    orderBy: { sfs_number: 'asc' },
    ...(limit ? { take: limit } : {}),
  })

  console.log(`Found ${failed.length} failed amendments to retry\n`)

  let success = 0
  let stillFailed = 0

  for (const doc of failed) {
    console.log(
      `Processing ${doc.sfs_number}: ${doc.title?.substring(0, 50)}...`
    )

    if (!doc.full_text) {
      console.log(`  ⚠️  No full_text, skipping`)
      stillFailed++
      continue
    }

    try {
      const parsed = await parseWithRetry(
        doc.full_text,
        doc.title || '',
        client
      )

      if (dryRun) {
        console.log(`  [DRY RUN] Would update with:`)
        console.log(`    baseLaw: ${parsed.baseLaw.sfsNumber}`)
        console.log(`    sections: ${parsed.affectedSections.length}`)
        console.log(`    confidence: ${parsed.confidence}`)
        success++
      } else {
        // Delete old section changes
        await prisma.sectionChange.deleteMany({
          where: { amendment_id: doc.id },
        })

        // Update the amendment document
        await prisma.amendmentDocument.update({
          where: { id: doc.id },
          data: {
            base_law_sfs: parsed.baseLaw.sfsNumber,
            base_law_name: parsed.baseLaw.name,
            effective_date: parsed.effectiveDate
              ? new Date(parsed.effectiveDate)
              : null,
            publication_date: parsed.publicationDate
              ? new Date(parsed.publicationDate)
              : null,
            parse_status: 'COMPLETED',
            parse_error: null,
            confidence: parsed.confidence,
            parsed_at: new Date(),
            section_changes: {
              create: parsed.affectedSections.map((section) => ({
                chapter: section.chapter,
                section: section.section,
                change_type: section.changeType.toUpperCase() as
                  | 'AMENDED'
                  | 'REPEALED'
                  | 'NEW'
                  | 'RENUMBERED',
                old_number: section.oldNumber,
                description: section.description,
                new_text: section.newText,
              })),
            },
          },
        })

        console.log(`  ✅ Success: ${parsed.affectedSections.length} sections`)
        success++
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.log(`  ❌ Still failed: ${errMsg.substring(0, 60)}`)

      if (!dryRun) {
        await prisma.amendmentDocument.update({
          where: { id: doc.id },
          data: {
            parse_error: `Retry failed: ${errMsg}`,
          },
        })
      }
      stillFailed++
    }

    // Rate limiting
    await new Promise((r) => setTimeout(r, 500))
  }

  console.log('')
  console.log('='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  console.log(`Success: ${success}`)
  console.log(`Still failed: ${stillFailed}`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
