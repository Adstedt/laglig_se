/**
 * Compare Haiku vs Sonnet accuracy for amendment parsing
 *
 * Takes 50 random documents that were parsed by Sonnet,
 * re-parses them with Haiku, and compares results.
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import Anthropic from '@anthropic-ai/sdk'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const anthropic = new Anthropic()

const SAMPLE_SIZE = 50

// Same prompt we use for Sonnet
const PARSE_PROMPT = `You are parsing a Swedish legal amendment document (ändringsförfattning).

Extract the following information from the PDF text:

1. **baseLaw**: The law being amended
   - name: The law's name (e.g., "arbetsmiljölagen", "plan- och bygglagen")
   - sfsNumber: The SFS number (e.g., "1977:1160")

2. **effectiveDate**: When the changes take effect (ISO format YYYY-MM-DD)
   - Look for "träder i kraft den X"

3. **publicationDate**: When published (ISO format YYYY-MM-DD)
   - Look for "Utfärdad den X"

4. **affectedSections**: Array of sections changed
   - chapter: Chapter number if applicable (e.g., "6" for "6 kap."), null otherwise
   - section: Section number (e.g., "17", "17a", "17 a")
   - changeType: One of "AMENDED", "REPEALED", "NEW", "RENUMBERED"
   - newText: Set to null (skip extraction)

<known_law_codes>
GRUNDLAGAR:
- riksdagsordningen: 2014:801
- regeringsformen: 1974:152
- tryckfrihetsförordningen: 1949:105
- yttrandefrihetsgrundlagen: 1991:1469

BALKAR:
- brottsbalken: 1962:700
- jordabalken: 1970:994
- ärvdabalken: 1958:637
- föräldrabalken: 1949:381
- äktenskapsbalken: 1987:230
- miljöbalken: 1998:808
- socialförsäkringsbalken: 2010:110
- skadeståndslag: 1972:207
</known_law_codes>

Return ONLY valid JSON (no markdown, no explanation):
{
  "baseLaw": { "name": "string", "sfsNumber": "string" },
  "effectiveDate": "YYYY-MM-DD or null",
  "publicationDate": "YYYY-MM-DD or null",
  "affectedSections": [
    { "chapter": "string or null", "section": "string", "changeType": "AMENDED|REPEALED|NEW|RENUMBERED", "newText": null }
  ]
}`

interface ParsedResult {
  baseLaw: { name: string; sfsNumber: string } | null
  effectiveDate: string | null
  publicationDate: string | null
  affectedSections: Array<{
    chapter: string | null
    section: string
    changeType: string
    newText: string | null
  }>
}

async function parseWithHaiku(fullText: string): Promise<ParsedResult | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `${PARSE_PROMPT}\n\n<pdf_text>\n${fullText}\n</pdf_text>`,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') return null

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    return JSON.parse(jsonMatch[0])
  } catch (error) {
    console.error('Haiku parse error:', error)
    return null
  }
}

interface ComparisonResult {
  sfsNumber: string
  sonnetSections: number
  haikuSections: number
  sectionsMatch: boolean
  baseLawMatch: boolean
  effectiveDateMatch: boolean
  details?: string
}

async function main() {
  console.log(`Comparing Haiku vs Sonnet on ${SAMPLE_SIZE} random documents\n`)

  // Get random sample of completed documents with section changes
  const docs = await prisma.amendmentDocument.findMany({
    where: {
      parse_status: 'COMPLETED',
      full_text: { not: null },
    },
    select: {
      sfs_number: true,
      full_text: true,
      base_law_sfs: true,
      effective_date: true,
      section_changes: {
        select: { chapter: true, section: true, change_type: true },
      },
    },
    orderBy: { sfs_number: 'asc' },
  })

  // Random sample
  const shuffled = docs.sort(() => Math.random() - 0.5)
  const sample = shuffled.slice(0, SAMPLE_SIZE)

  console.log(`Selected ${sample.length} documents for comparison\n`)

  const results: ComparisonResult[] = []
  let processed = 0

  for (const doc of sample) {
    processed++
    process.stdout.write(`[${processed}/${SAMPLE_SIZE}] ${doc.sfs_number}... `)

    const haikuResult = await parseWithHaiku(doc.full_text!)

    if (!haikuResult) {
      console.log('HAIKU FAILED')
      results.push({
        sfsNumber: doc.sfs_number,
        sonnetSections: doc.section_changes.length,
        haikuSections: 0,
        sectionsMatch: false,
        baseLawMatch: false,
        effectiveDateMatch: false,
        details: 'Haiku parsing failed',
      })
      continue
    }

    // Compare sections count
    const sonnetSections = doc.section_changes.length
    const haikuSections = haikuResult.affectedSections?.length || 0
    const sectionsMatch = sonnetSections === haikuSections

    // Compare base law
    const sonnetBaseLaw = doc.base_law_sfs
    const haikuBaseLaw = haikuResult.baseLaw?.sfsNumber
    const baseLawMatch = sonnetBaseLaw === haikuBaseLaw

    // Compare effective date
    const sonnetDate = doc.effective_date?.toISOString().split('T')[0]
    const haikuDate = haikuResult.effectiveDate
    const effectiveDateMatch = sonnetDate === haikuDate

    const status = sectionsMatch && baseLawMatch ? 'OK' : 'DIFF'
    console.log(`${status} (S:${sonnetSections} H:${haikuSections})`)

    results.push({
      sfsNumber: doc.sfs_number,
      sonnetSections,
      haikuSections,
      sectionsMatch,
      baseLawMatch,
      effectiveDateMatch,
    })

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200))
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('COMPARISON RESULTS')
  console.log('='.repeat(60))

  const sectionMatches = results.filter((r) => r.sectionsMatch).length
  const baseLawMatches = results.filter((r) => r.baseLawMatch).length
  const dateMatches = results.filter((r) => r.effectiveDateMatch).length
  const perfectMatches = results.filter(
    (r) => r.sectionsMatch && r.baseLawMatch && r.effectiveDateMatch
  ).length

  console.log(
    `\nSection count matches: ${sectionMatches}/${SAMPLE_SIZE} (${((sectionMatches / SAMPLE_SIZE) * 100).toFixed(1)}%)`
  )
  console.log(
    `Base law matches: ${baseLawMatches}/${SAMPLE_SIZE} (${((baseLawMatches / SAMPLE_SIZE) * 100).toFixed(1)}%)`
  )
  console.log(
    `Effective date matches: ${dateMatches}/${SAMPLE_SIZE} (${((dateMatches / SAMPLE_SIZE) * 100).toFixed(1)}%)`
  )
  console.log(
    `Perfect matches (all 3): ${perfectMatches}/${SAMPLE_SIZE} (${((perfectMatches / SAMPLE_SIZE) * 100).toFixed(1)}%)`
  )

  // Show mismatches
  const mismatches = results.filter((r) => !r.sectionsMatch || !r.baseLawMatch)
  if (mismatches.length > 0) {
    console.log('\nMismatches:')
    mismatches.slice(0, 10).forEach((m) => {
      console.log(
        `  ${m.sfsNumber}: sections S:${m.sonnetSections} H:${m.haikuSections}, baseLaw:${m.baseLawMatch ? 'OK' : 'DIFF'}`
      )
    })
    if (mismatches.length > 10) {
      console.log(`  ... and ${mismatches.length - 10} more`)
    }
  }

  // Cost comparison
  console.log('\n' + '='.repeat(60))
  console.log('COST COMPARISON (estimated for 10,074 docs)')
  console.log('='.repeat(60))
  console.log('Sonnet batch: ~$150 (what we paid)')
  console.log('Haiku batch:  ~$15 (10x cheaper)')
  console.log('Haiku real-time: ~$30 (5x cheaper than Sonnet batch)')

  await prisma.$disconnect()
}

main().catch(console.error)
