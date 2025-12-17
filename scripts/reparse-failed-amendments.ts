/**
 * Re-parse specific amendments that had JSON parsing failures
 * These amendments have section changes but no text extracted
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient, SectionChangeType } from '@prisma/client'
import Anthropic from '@anthropic-ai/sdk'

const prisma = new PrismaClient()

// The amendments that need re-parsing
const FAILED_AMENDMENTS = [
  'SFS 2003:365', // 0/21 with text - "Unterminated string in JSON"
  'SFS 2008:934', // 0/15 with text - "Unterminated string in JSON"
  'SFS 2013:610', // 0/26 with text - "Unterminated string in JSON"
]

interface ParsedSection {
  chapter: string | null
  section: string
  changeType: 'amended' | 'repealed' | 'new' | 'renumbered'
  oldNumber?: string | null
  description: string
  newText?: string | null
}

interface ParsedAmendment {
  baseLaw: { name: string; sfsNumber: string }
  title: string | null
  effectiveDate: string | null
  publicationDate: string | null
  affectedSections: ParsedSection[]
  transitionalProvisions: Array<{ description: string }>
  confidence: number
}

const PARSE_PROMPT = `You are an expert Swedish legal document parser. Analyze this amendment document and extract ALL structured data.

<document>
{fullText}
</document>

Extract and return as JSON:

{
  "baseLaw": { "name": "law name", "sfsNumber": "YYYY:NNN" },
  "title": "Full title or null",
  "effectiveDate": "YYYY-MM-DD or null",
  "publicationDate": "YYYY-MM-DD or null",
  "affectedSections": [
    {
      "chapter": "chapter number as string or null",
      "section": "section number (e.g., '15' or '2a')",
      "changeType": "amended|repealed|new|renumbered",
      "oldNumber": "for renumbering only",
      "description": "brief description in Swedish",
      "newText": "COMPLETE text of this section (for amended/new sections)"
    }
  ],
  "transitionalProvisions": [{ "description": "..." }],
  "confidence": 0.95
}

CRITICAL:
1. Expand section ranges: "15–20 §§" → 6 entries (15,16,17,18,19,20)
2. Parse "2 och 5 §§" as TWO entries
3. For AMENDED and NEW sections: extract the FULL text from the document
4. Look for section text after phrases like "ska ha följande lydelse"
5. Include all text until the next section header
6. Return ONLY valid JSON, no markdown blocks`

function mapChangeType(llmType: string): SectionChangeType {
  const map: Record<string, SectionChangeType> = {
    amended: 'AMENDED',
    repealed: 'REPEALED',
    new: 'NEW',
    renumbered: 'RENUMBERED',
  }
  return map[llmType] || 'AMENDED'
}

async function parseWithLLM(fullText: string): Promise<ParsedAmendment> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set')
  }

  const client = new Anthropic({ apiKey })
  const prompt = PARSE_PROMPT.replace('{fullText}', fullText)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000, // Increased from 4000
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from LLM')
  }

  let jsonText = textBlock.text.trim()

  // Remove markdown code blocks if present
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  return JSON.parse(jsonText) as ParsedAmendment
}

async function reparseAmendment(sfsNumber: string): Promise<void> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Re-parsing: ${sfsNumber}`)
  console.log('='.repeat(60))

  // Get amendment from database
  const amendment = await prisma.amendmentDocument.findUnique({
    where: { sfs_number: sfsNumber },
    include: { section_changes: true },
  })

  if (!amendment) {
    console.log(`  ERROR: Amendment not found in database`)
    return
  }

  if (!amendment.full_text) {
    console.log(`  ERROR: No full_text in database`)
    return
  }

  console.log(`  Current section changes: ${amendment.section_changes.length}`)
  console.log(
    `  With text: ${amendment.section_changes.filter((c) => c.new_text).length}`
  )
  console.log(`  Full text length: ${amendment.full_text.length} chars`)

  try {
    console.log(`  Calling LLM...`)
    const parsed = await parseWithLLM(amendment.full_text)

    console.log(`  LLM returned ${parsed.affectedSections.length} sections`)
    const withText = parsed.affectedSections.filter((s) => s.newText).length
    console.log(`  With text: ${withText}`)

    if (withText === 0) {
      console.log(`  WARNING: Still no text extracted!`)
      // Show a sample of what was returned
      if (parsed.affectedSections.length > 0) {
        console.log(
          `  Sample section:`,
          JSON.stringify(parsed.affectedSections[0], null, 2)
        )
      }
    }

    // Delete existing section changes
    await prisma.sectionChange.deleteMany({
      where: { amendment_id: amendment.id },
    })

    // Insert new section changes
    if (parsed.affectedSections.length > 0) {
      await prisma.sectionChange.createMany({
        data: parsed.affectedSections.map((section, index) => ({
          amendment_id: amendment.id,
          chapter: section.chapter || null,
          section: String(section.section),
          change_type: mapChangeType(section.changeType),
          old_number: section.oldNumber || null,
          description: section.description || '',
          new_text: section.newText || null,
          sort_order: index,
        })),
      })
    }

    // Update amendment record
    await prisma.amendmentDocument.update({
      where: { id: amendment.id },
      data: {
        parse_status: 'COMPLETED',
        parse_error: null,
        parsed_at: new Date(),
        confidence: parsed.confidence,
        effective_date: parsed.effectiveDate
          ? new Date(parsed.effectiveDate)
          : amendment.effective_date,
      },
    })

    console.log(
      `  SUCCESS: Updated ${parsed.affectedSections.length} section changes`
    )
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.log(`  ERROR: ${errorMsg}`)

    // Update with error
    await prisma.amendmentDocument.update({
      where: { id: amendment.id },
      data: {
        parse_error: errorMsg,
        parsed_at: new Date(),
      },
    })
  }
}

async function main() {
  console.log('Re-parsing failed amendments')
  console.log(`Amendments to process: ${FAILED_AMENDMENTS.length}`)

  for (const sfs of FAILED_AMENDMENTS) {
    await reparseAmendment(sfs)
    // Rate limit pause
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  // Verify results
  console.log('\n\n' + '='.repeat(60))
  console.log('VERIFICATION')
  console.log('='.repeat(60))

  for (const sfs of FAILED_AMENDMENTS) {
    const amendment = await prisma.amendmentDocument.findUnique({
      where: { sfs_number: sfs },
      include: { section_changes: true },
    })

    if (amendment) {
      const withText = amendment.section_changes.filter(
        (c) => c.new_text
      ).length
      const total = amendment.section_changes.length
      console.log(`${sfs}: ${withText}/${total} sections have text`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
