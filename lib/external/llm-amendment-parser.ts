/**
 * LLM-Assisted Amendment Document Parser
 *
 * Story 2.13: Uses Claude to accurately parse complex Swedish amendment documents
 * that regex cannot handle (multi-section patterns, ranges, renumbering, etc.)
 */

import Anthropic from '@anthropic-ai/sdk'

// ============================================================================
// Types aligned with our database schema
// ============================================================================

export interface ParsedAmendmentLLM {
  // Base law being amended
  baseLaw: {
    name: string // e.g., "arbetsmiljölagen"
    sfsNumber: string // e.g., "1977:1160"
  }

  // Document metadata
  title: string | null // Full title: "Lag om ändring i arbetsmiljölagen (1977:1160)"
  effectiveDate: string | null // ISO format: "2022-07-25"
  publicationDate: string | null // ISO format: "2022-06-30"

  // All section changes
  affectedSections: AffectedSectionLLM[]

  // Transitional provisions (övergångsbestämmelser)
  transitionalProvisions: TransitionalProvision[]

  // Confidence score (0-1) - flag for review if low
  confidence: number
}

export interface AffectedSectionLLM {
  chapter: string | null // "7" for "7 kap."
  section: string // "15" or "2a"
  changeType: 'amended' | 'repealed' | 'new' | 'renumbered'
  oldNumber?: string | null // For renumbering: original section number
  description: string // Brief description of the change
  newText?: string | null // The new text content (if available)
}

export interface TransitionalProvision {
  description: string
  effectiveUntil?: string | null // Date when provision expires
  affectedSections?: string[] // Which sections it applies to
}

// ============================================================================
// The comprehensive parsing prompt
// ============================================================================

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
      "description": "kort beskrivning på svenska av ändringen (t.ex. 'ska ha följande lydelse' eller 'ny paragraf om...')",
      "newText": "the FULL new text of this section as it appears in the document (for amended/new sections)"
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

8. SECTION TEXT EXTRACTION (CRITICAL):
   - For AMENDED and NEW sections, extract the COMPLETE text content from the document
   - The newText field must contain the full paragraph text as it appears after the section header
   - Include everything from the section number until the next section or chapter begins
   - For REPEALED sections, newText should be null
   - This is essential for version reconstruction - do not skip text extraction

Return ONLY valid JSON. No markdown code blocks, no explanations.`

// ============================================================================
// Parser implementation
// ============================================================================

export interface LLMParserOptions {
  apiKey?: string
  model?: string
  maxRetries?: number
}

export async function parseAmendmentWithLLM(
  fullText: string,
  options: LLMParserOptions = {}
): Promise<ParsedAmendmentLLM> {
  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not set. Provide via options or environment variable.'
    )
  }

  const client = new Anthropic({ apiKey })
  const model = options.model || 'claude-sonnet-4-20250514'
  const maxRetries = options.maxRetries || 3

  const prompt = AMENDMENT_PARSE_PROMPT.replace('{fullText}', fullText)

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      })

      // Extract text from response
      const textBlock = response.content.find((block) => block.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text response from LLM')
      }

      // Parse JSON - handle potential markdown code blocks
      let jsonText = textBlock.text.trim()

      // Remove markdown code blocks if present
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }

      const parsed = JSON.parse(jsonText) as ParsedAmendmentLLM

      // Validate required fields
      if (!parsed.baseLaw?.sfsNumber) {
        throw new Error('Missing required field: baseLaw.sfsNumber')
      }
      if (!Array.isArray(parsed.affectedSections)) {
        throw new Error('Missing required field: affectedSections')
      }

      // Normalize section data
      parsed.affectedSections = parsed.affectedSections.map((section) => ({
        chapter: section.chapter || null,
        section: String(section.section),
        changeType: section.changeType,
        oldNumber: section.oldNumber || null,
        description: section.description || '',
        newText: section.newText || null,
      }))

      // Ensure confidence is set
      if (typeof parsed.confidence !== 'number') {
        parsed.confidence = 0.8 // Default if not provided
      }

      return parsed
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        )
      }
    }
  }

  throw new Error(
    `Failed to parse amendment after ${maxRetries} attempts: ${lastError?.message}`
  )
}

// ============================================================================
// Batch processing helper
// ============================================================================

export interface BatchParseResult {
  sfsNumber: string
  success: boolean
  result?: ParsedAmendmentLLM
  error?: string
}

export async function parseAmendmentsBatch(
  documents: Array<{ sfsNumber: string; fullText: string }>,
  options: LLMParserOptions & { concurrency?: number } = {}
): Promise<BatchParseResult[]> {
  const concurrency = options.concurrency || 5
  const results: BatchParseResult[] = []

  // Process in chunks to respect rate limits
  for (let i = 0; i < documents.length; i += concurrency) {
    const chunk = documents.slice(i, i + concurrency)

    const chunkResults = await Promise.all(
      chunk.map(async (doc) => {
        try {
          const result = await parseAmendmentWithLLM(doc.fullText, options)
          return {
            sfsNumber: doc.sfsNumber,
            success: true,
            result,
          }
        } catch (error) {
          return {
            sfsNumber: doc.sfsNumber,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      })
    )

    results.push(...chunkResults)

    // Rate limiting pause between chunks
    if (i + concurrency < documents.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  return results
}
